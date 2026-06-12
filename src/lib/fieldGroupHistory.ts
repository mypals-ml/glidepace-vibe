export interface UsedFieldGroup {
  fieldIds: string[];
  savedAt: number;
}

export interface FieldGroupFieldRef {
  id: string;
  name: string;
}

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const USED_FIELD_GROUPS_STORAGE_KEY_PREFIX = 'used_field_groups';
const LAST_USED_FIELD_GROUP_STORAGE_KEY_PREFIX = 'last_used_field_group';

export const MAX_USED_FIELD_GROUPS = 20;

/** Recommended field combinations, expressed as project field names. */
export const RECOMMENDED_FIELD_GROUP_NAMES: readonly (readonly string[])[] = [
  ['Status'],
  ['Status', 'Priority'],
  ['Priority', 'Status'],
];

export function getUsedFieldGroupsStorageKey(projectId: string | null | undefined): string {
  return projectId
    ? `${USED_FIELD_GROUPS_STORAGE_KEY_PREFIX}_${projectId}`
    : USED_FIELD_GROUPS_STORAGE_KEY_PREFIX;
}

export function getLastUsedFieldGroupStorageKey(projectId: string | null | undefined): string {
  return projectId
    ? `${LAST_USED_FIELD_GROUP_STORAGE_KEY_PREFIX}_${projectId}`
    : LAST_USED_FIELD_GROUP_STORAGE_KEY_PREFIX;
}

function normalizeFieldIds(fieldIds: readonly string[]): string[] {
  return fieldIds.map(fieldId => fieldId.trim()).filter(Boolean);
}

/** Two combinations are identical when they contain the same fields in the same order. */
export function areFieldIdListsIdentical(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((fieldId, index) => fieldId === b[index]);
}

function isValidUsedFieldGroup(candidate: unknown): candidate is UsedFieldGroup {
  if (typeof candidate !== 'object' || candidate === null) return false;
  const entry = candidate as { fieldIds?: unknown; savedAt?: unknown };
  return (
    Array.isArray(entry.fieldIds) &&
    entry.fieldIds.length > 0 &&
    entry.fieldIds.every(fieldId => typeof fieldId === 'string' && fieldId.trim().length > 0) &&
    typeof entry.savedAt === 'number' &&
    Number.isFinite(entry.savedAt)
  );
}

function dedupeAndSortUsedFieldGroups(entries: UsedFieldGroup[]): UsedFieldGroup[] {
  const deduped: UsedFieldGroup[] = [];
  for (const entry of entries) {
    const existing = deduped.find(candidate => areFieldIdListsIdentical(candidate.fieldIds, entry.fieldIds));
    if (existing) {
      existing.savedAt = Math.max(existing.savedAt, entry.savedAt);
    } else {
      deduped.push({ fieldIds: [...entry.fieldIds], savedAt: entry.savedAt });
    }
  }
  return deduped.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_USED_FIELD_GROUPS);
}

/**
 * Load the previously used field combinations from storage.
 * Identical combinations are merged and the result is ordered by save time, descending.
 */
export function loadUsedFieldGroups(storage: StorageLike | null, storageKey: string): UsedFieldGroup[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(storageKey);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return dedupeAndSortUsedFieldGroups(parsed.filter(isValidUsedFieldGroup).map(entry => ({
      fieldIds: normalizeFieldIds(entry.fieldIds),
      savedAt: entry.savedAt,
    })).filter(entry => entry.fieldIds.length > 0));
  } catch {
    return [];
  }
}

/**
 * Record a freshly applied field combination and persist the updated list.
 * Returns the updated list (most recent first, identical combinations deduped).
 */
export function recordUsedFieldGroup(
  storage: StorageLike | null,
  storageKey: string,
  fieldIds: readonly string[],
  savedAt: number = Date.now()
): UsedFieldGroup[] {
  const normalizedFieldIds = normalizeFieldIds(fieldIds);
  const existingEntries = loadUsedFieldGroups(storage, storageKey);
  if (normalizedFieldIds.length === 0) return existingEntries;

  const updatedEntries = dedupeAndSortUsedFieldGroups([
    { fieldIds: normalizedFieldIds, savedAt },
    ...existingEntries,
  ]);

  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify(updatedEntries));
    } catch {
      // Storage may be unavailable (private mode, quota); the in-memory list still works.
    }
  }
  return updatedEntries;
}

/**
 * Load the last saved field group selection from storage.
 * Returns null when no selection has been saved; an empty array is a valid
 * saved value and means the user explicitly cleared grouping fields.
 */
export function loadLastUsedFieldGroup(storage: StorageLike | null, storageKey: string): string[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(fieldId => typeof fieldId !== 'string')) return null;
    return normalizeFieldIds(parsed);
  } catch {
    return null;
  }
}

/** Persist the last field group selection, including an explicitly empty selection. */
export function saveLastUsedFieldGroup(
  storage: StorageLike | null,
  storageKey: string,
  fieldIds: readonly string[]
): string[] {
  const normalizedFieldIds = normalizeFieldIds(fieldIds);
  if (storage) {
    try {
      storage.setItem(storageKey, JSON.stringify(normalizedFieldIds));
    } catch {
      // Storage may be unavailable (private mode, quota); callers can still use the normalized value.
    }
  }
  return normalizedFieldIds;
}

/**
 * Resolve the recommended field-name combinations against the project's actual fields.
 * A combination is only offered when every referenced field exists (matched by name,
 * case-insensitively). Returns the resolved field-id lists in recommendation order.
 */
export function getRecommendedFieldGroups(fields: readonly FieldGroupFieldRef[]): string[][] {
  const fieldIdsByName = new Map<string, string>();
  for (const field of fields) {
    const normalizedName = field.name.trim().toLowerCase();
    if (!fieldIdsByName.has(normalizedName)) {
      fieldIdsByName.set(normalizedName, field.id);
    }
  }

  const recommended: string[][] = [];
  for (const nameGroup of RECOMMENDED_FIELD_GROUP_NAMES) {
    const fieldIds = nameGroup.map(name => fieldIdsByName.get(name.toLowerCase()));
    if (fieldIds.every((fieldId): fieldId is string => Boolean(fieldId))) {
      recommended.push(fieldIds);
    }
  }
  return recommended;
}

/** Safe accessor for window.localStorage (unavailable in some embedded/private contexts). */
export function getLocalStorageSafe(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
