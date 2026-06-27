export interface StatusRemainingPercent {
  draft: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  other: number;
}

export interface ForecastAssumptions {
  capacityDaysPerWeek: number;
  availableWorkers?: number;
  statusRemainingPercent: StatusRemainingPercent;
}

export interface ForecastProjectSettings {
  assumptions: ForecastAssumptions;
}

export interface ForecastAssumptionsStoredPayload {
  version: number;
  settings: ForecastProjectSettings;
}

export const FORECAST_ASSUMPTIONS_CONFIG_VERSION = 2;
export const FORECAST_ASSUMPTIONS_CONFIG_MARKER = 'glidelines-config:forecast';
const LEGACY_FORECAST_ASSUMPTIONS_CONFIG_MARKERS = ['glidelines-config:forecast:v1'] as const;

export const DEFAULT_FORECAST_ASSUMPTIONS: ForecastAssumptions = {
  capacityDaysPerWeek: 5,
  statusRemainingPercent: {
    draft: 0,
    todo: 100,
    inProgress: 50,
    inReview: 20,
    done: 0,
    other: 50,
  },
};

export interface ParsedForecastAssumptions {
  assumptions: ForecastAssumptions;
  upgradedFromVersion: number | null;
}

const FORECAST_ASSUMPTIONS_STORAGE_KEY_PREFIX = 'forecast_assumptions';

interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface ConfigMarkerBlock {
  marker: string;
  start: string;
  end: string;
  pattern: RegExp;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createConfigMarkerBlock(marker: string): ConfigMarkerBlock {
  const start = `<!-- ${marker} -->`;
  const end = `<!-- /${marker} -->`;
  return {
    marker,
    start,
    end,
    pattern: new RegExp(`${escapeRegExp(start)}[\\s\\S]*?${escapeRegExp(end)}`, 'g'),
  };
}

const FORECAST_ASSUMPTIONS_CONFIG_BLOCKS = [
  createConfigMarkerBlock(FORECAST_ASSUMPTIONS_CONFIG_MARKER),
  ...LEGACY_FORECAST_ASSUMPTIONS_CONFIG_MARKERS.map(createConfigMarkerBlock),
];

function normalizePercent(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(100, Math.max(0, value))
    : fallback;
}

function normalizeCapacityDaysPerWeek(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return DEFAULT_FORECAST_ASSUMPTIONS.capacityDaysPerWeek;
  }
  return Math.min(35, value);
}

function normalizeAvailableWorkers(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return undefined;
  }
  return Math.min(100, Math.floor(value));
}

function isStatusRemainingPercent(value: unknown): value is StatusRemainingPercent {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StatusRemainingPercent>;
  return (
    typeof candidate.draft === 'number' &&
    typeof candidate.todo === 'number' &&
    typeof candidate.inProgress === 'number' &&
    typeof candidate.inReview === 'number' &&
    typeof candidate.done === 'number' &&
    typeof candidate.other === 'number'
  );
}

export function normalizeForecastAssumptions(value: unknown): ForecastAssumptions {
  if (!value || typeof value !== 'object') {
    return DEFAULT_FORECAST_ASSUMPTIONS;
  }

  const candidate = value as Partial<ForecastAssumptions>;
  const defaults = DEFAULT_FORECAST_ASSUMPTIONS.statusRemainingPercent;
  const source = candidate.statusRemainingPercent;

  const availableWorkers = normalizeAvailableWorkers(candidate.availableWorkers);
  const normalized: ForecastAssumptions = {
    capacityDaysPerWeek: normalizeCapacityDaysPerWeek(candidate.capacityDaysPerWeek),
    statusRemainingPercent: {
      draft: normalizePercent(source?.draft, defaults.draft),
      todo: normalizePercent(source?.todo, defaults.todo),
      inProgress: normalizePercent(source?.inProgress, defaults.inProgress),
      inReview: normalizePercent(source?.inReview, defaults.inReview),
      done: normalizePercent(source?.done, defaults.done),
      other: normalizePercent(source?.other, defaults.other),
    },
  };
  if (availableWorkers !== undefined) {
    normalized.availableWorkers = availableWorkers;
  }
  return normalized;
}

function readStoredVersion(raw: Record<string, unknown>): number {
  if (!('version' in raw)) return 0;
  if (typeof raw.version !== 'number' || !Number.isFinite(raw.version)) return 0;
  return Math.max(0, Math.floor(raw.version));
}

function hasNestedAssumptions(value: unknown): value is { assumptions: unknown } {
  return Boolean(value && typeof value === 'object' && 'assumptions' in value);
}

function extractAssumptionsCandidate(payload: Record<string, unknown>): unknown {
  const settings = payload.settings;
  if (settings && typeof settings === 'object' && hasNestedAssumptions(settings)) {
    return settings.assumptions;
  }

  if (typeof payload.capacityDaysPerWeek === 'number' || payload.statusRemainingPercent) {
    return {
      capacityDaysPerWeek: payload.capacityDaysPerWeek,
      availableWorkers: payload.availableWorkers,
      statusRemainingPercent: payload.statusRemainingPercent,
    };
  }

  return null;
}

function extractAssumptionsFromPayload(payload: Record<string, unknown>): ForecastAssumptions | null {
  const candidate = extractAssumptionsCandidate(payload);
  if (!candidate) return null;

  const normalized = normalizeForecastAssumptions(candidate);
  const source = candidate as Partial<ForecastAssumptions>;
  if (typeof source.capacityDaysPerWeek !== 'number' || !isStatusRemainingPercent(source.statusRemainingPercent)) {
    return normalized;
  }

  return normalized;
}

