// Shared tree-view depth color palette and derivations.
//
// The task-list sidebar renders each group/task tree node with a depth-based
// color from TREE_DEPTH_COLORS. The Gantt "group card" (Design 7) reuses these
// same colors so a group's card matches its tree node, with the card content
// background derived (more transparent) from the title fill color.

export const TREE_DEPTH_COLORS = [
  '#4f46e5',
  '#0891b2',
  '#16a34a',
  '#d97706',
  '#dc2626',
  '#9333ea',
  '#0f766e',
  '#2563eb',
  '#be185d',
  '#65a30d',
] as const;

export const TREE_LINE_MIX = 34;

export function clampTreeDepth(depth: number): number {
  return Math.min(Math.max(depth, 0), TREE_DEPTH_COLORS.length - 1);
}

/** The solid node color for a given tree depth (matches the sidebar node fill). */
export function getTreeColor(depth: number): string {
  return TREE_DEPTH_COLORS[clampTreeDepth(depth)];
}

export function getTreeLineColor(depth: number): string {
  return `color-mix(in srgb, ${getTreeColor(depth)} ${TREE_LINE_MIX}%, white)`;
}

export function getTreeHandleHoverColor(depth: number): string {
  return `color-mix(in srgb, ${getTreeColor(depth)} 82%, black)`;
}

// --- Gantt group-card derivations (Design 7) ---
// Title fill uses the solid node color at a low alpha; the card content
// background is a *more transparent* tint of that same color so it reads as a
// lighter wash behind the child task bars.

/** Translucent title-row fill for the group card, keyed to the tree node color. */
export function getGroupCardTitleBg(depth: number): string {
  return `color-mix(in srgb, ${getTreeColor(depth)} 11%, transparent)`;
}

/**
 * More-transparent content-surface fill, derived from the same node color.
 * The first-level group (the project group, depth 0) is special: its content
 * is rendered almost fully transparent (1% tint = 99% transparent) so it acts
 * as a subtle outer container rather than a colored wash.
 */
export function getGroupCardContentBg(depth: number): string {
  const tint = depth <= 0 ? 1 : 4;
  return `color-mix(in srgb, ${getTreeColor(depth)} ${tint}%, transparent)`;
}

/** Card border tint, keyed to the tree node color. */
export function getGroupCardBorder(depth: number): string {
  return `color-mix(in srgb, ${getTreeColor(depth)} 16%, transparent)`;
}

/**
 * Task-count pill fill — a light, readable tint of the node color. Kept
 * independent of the content-surface fill so the project group's pill stays
 * visible even though its card content is near-transparent.
 */
export function getGroupCardPillBg(depth: number): string {
  return `color-mix(in srgb, ${getTreeColor(depth)} 8%, white)`;
}

/** Title text color — a darkened, saturated variant of the node color. */
export function getGroupCardTitleFg(depth: number): string {
  return `color-mix(in srgb, ${getTreeColor(depth)} 78%, black)`;
}
