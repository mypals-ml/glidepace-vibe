import { useTranslation } from 'react-i18next';
import { getStatusColor } from '../../../utils/statusColors';
import type { Task } from '../../../types';

export interface TimelineTaskBarDragState {
  taskId: string;
  pointerId: number;
  originClientX: number;
  originClientY: number;
  originRowIndex: number;
  deltaX: number;
  deltaY: number;
  hasMoved: boolean;
}

interface TimelineTaskRowProps {
  task: Task;
  rowIndex: number;
  left: number;
  displayWidth: number;
  isSelected: boolean;
  isLinkMode: boolean;
  isLinkSelected: boolean;
  isLinkDropTarget: boolean;
  isGanttDropTarget: boolean;
  hoveredTargetTaskId: string | null;
  taskDrag: TimelineTaskBarDragState | null;
  onTaskActivate: (taskId: string) => void;
  onOpenContextMenu: (clientX: number, clientY: number, taskId: string, anchor: HTMLElement) => void;
  onTaskBarPointerDown: (e: React.PointerEvent<HTMLDivElement>, task: Task, rowIndex: number) => void;
  onTaskBarPointerMove: (e: React.PointerEvent<HTMLDivElement>, taskId: string) => void;
  onTaskBarPointerEnd: (e: React.PointerEvent<HTMLDivElement>, task: Task) => void;
  onTaskBarPointerCancel: (e: React.PointerEvent<HTMLDivElement>, taskId: string) => void;
  onClearLongPressTimer: () => void;
  onScheduleLongPressContextMenu: (clientX: number, clientY: number, taskId: string, anchor: HTMLElement) => void;
  shouldSuppressClick: () => boolean;
  clearSuppressClick: () => void;
  onLinkDragStart: (e: React.MouseEvent, taskId: string, startX: number, startY: number) => void;
  onLinkDrop: (targetTaskId: string) => void;
  onLinkHoverTargetEnter: (taskId: string) => void;
  onLinkHoverTargetLeave: (taskId: string) => void;
  linkDragSourceTaskId: string | null;
}

