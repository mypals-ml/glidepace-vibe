import { describe, expect, it } from 'vitest';
import {
  MAX_USED_FIELD_GROUPS,
  areFieldIdListsIdentical,
  getRecommendedFieldGroups,
  getUsedFieldGroupsStorageKey,
  loadUsedFieldGroups,
  recordUsedFieldGroup,
} from './fieldGroupHistory';

function makeMemoryStorage(initial: Record<string, string> = {}) {
  const data = new Map<string, string>(Object.entries(initial));
  return {
    getItem: (key: string) => (data.has(key) ? data.get(key)! : null),
    setItem: (key: string, value: string) => {
      data.set(key, value);
    },
    dump: () => Object.fromEntries(data.entries()),
  };
}

describe('fieldGroupHistory', () => {
  it('scopes the storage key by project id', () => {
    expect(getUsedFieldGroupsStorageKey('PVT_1')).toBe('used_field_groups_PVT_1');
    expect(getUsedFieldGroupsStorageKey(null)).toBe('used_field_groups');
    expect(getUsedFieldGroupsStorageKey(undefined)).toBe('used_field_groups');
  });

  it('treats combinations as identical only with the same fields in the same order', () => {
    expect(areFieldIdListsIdentical(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(areFieldIdListsIdentical(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(areFieldIdListsIdentical(['a'], ['a', 'b'])).toBe(false);
    expect(areFieldIdListsIdentical([], [])).toBe(true);
  });

  it('records used combinations to storage and returns them most recent first', () => {
    const storage = makeMemoryStorage();
    const key = getUsedFieldGroupsStorageKey('PVT_1');

    recordUsedFieldGroup(storage, key, ['status'], 1000);
    const entries = recordUsedFieldGroup(storage, key, ['status', 'priority'], 2000);

    expect(entries.map(entry => entry.fieldIds)).toEqual([['status', 'priority'], ['status']]);
    expect(loadUsedFieldGroups(storage, key)).toEqual(entries);
  });

  it('keeps a single entry for identical combinations and refreshes its recency', () => {
    const storage = makeMemoryStorage();
    const key = getUsedFieldGroupsStorageKey('PVT_1');

    recordUsedFieldGroup(storage, key, ['status'], 1000);
    recordUsedFieldGroup(storage, key, ['priority'], 2000);
    const entries = recordUsedFieldGroup(storage, key, ['status'], 3000);

    expect(entries.map(entry => entry.fieldIds)).toEqual([['status'], ['priority']]);
    expect(entries[0].savedAt).toBe(3000);
  });

  it('does not merge differently ordered combinations of the same fields', () => {
    const storage = makeMemoryStorage();
    const key = getUsedFieldGroupsStorageKey('PVT_1');

    recordUsedFieldGroup(storage, key, ['status', 'priority'], 1000);
    const entries = recordUsedFieldGroup(storage, key, ['priority', 'status'], 2000);

    expect(entries.map(entry => entry.fieldIds)).toEqual([
      ['priority', 'status'],
      ['status', 'priority'],
    ]);
  });

  it('ignores empty selections and keeps the existing history', () => {
    const storage = makeMemoryStorage();
    const key = getUsedFieldGroupsStorageKey('PVT_1');

    recordUsedFieldGroup(storage, key, ['status'], 1000);
    const entries = recordUsedFieldGroup(storage, key, ['  ', ''], 2000);

    expect(entries.map(entry => entry.fieldIds)).toEqual([['status']]);
  });

  it('caps the stored history length', () => {
    const storage = makeMemoryStorage();
    const key = getUsedFieldGroupsStorageKey('PVT_1');

    for (let index = 0; index < MAX_USED_FIELD_GROUPS + 5; index += 1) {
      recordUsedFieldGroup(storage, key, [`field-${index}`], index);
    }

    const entries = loadUsedFieldGroups(storage, key);
    expect(entries).toHaveLength(MAX_USED_FIELD_GROUPS);
    expect(entries[0].fieldIds).toEqual([`field-${MAX_USED_FIELD_GROUPS + 4}`]);
  });

  it('survives malformed storage content', () => {
    const key = getUsedFieldGroupsStorageKey('PVT_1');
    expect(loadUsedFieldGroups(makeMemoryStorage({ [key]: 'not-json' }), key)).toEqual([]);
    expect(loadUsedFieldGroups(makeMemoryStorage({ [key]: '{"a":1}' }), key)).toEqual([]);
    expect(
      loadUsedFieldGroups(
        makeMemoryStorage({
          [key]: JSON.stringify([
            { fieldIds: ['ok'], savedAt: 10 },
            { fieldIds: [], savedAt: 20 },
            { fieldIds: ['missing-saved-at'] },
            { fieldIds: [42], savedAt: 30 },
            'junk',
          ]),
        }),
        key
      ).map(entry => entry.fieldIds)
    ).toEqual([['ok']]);
  });

  it('dedupes identical combinations already persisted in storage', () => {
    const key = getUsedFieldGroupsStorageKey('PVT_1');
    const storage = makeMemoryStorage({
      [key]: JSON.stringify([
        { fieldIds: ['status'], savedAt: 10 },
        { fieldIds: ['status'], savedAt: 30 },
        { fieldIds: ['priority'], savedAt: 20 },
      ]),
    });

    const entries = loadUsedFieldGroups(storage, key);
    expect(entries.map(entry => entry.fieldIds)).toEqual([['status'], ['priority']]);
    expect(entries[0].savedAt).toBe(30);
  });

  it('works without storage available', () => {
    expect(loadUsedFieldGroups(null, 'any')).toEqual([]);
    expect(recordUsedFieldGroup(null, 'any', ['status'], 1000).map(entry => entry.fieldIds)).toEqual([
      ['status'],
    ]);
  });

  it('resolves recommended combinations against existing fields case-insensitively', () => {
    const fields = [
      { id: 'f-status', name: 'status' },
      { id: 'f-priority', name: 'PRIORITY' },
      { id: 'f-other', name: 'Iteration' },
    ];

    expect(getRecommendedFieldGroups(fields)).toEqual([
      ['f-status'],
      ['f-status', 'f-priority'],
      ['f-priority', 'f-status'],
    ]);
  });

  it('skips recommended combinations referencing missing fields', () => {
    expect(getRecommendedFieldGroups([{ id: 'f-status', name: 'Status' }])).toEqual([['f-status']]);
    expect(getRecommendedFieldGroups([{ id: 'f-x', name: 'Estimate' }])).toEqual([]);
  });
});
