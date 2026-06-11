import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardItem, Task } from '../../../types';
import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { diffDays } from '../../../lib/dateUtils';
import { isDashboardTask, isTaskGroupBlock } from '../../../lib/taskGroupUtils';

interface DependencyLinesProps {
  items: DashboardItem[];
  /**
   * Full (filtered) task list, including tasks hidden inside folded group
   * cards. Used so links that touch a hidden task can still be drawn,
   * anchored to the folded group card's title bar. Falls back to the visible
   * tasks in `items` when omitted.
   */
  tasks?: Task[];
  getPositionForDate: (dateStr: string) => number;
  dayWidth: number;
  onBreakLink: (taskId: string, targetId: string) => void;
  dragState: { startX: number; startY: number; currentX: number; currentY: number } | null;
  hoveredTargetTaskId?: string | null;
}

interface LineAnchor {
  x1: number;
  x2: number;
  y: number;
  /** Set when the anchor is a folded group card rather than a task bar. */
  groupBlockId?: string;
}

export function DependencyLines({ items, tasks, getPositionForDate, dayWidth, onBreakLink, dragState, hoveredTargetTaskId }: DependencyLinesProps) {
  const { t } = useTranslation();
  const ROW_HEIGHT = 72;
  const DEPENDENCY_LINE_DASH_DURATION_SECONDS = 10;
  const DRAG_LINE_STROKE_WIDTH = 2;
  const SNAPPED_DRAG_LINE_STROKE_WIDTH = 2.5;
  // Mirror the group card geometry in GanttChart (CARD_PAD / min span width)
  // so folded-card anchors line up with the rendered card title bar.
  const GROUP_CARD_PAD = 9;
  const GROUP_CARD_MIN_SPAN_WIDTH = 120;

  const getPathStr = (startX: number, startY: number, endX: number, endY: number) => {
    let cp1X, cp2X;
    if (endX > startX) {
      const offset = Math.max(100, (endX - startX) / 2);
      cp1X = startX + offset;
      cp2X = endX - offset;
    } else {
      cp1X = startX + 100;
      cp2X = endX - 100;
    }
    return `M ${startX} ${startY} C ${cp1X} ${startY}, ${cp2X} ${endY}, ${endX} ${endY}`;
  };

  // Map task ids to their bounds
  const boundsMap = useMemo(() => {
    const bounds = new Map<string, LineAnchor>();
    items.forEach((t, i) => {
      if (isTaskGroupBlock(t)) return;
      const start = getStartDateForCal(t);
      const end = getTargetDateForCal(t);
      if (start && end) {
        const x1 = getPositionForDate(start);
        const duration = diffDays(start, end);
        const x2 = x1 + Math.max(duration * dayWidth, 100);
        const y = i * ROW_HEIGHT + (ROW_HEIGHT / 2);
        bounds.set(t.id, { x1, x2, y });
        if (t.itemId) bounds.set(t.itemId, { x1, x2, y });
      }
    });
    return bounds;
  }, [items, getPositionForDate, dayWidth]);

  // Anchor bounds for tasks hidden inside folded group cards, keyed by the
  // hidden task's identity. The anchor is the folded card's title bar so a
  // link that crosses the card boundary visually starts/ends at the card.
  const foldedCardAnchorMap = useMemo(() => {
    const anchors = new Map<string, LineAnchor>();
    items.forEach((item, i) => {
      if (!isTaskGroupBlock(item) || item.isExpanded) return;
      if (!item.startDate || !item.targetDate) return;
      const spanLeft = getPositionForDate(item.startDate);
      const duration = diffDays(item.startDate, item.targetDate);
      const x1 = spanLeft - GROUP_CARD_PAD;
      const x2 = x1 + Math.max(duration * dayWidth, GROUP_CARD_MIN_SPAN_WIDTH) + GROUP_CARD_PAD * 2;
      // The card title bar is vertically centered within the group row.
      const y = i * ROW_HEIGHT + (ROW_HEIGHT / 2);
      const anchor: LineAnchor = { x1, x2, y, groupBlockId: item.groupBlockId };
      item.childTaskIds.forEach(childId => {
        if (!anchors.has(childId)) anchors.set(childId, anchor);
      });
    });
    return anchors;
  }, [items, getPositionForDate, dayWidth]);

  const lines = useMemo(() => {
    const result: React.ReactNode[] = [];
    const drawnAnchorPairs = new Set<string>();
    const linkSourceTasks = tasks ?? items.filter(isDashboardTask);

    linkSourceTasks.forEach(task => {
      if (task.successorIds && task.successorIds.length > 0) {
        const sourceId = task.itemId || task.id;
        const source = boundsMap.get(sourceId) ?? foldedCardAnchorMap.get(sourceId);
        if (!source) return;

        task.successorIds.forEach(targetId => {
          const target = boundsMap.get(targetId) ?? foldedCardAnchorMap.get(targetId);
          if (!target) return;

          const sourceAnchorKey = source.groupBlockId ? `group:${source.groupBlockId}` : `task:${sourceId}`;
          const targetAnchorKey = target.groupBlockId ? `group:${target.groupBlockId}` : `task:${targetId}`;
          // Both endpoints sit inside the same folded card: the link is
          // internal to the group and stays hidden with its tasks.
          if (sourceAnchorKey === targetAnchorKey) return;
          // Collapse duplicate lines that would overlap exactly (multiple
          // hidden tasks of one folded card linked to the same counterpart).
          const anchorPairKey = `${sourceAnchorKey}->${targetAnchorKey}`;
          if (drawnAnchorPairs.has(anchorPairKey)) return;
          drawnAnchorPairs.add(anchorPairKey);

          const startX = source.x2;
          const startY = source.y;
          const endX = target.x1;
          const endY = target.y;

          const pathStr = getPathStr(startX, startY, endX, endY);

          result.push(
            <g key={`${task.id}-${targetId}`} className="group/line cursor-pointer">
              {/* Invisible thicker line for easier hover */}
              <path d={pathStr} fill="none" stroke="transparent" strokeWidth="16" />
              {/* Visible line */}
              <path
                d={pathStr}
                fill="none"
                stroke="#6366f1"
                strokeWidth="2"
                strokeDasharray="4 4"
                className="dependency-line opacity-60 group-hover/line:opacity-100 group-hover/line:stroke-rose-500"
                style={{ animation: `dash ${DEPENDENCY_LINE_DASH_DURATION_SECONDS}s linear infinite` }}
              />
              {/* Break link icon on hover */}
              <foreignObject x={(startX + endX) / 2 - 12} y={(startY + endY) / 2 - 12} width="24" height="24" className="opacity-0 group-hover/line:opacity-100">
                <div 
                  className="w-6 h-6 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center shadow hover:bg-rose-500 hover:text-white transition-colors"
                  onClick={(e) => { e.stopPropagation(); onBreakLink(task.id, targetId); }}
                  title={t('dashboard.breakLink') || "Break link"}
                >
                  <span className="material-symbols-outlined text-[14px]">link_off</span>
                </div>
              </foreignObject>
            </g>
          );
        });
      }
    });

    return result;
  }, [items, tasks, boundsMap, foldedCardAnchorMap, onBreakLink, t]);

  const dragPathInfo = useMemo(() => {
    if (!dragState) return null;
    let endX = dragState.currentX;
    let endY = dragState.currentY;
    let isSnapped = false;

    if (hoveredTargetTaskId) {
      const bounds = boundsMap.get(hoveredTargetTaskId);
      if (bounds) {
        endX = bounds.x1;
        endY = bounds.y;
        isSnapped = true;
      }
    }

    return {
      path: getPathStr(dragState.startX, dragState.startY, endX, endY),
      isSnapped
    };
  }, [dragState, hoveredTargetTaskId, boundsMap]);

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-20" style={{ minWidth: '100%', minHeight: '100%' }}>
      <defs>
        <marker
          id="arrowhead"
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="#6366f1" />
        </marker>
        <marker
          id="arrowhead-hover"
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="#f43f5e" />
        </marker>
        <marker
          id="arrowhead-snap"
          markerWidth="6"
          markerHeight="4"
          refX="5"
          refY="2"
          orient="auto"
        >
          <polygon points="0 0, 6 2, 0 4" fill="#10b981" />
        </marker>
      </defs>
      <style>{`
        @keyframes dash {
          to {
            stroke-dashoffset: -16;
          }
        }
        .dependency-line {
          marker-end: url(#arrowhead);
        }
        .group\\/line:hover .dependency-line {
          marker-end: url(#arrowhead-hover);
        }
      `}</style>
      <g className="pointer-events-auto">
        {lines}
      </g>
      {dragPathInfo && (
        <path
          data-testid="dependency-drag-preview"
          d={dragPathInfo.path}
          fill="none"
          stroke={dragPathInfo.isSnapped ? '#10b981' : '#818cf8'}
          strokeWidth={dragPathInfo.isSnapped ? SNAPPED_DRAG_LINE_STROKE_WIDTH : DRAG_LINE_STROKE_WIDTH}
          strokeDasharray={dragPathInfo.isSnapped ? '3 5' : '6 6'}
          className={dragPathInfo.isSnapped ? 'animate-[dash_0.5s_linear_infinite] drop-shadow-[0_0_2px_rgba(16,185,129,0.35)] transition-all duration-150' : 'animate-[dash_1s_linear_infinite]'}
          markerEnd={dragPathInfo.isSnapped ? 'url(#arrowhead-snap)' : 'url(#arrowhead)'}
        />
      )}
    </svg>
  );
}
