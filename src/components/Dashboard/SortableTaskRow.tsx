import type { TFunction } from 'i18next';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { memo, useState, type CSSProperties, type Dispatch, type SetStateAction } from 'react';
import { AssigneePicker } from './AssigneePicker';
import { StatusPicker } from './StatusPicker';
import { getStatusDotColor, getStatusTextColor } from '../../utils/statusColors';
import type { Task, User } from '../../types';
import { IconButton } from '../UI/IconButton';
import { getStartDateForCal, getTargetDateForCal } from '../../lib/githubTaskMapper';
import { getDashboardItemSortId } from '../../lib/taskOrderUtils';
import { TREE_DEPTH_COLORS, getTreeColor, getTreeHandleHoverColor } from '../../lib/treeColors';
import {
  getTreeDragHandleX,
  getTreeRowDividerLeft,
  type TreeRowMeta,
} from './taskSidebarTree';
import type { ContextMenuTarget } from './TaskGroupRow';
import { TreeTitleCell } from './TaskGroupRow';

const TASK_ASSIGNEE_CHIP_CLASS = 'w-4 h-4 shrink-0 rounded-full border shadow-sm flex items-center justify-center';
const TASK_ASSIGNEE_AVATAR_CLASS = `${TASK_ASSIGNEE_CHIP_CLASS} overflow-hidden`;
const TASK_ASSIGNEE_PLACEHOLDER_ICON_CLASS = 'material-symbols-outlined task-assignee-icon';

interface SortableTaskRowProps {
  task: Task;
  isFirst: boolean;
  treeMeta: TreeRowMeta;
  isLinkMode: boolean;
  isSelected: boolean;
  isLinkSelected: boolean;
  isDragActive: boolean;
  isAnyDragging: boolean;
  isMobile: boolean;
  movingItemSortId: string | null;
  openPickerTaskId: string | null;
  openStatusPickerTaskId: string | null;
  suppressNextClickRef: React.MutableRefObject<boolean>;
  openContextMenu: (clientX: number, clientY: number, target: ContextMenuTarget) => void;
  handleTaskActivate: (taskId: string) => void;
  setOpenPickerTaskId: Dispatch<SetStateAction<string | null>>;
  setOpenStatusPickerTaskId: Dispatch<SetStateAction<string | null>>;
  setIsLinkMode: (mode: boolean) => void;
  setSelectedLinkTaskIds: (tasks: string[] | ((prev: string[]) => string[])) => void;
  jumpToChart: (taskId: string) => void;
  t: TFunction;
}

