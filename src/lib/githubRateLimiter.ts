/**
 * Token-scoped GitHub GraphQL rate-limit transport.
 *
 * This module owns everything about *how* a request is sent to GitHub once the
 * caller has decided *what* to send: per-account queueing, pacing of mutations,
 * primary/secondary rate-limit classification, and bounded retry/backoff.
 *
 * It is intentionally free of any UI, React, i18n, or dashboard imports — it is
 * a pure transport layer. Callers receive either parsed JSON or one of the
 * typed errors below, and decide how to surface them.
 */

// ---- Typed errors -----------------------------------------------------------

/** Base class so callers can `instanceof GitHubTransportError` for any of ours. */
export class GitHubTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitHubTransportError';
  }
}

/** Primary rate limit: budget exhausted (remaining 0), recoverable after reset. */
export class GitHubRateLimitError extends GitHubTransportError {
  /** Epoch ms when the limit is expected to reset, if known. */
  readonly resetAtMs?: number;
  constructor(message: string, resetAtMs?: number) {
    super(message);
    this.name = 'GitHubRateLimitError';
    this.resetAtMs = resetAtMs;
  }
}

/** Secondary / abuse rate limit. Retrying aggressively makes it worse. */
export class GitHubSecondaryRateLimitError extends GitHubTransportError {
  /** Suggested wait in ms (from Retry-After), if provided. */
  readonly retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'GitHubSecondaryRateLimitError';
    this.retryAfterMs = retryAfterMs;
  }
}

/** Any other non-2xx / network failure that isn't a rate limit. */
export class GitHubRequestFailedError extends GitHubTransportError {
  readonly status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GitHubRequestFailedError';
    this.status = status;
  }
}

/** True for any of the rate-limit error types (primary or secondary). */
export function isGitHubRateLimitError(
  error: unknown
): error is GitHubRateLimitError | GitHubSecondaryRateLimitError {
  return (
    error instanceof GitHubRateLimitError ||
    error instanceof GitHubSecondaryRateLimitError
  );
}

// ---- Public option / state types -------------------------------------------

export interface FetchGitHubGraphQLOptions {
  operationType?: 'query' | 'mutation';
  priority?: 'foreground' | 'background';
  /** Max total wait (ms) a foreground caller will tolerate before giving up. */
  maxWaitMs?: number;
  signal?: AbortSignal;
  /** Reserved for read dedupe (handled in the service layer). */
  dedupeKey?: string;
}

export interface RateLimitState {
  limit?: number;
  remaining?: number;
  used?: number;
  /** Epoch ms. */
  resetAtMs?: number;
}

/** What the transport needs from a single HTTP attempt. Injected so tests and
 *  the service layer can supply their own fetch + mock handling. */
export interface GraphQLRequest {
  query: string;
  variables: Record<string, unknown>;
  token: string;
}

export type GraphQLResponseJson = {
  data?: unknown;
  errors?: Array<{ message?: string; type?: string }>;
};

// ---- Tunables ---------------------------------------------------------------

export const RATE_LIMIT_TUNABLES = {
  /** Minimum gap between mutative requests for one token. */
  mutationPacingMs: 1000,
  /** Reads allowed to run at once per token. */
  readConcurrency: 4,
  /** Default ceiling on how long a foreground op will wait across retries. */
  defaultForegroundMaxWaitMs: 25_000,
  /** Secondary-limit wait when no Retry-After/reset is provided. */
  secondaryFallbackWaitMs: 60_000,
  /** Hard cap on retry attempts regardless of priority. */
  maxRetries: 5,
  /** Random jitter added to computed waits to avoid thundering herds. */
  maxJitterMs: 500,
};

// ---- Header parsing & classification ---------------------------------------

function toInt(value: string | null): number | undefined {
  if (value == null) return undefined;
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : undefined;
}

export function parseRateLimitHeaders(headers: Headers): RateLimitState {
  const resetSec = toInt(headers.get('x-ratelimit-reset'));
  return {
    limit: toInt(headers.get('x-ratelimit-limit')),
    remaining: toInt(headers.get('x-ratelimit-remaining')),
    used: toInt(headers.get('x-ratelimit-used')),
    resetAtMs: resetSec != null ? resetSec * 1000 : undefined,
  };
}

function parseRetryAfterMs(headers: Headers): number | undefined {
  const raw = headers.get('retry-after');
  if (!raw) return undefined;
  const seconds = parseInt(raw, 10);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const dateMs = Date.parse(raw);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - Date.now()) : undefined;
}

const SECONDARY_LIMIT_PATTERN = /secondary rate limit|abuse detection|retry your request/i;
const PRIMARY_LIMIT_PATTERN = /rate limit/i;

export interface ClassifiedResponse {
  kind: 'ok' | 'primary' | 'secondary' | 'failed';
  json?: GraphQLResponseJson;
  error?: GitHubTransportError;
}

/**
 * Classify a completed HTTP attempt. Handles GitHub's quirks: the primary
 * GraphQL limit can return HTTP 200 with an `errors` body and
 * `x-ratelimit-remaining: 0`; the secondary limit can return 200 or 403.
 */
