// ========================================
// Viewport anchoring for background full refreshes.
//
// Before a refreshed snapshot is applied, the currently visible rows are
// captured as ordered anchor candidates (tasks first, groups as fallback).
// After the new `dashboardItems` render, the first surviving candidate is
// scrolled back to its previous offset from the viewport top, so the user
// does not lose their place even when rows moved or were deleted.
// ========================================

import type { DashboardItem, Task } from '../types';

/** Task rows and group rows share the same fixed height in list and Gantt. */
export const DASHBOARD_ROW_HEIGHT_PX = 72;

/** Anchors older than this are considered stale and must not be applied. */
export const VIEWPORT_ANCHOR_MAX_AGE_MS = 5_000;

export interface ViewportAnchorCandidate {
  stableId: string;
  kind: 'task' | 'group';
  /** Pixel offset of the row's top edge from the viewport top at capture time. */
  offsetFromViewportTop: number;
}

export interface ViewportAnchor {
  /** Ordered candidates: visible tasks top-to-bottom first, then groups. */
  candidates: ViewportAnchorCandidate[];
  scrollTop: number;
  capturedAt: number;
}

export function getDashboardItemStableId(item: DashboardItem): string {
  if (item.kind === 'group') {
    return item.groupBlockId;
  }
  const task = item as Task;
  return task.itemId || task.contentId || task.id;
}

export interface CaptureViewportAnchorParams {
  dashboardItems: DashboardItem[];
  scrollTop: number;
  viewportHeight: number;
  rowHeight?: number;
  now?: number;
}

export function captureViewportAnchor({
  dashboardItems,
  scrollTop,
  viewportHeight,
  rowHeight = DASHBOARD_ROW_HEIGHT_PX,
  now = Date.now(),
}: CaptureViewportAnchorParams): ViewportAnchor | null {
  if (rowHeight <= 0 || dashboardItems.length === 0) {
    return null;
  }

  const safeScrollTop = Math.max(0, scrollTop);
  const firstVisibleIndex = Math.min(
    dashboardItems.length - 1,
    Math.max(0, Math.floor(safeScrollTop / rowHeight))
  );
  const lastVisibleIndex = Math.min(
    dashboardItems.length - 1,
    Math.max(firstVisibleIndex, Math.ceil((safeScrollTop + Math.max(0, viewportHeight)) / rowHeight) - 1)
  );

  const taskCandidates: ViewportAnchorCandidate[] = [];
  const groupCandidates: ViewportAnchorCandidate[] = [];

  for (let index = firstVisibleIndex; index <= lastVisibleIndex; index++) {
    const item = dashboardItems[index];
    const candidate: ViewportAnchorCandidate = {
      stableId: getDashboardItemStableId(item),
      kind: item.kind === 'group' ? 'group' : 'task',
      offsetFromViewportTop: index * rowHeight - safeScrollTop,
    };
    if (candidate.kind === 'task') {
      taskCandidates.push(candidate);
    } else {
      groupCandidates.push(candidate);
    }
  }

  return {
    candidates: [...taskCandidates, ...groupCandidates],
    scrollTop: safeScrollTop,
    capturedAt: now,
  };
}

export interface ResolveViewportAnchorParams {
  anchor: ViewportAnchor;
  dashboardItems: DashboardItem[];
  rowHeight?: number;
  maxScrollTop: number;
}

function clampScrollTop(value: number, maxScrollTop: number): number {
  return Math.min(Math.max(0, value), Math.max(0, maxScrollTop));
}

/**
 * Returns the scrollTop that puts the first surviving anchor candidate back
 * at its captured offset from the viewport top. Falls back to the previous
 * scrollTop (clamped) when no candidate survived the refresh.
 */
export function resolveViewportAnchor({
  anchor,
  dashboardItems,
  rowHeight = DASHBOARD_ROW_HEIGHT_PX,
  maxScrollTop,
}: ResolveViewportAnchorParams): number {
  if (rowHeight > 0) {
    const indexByStableId = new Map(
      dashboardItems.map((item, index) => [getDashboardItemStableId(item), index])
    );

    for (const candidate of anchor.candidates) {
      const newIndex = indexByStableId.get(candidate.stableId);
      if (newIndex !== undefined) {
        return clampScrollTop(newIndex * rowHeight - candidate.offsetFromViewportTop, maxScrollTop);
      }
    }
  }

  return clampScrollTop(anchor.scrollTop, maxScrollTop);
}