type ForecastAssumptionsMigration = (payload: Record<string, unknown>) => Record<string, unknown>;

const FORECAST_ASSUMPTIONS_MIGRATIONS: Record<number, ForecastAssumptionsMigration> = {
  1: (payload) => ({
    ...payload,
    version: 1,
  }),
  2: (payload) => {
    const assumptions = extractAssumptionsFromPayload(payload) ?? DEFAULT_FORECAST_ASSUMPTIONS;
    return {
      version: 2,
      settings: {
        assumptions: normalizeForecastAssumptions(assumptions),
      },
    };
  },
};

export function upgradeForecastAssumptionsPayload(raw: unknown): ParsedForecastAssumptions | null {
  if (!raw || typeof raw !== 'object') return null;

  const source = raw as Record<string, unknown>;
  const originalVersion = readStoredVersion(source);
  let version = originalVersion;
  let current: Record<string, unknown> = { ...source };

  while (version < FORECAST_ASSUMPTIONS_CONFIG_VERSION) {
    const nextVersion = version + 1;
    const migrate = FORECAST_ASSUMPTIONS_MIGRATIONS[nextVersion];
    if (!migrate) return null;
    current = migrate(current);
    version = nextVersion;
  }

  const assumptions = extractAssumptionsFromPayload(current);
  if (!assumptions) return null;

  return {
    assumptions,
    upgradedFromVersion: originalVersion < FORECAST_ASSUMPTIONS_CONFIG_VERSION ? originalVersion : null,
  };
}

export function toStoredForecastAssumptionsPayload(
  assumptions: ForecastAssumptions,
): ForecastAssumptionsStoredPayload {
  return {
    version: FORECAST_ASSUMPTIONS_CONFIG_VERSION,
    settings: {
      assumptions: normalizeForecastAssumptions(assumptions),
    },
  };
}

function parseForecastAssumptionsJson(rawJson: string): ParsedForecastAssumptions | null {
  try {
    const parsed: unknown = JSON.parse(rawJson.trim());
    return upgradeForecastAssumptionsPayload(parsed);
  } catch {
    return null;
  }
}

function findForecastAssumptionsConfigBlock(readme: string): { block: string; json: string } | null {
  for (const markerBlock of FORECAST_ASSUMPTIONS_CONFIG_BLOCKS) {
    const startIndex = readme.indexOf(markerBlock.start);
    const endIndex = readme.indexOf(markerBlock.end);
    if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) continue;

    const block = readme.slice(startIndex + markerBlock.start.length, endIndex);
    const jsonMatch = block.match(/\{[\s\S]*\}/);
    if (!jsonMatch) continue;

    return { block, json: jsonMatch[0] };
  }

  return null;
}

export function parseForecastAssumptionsFromReadme(readme: string | null | undefined): ParsedForecastAssumptions | null {
  if (!readme) return null;

  const configBlock = findForecastAssumptionsConfigBlock(readme);
  if (!configBlock) return null;

  return parseForecastAssumptionsJson(configBlock.json);
}

export function buildForecastAssumptionsConfigBlock(assumptions: ForecastAssumptions): string {
  const payload = toStoredForecastAssumptionsPayload(assumptions);
  const markerBlock = createConfigMarkerBlock(FORECAST_ASSUMPTIONS_CONFIG_MARKER);
  return [
    markerBlock.start,
    JSON.stringify(payload),
    markerBlock.end,
  ].join('\n');
}

export function embedForecastAssumptionsInReadme(
  readme: string | null | undefined,
  assumptions: ForecastAssumptions,
): string {
  const block = buildForecastAssumptionsConfigBlock(assumptions);
  const current = readme ?? '';
  const hasExistingBlock = FORECAST_ASSUMPTIONS_CONFIG_BLOCKS.some((markerBlock) => markerBlock.pattern.test(current));

  if (hasExistingBlock) {
    let next = current;
    for (const markerBlock of FORECAST_ASSUMPTIONS_CONFIG_BLOCKS) {
      next = next.replace(markerBlock.pattern, block);
    }
    return next;
  }

  const trimmed = current.trimEnd();
  if (!trimmed) return `${block}\n`;
  return `${trimmed}\n\n${block}\n`;
}

export function getForecastAssumptionsStorageKey(projectId: string | null | undefined): string {
  return projectId
    ? `${FORECAST_ASSUMPTIONS_STORAGE_KEY_PREFIX}_${projectId}`
    : FORECAST_ASSUMPTIONS_STORAGE_KEY_PREFIX;
}

export function loadForecastAssumptionsFromLocalStorage(
  storage: StorageLike | null,
  projectId: string | null | undefined,
): ParsedForecastAssumptions | null {
  if (!storage || !projectId) return null;

  try {
    const saved = storage.getItem(getForecastAssumptionsStorageKey(projectId));
    if (!saved) return null;
    const parsed: unknown = JSON.parse(saved);
    return upgradeForecastAssumptionsPayload(parsed);
  } catch {
    return null;
  }
}

export function saveForecastAssumptionsToLocalStorage(
  storage: StorageLike | null,
  projectId: string | null | undefined,
  assumptions: ForecastAssumptions,
): void {
  if (!storage || !projectId) return;
  storage.setItem(
    getForecastAssumptionsStorageKey(projectId),
    JSON.stringify(toStoredForecastAssumptionsPayload(assumptions)),
  );
}
