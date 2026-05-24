const DEFAULT_RECENT_REORDER_WINDOW_MS = 15_000;

export interface RecentLocalReorderTracker {
  mark: (itemIds: string[], now?: number) => void;
  consume: (itemId: string | undefined, now?: number) => boolean;
}

export function createRecentLocalReorderTracker(
  windowMs = DEFAULT_RECENT_REORDER_WINDOW_MS
): RecentLocalReorderTracker {
  const reorderedAtByItemId = new Map<string, number>();

  const prune = (now: number) => {
    for (const [itemId, reorderedAt] of reorderedAtByItemId.entries()) {
      if (now - reorderedAt > windowMs) {
        reorderedAtByItemId.delete(itemId);
      }
    }
  };

  return {
    mark: (itemIds, now = Date.now()) => {
      prune(now);
      itemIds.filter(Boolean).forEach(itemId => {
        reorderedAtByItemId.set(itemId, now);
      });
    },
    consume: (itemId, now = Date.now()) => {
      prune(now);
      return Boolean(itemId && reorderedAtByItemId.has(itemId));
    },
  };
}
