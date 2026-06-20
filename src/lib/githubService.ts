import { GITHUB_GRAPHQL_API_URL } from './constants';
import { handleMockGraphQL, MOCK_TOKEN, type MockVariables } from './githubMock';
import {
  githubRateLimiter,
  classifyResponse,
  computeWaitMs,
  delay,
  isGitHubRateLimitError,
  GitHubTransportError,
  RATE_LIMIT_TUNABLES,
  tokenKey,
  type FetchGitHubGraphQLOptions,
  type GraphQLResponseJson,
} from './githubRateLimiter';
import { githubReadCache, READ_CACHE_TTL } from './githubReadCache';
import {
  GET_REPOSITORY_ID_QUERY,
  CREATE_ISSUE_MUTATION,
  ADD_PROJECT_ITEM_MUTATION,
  ADD_DRAFT_ISSUE_MUTATION,
  UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION,
  CLEAR_PROJECT_ITEM_FIELD_VALUE_MUTATION,
  UPDATE_PROJECT_ITEM_POSITION_MUTATION,
  CREATE_PROJECT_V2_FIELD_MUTATION
} from './githubQueries';

export {
  isGitHubRateLimitError,
  GitHubRateLimitError,
  GitHubSecondaryRateLimitError,
  GitHubRequestFailedError,
  GitHubTransportError,
} from './githubRateLimiter';
export type { FetchGitHubGraphQLOptions } from './githubRateLimiter';

/**
 * Kill-switch: when false (set `VITE_GITHUB_RATE_LIMITER` to "off"), the legacy
 * raw-fetch path is used so the new transport limiter can be disabled in case of
 * a regression. Defaults to enabled.
 */
const RATE_LIMITER_ENABLED =
  import.meta.env.VITE_GITHUB_RATE_LIMITER !== 'off';

/** Heuristic: GraphQL operations starting with `mutation` mutate state. */
function inferOperationType(query: string): 'query' | 'mutation' {
  return /^\s*mutation\b/.test(query) ? 'mutation' : 'query';
}

function shouldUseMock(token: string, variables: Record<string, unknown>): boolean {
  return (
    token === MOCK_TOKEN ||
    (typeof variables.projectId === 'string' &&
      (variables.projectId === 'PVT_2' || variables.projectId === 'PVT_3')) ||
    (typeof variables.itemId === 'string' && variables.itemId.startsWith('item-'))
  );
}

/** In-flight read dedupe: identical concurrent reads share one promise. */
const inFlightReads = new Map<string, Promise<GraphQLResponseJson>>();

async function performSingleAttempt(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  signal?: AbortSignal
): Promise<GraphQLResponseJson> {
  const res = await fetch(GITHUB_GRAPHQL_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
    signal,
  });

  const bodyText = await res.text();
  const classified = classifyResponse(res.status, res.headers, bodyText);
  // Record the latest budget for this token regardless of outcome.
  githubRateLimiter.recordState(token, parseStateFromHeaders(res.headers));

  if (classified.kind === 'ok') {
    const data = classified.json ?? {};
    if (data.errors) {
      console.warn(
        `[GitHubAPI] ⚠️ GraphQL Errors for query ${query.slice(0, 50)}...`,
        data.errors
      );
    }
    return data;
  }
  // Throw the typed error; the retry loop decides what to do.
  throw classified.error as GitHubTransportError;
}

function parseStateFromHeaders(headers: Headers) {
  const resetSec = headers.get('x-ratelimit-reset');
  const toInt = (v: string | null) =>
    v == null ? undefined : Number.isFinite(parseInt(v, 10)) ? parseInt(v, 10) : undefined;
  return {
    limit: toInt(headers.get('x-ratelimit-limit')),
    remaining: toInt(headers.get('x-ratelimit-remaining')),
    used: toInt(headers.get('x-ratelimit-used')),
    resetAtMs: resetSec ? parseInt(resetSec, 10) * 1000 : undefined,
  };
}

/**
 * Send a GitHub GraphQL request through the token-scoped rate-limit transport.
 *
 * Returns parsed JSON on success. On rate-limit exhaustion that cannot be
 * resolved within the (foreground) wait budget, throws a typed
 * `GitHubRateLimitError` / `GitHubSecondaryRateLimitError`; other failures throw
 * `GitHubRequestFailedError`. Mock requests bypass the limiter entirely.
 */