export function TimelineTaskRow({
  task,
  rowIndex,
  left,
  displayWidth,
  isSelected,
  isLinkMode,
  isLinkSelected,
  isLinkDropTarget,
  isGanttDropTarget,
  hoveredTargetTaskId,
  taskDrag,
  onTaskActivate,
  onOpenContextMenu,
  onTaskBarPointerDown,
  onTaskBarPointerMove,
  onTaskBarPointerEnd,
  onTaskBarPointerCancel,
  onClearLongPressTimer,
  onScheduleLongPressContextMenu,
  shouldSuppressClick,
  clearSuppressClick,
  onLinkDragStart,
  onLinkDrop,
  onLinkHoverTargetEnter,
  onLinkHoverTargetLeave,
  linkDragSourceTaskId,
}: TimelineTaskRowProps) {
  const { t } = useTranslation();
  const hideLinkHandles = Boolean(taskDrag);

  return (
    <div
      key={task.id}
      className={`relative h-[72px] w-full flex items-center group px-2 pointer-events-none transition-all duration-200 ${
        isSelected ? 'z-20' : 'z-10'
      } ${taskDrag?.hasMoved ? 'z-50 shadow-lg ring-1 ring-primary/20 bg-primary/[0.04]' : ''} ${
        isGanttDropTarget ? 'bg-primary/[0.06] ring-2 ring-inset ring-primary/30' : ''
      }`}
      style={{
        transform: taskDrag?.hasMoved ? `translateY(${taskDrag.deltaY}px)` : undefined,
      }}
    >
      {isSelected && (
        <div className="absolute inset-y-0 left-0 right-0 bg-primary/[0.03] pointer-events-none" />
      )}
      <div
        data-gantt-task-bar="true"
        className={`absolute h-10 rounded-lg border flex items-center px-4 select-none pointer-events-auto ${
          taskDrag?.hasMoved ? 'cursor-grabbing transition-[box-shadow,border-color,ring-color]' : 'cursor-grab transition-[transform,box-shadow,border-color,ring-color]'
        } ${
          isSelected
            ? `ring-4 ring-primary/30 border-primary shadow-lg scale-[1.02] z-30 ${getStatusColor(task.status).replace('border-slate-200', 'border-primary')}`
            : `shadow-md hover:scale-[1.02] hover:z-20 active:scale-[0.98] ${getStatusColor(task.status)}`
        }`}
        style={{
          left: `${left}px`,
          width: `${displayWidth}px`,
          transform: taskDrag?.hasMoved ? `translateX(${taskDrag.deltaX}px)` : undefined,
          userSelect: 'none',
          WebkitUserSelect: 'none',
          WebkitTouchCallout: 'none',
          touchAction: 'manipulation',
        }}
        onClick={() => {
          if (shouldSuppressClick()) {
            clearSuppressClick();
            return;
          }
          onTaskActivate(task.id);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          onOpenContextMenu(e.clientX, e.clientY, task.id, e.currentTarget);
        }}
        onPointerMove={(e) => {
          onClearLongPressTimer();
          onTaskBarPointerMove(e, task.id);
        }}
        onPointerUp={(e) => {
          onClearLongPressTimer();
          onTaskBarPointerEnd(e, task);
        }}
        onPointerCancel={(e) => {
          onClearLongPressTimer();
          onTaskBarPointerCancel(e, task.id);
        }}
        onPointerLeave={onClearLongPressTimer}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse') {
            onClearLongPressTimer();
            onScheduleLongPressContextMenu(e.clientX, e.clientY, task.id, e.currentTarget);
            return;
          }
          onTaskBarPointerDown(e, task, rowIndex);
        }}
        aria-pressed={isLinkMode ? isLinkSelected : undefined}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onTaskActivate(task.id);
          }
        }}
      >
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-xs font-bold leading-tight line-clamp-2 overflow-hidden text-ellipsis break-words">
            <span className="text-slate-400">{task.displayId}</span>{' '}
            {task.title}
          </span>
        </div>
        {task.progress === 100 && (
          <div className="ml-2 flex items-center">
            <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
          </div>
        )}
      </div>
      <div
        data-gantt-link-handle="true"
        className={`absolute z-40 flex items-center justify-center rounded-full cursor-grab pointer-events-auto transition-[transform,box-shadow,border-color,ring-color,opacity] ${
          hideLinkHandles
            ? 'opacity-0 pointer-events-none'
            : hoveredTargetTaskId === task.id
              ? 'w-6 h-6 bg-emerald-50 opacity-100 ring-2 ring-emerald-400/80 shadow-md shadow-emerald-500/20 scale-105'
              : isLinkDropTarget
                ? 'w-5 h-5 bg-indigo-100/80 opacity-100 ring-2 ring-indigo-300/60 shadow-md shadow-indigo-500/20'
                : 'w-7 h-7 opacity-0 group-hover:opacity-100'
        }`}
        style={{ left: `${left}px`, top: '50%', transform: 'translate(-50%, -50%)' }}
        onMouseEnter={() => {
          if (linkDragSourceTaskId && linkDragSourceTaskId !== task.id) {
            onLinkHoverTargetEnter(task.id);
          }
        }}
        onMouseLeave={() => {
          if (hoveredTargetTaskId === task.id) {
            onLinkHoverTargetLeave(task.id);
          }
        }}
        onMouseUp={(e) => {
          e.stopPropagation();
          onLinkDrop(task.id);
        }}
        title={t('dashboard.dropToCreateLink') || 'Drop to create link'}
      >
        <span
          className={`rounded-full border-2 transition-all ${
            hoveredTargetTaskId === task.id
              ? 'w-3 h-3 bg-emerald-500 border-white animate-pulse'
              : isLinkDropTarget
                ? 'w-2.5 h-2.5 bg-indigo-500 border-white'
                : 'w-3 h-3 bg-indigo-200 border-indigo-500 hover:scale-125'
          }`}
        />
      </div>
      <div
        data-gantt-link-handle="true"
        className={`absolute w-3 h-3 rounded-full bg-indigo-500 border-2 border-white transition-[opacity,transform] z-40 cursor-crosshair hover:scale-125 shadow-sm pointer-events-auto ${
          hideLinkHandles ? 'opacity-0 pointer-events-none' : 'opacity-0 group-hover:opacity-100'
        }`}
        style={{ left: `${left + displayWidth - 6}px`, top: '50%', transform: 'translateY(-50%)' }}
        onMouseDown={(e) => {
          onLinkDragStart(e, task.id, left + displayWidth, rowIndex * 72 + 36);
        }}
        title={t('dashboard.dragToLink') || 'Drag to link to successor'}
      />
    </div>
  );
}