import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { DashboardItem } from '../../../types';
import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { diffDays } from '../../../lib/dateUtils';
import { isTaskGroupBlock } from '../../../lib/taskGroupUtils';

interface DependencyLinesProps {
  items: DashboardItem[];
  getPositionForDate: (dateStr: string) => number;
  dayWidth: number;
  onBreakLink: (taskId: string, targetId: string) => void;
  dragState: { startX: number; startY: number; currentX: number; currentY: number } | null;
}

export function DependencyLines({ items, getPositionForDate, dayWidth, onBreakLink, dragState }: DependencyLinesProps) {
  const { t } = useTranslation();
  const ROW_HEIGHT = 72;
  const DEPENDENCY_LINE_DASH_DURATION_SECONDS = 10;

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

  const lines = useMemo(() => {
    const result: React.ReactNode[] = [];

    // Map task ids to their bounds
    const boundsMap = new Map<string, { x1: number; x2: number; y: number }>();
    items.forEach((t, i) => {
      if (isTaskGroupBlock(t)) return;
      const start = getStartDateForCal(t);
      const end = getTargetDateForCal(t);
      if (start && end) {
        const x1 = getPositionForDate(start);
        const duration = diffDays(start, end);
        const x2 = x1 + Math.max(duration * dayWidth, 100);
        const y = i * ROW_HEIGHT + (ROW_HEIGHT / 2);
        boundsMap.set(t.id, { x1, x2, y });
        if (t.itemId) boundsMap.set(t.itemId, { x1, x2, y });
      }
    });

    items.forEach(task => {
      if (isTaskGroupBlock(task)) return;
      if (task.successorIds && task.successorIds.length > 0) {
        const source = boundsMap.get(task.itemId || task.id);
        if (!source) return;

        task.successorIds.forEach(targetId => {
          const target = boundsMap.get(targetId);
          if (!target) return;

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
  }, [items, getPositionForDate, dayWidth, onBreakLink, t]);

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
      {dragState && (
        <path
          d={getPathStr(dragState.startX, dragState.startY, dragState.currentX, dragState.currentY)}
          fill="none"
          stroke="#818cf8"
          strokeWidth="3"
          strokeDasharray="6 6"
          className="animate-[dash_1s_linear_infinite]"
          markerEnd="url(#arrowhead)"
        />
      )}
    </svg>
  );
}
