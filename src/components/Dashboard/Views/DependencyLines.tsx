import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { Task } from '../../../types';
import { getStartDateForCal, getTargetDateForCal } from '../../../lib/githubTaskMapper';
import { diffDays } from '../../../lib/dateUtils';

interface DependencyLinesProps {
  tasks: Task[];
  getPositionForDate: (dateStr: string) => number;
  dayWidth: number;
  onBreakLink: (taskId: string, targetId: string) => void;
  dragState: { startX: number; startY: number; currentX: number; currentY: number } | null;
}

export function DependencyLines({ tasks, getPositionForDate, dayWidth, onBreakLink, dragState }: DependencyLinesProps) {
  const { t } = useTranslation();
  const ROW_HEIGHT = 72;

  const lines = useMemo(() => {
    const result: React.ReactNode[] = [];

    // Map task ids to their bounds
    const boundsMap = new Map<string, { x1: number; x2: number; y: number }>();
    tasks.forEach((t, i) => {
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

    tasks.forEach(task => {
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

          const midX = (startX + endX) / 2;
          const pathStr = `M ${startX} ${startY} C ${midX} ${startY}, ${midX} ${endY}, ${endX} ${endY}`;

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
                className="dependency-line opacity-60 group-hover/line:opacity-100 group-hover/line:stroke-rose-500 animate-[dash_2s_linear_infinite]"
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
  }, [tasks, getPositionForDate, dayWidth, onBreakLink, t]);

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
          d={`M ${dragState.startX} ${dragState.startY} C ${(dragState.startX + dragState.currentX) / 2} ${dragState.startY}, ${(dragState.startX + dragState.currentX) / 2} ${dragState.currentY}, ${dragState.currentX} ${dragState.currentY}`}
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