export function classifyResponse(
  status: number,
  headers: Headers,
  bodyText: string
): ClassifiedResponse {
  const rl = parseRateLimitHeaders(headers);
  const retryAfterMs = parseRetryAfterMs(headers);

  let json: GraphQLResponseJson | undefined;
  try {
    json = bodyText ? (JSON.parse(bodyText) as GraphQLResponseJson) : undefined;
  } catch {
    json = undefined;
  }

  const bodyMentionsSecondary =
    SECONDARY_LIMIT_PATTERN.test(bodyText) ||
    (json?.errors?.some((e) => e.type === 'RATE_LIMITED' && SECONDARY_LIMIT_PATTERN.test(e.message || '')) ??
      false);

  // Secondary limit: 403/429 or any status whose body says so.
  if ((status === 403 || status === 429 || bodyMentionsSecondary) && (bodyMentionsSecondary || status === 429)) {
    return {
      kind: 'secondary',
      json,
      error: new GitHubSecondaryRateLimitError(
        'GitHub secondary rate limit hit',
        retryAfterMs
      ),
    };
  }

  // Primary limit: explicit 403 rate-limit text, OR HTTP 200 with errors and
  // remaining === 0.
  const graphqlRateLimited =
    json?.errors?.some((e) => e.type === 'RATE_LIMITED') ?? false;
  const exhausted = rl.remaining === 0;
  const bodyMentionsPrimary = PRIMARY_LIMIT_PATTERN.test(bodyText);

  if (
    (status === 403 && bodyMentionsPrimary) ||
    graphqlRateLimited ||
    (exhausted && (json?.errors?.length || status === 403))
  ) {
    return {
      kind: 'primary',
      json,
      error: new GitHubRateLimitError(
        'GitHub primary rate limit exceeded',
        rl.resetAtMs
      ),
    };
  }

  if (status < 200 || status >= 300) {
    return {
      kind: 'failed',
      json,
      error: new GitHubRequestFailedError(
        `GitHub API error: ${status} ${bodyText.slice(0, 200)}`,
        status
      ),
    };
  }

  return { kind: 'ok', json };
}

// ---- Wait helpers -----------------------------------------------------------

function jitter(): number {
  return Math.floor(Math.random() * RATE_LIMIT_TUNABLES.maxJitterMs);
}

export function computeWaitMs(error: GitHubTransportError, now: number): number {
  if (error instanceof GitHubSecondaryRateLimitError) {
    return (
      (error.retryAfterMs ?? RATE_LIMIT_TUNABLES.secondaryFallbackWaitMs) +
      jitter()
    );
  }
  if (error instanceof GitHubRateLimitError) {
    if (error.resetAtMs && error.resetAtMs > now) {
      return error.resetAtMs - now + jitter();
    }
    return RATE_LIMIT_TUNABLES.secondaryFallbackWaitMs + jitter();
  }
  return 0;
}

/** Abortable delay. Rejects with an AbortError if the signal fires first. */
export function delay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// ---- Per-token limiter ------------------------------------------------------

interface TokenLane {
  /** Promise chain tail for mutations (serialized + paced). */
  mutationTail: Promise<void>;
  /** Timestamp of the last mutation dispatch, for pacing. */
  lastMutationAt: number;
  /** Active read count for concurrency limiting. */
  activeReads: number;
  /** Pending read resolvers waiting for a concurrency slot. */
  readWaiters: Array<() => void>;
  state: RateLimitState;
}

/**
 * Stable per-token key. We never store or log raw tokens beyond the last 4
 * chars (matching the existing service logging), so the key is a short suffix
 * plus length to keep collisions astronomically unlikely without exposing the
 * secret.
 */
export function tokenKey(token: string): string {
  return `${token.length}:${token.slice(-4)}`;
}

export class GitHubRateLimiter {
  private lanes = new Map<string, TokenLane>();

  private lane(token: string): TokenLane {
    const key = tokenKey(token);
    let lane = this.lanes.get(key);
    if (!lane) {
      lane = {
        mutationTail: Promise.resolve(),
        lastMutationAt: 0,
        activeReads: 0,
        readWaiters: [],
        state: {},
      };
      this.lanes.set(key, lane);
    }
    return lane;
  }

  getState(token: string): RateLimitState {
    return { ...this.lane(token).state };
  }

  recordState(token: string, state: RateLimitState) {
    const lane = this.lane(token);
    lane.state = { ...lane.state, ...state };
  }

  /** Test/diagnostic helper. */
  reset() {
    this.lanes.clear();
  }

  /** Acquire a slot appropriate to the operation type, run `task`, release. */
  async schedule<T>(
    token: string,
    operationType: 'query' | 'mutation',
    task: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    if (operationType === 'mutation') {
      return this.scheduleMutation(token, task, signal);
    }
    return this.scheduleRead(token, task);
  }

  private async scheduleMutation<T>(
    token: string,
    task: () => Promise<T>,
    signal?: AbortSignal
  ): Promise<T> {
    const lane = this.lane(token);
    let release!: () => void;
    const prior = lane.mutationTail;
    lane.mutationTail = new Promise<void>((res) => {
      release = res;
    });

    await prior;
    try {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      const sinceLast = Date.now() - lane.lastMutationAt;
      const wait = RATE_LIMIT_TUNABLES.mutationPacingMs - sinceLast;
      if (wait > 0) await delay(wait, signal);
      lane.lastMutationAt = Date.now();
      return await task();
    } finally {
      release();
    }
  }

  private async scheduleRead<T>(token: string, task: () => Promise<T>): Promise<T> {
    const lane = this.lane(token);
    if (lane.activeReads >= RATE_LIMIT_TUNABLES.readConcurrency) {
      await new Promise<void>((res) => lane.readWaiters.push(res));
    }
    lane.activeReads++;
    try {
      return await task();
    } finally {
      lane.activeReads--;
      const next = lane.readWaiters.shift();
      if (next) next();
    }
  }
}

/** Shared singleton used by the service layer. */
export const githubRateLimiter = new GitHubRateLimiter();