export async function fetchGitHubGraphQL(
  query: string,
  variables: Record<string, unknown> = {},
  token: string,
  options: FetchGitHubGraphQLOptions = {}
) {
  if (shouldUseMock(token, variables)) {
    return handleMockGraphQL(query, variables as MockVariables);
  }

  if (!RATE_LIMITER_ENABLED) {
    // Legacy raw-fetch path (kill-switch engaged).
    return legacyFetch(query, variables, token);
  }

  const operationType = options.operationType ?? inferOperationType(query);
  const priority = options.priority ?? 'foreground';
  const maxWaitMs =
    options.maxWaitMs ??
    (priority === 'foreground'
      ? RATE_LIMIT_TUNABLES.defaultForegroundMaxWaitMs
      : Number.POSITIVE_INFINITY);

  // Read dedupe (queries only, when a dedupeKey is supplied).
  const dedupeKey =
    operationType === 'query' && options.dedupeKey
      ? `${tokenKey(token)}:${options.dedupeKey}`
      : undefined;
  if (dedupeKey && inFlightReads.has(dedupeKey)) {
    return inFlightReads.get(dedupeKey)!;
  }

  const run = githubRateLimiter.schedule(
    token,
    operationType,
    () => runWithRetry(query, variables, token, operationType, priority, maxWaitMs, options.signal),
    options.signal
  );

  if (dedupeKey) {
    inFlightReads.set(dedupeKey, run as Promise<GraphQLResponseJson>);
    try {
      return await run;
    } finally {
      inFlightReads.delete(dedupeKey);
    }
  }
  return run;
}

async function runWithRetry(
  query: string,
  variables: Record<string, unknown>,
  token: string,
  operationType: 'query' | 'mutation',
  priority: 'foreground' | 'background',
  maxWaitMs: number,
  signal?: AbortSignal
): Promise<GraphQLResponseJson> {
  console.log(
    `[GitHubAPI] ${operationType}/${priority} token(${token.slice(-4)}) remaining=${githubRateLimiter.getState(token).remaining ?? '?'}`
  );
  const startedAt = Date.now();
  let attempt = 0;

  for (;;) {
    try {
      return await performSingleAttempt(query, variables, token, signal);
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error;

      if (!isGitHubRateLimitError(error)) {
        // Non-rate-limit failure: surface immediately.
        console.error('[GitHubAPI] ❌ request failed:', error);
        throw error;
      }

      attempt++;
      const now = Date.now();
      const waitMs = computeWaitMs(error as GitHubTransportError, now);
      const elapsed = now - startedAt;

      const exceedsBudget = elapsed + waitMs > maxWaitMs;
      const exceedsAttempts = attempt > RATE_LIMIT_TUNABLES.maxRetries;

      if (exceedsBudget || exceedsAttempts) {
        console.warn(
          `[GitHubAPI] ⏳ rate limited; giving up after attempt ${attempt} (waitMs=${waitMs}, elapsed=${elapsed}, budget=${maxWaitMs})`
        );
        throw error;
      }

      console.warn(
        `[GitHubAPI] ⏳ rate limited (${(error as Error).name}); waiting ${waitMs}ms before retry ${attempt}`
      );
      await delay(waitMs, signal);
    }
  }
}

/** Legacy behavior used only when the kill-switch disables the limiter. */
async function legacyFetch(
  query: string,
  variables: Record<string, unknown>,
  token: string
) {
  try {
    console.log('[GitHubAPI] (legacy) Executing GraphQL query with token (last 4):', token.slice(-4));
    const res = await fetch(GITHUB_GRAPHQL_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error(`[GitHubAPI] ❌ Error: ${res.status}`, errorText);
      throw new Error(`GitHub API error: ${res.status} ${errorText}`);
    }

    const data = await res.json();
    if (data.errors) {
      console.warn(`[GitHubAPI] ⚠️ GraphQL Errors for query ${query.slice(0, 50)}...`, data.errors);
    }
    return data;
  } catch (error: unknown) {
    console.error('Fetch GitHub GraphQL failed:', error);
    throw error;
  }
}

/**
 * Check if a token is a mock token.
 */
export function isMockToken(token: string): boolean {
  return token === MOCK_TOKEN;
}

// ---- High-level helpers ----

export async function getRepositoryId(owner: string, name: string, token: string): Promise<string | null> {
  // Repository node IDs are effectively immutable; cache by owner/name/token so
  // repeated task creations don't re-query.
  const key = `repoId:${tokenKey(token)}:${owner}/${name}`;
  return githubReadCache.get(key, READ_CACHE_TTL.repositoryId, async () => {
    const json = await fetchGitHubGraphQL(GET_REPOSITORY_ID_QUERY, { owner, name }, token);
    return (json.data as { repository?: { id?: string } })?.repository?.id || null;
  });
}

