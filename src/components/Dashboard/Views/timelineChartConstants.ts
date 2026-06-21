export const BASE_DAY_WIDTH = 120;
export const INITIAL_BUFFER_DAYS_LEFT = 14;
export const INITIAL_BUFFER_DAYS_RIGHT = 30;
export const EXPANSION_THRESHOLD_PX = 300;
export const EXPANSION_DAYS = 14;
export const ROW_HEIGHT = 72;
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 1;
export const TASK_BAR_DRAG_THRESHOLD_PX = 6;

export const GROUP_CARD_PAD = 9;
export const GROUP_CARD_TITLE_HEIGHT = 40;
export const GROUP_CARD_RADIUS = 8;
export const GROUP_TITLE_LEFT_PADDING = 6;
export const GROUP_TITLE_RIGHT_PADDING = 13;
export const GROUP_TITLE_PROGRESS_WIDTH = 36;

/** Thicker top border marks the insertion edge where a dragged task bar will land. */
export const GANTT_DROP_TARGET_ROW_CLASSNAME =
  'bg-primary/[0.06] border border-primary/30 border-t-[3px]';

export const getViewportInfo = (el: HTMLDivElement) => ({
  scrollLeft: el.scrollLeft,
  scrollTop: el.scrollTop,
  clientWidth: el.clientWidth,
  clientHeight: el.clientHeight,
});