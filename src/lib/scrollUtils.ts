export interface RowScrollPositionInput {
  currentScrollTop: number;
  rowIndex: number;
  rowHeight: number;
  viewportHeight: number;
}

export function getScrollTopForSelectedRow({
  currentScrollTop,
  rowIndex,
  rowHeight,
  viewportHeight,
}: RowScrollPositionInput): number {
  const rowTop = rowIndex * rowHeight;
  const rowBottom = rowTop + rowHeight;
  const viewportBottom = currentScrollTop + viewportHeight;

  if (rowBottom > currentScrollTop && rowTop < viewportBottom) {
    return currentScrollTop;
  }

  return Math.max(0, rowTop - viewportHeight / 2 + rowHeight / 2);
}
