// ========================================
// GitHub webhook sync event normalization and dedupe helpers.
//
// The webhook handler (api/github-webhook.ts) broadcasts the same payload to
// up to three Supabase channels (project, repo, owner). These helpers turn
// any channel's raw broadcast into one internal event shape, decide whether
// it belongs to the selected project, and suppress redundant duplicates.
// ========================================

export type GithubSyncBroadcastEvent = 'sync' | 'refresh_task' | 'reorder';
export type GithubSyncEventKind = 'full_project' | 'single_task' | 'reorder';

export interface NormalizedGithubSyncEvent {
  kind: GithubSyncEventKind;
  channelLabel: string;
  projectId?: string;
  itemId?: string;
  contentId?: string;
  action?: string;
  sourceEvent?: string;
  deliveryId?: string;
  timestamp?: number;
  receivedAt: number;
}

const KIND_BY_BROADCAST_EVENT: Record<GithubSyncBroadcastEvent, GithubSyncEventKind> = {
  sync: 'full_project',
  refresh_task: 'single_task',
  reorder: 'reorder',
};

interface RawSyncPayloadFields {
  deliveryId?: unknown;
  sourceEvent?: unknown;
  action?: unknown;
  projectId?: unknown;
  itemId?: unknown;
  contentId?: unknown;
  timestamp?: unknown;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function asOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/**
 * Normalizes a Supabase broadcast payload (which may or may not be wrapped in
 * a `{ payload }` envelope depending on the channel/client version) into one
 * internal event shape, regardless of which channel delivered it.
 */
export function normalizeGithubSyncPayload(
  broadcastEvent: GithubSyncBroadcastEvent,
  rawPayload: unknown,
  channelLabel: string,
  now = Date.now()
): NormalizedGithubSyncEvent {
  const wrapper = rawPayload as { payload?: unknown } | null | undefined;
  const unwrapped = wrapper && typeof wrapper === 'object' && 'payload' in wrapper && wrapper.payload
    ? wrapper.payload
    : rawPayload;
  const data = (unwrapped && typeof unwrapped === 'object' ? unwrapped : {}) as RawSyncPayloadFields;

  return {
    kind: KIND_BY_BROADCAST_EVENT[broadcastEvent],
    channelLabel,
    projectId: asOptionalString(data.projectId),
    itemId: asOptionalString(data.itemId),
    contentId: asOptionalString(data.contentId),
    action: asOptionalString(data.action),
    sourceEvent: asOptionalString(data.sourceEvent),
    deliveryId: asOptionalString(data.deliveryId),
    timestamp: asOptionalNumber(data.timestamp),
    receivedAt: now,
  };
}

/**
 * Centralized project filtering.
 *
 * A present-but-different projectId proves the event is for another project.
 * A missing projectId (e.g. `issues` webhooks carry no project information)
 * can only be treated as "possibly ours": membership can be confirmed later
 * via a contentId lookup, but never denied from the payload alone.
 */
export function isEventForSelectedProject(
  event: Pick<NormalizedGithubSyncEvent, 'projectId'>,
  selectedProjectId: string
): boolean {
  if (!event.projectId) return true;
  return event.projectId === selectedProjectId;
}

/**
 * Stable fingerprint for short-lived duplicate suppression. Redundant
 * broadcasts of one webhook delivery share the same `deliveryId` (or, for
 * older payload shapes, the same server-side `timestamp`), so identical
 * fingerprints arriving on different channels identify the same delivery.
 */
export function getSyncEventFingerprint(
  event: Pick<NormalizedGithubSyncEvent, 'kind' | 'action' | 'itemId' | 'contentId' | 'deliveryId' | 'timestamp'>
): string {
  if (event.deliveryId) {
    return `${event.deliveryId}:${event.kind}`;
  }
  return [
    event.kind,
    event.action || '',
    event.itemId || event.contentId || 'project',
    event.timestamp !== undefined ? String(event.timestamp) : '',
  ].join(':');
}

export interface SyncEventDeduper {
  /** Returns true the first time a fingerprint is seen within the TTL window. */
  shouldProcess: (fingerprint: string, now?: number) => boolean;
}

export const DEFAULT_SYNC_EVENT_DEDUPE_TTL_MS = 10_000;

export function createSyncEventDeduper(ttlMs = DEFAULT_SYNC_EVENT_DEDUPE_TTL_MS): SyncEventDeduper {
  const seenAt = new Map<string, number>();

  return {
    shouldProcess: (fingerprint, now = Date.now()) => {
      for (const [key, at] of seenAt.entries()) {
        if (now - at > ttlMs) {
          seenAt.delete(key);
        }
      }
      if (seenAt.has(fingerprint)) {
        return false;
      }
      seenAt.set(fingerprint, now);
      return true;
    },
  };
}