export const SortableTaskRow = memo(function SortableTaskRow({
  task,
  isFirst,
  treeMeta,
  isLinkMode,
  isSelected,
  isLinkSelected,
  isDragActive,
  isAnyDragging,
  isMobile,
  movingItemSortId,
  openPickerTaskId,
  openStatusPickerTaskId,
  suppressNextClickRef,
  openContextMenu,
  handleTaskActivate,
  setOpenPickerTaskId,
  setOpenStatusPickerTaskId,
  setIsLinkMode,
  setSelectedLinkTaskIds,
  jumpToChart,
  t,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: getDashboardItemSortId(task) });
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [isDragHandleHovered, setIsDragHandleHovered] = useState(false);
  const [isDragHandleFocused, setIsDragHandleFocused] = useState(false);
  const [statusPickerAnchorRect, setStatusPickerAnchorRect] = useState<DOMRectReadOnly | null>(null);
  const [assigneePickerAnchorRect, setAssigneePickerAnchorRect] = useState<DOMRectReadOnly | null>(null);
  const sortId = getDashboardItemSortId(task);
  const isMovingThisTask = movingItemSortId === sortId;
  const showHoverActions = !isDragging && !isDragActive && !isAnyDragging;
  const dragHandleLeft = getTreeDragHandleX();
  const dragHandleFillClass = isLinkMode
    ? isLinkSelected ? 'bg-drag-handle-selected-link' : 'bg-slate-100/80 group-hover:bg-indigo-50'
    : isSelected ? 'bg-indigo-100' : 'bg-slate-100/80 group-hover:bg-indigo-50';
  const treeNodeColor = getTreeColor(Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1));
  const treeHandleHoverColor = getTreeHandleHoverColor(Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1));
  const dragHandleColor = isDragHandleHovered ? treeHandleHoverColor : isDragHandleFocused || isRowHovered ? treeNodeColor : undefined;
  const dividerLeft = getTreeRowDividerLeft(treeMeta.depth);
  const statusTextColor = getStatusTextColor(task.status);
  const isPickerOpen = openPickerTaskId === task.id || openStatusPickerTaskId === task.id;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: isMobile && isMovingThisTask ? 'none' : undefined,
        userSelect: isMobile ? 'none' : undefined,
        WebkitUserSelect: isMobile ? 'none' : undefined,
        WebkitTouchCallout: isMobile ? 'none' : undefined,
        '--tree-row-divider-left': `${dividerLeft}px`,
      } as CSSProperties}
      data-task-sortable-row="true"
      data-dashboard-sort-id={sortId}
      data-task-id={task.id}
      data-task-moving={isMobile && isMovingThisTask ? "true" : undefined}
      className={`grid grid-cols-1 gap-1 items-center h-[72px] pl-2 pr-0 cursor-pointer transition-all duration-200 relative group overflow-visible after:absolute after:bottom-0 after:left-[var(--tree-row-divider-left)] after:right-0 after:h-px after:bg-slate-100/50 after:content-[''] ${
        isLinkMode
          ? isLinkSelected ? 'bg-primary/10 ring-1 ring-primary/30 shadow-sm' : 'hover:bg-slate-50/80 bg-white'
          : isSelected ? 'bg-primary/[0.04] ring-1 ring-primary/10 shadow-sm' : 'hover:bg-slate-50/80 bg-white'
      } ${isDragging ? 'z-50 shadow-lg ring-1 ring-primary/20 bg-white' : isPickerOpen ? 'z-20' : ''}`}
      onClick={() => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        handleTaskActivate(task.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, { kind: 'task', taskId: task.id });
      }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
      aria-pressed={isLinkMode ? isLinkSelected : undefined}
      role="button"
      tabIndex={0}
      {...listeners}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleTaskActivate(task.id);
        }
      }}
    >
      {(isSelected || isLinkSelected) && (
        <div className="absolute left-0 top-0 h-full w-0.5 bg-primary rounded-r-full z-10" />
      )}

      <button
        type="button"
        data-task-drag-handle="true"
        className={`pointer-events-auto absolute top-1/2 z-20 inline-flex h-[72px] w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-none text-slate-400 transition-[opacity,color,background-color] cursor-grab active:cursor-grabbing focus:outline-none border-none shadow-none ${dragHandleFillClass} ${
          isAnyDragging && !isDragging && !isDragActive ? 'opacity-0 pointer-events-none' : 'task-drag-handle'
        } ${
          isDragging || isDragActive ? 'is-dragging' : ''
        }`}
        style={{
          left: dragHandleLeft,
          color: dragHandleColor,
        } as CSSProperties}
        onMouseEnter={() => setIsDragHandleHovered(true)}
        onMouseLeave={() => setIsDragHandleHovered(false)}
        onFocus={() => setIsDragHandleFocused(true)}
        onBlur={() => setIsDragHandleFocused(false)}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        title={t('dashboard.dragToReorder', 'Drag to reorder')}
        aria-label={t('dashboard.dragToReorder', 'Drag to reorder')}
        {...attributes}
        {...listeners}
      >
        <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
      </button>

      <TreeTitleCell treeMeta={treeMeta} nodeKind="task">
        <span className={`overflow-hidden text-ellipsis text-sm font-medium transition-colors leading-tight line-clamp-2 break-words ${task.status === 'Done' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700 group-hover:text-primary'}`}>
          <span className={statusTextColor}>{task.displayId}</span>{' '}
          {task.title}
        </span>
        <div className="status-assignees flex items-center gap-3 mt-1 mb-0.5">
          <div className="group/status relative flex items-center min-w-0">
            <div
              className="flex items-center gap-1 cursor-pointer hover:bg-slate-100/80 transition-colors px-1 rounded border border-slate-200/50 bg-slate-50/60 h-4"
              onClick={(e) => {
                e.stopPropagation();
                if (openStatusPickerTaskId === task.id) {
                  setStatusPickerAnchorRect(null);
                  setOpenStatusPickerTaskId(null);
                } else {
                  setStatusPickerAnchorRect(e.currentTarget.getBoundingClientRect());
                  setOpenPickerTaskId(null);
                  setOpenStatusPickerTaskId(task.id);
                }
              }}
              title={t('dashboard.updateStatus', 'Update status')}
            >
              <span className={`w-1.5 h-1.5 rounded-full ring-1 ring-white shadow-sm ${getStatusDotColor(task.status)}`}></span>
              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter truncate max-w-[60px]">
                {task.status}
              </span>
            </div>
            {openStatusPickerTaskId === task.id && (
              <StatusPicker
                task={task}
                anchorRect={statusPickerAnchorRect}
                onClose={() => {
                  setStatusPickerAnchorRect(null);
                  setOpenStatusPickerTaskId(null);
                }}
              />
            )}
          </div>

          <div className="group/assignee relative flex items-center justify-center">
            <div
              className="flex -space-x-1 cursor-pointer hover:scale-105 transition-transform"
              onClick={(e) => {
                e.stopPropagation();
                if (openPickerTaskId === task.id) {
                  setAssigneePickerAnchorRect(null);
                  setOpenPickerTaskId(null);
                } else {
                  setAssigneePickerAnchorRect(e.currentTarget.getBoundingClientRect());
                  setOpenStatusPickerTaskId(null);
                  setOpenPickerTaskId(task.id);
                }
              }}
              title={t('dashboard.updateAssignees', 'Update assignees')}
            >
              {task.assignees.length > 0 ? (
                <>
                  {task.assignees.slice(0, 3).map((user: User, idx: number) => (
                    <div key={user.id} className={`${TASK_ASSIGNEE_AVATAR_CLASS} border-white text-[7px] font-bold ${user.avatarColor}`} style={{ zIndex: 10 - idx }} title={user.name}>
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.initials} className="w-full h-full rounded-full object-cover" />
                      ) : user.initials}
                    </div>
                  ))}
                  {task.assignees.length > 3 && (
                    <div className={`${TASK_ASSIGNEE_AVATAR_CLASS} border-white text-[6px] font-bold bg-slate-100 text-slate-500`} style={{ zIndex: 0 }}>
                      +{task.assignees.length - 3}
                    </div>
                  )}
                </>
              ) : (
                <div className={`${TASK_ASSIGNEE_CHIP_CLASS} border-primary/40 bg-primary/10 text-primary shadow-primary/10 group-hover/assignee:border-primary/70 group-hover/assignee:bg-primary/15 group-hover/assignee:text-primary`}>
                  <span className={TASK_ASSIGNEE_PLACEHOLDER_ICON_CLASS}>person_add</span>
                </div>
              )}
            </div>
            {openPickerTaskId === task.id && (
              <AssigneePicker
                taskId={task.id}
                currentAssignees={task.assignees}
                repository={task.repository}
                anchorRect={assigneePickerAnchorRect}
                onClose={() => {
                  setAssigneePickerAnchorRect(null);
                  setOpenPickerTaskId(null);
                }}
              />
            )}
          </div>

          <div className="truncate text-[10px] font-medium text-slate-400">{getStartDateForCal(task)} - {getTargetDateForCal(task)}</div>
        </div>
      </TreeTitleCell>

      <div className={`absolute right-2 ${isFirst ? 'top-full translate-y-[-60%]' : 'bottom-full translate-y-[60%]'} flex items-center gap-1 opacity-0 ${showHoverActions ? 'group-hover:opacity-100' : ''} transition-opacity z-10 pointer-events-none bg-white/90 backdrop-blur rounded shadow-sm border border-slate-200 p-0.5`}>
        <IconButton
          icon="link"
          variant="ghost"
          size="xs"
          className="pointer-events-none group-hover:pointer-events-auto text-slate-500 hover:text-primary hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            setIsLinkMode(true);
            setSelectedLinkTaskIds([task.id]);
          }}
          title={t('dashboard.linkTasks') || 'Link Tasks'}
          aria-label={t('dashboard.linkTasks') || 'Link Tasks'}
        />
        <IconButton
          icon="center_focus_strong"
          variant="ghost"
          size="xs"
          className="pointer-events-none group-hover:pointer-events-auto text-slate-500 hover:text-primary hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            jumpToChart(task.id);
          }}
          title={t('dashboard.centerInGantt') || 'Center in Gantt'}
          aria-label={t('dashboard.centerInGantt') || 'Center in Gantt'}
        />
        <IconButton
          icon="more_horiz"
          variant="ghost"
          size="xs"
          className="pointer-events-none group-hover:pointer-events-auto text-slate-500 hover:text-primary hover:bg-primary/10"
          onClick={(e) => {
            e.stopPropagation();
            openContextMenu(e.clientX, e.clientY, { kind: 'task', taskId: task.id });
          }}
          title={t('dashboard.moreActions', 'More actions')}
          aria-label={t('dashboard.moreActions', 'More actions')}
        />
      </div>
    </div>
  );
});
