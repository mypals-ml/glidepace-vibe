import { describe, it, expect } from 'vitest';
import {
  normalizeGithubSyncPayload,
  isEventForSelectedProject,
  getSyncEventFingerprint,
  createSyncEventDeduper,
} from './githubSyncEvents';

const FULL_PAYLOAD = {
  deliveryId: 'delivery-123',
  sourceEvent: 'projects_v2_item',
  action: 'edited',
  projectId: 'PVT_2',
  itemId: 'item-1',
  contentId: 'content-1',
  timestamp: 1700000000000,
};

describe('normalizeGithubSyncPayload', () => {
  it('normalizes a supabase-wrapped payload (project/repo channel shape)', () => {
    const event = normalizeGithubSyncPayload(
      'refresh_task',
      { type: 'broadcast', event: 'refresh_task', payload: FULL_PAYLOAD },
      'project-PVT_2',
      1700000000500
    );

    expect(event).toEqual({
      kind: 'single_task',
      channelLabel: 'project-PVT_2',
      projectId: 'PVT_2',
      itemId: 'item-1',
      contentId: 'content-1',
      action: 'edited',
      sourceEvent: 'projects_v2_item',
      deliveryId: 'delivery-123',
      timestamp: 1700000000000,
      receivedAt: 1700000000500,
    });
  });

  it('normalizes an unwrapped payload identically', () => {
    const wrapped = normalizeGithubSyncPayload(
      'refresh_task',
      { payload: FULL_PAYLOAD },
      'repo-acme-app',
      1
    );
    const unwrapped = normalizeGithubSyncPayload('refresh_task', FULL_PAYLOAD, 'repo-acme-app', 1);

    expect(unwrapped).toEqual(wrapped);
  });

  it('maps broadcast event names to internal kinds', () => {
    expect(normalizeGithubSyncPayload('sync', {}, 'c').kind).toBe('full_project');
    expect(normalizeGithubSyncPayload('refresh_task', {}, 'c').kind).toBe('single_task');
    expect(normalizeGithubSyncPayload('reorder', {}, 'c').kind).toBe('reorder');
  });

  it('tolerates legacy sync payloads without metadata', () => {
    const event = normalizeGithubSyncPayload(
      'sync',
      { payload: { message: 'Tasks updated on GitHub', timestamp: 42 } },
      'owner-acme'
    );

    expect(event.kind).toBe('full_project');
    expect(event.projectId).toBeUndefined();
    expect(event.deliveryId).toBeUndefined();
    expect(event.timestamp).toBe(42);
  });

  it('tolerates null and non-object payloads', () => {
    expect(normalizeGithubSyncPayload('sync', null, 'c').kind).toBe('full_project');
    expect(normalizeGithubSyncPayload('sync', 'oops', 'c').itemId).toBeUndefined();
  });
});

describe('isEventForSelectedProject', () => {
  it('accepts matching projectId', () => {
    expect(isEventForSelectedProject({ projectId: 'PVT_2' }, 'PVT_2')).toBe(true);
  });

  it('rejects a different projectId', () => {
    expect(isEventForSelectedProject({ projectId: 'PVT_3' }, 'PVT_2')).toBe(false);
  });

  it('treats a missing projectId as possibly ours', () => {
    expect(isEventForSelectedProject({}, 'PVT_2')).toBe(true);
  });
});

describe('getSyncEventFingerprint', () => {
  it('generates identical fingerprints for redundant channel broadcasts', () => {
    const onProject = normalizeGithubSyncPayload(
      'refresh_task',
      { payload: FULL_PAYLOAD },
      'project-PVT_2',
      100
    );
    const onRepo = normalizeGithubSyncPayload(
      'refresh_task',
      { payload: FULL_PAYLOAD },
      'repo-acme-app',
      150
    );
    const onOwner = normalizeGithubSyncPayload(
      'refresh_task',
      { payload: FULL_PAYLOAD },
      'owner-acme',
      200
    );

    const fingerprint = getSyncEventFingerprint(onProject);
    expect(getSyncEventFingerprint(onRepo)).toBe(fingerprint);
    expect(getSyncEventFingerprint(onOwner)).toBe(fingerprint);
  });

  it('prefers deliveryId when available', () => {
    const a = getSyncEventFingerprint({ kind: 'single_task', deliveryId: 'd1' });
    const b = getSyncEventFingerprint({ kind: 'single_task', deliveryId: 'd2' });
    expect(a).not.toBe(b);
  });

  it('falls back to kind/action/id/timestamp without deliveryId', () => {
    const a = getSyncEventFingerprint({ kind: 'single_task', action: 'edited', itemId: 'i1', timestamp: 1 });
    const sameDelivery = getSyncEventFingerprint({ kind: 'single_task', action: 'edited', itemId: 'i1', timestamp: 1 });
    const laterDelivery = getSyncEventFingerprint({ kind: 'single_task', action: 'edited', itemId: 'i1', timestamp: 2 });

    expect(sameDelivery).toBe(a);
    expect(laterDelivery).not.toBe(a);
  });

  it('distinguishes kinds sharing one delivery', () => {
    const single = getSyncEventFingerprint({ kind: 'single_task', deliveryId: 'd1' });
    const full = getSyncEventFingerprint({ kind: 'full_project', deliveryId: 'd1' });
    expect(single).not.toBe(full);
  });
});

describe('createSyncEventDeduper', () => {
  it('processes the first occurrence and suppresses duplicates inside the TTL', () => {
    const deduper = createSyncEventDeduper(10_000);

    expect(deduper.shouldProcess('fp-1', 1000)).toBe(true);
    expect(deduper.shouldProcess('fp-1', 2000)).toBe(false);
    expect(deduper.shouldProcess('fp-1', 9000)).toBe(false);
  });

  it('allows the fingerprint again after the TTL expires', () => {
    const deduper = createSyncEventDeduper(10_000);

    expect(deduper.shouldProcess('fp-1', 1000)).toBe(true);
    expect(deduper.shouldProcess('fp-1', 11_001)).toBe(true);
  });

  it('tracks independent fingerprints separately', () => {
    const deduper = createSyncEventDeduper(10_000);

    expect(deduper.shouldProcess('fp-1', 1000)).toBe(true);
    expect(deduper.shouldProcess('fp-2', 1000)).toBe(true);
    expect(deduper.shouldProcess('fp-2', 1500)).toBe(false);
  });
});
