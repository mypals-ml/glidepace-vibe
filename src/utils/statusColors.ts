/**
 * Dynamic status color registry.
 *
 * Maps status names to Tailwind color classes.  Colours can come from:
 *   1. The project itself — GitHub colour enum (GRAY, GREEN, PURPLE, …)
 *      passed via `registerStatuses()` after tasks load.
 *   2. A well-known fallback map for names like "Todo", "Done", etc.
 *   3. A round-robin palette for anything completely unknown.
 *
 * Used across the app: StatusSelector, TaskDetailsPanel, Sidebar, Timeline.
 */

// ---------------------------------------------------------------------------
// Tailwind class palette — keyed by GitHub colour enum name
// ---------------------------------------------------------------------------

interface StatusColors {
  badge: string;  // bg + text + border for the pill/badge
  dot: string;    // dot indicator colour (+ optional animate)
  text: string;   // text colour matching the status accent
}

/** GitHub ProjectV2 colour enum → Tailwind classes */
const GITHUB_COLOR_MAP: Record<string, StatusColors> = {
  GRAY: {
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    dot:   'bg-slate-400',
    text:  'text-slate-500',
  },
  BLUE: {
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
    dot:   'bg-blue-500',
    text:  'text-blue-600',
  },
  GREEN: {
    badge: 'bg-green-50 text-green-700 border-green-200',
    dot:   'bg-green-500',
    text:  'text-green-600',
  },
  YELLOW: {
    badge: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    dot:   'bg-yellow-500 animate-pulse',
    text:  'text-yellow-600',
  },
  ORANGE: {
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
    dot:   'bg-orange-500',
    text:  'text-orange-600',
  },
  RED: {
    badge: 'bg-red-50 text-red-700 border-red-200',
    dot:   'bg-red-500',
    text:  'text-red-600',
  },
  PINK: {
    badge: 'bg-pink-50 text-pink-700 border-pink-200',
    dot:   'bg-pink-500',
    text:  'text-pink-600',
  },
  PURPLE: {
    badge: 'bg-purple-100 text-purple-700 border-purple-200',
    dot:   'bg-purple-500',
    text:  'text-purple-600',
  },
};

/** Fallback palette for round-robin assignment when no GitHub colour given */
const FALLBACK_PALETTE: StatusColors[] = Object.values(GITHUB_COLOR_MAP);

// ---------------------------------------------------------------------------
// Well-known fallback (used when no colour is provided by the project)
// ---------------------------------------------------------------------------

const WELL_KNOWN_COLOR: Record<string, string> = {
  'todo':        'GRAY',
  'backlog':     'GRAY',
  'open':        'GRAY',
  'not started': 'GRAY',

  'in progress': 'YELLOW',
  'in review':   'YELLOW',
  'review':      'YELLOW',
  'wip':         'YELLOW',

  'done':        'PURPLE',
  'closed':      'PURPLE',
  'completed':   'PURPLE',
  'merged':      'PURPLE',

  'blocked':     'RED',
  'on hold':     'RED',

  'cancelled':   'GRAY',
  'canceled':    'GRAY',
};

// ---------------------------------------------------------------------------
// Runtime registry
// ---------------------------------------------------------------------------

/** Lower-cased status name → StatusColors */
const registry = new Map<string, StatusColors>();

/** Next fallback palette slot for truly unknown statuses */
let nextFallbackSlot = 0;

export function registerStatuses(
  entries: Array<{ name: string; color?: string }>,
): void {
  entries.forEach(({ name, color }) => {
    const key = name.toLowerCase();
    const existing = registry.get(key);

    if (color && GITHUB_COLOR_MAP[color]) {
      // Prioritize project-supplied color, even if already registered via fallback
      registry.set(key, GITHUB_COLOR_MAP[color]);
    } else if (!existing) {
      if (WELL_KNOWN_COLOR[key]) {
        registry.set(key, GITHUB_COLOR_MAP[WELL_KNOWN_COLOR[key]]);
      } else {
        registry.set(key, FALLBACK_PALETTE[nextFallbackSlot++ % FALLBACK_PALETTE.length]);
      }
    }
  });
}

// Seed the well-known defaults so the app works before projects load.
registerStatuses(
  Object.keys(WELL_KNOWN_COLOR).map(k => ({
    name: k.replace(/\b\w/g, c => c.toUpperCase()),
  })),
);

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

function resolve(status: string): StatusColors {
  const key = status.toLowerCase();
  return registry.get(key) ?? GITHUB_COLOR_MAP[WELL_KNOWN_COLOR[key] ?? 'GRAY'];
}

/** Returns Tailwind classes for the status badge (bg + text + border). */
export function getStatusColor(status: string): string {
  return resolve(status).badge;
}

/** Returns Tailwind classes for the status dot indicator. */
export function getStatusDotColor(status: string): string {
  return resolve(status).dot;
}

/** Returns Tailwind text colour classes for status-accented inline text. */
export function getStatusTextColor(status: string): string {
  return resolve(status).text;
}
