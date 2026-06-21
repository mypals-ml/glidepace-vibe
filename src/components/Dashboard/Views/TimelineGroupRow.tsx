import { useTranslation } from 'react-i18next';
import { diffDays } from '../../../lib/dateUtils';
import {
  getGroupCardBorder,
  getGroupCardContentBg,
  getGroupCardPillBg,
  getGroupCardTitleBg,
  getGroupCardTitleFg,
  getTreeColor,
} from '../../../lib/treeColors';
import type { TaskGroupBlock } from '../../../types';
import {
  GROUP_CARD_PAD,
  GROUP_CARD_RADIUS,
  GROUP_CARD_TITLE_HEIGHT,
  GROUP_TITLE_LEFT_PADDING,
  GROUP_TITLE_PROGRESS_WIDTH,
  GROUP_TITLE_RIGHT_PADDING,
  ROW_HEIGHT,
  GANTT_DROP_TARGET_ROW_CLASSNAME,
} from './timelineChartConstants';
import { getGroupTitleLayout } from './timelineChartUtils';

interface TimelineGroupRowProps {
  item: TaskGroupBlock;
  dayWidth: number;
  rowSpan: number;
  weightedProgress: number;
  getPositionForDate: (dateStr: string) => number;
  onToggleCollapsed: (groupBlockId: string) => void;
  isDropTarget?: boolean;
}

export function TimelineGroupRow({
  item,
  dayWidth,
  rowSpan,
  weightedProgress,
  getPositionForDate,
  onToggleCollapsed,
  isDropTarget = false,
}: TimelineGroupRowProps) {
  const dropTargetClassName = isDropTarget ? GANTT_DROP_TARGET_ROW_CLASSNAME : '';
  const { t } = useTranslation();
  const groupStart = item.startDate;
  const groupEnd = item.targetDate;
  const nodeColor = getTreeColor(item.depth);
  const titleBg = getGroupCardTitleBg(item.depth);
  const contentBg = getGroupCardContentBg(item.depth);
  const cardBorder = getGroupCardBorder(item.depth);
  const titleFg = getGroupCardTitleFg(item.depth);

  if (!groupStart || !groupEnd) {
    return (
      <div key={item.groupBlockId} className={`relative h-[72px] w-full flex items-center px-2 bg-slate-50/40 pointer-events-none ${dropTargetClassName}`}>
        <button
          type="button"
          onClick={() => onToggleCollapsed(item.groupBlockId)}
          className="sticky left-3 inline-flex items-center gap-2 text-sm font-extrabold tracking-[-0.01em] pointer-events-auto"
          style={{ color: titleFg }}
        >
          <span
            className="material-symbols-outlined text-[18px] transition-transform duration-200"
            style={{ transform: item.isExpanded ? 'rotate(90deg)' : 'none', color: nodeColor }}
          >
            chevron_right
          </span>
          {item.name}
        </button>
      </div>
    );
  }

  const spanLeft = getPositionForDate(groupStart);
  const duration = diffDays(groupStart, groupEnd);
  const spanWidth = duration * dayWidth;
  const cardLeft = spanLeft - GROUP_CARD_PAD;
  const groupMinWidth = Math.max(80, Math.floor(dayWidth));
  const cardWidth = Math.max(spanWidth, groupMinWidth) + GROUP_CARD_PAD * 2;
  const isOpen = item.isExpanded;
  const titleLayout = getGroupTitleLayout(cardWidth);
  const cardHeight = isOpen
    ? (rowSpan - 1) * ROW_HEIGHT + GROUP_CARD_TITLE_HEIGHT + (72 - GROUP_CARD_TITLE_HEIGHT) / 2
    : GROUP_CARD_TITLE_HEIGHT;
  const titleTop = (72 - GROUP_CARD_TITLE_HEIGHT) / 2;

  return (
    <div key={item.groupBlockId} className={`relative h-[72px] w-full px-2 pointer-events-none ${dropTargetClassName}`} style={{ zIndex: 5 }}>
      <div
        className="absolute pointer-events-none"
        style={{
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
          top: `${titleTop}px`,
          height: `${cardHeight}px`,
          background: contentBg,
          border: `1px solid ${cardBorder}`,
          borderRadius: `${GROUP_CARD_RADIUS}px`,
          zIndex: 0,
        }}
      />
      <button
        type="button"
        onClick={() => onToggleCollapsed(item.groupBlockId)}
        className="absolute flex items-center gap-[9px] text-left overflow-hidden pointer-events-auto"
        style={{
          left: `${cardLeft}px`,
          width: `${cardWidth}px`,
          top: `${titleTop}px`,
          height: `${GROUP_CARD_TITLE_HEIGHT}px`,
          padding: `0 ${GROUP_TITLE_RIGHT_PADDING}px 0 ${GROUP_TITLE_LEFT_PADDING}px`,
          background: titleBg,
          borderRadius: isOpen
            ? `${GROUP_CARD_RADIUS}px ${GROUP_CARD_RADIUS}px 0 0`
            : `${GROUP_CARD_RADIUS}px`,
          borderBottom: isOpen ? `1px solid ${cardBorder}` : 'none',
          zIndex: 5,
        }}
        aria-expanded={isOpen}
      >
        <span
          className="inline-flex items-center justify-center w-[22px] h-[22px] rounded-md flex-shrink-0 transition-colors"
          style={{ color: nodeColor }}
        >
          <span
            className="material-symbols-outlined text-[18px] transition-transform duration-200"
            style={{ transform: isOpen ? 'rotate(90deg)' : 'none' }}
          >
            chevron_right
          </span>
        </span>
        <span
          className="text-sm font-extrabold tracking-[-0.01em] whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0"
          style={{
            color: titleFg,
            maxWidth: `${titleLayout.nameMaxWidth}px`,
            minWidth: `${Math.min(titleLayout.nameMaxWidth, 12)}px`,
          }}
        >
          {item.name}
        </span>
        {titleLayout.showTaskCount && (
          <span
            className="inline-flex items-center text-[10px] font-extrabold px-[7px] py-[2px] rounded-full whitespace-nowrap overflow-hidden text-ellipsis flex-shrink min-w-0"
            style={{
              color: nodeColor,
              background: getGroupCardPillBg(item.depth),
              border: `1px solid ${getGroupCardBorder(item.depth)}`,
              maxWidth: `${titleLayout.countMaxWidth}px`,
            }}
          >
            <span className="overflow-hidden text-ellipsis">
              {item.childTaskIds.length} {t('dashboard.tasksLabel', 'tasks')}
            </span>
          </span>
        )}
        {titleLayout.showProgress && (
          <span
            className="ml-auto flex items-center flex-shrink-0 overflow-hidden"
            style={{ width: `${GROUP_TITLE_PROGRESS_WIDTH}px` }}
          >
            <span className="block w-full overflow-hidden text-ellipsis whitespace-nowrap text-right text-[11px] font-black tabular-nums" style={{ color: nodeColor }}>
              {weightedProgress}%
            </span>
          </span>
        )}
      </button>
    </div>
  );
}