export async function createGitHubIssue(repositoryId: string, title: string, body: string | undefined, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(CREATE_ISSUE_MUTATION, { repositoryId, title, body }, token);
  return json.data?.createIssue?.issue?.id || null;
}

export async function addProjectV2Item(projectId: string, contentId: string, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(ADD_PROJECT_ITEM_MUTATION, { projectId, contentId }, token);
  return json.data?.addProjectV2ItemById?.item?.id || null;
}

export async function addProjectV2DraftIssue(projectId: string, title: string, body: string | undefined, token: string): Promise<string | null> {
  const json = await fetchGitHubGraphQL(ADD_DRAFT_ISSUE_MUTATION, { projectId, title, body }, token);
  return json.data?.addProjectV2DraftIssue?.projectItem?.id || null;
}

export async function updateProjectV2ItemField(projectId: string, itemId: string, fieldId: string, value: unknown, token: string): Promise<boolean> {
  try {
    console.log('[GitHubAPI] Executing GraphQL query with token (last 4):', token.slice(-4));
    const res = await fetchGitHubGraphQL(UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, { projectId, itemId, fieldId, value }, token);
    if (res.errors) {
      console.error('Update field failed:', res.errors);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Update field failed:', e);
    return false;
  }
}

export async function clearProjectV2ItemField(projectId: string, itemId: string, fieldId: string, token: string): Promise<boolean> {
  try {
    console.log('[GitHubAPI] Executing GraphQL query with token (last 4):', token.slice(-4));
    const res = await fetchGitHubGraphQL(CLEAR_PROJECT_ITEM_FIELD_VALUE_MUTATION, { projectId, itemId, fieldId }, token);
    if (res.errors) {
      console.error('Clear field failed:', res.errors);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Clear field failed:', e);
    return false;
  }
}

/**
 * One project item, several field writes, one HTTP request.
 *
 * Builds an aliased GraphQL mutation that runs each field update (or clear) as a
 * separate top-level field on the same request, so multi-field saves (e.g. start
 * date + target date + estimate + unit) cost a single round trip instead of one
 * per field. Returns true only if every sub-mutation reported no error.
 *
 * Order of the supplied changes is preserved in the alias order; GitHub executes
 * top-level mutation fields serially in document order.
 */
export type ProjectV2FieldWrite =
  | { kind: 'set'; fieldId: string; value: unknown; name?: string }
  | { kind: 'clear'; fieldId: string; name?: string };

interface GraphQLErrorLike {
  message?: string;
}

interface BatchUpdateProjectV2ItemFieldsOptions {
  issueId?: string;
}

const UPDATE_ISSUE_FIELD_VALUE_MUTATION = `
mutation UpdateIssueFieldValue($issueId: ID!, $issueField: IssueFieldCreateOrUpdateInput!) {
  updateIssueFieldValue(input: { issueId: $issueId, issueField: $issueField }) {
    issue { id }
  }
}`;

/**
 * Some ProjectV2 fields (e.g. the org-level `Start date` / `Target date`) are
 * actually backed by repository-level *issue fields*. They appear in the project
 * metadata with a `PVTF_…` id, but GitHub rejects writes through
 * `updateProjectV2ItemFieldValue` for them and demands `updateIssueFieldValue`,
 * which only accepts the backing issue-field id (`IFD_…`, `IFSS_…`, …).
 *
 * This query lists the issue-field definitions for the issue's repository so we
 * can resolve the backing id by name + data type.
 */
const GET_ISSUE_FIELDS_QUERY = `
query IssueFields($issueId: ID!) {
  node(id: $issueId) {
    ... on Issue {
      repository {
        id
        issueFields(first: 50) {
          nodes {
            ... on Node { id }
            ... on IssueFieldCommon { name dataType }
          }
        }
      }
    }
  }
}`;

interface IssueFieldDefinition {
  id: string;
  name: string;
  dataType: string;
}

function isIssueFieldUpdateRequired(errors: unknown): boolean {
  return Array.isArray(errors) && errors.some((error: GraphQLErrorLike) =>
    typeof error?.message === 'string' &&
    error.message.includes('Issue field values cannot be updated') &&
    error.message.includes('updateIssueFieldValue')
  );
}

/** Map a ProjectV2 field value/clear to the issue-field data type used for matching. */
function issueFieldDataType(change: ProjectV2FieldWrite): string | null {
  if (change.kind === 'clear') return null;
  const value = change.value as Record<string, unknown>;
  if (typeof value.date === 'string') return 'DATE';
  if (typeof value.number === 'number') return 'NUMBER';
  if (typeof value.text === 'string') return 'TEXT';
  // Single-select option ids differ between project and issue fields, so the
  // issue-field fallback intentionally does not handle them.
  return null;
}

/** Translate a project field write into the `IssueFieldCreateOrUpdateInput` shape. */
function toIssueFieldInput(change: ProjectV2FieldWrite, issueFieldId: string): Record<string, unknown> | null {
  if (change.kind === 'clear') {
    return { fieldId: issueFieldId, delete: true };
  }

  const value = change.value as Record<string, unknown>;
  const issueField: Record<string, unknown> = { fieldId: issueFieldId };

  if (typeof value.date === 'string') {
    issueField.dateValue = value.date;
  } else if (typeof value.number === 'number') {
    issueField.numberValue = value.number;
  } else if (typeof value.text === 'string') {
    issueField.textValue = value.text;
  } else {
    return null;
  }

  return issueField;
}

/** Fetch (and cache) the issue-field definitions for the issue's repository. */
async function getIssueFieldDefinitions(issueId: string, token: string): Promise<IssueFieldDefinition[]> {
  const key = `issueFields:${tokenKey(token)}:${issueId}`;
  return githubReadCache.get(key, READ_CACHE_TTL.issueFields, async () => {
    const json = await fetchGitHubGraphQL(GET_ISSUE_FIELDS_QUERY, { issueId }, token);
    const nodes =
      (json.data as { node?: { repository?: { issueFields?: { nodes?: unknown[] } } } })
        ?.node?.repository?.issueFields?.nodes ?? [];
    return nodes
      .filter((node): node is IssueFieldDefinition =>
        typeof (node as IssueFieldDefinition)?.id === 'string' &&
        typeof (node as IssueFieldDefinition)?.name === 'string')
      .map((node) => ({ id: node.id, name: node.name, dataType: node.dataType }));
  });
}

/**
 * Resolve the backing issue-field id for a project field change by matching on
 * the field name (and data type, when known). Returns null when no unambiguous
 * match exists.
 */
async function resolveIssueFieldId(
  issueId: string,
  name: string | undefined,
  dataType: string | null,
  token: string
): Promise<string | null> {
  if (!name) return null;
  const definitions = await getIssueFieldDefinitions(issueId, token);
  const targetName = name.trim().toLowerCase();
  const matches = definitions.filter(
    (def) =>
      def.name.trim().toLowerCase() === targetName &&
      (dataType ? def.dataType === dataType : true)
  );
  if (matches.length !== 1) return null;
  return matches[0].id;
}

/** Resolve the backing issue-field id for a change (matched by name + data type). */
async function resolveIssueFieldIdForChange(issueId: string, change: ProjectV2FieldWrite, token: string): Promise<string | null> {
  // For a clear we have no value to infer the type from, so match by name only.
  const dataType = change.kind === 'clear' ? null : issueFieldDataType(change);
  if (change.kind === 'set' && !dataType) return null; // unsupported value shape (e.g. single-select)
  return resolveIssueFieldId(issueId, change.name, dataType, token);
}

async function updateIssueFieldValueById(
  issueId: string,
  change: ProjectV2FieldWrite,
  issueFieldId: string,
  token: string
): Promise<boolean> {
  const issueField = toIssueFieldInput(change, issueFieldId);
  if (!issueField) {
    console.error('Issue field update failed: unsupported value shape', change);
    return false;
  }

  try {
    const res = await fetchGitHubGraphQL(
      UPDATE_ISSUE_FIELD_VALUE_MUTATION,
      { issueId, issueField },
      token,
      { operationType: 'mutation' }
    );
    if (res.errors) {
      console.error('Issue field update failed:', res.errors);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Issue field update failed:', e);
    return false;
  }
}

/**
 * Apply a single field write, preferring `updateIssueFieldValue` when the field
 * is backed by a repository issue field (resolved by name + data type) and
 * otherwise using the plain ProjectV2 mutation. Used as the per-field fallback
 * after a batched ProjectV2 write is rejected for touching issue-backed fields.
 */
async function applyFieldWriteWithIssueFallback(
  projectId: string,
  itemId: string,
  change: ProjectV2FieldWrite,
  token: string,
  issueId: string
): Promise<boolean> {
  const issueFieldId = await resolveIssueFieldIdForChange(issueId, change, token);
  if (issueFieldId) {
    return updateIssueFieldValueById(issueId, change, issueFieldId, token);
  }

  // Not an issue-backed field (or unsupported shape): plain ProjectV2 write.
  const res = await runProjectFieldWrites(projectId, itemId, [change], token);
  if (!res.ok) console.error('Update field failed:', res.errors);
  return res.ok;
}

/**
 * Perform the field writes via the plain ProjectV2 mutations (single field or
 * one aliased multi-field request). Returns the GraphQL errors (if any) so the
 * caller can decide whether an issue-field fallback is warranted.
 */
async function runProjectFieldWrites(
  projectId: string,
  itemId: string,
  changes: ProjectV2FieldWrite[],
  token: string
): Promise<{ ok: boolean; errors?: unknown }> {
  try {
    if (changes.length === 1) {
      // No benefit to aliasing a single change; use the simple named mutation.
      const only = changes[0];
      const res = only.kind === 'clear'
        ? await fetchGitHubGraphQL(CLEAR_PROJECT_ITEM_FIELD_VALUE_MUTATION, { projectId, itemId, fieldId: only.fieldId }, token, { operationType: 'mutation' })
        : await fetchGitHubGraphQL(UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, { projectId, itemId, fieldId: only.fieldId, value: only.value }, token, { operationType: 'mutation' });
      if (res.errors) return { ok: false, errors: res.errors };
      return { ok: true };
    }

    // Build variable declarations + aliased mutation fields so multi-field saves
    // cost a single round trip.
    const varDecls: string[] = ['$projectId: ID!', '$itemId: ID!'];
    const fields: string[] = [];
    const variables: Record<string, unknown> = { projectId, itemId };

    changes.forEach((change, i) => {
      const fieldVar = `fieldId${i}`;
      varDecls.push(`$${fieldVar}: ID!`);
      variables[fieldVar] = change.fieldId;

      if (change.kind === 'clear') {
        fields.push(
          `c${i}: clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $${fieldVar} }) { projectV2Item { id } }`
        );
      } else {
        const valueVar = `value${i}`;
        varDecls.push(`$${valueVar}: ProjectV2FieldValue!`);
        variables[valueVar] = change.value;
        fields.push(
          `u${i}: updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $${fieldVar}, value: $${valueVar} }) { projectV2Item { id } }`
        );
      }
    });

    const mutation = `mutation BatchUpdateFields(${varDecls.join(', ')}) {\n  ${fields.join('\n  ')}\n}`;
    const res = await fetchGitHubGraphQL(mutation, variables, token, { operationType: 'mutation' });
    if (res.errors) return { ok: false, errors: res.errors };
    return { ok: true };
  } catch (e) {
    console.error('Batch field update failed:', e);
    return { ok: false };
  }
}

export async function batchUpdateProjectV2ItemFields(
  projectId: string,
  itemId: string,
  changes: ProjectV2FieldWrite[],
  token: string,
  options: BatchUpdateProjectV2ItemFieldsOptions = {}
): Promise<boolean> {
  if (changes.length === 0) return true;

  const plain = await runProjectFieldWrites(projectId, itemId, changes, token);
  if (plain.ok) return true;

  // Some fields (org-level Start/Target date) are issue-backed and reject the
  // ProjectV2 mutation. Retry each change individually, falling back to
  // updateIssueFieldValue for the ones GitHub demands it for. The plain set
  // mutations are idempotent, so re-applying the non-issue fields is safe.
  if (options.issueId && isIssueFieldUpdateRequired(plain.errors)) {
    const issueId = options.issueId;
    for (const change of changes) {
      const ok = await applyFieldWriteWithIssueFallback(projectId, itemId, change, token, issueId);
      if (!ok) return false;
    }
    return true;
  }

  console.error('Batch field update failed:', plain.errors);
  return false;
}

export async function updateProjectV2ItemPosition(projectId: string, itemId: string, afterId: string | null, token: string): Promise<boolean> {
  try {
    console.log('[GitHubAPI] Executing GraphQL query with token (last 4):', token.slice(-4));
    const res = await fetchGitHubGraphQL(UPDATE_PROJECT_ITEM_POSITION_MUTATION, { projectId, itemId, afterId }, token);
    if (res.errors) {
      console.error('Update item position failed:', res.errors);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Update item position failed:', e);
    return false;
  }
}

export async function createProjectV2Field(projectId: string, name: string, dataType: string, token: string, singleSelectOptions?: { name: string; description: string; color: string }[]): Promise<string | null> {
  try {
    const variables: Record<string, unknown> = { projectId, name, dataType };
    if (singleSelectOptions) {
      variables.singleSelectOptions = singleSelectOptions;
    }
    const json = await fetchGitHubGraphQL(CREATE_PROJECT_V2_FIELD_MUTATION, variables, token);
    if (json.errors) {
      console.error('Create field failed:', json.errors);
      return null;
    }
    return json.data?.createProjectV2Field?.projectV2Field?.id || null;
  } catch (e) {
    console.error('Create field failed:', e);
    return null;
  }
}
