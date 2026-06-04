import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type MouseSensorOptions, type TouchSensorOptions } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneePicker } from './AssigneePicker';
import { StatusPicker } from './StatusPicker';
import { getStatusDotColor, getStatusTextColor } from '../../utils/statusColors';
import type { DashboardItem, Task, TaskGroupBlock, User } from '../../types';
import { memo, useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect, type CSSProperties, type Dispatch, type MouseEvent as ReactMouseEvent, type ReactNode, type SetStateAction, type TouchEvent as ReactTouchEvent } from 'react';
import { IconButton } from '../UI/IconButton';
import { getStartDateForCal, getTargetDateForCal } from '../../lib/githubTaskMapper';
import { FloatingSequenceBuilder } from './FloatingSequenceBuilder';
import { getDashboardGroupDropPlan, getDashboardItemSortId, getDashboardTaskGroupPathMovePlan, getGroupPathForCreatedTaskTarget, getTaskOrderId, getVisibleDashboardMovePlan } from '../../lib/taskOrderUtils';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isTaskGroupBlock, parseSlashGroupPath, serializeSlashGroupPath } from '../../lib/taskGroupUtils';
import { buildBreakLinkPlan, type BreakLinkScope } from '../../lib/contextMenuLinkUtils';
import { Button } from '../UI/Button';
import { TREE_DEPTH_COLORS, getTreeColor, getTreeLineColor, getTreeHandleHoverColor } from '../../lib/treeColors';

type ContextMenuTarget =
  | { kind: 'task'; taskId: string }
  | { kind: 'group'; groupBlockId: string };

type ContextMenuState = { x: number; y: number; target: ContextMenuTarget; alignRight: boolean };

const TREE_NODE_BASE_X = 12;
const TREE_DEPTH_STEP = 20;
const TREE_CONTENT_GAP = 18;
const TREE_ELBOW_HEIGHT = 16;
const TREE_ELBOW_RADIUS = 8;
const TREE_ROW_HEIGHT = 72;
const TREE_ROW_PADDING_LEFT = 8;
const TASK_ASSIGNEE_CHIP_CLASS = 'w-4 h-4 shrink-0 rounded-full border shadow-sm flex items-center justify-center';
const TASK_ASSIGNEE_AVATAR_CLASS = `${TASK_ASSIGNEE_CHIP_CLASS} overflow-hidden`;
const TASK_ASSIGNEE_PLACEHOLDER_ICON_CLASS = 'material-symbols-outlined task-assignee-icon';
const CONTEXT_MENU_VIEWPORT_PADDING = 8;

interface TreeRowMeta {
  depth: number;
  guideSegments: TreeGuideSegment[];
}

interface TreeGuideSegment {
  level: number;
  startsAtNode: boolean;
  endsAtJoint: boolean;
}

interface DashboardTreeRow {
  item: DashboardItem;
  treeMeta: TreeRowMeta;
}

function eventTargetElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
}

function blurActiveDragHandle() {
  const activeElement = document.activeElement;
  if (activeElement instanceof HTMLElement && activeElement.matches('[data-task-drag-handle="true"]')) {
    activeElement.blur();
  }
}

function getDashboardItemTreeDepth(item: DashboardItem): number {
  if (isTaskGroupBlock(item)) return item.depth;
  return item.depth ?? (item.groupPath?.length ?? 0) + 1;
}

function getTreeNodeX(depth: number): number {
  return TREE_NODE_BASE_X + Math.min(Math.max(depth, 0), TREE_DEPTH_COLORS.length - 1) * TREE_DEPTH_STEP;
}

function getTreeDragHandleX(): number {
  return TREE_ROW_PADDING_LEFT;
}

function getTreeRowDividerLeft(depth: number): number {
  return TREE_ROW_PADDING_LEFT + getTreeNodeX(depth) + TREE_CONTENT_GAP;
}

function buildDashboardTreeRows(items: DashboardItem[]): DashboardTreeRow[] {
  const depths = items.map(getDashboardItemTreeDepth);
  const subtreeEndIndexes = depths.map((depth, index) => {
    let endIndex = index;
    for (let candidateIndex = index + 1; candidateIndex < depths.length; candidateIndex += 1) {
      if (depths[candidateIndex] <= depth) break;
      endIndex = candidateIndex;
    }
    return endIndex;
  });
  const hasNextSibling = depths.map((depth, index) => {
    const nextIndexAfterSubtree = subtreeEndIndexes[index] + 1;
    return depths[nextIndexAfterSubtree] === depth;
  });
  const branchStack: number[] = [];

  return items.map((item, index) => {
    const depth = depths[index];
    const nextDepth = depths[index + 1] ?? null;
    const hasChildren = nextDepth !== null && nextDepth > depth;

    branchStack.length = depth + 1;
    branchStack[depth] = index;

    const guideSegments: TreeGuideSegment[] = [];
    for (let level = 0; level < depth; level += 1) {
      const childBranchIndex = branchStack[level + 1];
      if (childBranchIndex === undefined) continue;

      const isChildBranchRoot = childBranchIndex === index;
      if (hasNextSibling[childBranchIndex] || isChildBranchRoot) {
        guideSegments.push({
          level,
          startsAtNode: false,
          endsAtJoint: !hasNextSibling[childBranchIndex] && isChildBranchRoot,
        });
      }
    }

    if (hasChildren) {
      guideSegments.push({
        level: depth,
        startsAtNode: true,
        endsAtJoint: false,
      });
    }

    return {
      item,
      treeMeta: {
        depth,
        guideSegments,
      },
    };
  });
}

class TaskMouseSensor extends MouseSensor {
  static activators = [{
    eventName: 'onMouseDown' as const,
    handler: (event: ReactMouseEvent, options: MouseSensorOptions) => {
      const target = eventTargetElement(event.nativeEvent.target);
      if (!target?.closest('[data-task-drag-handle="true"]')) return false;
      return MouseSensor.activators[0].handler(event, options);
    },
  }];
}

class TaskTouchSensor extends TouchSensor {
  static activators = [{
    eventName: 'onTouchStart' as const,
    handler: (event: ReactTouchEvent, options: TouchSensorOptions) => {
      const target = eventTargetElement(event.nativeEvent.target);
      if (!target?.closest('[data-task-moving="true"]')) return false;
      return TouchSensor.activators[0].handler(event, options);
    },
  }];
}

export interface TaskSidebarProps {
  scrollRef?: React.RefObject<HTMLDivElement | null>;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
}

export function TaskSidebar({ scrollRef, onScroll }: TaskSidebarProps) {
  const { t } = useTranslation();
  const { 
    filteredTasks, 
    dashboardItems,
    tasks, 
    projectFields,
    selectedGroupFieldIds,
    setSelectedGroupFieldIds,
    isLoadingTasks, 
    searchQuery, 
    setSearchQuery, 
    selectedTaskId, 
    setSelectedTaskId, 
    setIsCreateMode, 
    setIsChartVisible,
    setDashboardView,
    apiError,
    fieldsProgress,
    mappingStatus,
    setIsTaskDetailsOpen,
    centerGanttOnTask,
    isLinkMode,
    setIsLinkMode,
    selectedLinkTaskIds,
    setSelectedLinkTaskIds,
    updateTaskSuccessors,
    updateTaskGroupPath,
    renameGroupBlock,
    ungroupGroupBlock,
    toggleGroupBlockCollapsed,
    reorderTask,
    reorderTaskBlock,
    moveTaskToGroupPath,
    setPendingTaskInsertPosition,
  } = useDashboard();
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const [movingItemSortId, setMovingItemSortId] = useState<string | null>(null);
  const [openPickerTaskId, setOpenPickerTaskId] = useState<string | null>(null);
  const [openStatusPickerTaskId, setOpenStatusPickerTaskId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [activeDragItemSortId, setActiveDragItemSortId] = useState<string | null>(null);
  const [groupEditor, setGroupEditor] = useState<
    | { mode: 'taskPath'; taskId: string; value: string }
    | { mode: 'renameGroup'; groupBlockId: string; value: string }
    | null
  >(null);
  const [isSavingGroupEditor, setIsSavingGroupEditor] = useState(false);
  const [isFieldGroupDialogOpen, setIsFieldGroupDialogOpen] = useState(false);
  const [draftGroupFieldIds, setDraftGroupFieldIds] = useState<string[]>([]);
  const [fieldGroupSearchQuery, setFieldGroupSearchQuery] = useState('');
  const [draggedGroupFieldId, setDraggedGroupFieldId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef(false);
  const dragHasMovedRef = useRef(false);
  const justDroppedRef = useRef(false);

  useEffect(() => {
    if (!movingItemSortId) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-dashboard-sort-id="${movingItemSortId}"]`)) {
        setMovingItemSortId(null);
      }
    };

    const timeoutId = setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
      document.addEventListener('touchstart', handleOutsideClick);
    }, 100);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('click', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [movingItemSortId]);

  const openContextMenu = useCallback((clientX: number, clientY: number, target: ContextMenuTarget) => {
    if (activeDragItemSortId || justDroppedRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    setContextMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      target,
      alignRight: clientX - rect.left > rect.width - 220
    });
  }, [activeDragItemSortId]);

  useLayoutEffect(() => {
    if (!contextMenu) return;

    const rootRect = rootRef.current?.getBoundingClientRect();
    const menuRect = contextMenuRef.current?.getBoundingClientRect();
    if (!rootRect || !menuRect) return;

    const visibleBottom = Math.min(rootRect.height, window.innerHeight - rootRect.top);
    const maxY = Math.max(
      CONTEXT_MENU_VIEWPORT_PADDING,
      visibleBottom - menuRect.height - CONTEXT_MENU_VIEWPORT_PADDING,
    );
    const nextY = Math.min(Math.max(contextMenu.y, CONTEXT_MENU_VIEWPORT_PADDING), maxY);

    if (nextY !== contextMenu.y) {
      setContextMenu(prev => prev ? { ...prev, y: nextY } : prev);
    }
  }, [contextMenu]);

  const findTaskByOrderId = useCallback((taskId: string): Task | undefined => {
    return tasks.find(task => task.id === taskId || task.itemId === taskId || getTaskOrderId(task) === taskId);
  }, [tasks]);

  const findGroupById = useCallback((groupBlockId: string): TaskGroupBlock | undefined => {
    const item = dashboardItems.find(candidate => isTaskGroupBlock(candidate) && candidate.groupBlockId === groupBlockId);
    return item && isTaskGroupBlock(item) ? item : undefined;
  }, [dashboardItems]);

  const getGroupBoundaryTasks = useCallback((group: TaskGroupBlock): { firstTask: Task; lastTask: Task } | null => {
    const firstTaskId = group.childTaskIds[0];
    const lastTaskId = group.childTaskIds[group.childTaskIds.length - 1];
    const firstTask = firstTaskId ? findTaskByOrderId(firstTaskId) : undefined;
    const lastTask = lastTaskId ? findTaskByOrderId(lastTaskId) : undefined;
    return firstTask && lastTask ? { firstTask, lastTask } : null;
  }, [findTaskByOrderId]);

  const getContextBoundaryTasks = useCallback((target: ContextMenuTarget): { firstTask: Task; lastTask: Task } | null => {
    if (target.kind === 'task') {
      const task = findTaskByOrderId(target.taskId);
      return task ? { firstTask: task, lastTask: task } : null;
    }

    const group = findGroupById(target.groupBlockId);
    return group ? getGroupBoundaryTasks(group) : null;
  }, [findGroupById, findTaskByOrderId, getGroupBoundaryTasks]);

  const getContextTargetSortId = useCallback((target: ContextMenuTarget): string | null => {
    if (target.kind === 'group') return `group:${target.groupBlockId}`;

    const task = findTaskByOrderId(target.taskId);
    return task ? getDashboardItemSortId(task) : null;
  }, [findTaskByOrderId]);

  const startCreateTaskAt = (target: ContextMenuTarget, placement: 'above' | 'below') => {
    const boundaryTasks = getContextBoundaryTasks(target);
    if (!boundaryTasks) return;
    const targetItem = target.kind === 'task'
      ? findTaskByOrderId(target.taskId)
      : findGroupById(target.groupBlockId);
    if (!targetItem) return;
    const targetTaskId = placement === 'above' ? boundaryTasks.firstTask.id : boundaryTasks.lastTask.id;
    setPendingTaskInsertPosition({
      targetTaskId,
      placement,
      groupPath: getGroupPathForCreatedTaskTarget(targetItem),
    });
    setIsCreateMode(true);
    setSelectedTaskId(null);
    setIsTaskDetailsOpen(true);
    setContextMenu(null);
  };

  const handleTaskActivate = useCallback((taskId: string) => {
    if (isLinkMode) {
      setSelectedLinkTaskIds(prev =>
        prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      );
      return;
    }

    setIsCreateMode(false);
    setSelectedTaskId(taskId);
    setIsTaskDetailsOpen(true);
  }, [isLinkMode, setIsCreateMode, setIsTaskDetailsOpen, setSelectedLinkTaskIds, setSelectedTaskId]);

  const handleJumpToChart = (taskId: string) => {
    const task = findTaskByOrderId(taskId);
    if (!task) return;
    setIsCreateMode(false);
    setSelectedTaskId(task.id);
    setIsTaskDetailsOpen(false);
    setDashboardView('gantt');
    setIsChartVisible(true);

    const startDate = task ? getStartDateForCal(task) : null;
    if (startDate) {
      centerGanttOnTask(task.id, startDate);
    }

    setContextMenu(null);
  };

  const handleJumpContextTargetToChart = (target: ContextMenuTarget) => {
    const boundaryTasks = getContextBoundaryTasks(target);
    if (!boundaryTasks) return;
    handleJumpToChart(boundaryTasks.firstTask.id);
  };

  const handleAddSuccessorsFromContext = (target: ContextMenuTarget) => {
    const boundaryTasks = getContextBoundaryTasks(target);
    if (!boundaryTasks) return;

    setIsLinkMode(true);
    setSelectedLinkTaskIds([boundaryTasks.lastTask.id]);
    setContextMenu(null);
  };

  const getBreakLinkPlanForContext = useCallback((target: ContextMenuTarget, scope: BreakLinkScope) => {
    const boundaryTasks = getContextBoundaryTasks(target);
    return boundaryTasks ? buildBreakLinkPlan(tasks, boundaryTasks, scope) : null;
  }, [getContextBoundaryTasks, tasks]);

  const handleBreakLinksFromContext = async (target: ContextMenuTarget, scope: BreakLinkScope) => {
    const plan = getBreakLinkPlanForContext(target, scope);
    if (!plan) return;

    for (const operation of plan.operations) {
      await updateTaskSuccessors(operation.taskId, operation.successorIds, true);
    }

    setContextMenu(null);
  };

  const contextBreakLinkPlan = useMemo(() => {
    if (!contextMenu) return null;
    return getBreakLinkPlanForContext(contextMenu.target, 'all');
  }, [contextMenu, getBreakLinkPlanForContext]);

  const getExistingGroupPaths = useCallback((): string[] => {
    const paths = new Set<string>();
    tasks.forEach(task => {
      const formatted = serializeSlashGroupPath(task.groupPath);
      if (formatted) {
        paths.add(formatted);
      }
    });
    return Array.from(paths).sort();
  }, [tasks]);

  const promptTaskGroupPath = async (taskId: string) => {
    const task = filteredTasks.find(t => t.id === taskId || t.itemId === taskId);
    if (!task) return;

    setGroupEditor({
      mode: 'taskPath',
      taskId: task.id,
      value: serializeSlashGroupPath(task.groupPath),
    });
    setContextMenu(null);
  };

  const promptRenameGroup = async (group: TaskGroupBlock) => {
    setGroupEditor({
      mode: 'renameGroup',
      groupBlockId: group.groupBlockId,
      value: group.name,
    });
    setContextMenu(null);
  };

  const handleSaveGroupEditor = async () => {
    if (!groupEditor || isSavingGroupEditor) return;

    setIsSavingGroupEditor(true);
    try {
      const success = groupEditor.mode === 'taskPath'
        ? await updateTaskGroupPath(
            groupEditor.taskId,
            parseSlashGroupPath(groupEditor.value)
          )
        : await renameGroupBlock(groupEditor.groupBlockId, groupEditor.value);

      if (success) {
        setGroupEditor(null);
      }
    } finally {
      setIsSavingGroupEditor(false);
    }
  };

  const sensors = useSensors(
    useSensor(TaskMouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TaskTouchSensor, {
      activationConstraint: movingItemSortId
        ? { distance: 5 }
        : { delay: 550, tolerance: 8 }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableItemIds = useMemo(
    () => dashboardItems.map(getDashboardItemSortId),
    [dashboardItems]
  );
  const dashboardRows = useMemo(() => buildDashboardTreeRows(dashboardItems), [dashboardItems]);
  const projectFieldsById = useMemo(() => {
    return new Map(projectFields.map(field => [field.id, field]));
  }, [projectFields]);
  const sortedProjectFields = useMemo(() => {
    return [...projectFields].sort((a, b) => a.name.localeCompare(b.name));
  }, [projectFields]);
  const filteredProjectFields = useMemo(() => {
    const query = fieldGroupSearchQuery.trim().toLowerCase();
    if (!query) return sortedProjectFields;

    return sortedProjectFields.filter(field => {
      const fieldName = field.name.toLowerCase();
      const fieldType = field.dataType?.toLowerCase() || '';
      return fieldName.includes(query) || fieldType.includes(query);
    });
  }, [fieldGroupSearchQuery, sortedProjectFields]);
  const isDraggingTask = useMemo(() => {
    if (!activeDragItemSortId) return false;
    const activeItem = dashboardItems.find(item => getDashboardItemSortId(item) === activeDragItemSortId);
    return Boolean(activeItem && !isTaskGroupBlock(activeItem));
  }, [activeDragItemSortId, dashboardItems]);

  const handleDragStart = (event: DragStartEvent) => {
    dragHasMovedRef.current = false;
    setActiveDragItemSortId(String(event.active.id));
    suppressNextClickRef.current = true;
    setContextMenu(null);
  };

  const handleDragMove = () => {
    dragHasMovedRef.current = true;
    setContextMenu(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    try {
      const { active, over } = event;
      if (!over) return;

      const groupDropPlan = getDashboardGroupDropPlan(dashboardItems, String(active.id), String(over.id));
      if (groupDropPlan) {
        await moveTaskToGroupPath(groupDropPlan.taskId, groupDropPlan.targetGroupPath, groupDropPlan.afterTaskId);
        return;
      }

      const taskGroupPathMovePlan = getDashboardTaskGroupPathMovePlan(dashboardItems, String(active.id), String(over.id));
      if (taskGroupPathMovePlan) {
        await moveTaskToGroupPath(
          taskGroupPathMovePlan.taskId,
          taskGroupPathMovePlan.targetGroupPath,
          taskGroupPathMovePlan.afterTaskId
        );
        return;
      }

      const movePlan = getVisibleDashboardMovePlan(dashboardItems, String(active.id), String(over.id));
      if (!movePlan) return;

      if (movePlan.taskIds.length === 1) {
        await reorderTask(movePlan.taskIds[0], movePlan.afterTaskId);
      } else {
        await reorderTaskBlock(movePlan.taskIds, movePlan.afterTaskId);
      }
    } finally {
      setActiveDragItemSortId(null);
      setMovingItemSortId(null);
      blurActiveDragHandle();
      dragHasMovedRef.current = false;
      justDroppedRef.current = true;
      setTimeout(() => {
        justDroppedRef.current = false;
      }, 100);
    }
  };

  const openFieldGroupDialog = () => {
    setDraftGroupFieldIds(selectedGroupFieldIds);
    setFieldGroupSearchQuery('');
    setIsFieldGroupDialogOpen(true);
  };

  const closeFieldGroupDialog = () => {
    setFieldGroupSearchQuery('');
    setIsFieldGroupDialogOpen(false);
  };

  const toggleDraftGroupField = (fieldId: string) => {
    setDraftGroupFieldIds(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const moveDraftGroupFieldTo = (fieldId: string, targetFieldId: string) => {
    setDraftGroupFieldIds(prev => {
      const sourceIndex = prev.indexOf(fieldId);
      const targetIndex = prev.indexOf(targetFieldId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return prev;
      const next = [...prev];
      const [movedFieldId] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedFieldId);
      return next;
    });
  };

  const saveFieldGroupSelection = () => {
    setSelectedGroupFieldIds(draftGroupFieldIds);
    closeFieldGroupDialog();
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative" ref={rootRef} data-testid="task-sidebar-root">
      {/* Header - Moved outside scroll container for alignment */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] grid grid-cols-[32px_minmax(0,1fr)_64px_76px] gap-1 pl-1.5 pr-0 h-[var(--dashboard-header-height)] items-center flex-shrink-0" aria-label={t('dashboard.issuesList')}>
        <IconButton
          icon="dataset"
          variant="ghost"
          size="xs"
          className="text-slate-500 hover:text-primary hover:bg-primary/10"
          onClick={openFieldGroupDialog}
          title={t('dashboard.groupByFields', 'Group by Fields')}
          aria-label={t('dashboard.groupByFields', 'Group by Fields')}
        />
        <div className="flex min-w-0 items-center gap-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
          <span className="shrink-0">{t('table.tasks', 'Tasks')}</span>
        </div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider"></div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center"></div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar" ref={scrollRef} onScroll={onScroll}>
        {/* Task List Container */}
        <div className="flex flex-col relative z-0 pb-[var(--search-bar-height)]">
          {isLoadingTasks ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-sm font-medium">{t('dashboard.loadingTasks')}</span>
            </div>
          ) : (apiError) ? (
            <div className="p-4 bg-red-50 border border-red-100 rounded-lg mx-2 my-4">
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="material-symbols-outlined text-red-400">error</span>
                <p className="text-sm text-red-700 font-medium">{t('dashboard.githubApiErrorTitle')}</p>
                <p className="text-xs text-red-600 line-clamp-3 overflow-hidden text-ellipsis px-2">{apiError}</p>
              </div>
            </div>
          ) : tasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              {t('dashboard.noTasksInProject')}
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs italic">
              {t('dashboard.noMatchingTasks')}
            </div>
          ) : (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragMove={handleDragMove}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setActiveDragItemSortId(null);
                setMovingItemSortId(null);
                blurActiveDragHandle();
                dragHasMovedRef.current = false;
                justDroppedRef.current = true;
                setTimeout(() => {
                  justDroppedRef.current = false;
                }, 100);
              }}
            >
              <SortableContext items={sortableItemIds} strategy={verticalListSortingStrategy}>
                {dashboardRows.map(({ item, treeMeta }, index) => (
                  isTaskGroupBlock(item) ? (
                    <TaskGroupRow
                      key={item.groupBlockId}
                      group={item}
                      treeMeta={treeMeta}
                      onToggle={() => toggleGroupBlockCollapsed(item.groupBlockId)}
                      onRename={() => promptRenameGroup(item)}
                      onUngroup={() => ungroupGroupBlock(item.groupBlockId)}
                      isDragActive={activeDragItemSortId === getDashboardItemSortId(item)}
                      isAnyDragging={activeDragItemSortId !== null}
                      isTaskDropTarget={isDraggingTask}
                      isMobile={isMobile}
                      movingItemSortId={movingItemSortId}
                      suppressNextClickRef={suppressNextClickRef}
                      openContextMenu={openContextMenu}
                      t={t}
                    />
                  ) : (
                    <SortableTaskRow
                      isFirst={index === 0}
                      key={item.id}
                      task={item}
                      treeMeta={treeMeta}
                      isLinkMode={isLinkMode}
                      isSelected={selectedTaskId === item.id}
                      isLinkSelected={selectedLinkTaskIds.includes(item.id)}
                      isDragActive={activeDragItemSortId === getDashboardItemSortId(item)}
                      isAnyDragging={activeDragItemSortId !== null}
                      isMobile={isMobile}
                      movingItemSortId={movingItemSortId}
                      openPickerTaskId={openPickerTaskId}
                      openStatusPickerTaskId={openStatusPickerTaskId}
                      suppressNextClickRef={suppressNextClickRef}
                      openContextMenu={openContextMenu}
                      handleTaskActivate={handleTaskActivate}
                      setOpenPickerTaskId={setOpenPickerTaskId}
                      setOpenStatusPickerTaskId={setOpenStatusPickerTaskId}
                      setIsLinkMode={setIsLinkMode}
                      setSelectedLinkTaskIds={setSelectedLinkTaskIds}
                      jumpToChart={handleJumpToChart}
                      t={t}
                    />
                  )
                ))}
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Context Menu Overlay */}
      {contextMenu && (
        <div
          className="absolute inset-0 z-[100]"
          onClick={() => setContextMenu(null)}
          onContextMenu={(e) => {
            e.preventDefault();
            setContextMenu(null);
          }}
        >
          <div
            ref={contextMenuRef}
            data-testid="task-context-menu"
            className="absolute bg-white/95 rounded-xl shadow-2xl border border-slate-200/60 py-1.5 min-w-[200px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
            style={{
              left: contextMenu.x,
              top: contextMenu.y,
              transform: contextMenu.alignRight ? 'translateX(-100%)' : 'none'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => startCreateTaskAt(contextMenu.target, 'above')}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t('dashboard.addTaskAbove', 'Add task above')}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => startCreateTaskAt(contextMenu.target, 'below')}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t('dashboard.addTaskBelow', 'Add task below')}
            </button>
            {isMobile && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                onClick={() => {
                  setMovingItemSortId(getContextTargetSortId(contextMenu.target));
                  setContextMenu(null);
                }}
              >
                <span className="material-symbols-outlined text-[16px]">drag_pan</span>
                {t('dashboard.moveTask', 'Move task')}
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            {contextMenu.target.kind === 'group' ? (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  onClick={() => {
                    if (contextMenu.target.kind !== 'group') return;
                    const group = findGroupById(contextMenu.target.groupBlockId);
                    if (group) promptRenameGroup(group);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">edit</span>
                  {t('dashboard.renameGroup', 'Rename group')}
                </button>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                  onClick={() => {
                    if (contextMenu.target.kind !== 'group') return;
                    ungroupGroupBlock(contextMenu.target.groupBlockId);
                    setContextMenu(null);
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">folder_off</span>
                  {t('dashboard.ungroup', 'Ungroup')}
                </button>
              </>
            ) : (
              <button
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                onClick={() => {
                  if (contextMenu.target.kind !== 'task') return;
                  promptTaskGroupPath(contextMenu.target.taskId);
                }}
              >
                <span className="material-symbols-outlined text-[16px]">folder</span>
                {t('dashboard.groupLabel', 'Group')}
              </button>
            )}
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => handleJumpContextTargetToChart(contextMenu.target)}
            >
              <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
              {t('dashboard.jumpToChart')}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => handleAddSuccessorsFromContext(contextMenu.target)}
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              {t('dashboard.addSuccessors')}
            </button>
            {contextBreakLinkPlan && (contextBreakLinkPlan.hasPredecessors || contextBreakLinkPlan.hasSuccessors) && (
              <>
                <button
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                  onClick={() => {
                    handleBreakLinksFromContext(contextMenu.target, 'all');
                  }}
                >
                  <span className="material-symbols-outlined text-[16px]">link_off</span>
                  {t('dashboard.breakAllLinks')}
                </button>
                {contextBreakLinkPlan.hasPredecessors && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    onClick={() => {
                      handleBreakLinksFromContext(contextMenu.target, 'predecessors');
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">call_received</span>
                    {t('dashboard.breakWithPredecessors')}
                  </button>
                )}
                {contextBreakLinkPlan.hasSuccessors && (
                  <button
                    className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                    onClick={() => {
                      handleBreakLinksFromContext(contextMenu.target, 'successors');
                    }}
                  >
                    <span className="material-symbols-outlined text-[16px]">call_made</span>
                    {t('dashboard.breakWithSuccessors')}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {groupEditor && (
        <div
          className="absolute inset-0 z-[120] flex items-center justify-center bg-slate-900/25 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="group-editor-title"
          onClick={() => {
            if (!isSavingGroupEditor) setGroupEditor(null);
          }}
        >
          <form
            className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              handleSaveGroupEditor();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 id="group-editor-title" className="text-sm font-bold text-slate-800">
                {groupEditor.mode === 'taskPath'
                  ? t('dashboard.groupLabel', 'Group')
                  : t('dashboard.renameGroup', 'Rename group')}
              </h3>
              <IconButton
                icon="close"
                variant="ghost"
                size="xs"
                onClick={() => setGroupEditor(null)}
                disabled={isSavingGroupEditor}
                aria-label={t('dashboard.close', 'Close')}
              />
            </div>
            <div className="space-y-4 px-4 py-4 max-h-[400px] overflow-y-auto custom-scrollbar">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="group-editor-value">
                  {groupEditor.mode === 'taskPath'
                    ? t('settings.groupPathField', 'Group Path')
                    : t('dashboard.groupLabel', 'Group')}
                </label>
                {groupEditor.mode === 'taskPath' ? (
                  <input
                    id="group-editor-value"
                    type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    value={groupEditor.value}
                    onChange={(e) => setGroupEditor({ ...groupEditor, value: e.target.value })}
                    placeholder="e.g. group1 / sub-group"
                    autoFocus
                  />
                ) : (
                  <input
                    id="group-editor-value"
                    type="text"
                    className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    value={groupEditor.value}
                    onChange={(e) => setGroupEditor({ ...groupEditor, value: e.target.value })}
                    autoFocus
                  />
                )}
                {groupEditor.mode === 'taskPath' && (
                  <p className="text-xs leading-relaxed text-slate-400">
                    Use slashes for nested groups, e.g. <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[10px] text-slate-600">group1 / sub-group</code>. Leave empty for no group.
                  </p>
                )}
              </div>

              {groupEditor.mode === 'taskPath' && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Select Existing Group
                  </span>
                  <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
                    {/* Clear / Root Group Option */}
                    <button
                      type="button"
                      onClick={() => setGroupEditor({ ...groupEditor, value: '' })}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                        groupEditor.value.trim() === ''
                          ? 'bg-primary/5 text-primary border-primary/20 font-bold'
                          : 'text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-800'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px] text-slate-400">folder_off</span>
                      <span>None (Root)</span>
                    </button>
                    
                    {/* List of Unique Existing Groups */}
                    {getExistingGroupPaths().map((pathStr) => (
                      <button
                        key={pathStr}
                        type="button"
                        onClick={() => setGroupEditor({ ...groupEditor, value: pathStr })}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                          groupEditor.value.trim() === pathStr
                            ? 'bg-primary/5 text-primary border-primary/20 font-bold'
                            : 'text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-800'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[16px] text-slate-400">folder</span>
                        <span className="truncate">{pathStr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setGroupEditor(null)}
                disabled={isSavingGroupEditor}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                isLoading={isSavingGroupEditor}
                disabled={groupEditor.mode === 'renameGroup' && groupEditor.value.trim().length === 0}
              >
                {t('common.save', 'Save')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {isFieldGroupDialogOpen && (
        <div
          className="absolute inset-0 z-[130] flex items-center justify-center bg-slate-900/25 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="field-group-dialog-title"
          onClick={closeFieldGroupDialog}
        >
          <form
            className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              saveFieldGroupSelection();
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
              <h3 id="field-group-dialog-title" className="text-sm font-bold text-slate-800">
                {t('dashboard.fieldGroupDialogTitle', 'Group by Fields')}
              </h3>
              <IconButton
                icon="close"
                variant="ghost"
                size="xs"
                onClick={closeFieldGroupDialog}
                aria-label={t('dashboard.close', 'Close')}
              />
            </div>
            <div className="space-y-4 px-4 py-4">
              <section className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('dashboard.selectedFields', 'Selected fields')}
                </div>
                <div className="flex min-h-11 items-center gap-2 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 custom-scrollbar">
                  {draftGroupFieldIds.length === 0 ? (
                    <span className="text-xs text-slate-400">{t('dashboard.noFieldsSelected', 'No fields selected')}</span>
                  ) : draftGroupFieldIds.map((fieldId) => {
                    const field = projectFieldsById.get(fieldId);
                    if (!field) return null;
                    return (
                      <div
                        key={fieldId}
                        draggable
                        onDragStart={() => setDraggedGroupFieldId(fieldId)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedGroupFieldId) moveDraftGroupFieldTo(draggedGroupFieldId, fieldId);
                          setDraggedGroupFieldId(null);
                        }}
                        onDragEnd={() => setDraggedGroupFieldId(null)}
                        className="inline-flex max-w-[180px] shrink-0 cursor-grab items-stretch gap-1 rounded-md border border-primary/15 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm active:cursor-grabbing"
                      >
                        <span className="material-symbols-outlined self-center text-[14px] text-slate-400">drag_indicator</span>
                        <span className="flex min-w-0 flex-1 items-center">
                          <span className="line-clamp-2 min-w-0 whitespace-normal break-words leading-snug" title={field.name}>{field.name}</span>
                        </span>
                        <IconButton
                          icon="close"
                          variant="ghost"
                          size="xs"
                          className="shrink-0 self-center"
                          onClick={() => toggleDraftGroupField(fieldId)}
                          aria-label={t('dashboard.removeField', 'Remove field')}
                        />
                      </div>
                    );
                  })}
                </div>
              </section>

              <section className="space-y-2">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('dashboard.availableFields', 'Available fields')}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400" aria-hidden="true">search</span>
                  <input
                    className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    type="text"
                    value={fieldGroupSearchQuery}
                    onChange={(e) => setFieldGroupSearchQuery(e.target.value)}
                    placeholder={t('dashboard.fieldSearchPlaceholder', 'Filter fields...')}
                    aria-label={t('dashboard.fieldSearchPlaceholder', 'Filter fields...')}
                  />
                  {fieldGroupSearchQuery && (
                    <IconButton
                      type="button"
                      icon="close"
                      variant="ghost"
                      size="xs"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setFieldGroupSearchQuery('')}
                      aria-label={t('dashboard.clearFieldSearch', 'Clear field filter')}
                    />
                  )}
                </div>
                <div className="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
                  {sortedProjectFields.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      {t('dashboard.noProjectFields', 'No project fields available')}
                    </div>
                  ) : filteredProjectFields.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      {t('dashboard.noMatchingFields', 'No fields match your search.')}
                    </div>
                  ) : filteredProjectFields.map(field => (
                    <label
                      key={field.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={draftGroupFieldIds.includes(field.id)}
                        onChange={() => toggleDraftGroupField(field.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{field.name}</span>
                      {field.dataType && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {field.dataType}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </section>
            </div>
            <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeFieldGroupDialog}
              >
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" size="sm">
                {t('common.save', 'Save')}
              </Button>
            </div>
          </form>
        </div>
      )}

      {/* Bottom Search Box with Add Task Button and Progress Bar */}
      <div className="border-t border-slate-200/80 bg-slate-50/50 backdrop-blur-md absolute bottom-0 left-0 right-0 z-10">
        {isLinkMode && <FloatingSequenceBuilder variant="inline" className="md:hidden" />}

        <div className={`p-3 space-y-2.5 ${isLinkMode ? 'hidden md:block' : ''}`}>
          {/* Progress Bar for Field Checking/Mapping */}
          {(fieldsProgress.isFetching || mappingStatus !== 'idle' && mappingStatus !== 'complete') && (
            <div className="px-1 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <div className="flex space-x-1">
                    <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1 h-1 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1 h-1 bg-primary rounded-full animate-bounce"></div>
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    {fieldsProgress.isFetching ? t('dashboard.scanningFields', 'Scanning GitHub fields...') : t('dashboard.mappingFields', 'Analyzing field mappings...')}
                  </span>
                </div>
                {fieldsProgress.total > 0 && (
                  <span className="text-[10px] font-bold text-primary tabular-nums bg-primary/10 px-1.5 py-0.5 rounded">
                    {Math.round((fieldsProgress.current / fieldsProgress.total) * 100)}%
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full bg-slate-200/50 rounded-full overflow-hidden border border-slate-200/30">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
                  style={{
                    width: fieldsProgress.total > 0
                      ? `${(fieldsProgress.current / fieldsProgress.total) * 100}%`
                      : '30%',
                    animation: fieldsProgress.total === 0 ? 'shimmer 1.5s infinite linear' : 'none'
                  }}
                />
              </div>
              <style dangerouslySetInnerHTML={{ __html: `
                @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(330%); }
                }
              `}} />
            </div>
          )}

          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">search</span>
              <input
                className="w-full h-9 bg-white border border-slate-200 shadow-sm rounded-md pl-9 pr-9 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                placeholder={t('dashboard.filterPlaceholder')}
                aria-label={t('dashboard.filterPlaceholder')}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <IconButton
                  type="button"
                  icon="close"
                  variant="ghost"
                  size="xs"
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  onClick={() => setSearchQuery('')}
                  aria-label={t('dashboard.clearIssueFilter', 'Clear issue filter')}
                />
              )}
            </div>
            <IconButton
              icon="add"
              variant="success"
              size="sm"
              onClick={() => {
                setSelectedTaskId(null);
                setIsCreateMode(true);
                setIsTaskDetailsOpen(true);
              }}
              title={t('createTask.addButton') || 'Add new task'}
              aria-label={t('createTask.addButton') || 'Add new task'}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

interface TreeTitleCellProps {
  children: ReactNode;
  treeMeta: TreeRowMeta;
  nodeKind: 'group' | 'task';
  isExpanded?: boolean;
  onToggle?: () => void;
  toggleTitle?: string;
  toggleAriaLabel?: string;
}

function TreeTitleCell({
  children,
  treeMeta,
  nodeKind,
  isExpanded = false,
  onToggle,
  toggleTitle,
  toggleAriaLabel,
}: TreeTitleCellProps) {
  const visualDepth = Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1);
  const nodeX = getTreeNodeX(visualDepth);
  const parentDepth = Math.max(visualDepth - 1, 0);
  const parentX = getTreeNodeX(parentDepth);
  const railColor = getTreeColor(visualDepth);
  const contentPaddingLeft = nodeX + TREE_CONTENT_GAP;
  const parentLineColor = getTreeLineColor(parentDepth);
  const nodeCenterY = TREE_ROW_HEIGHT / 2;
  const elbowCenterY = nodeCenterY - 1;
  const elbowTopY = elbowCenterY - TREE_ELBOW_HEIGHT;
  const elbowCurveStartY = elbowCenterY - TREE_ELBOW_RADIUS;
  const elbowCurveEndX = parentX + TREE_ELBOW_RADIUS;

  const nodeCommonClassName = 'absolute top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white';
  const nodeStyle: CSSProperties = {
    left: nodeX,
    color: railColor,
  };

  return (
    <div className="relative h-full min-w-0">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {treeMeta.guideSegments.map(segment => (
          <span
            key={segment.level}
            className="absolute w-0.5 -translate-x-1/2 rounded-full"
            style={{
              left: getTreeNodeX(segment.level),
              top: segment.startsAtNode ? '50%' : 0,
              bottom: segment.endsAtJoint ? `calc(50% + ${TREE_ELBOW_HEIGHT}px)` : 0,
              backgroundColor: getTreeLineColor(segment.level),
            }}
          />
        ))}
        {visualDepth > 0 && (
          <svg className="absolute inset-0 overflow-visible" aria-hidden="true">
            <path
              d={`M ${parentX} ${elbowTopY} V ${elbowCurveStartY} Q ${parentX} ${elbowCenterY} ${elbowCurveEndX} ${elbowCenterY} H ${nodeX}`}
              fill="none"
              stroke={parentLineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {nodeKind === 'group' ? (
        <button
          type="button"
          className={`${nodeCommonClassName} pointer-events-auto inline-flex h-[18px] w-[18px] items-center justify-center border-2 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
          style={{
            ...nodeStyle,
            backgroundColor: isExpanded ? `color-mix(in srgb, ${railColor} 10%, white)` : '#fff',
            borderColor: railColor,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          title={toggleTitle}
          aria-label={toggleAriaLabel}
          aria-expanded={isExpanded}
        >
          <span className="h-0.5 w-1.5 rounded-full" style={{ backgroundColor: railColor }} />
          {!isExpanded && (
            <span className="absolute h-1.5 w-0.5 rounded-full" style={{ backgroundColor: railColor }} />
          )}
        </button>
      ) : (
        <span
          className={`${nodeCommonClassName} h-2.5 w-2.5 border-2`}
          style={{
            ...nodeStyle,
            borderColor: railColor,
          }}
          aria-hidden="true"
        />
      )}

      <div
        className="relative z-[1] flex h-full min-w-0 flex-col justify-center overflow-hidden pr-1"
        style={{ paddingLeft: contentPaddingLeft }}
      >
        {children}
      </div>
    </div>
  );
}

interface TaskGroupRowProps {
  group: TaskGroupBlock;
  treeMeta: TreeRowMeta;
  onToggle: () => void;
  onRename: () => void;
  onUngroup: () => void;
  isDragActive: boolean;
  isAnyDragging: boolean;
  isTaskDropTarget: boolean;
  isMobile: boolean;
  movingItemSortId: string | null;
  suppressNextClickRef: React.MutableRefObject<boolean>;
  openContextMenu: (clientX: number, clientY: number, target: ContextMenuTarget) => void;
  t: TFunction;
}

function TaskGroupRow({
  group,
  treeMeta,
  onToggle,
  onRename,
  onUngroup,
  isDragActive,
  isAnyDragging,
  isTaskDropTarget,
  isMobile,
  movingItemSortId,
  suppressNextClickRef,
  openContextMenu,
  t,
}: TaskGroupRowProps) {
  const sortId = getDashboardItemSortId(group);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({
    id: sortId,
    disabled: group.isSyntheticRoot ? { draggable: true, droppable: false } : false,
  });
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [isDragHandleHovered, setIsDragHandleHovered] = useState(false);
  const [isDragHandleFocused, setIsDragHandleFocused] = useState(false);
  const isMovingThisGroup = movingItemSortId === sortId;
  const showHoverActions = !isDragging && !isDragActive && !isAnyDragging;
  const actionToolbarClassName = `opacity-0 ${showHoverActions ? 'group-hover:opacity-100' : ''} pointer-events-none`;
  const actionButtonClassName = 'pointer-events-none group-hover:pointer-events-auto text-slate-500 hover:text-primary hover:bg-primary/10';
  const dragHandleLeft = getTreeDragHandleX();
  const treeNodeColor = getTreeColor(Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1));
  const treeHandleHoverColor = getTreeHandleHoverColor(Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1));
  const dragHandleFillClass = isDragging || isDragActive ? 'bg-white' : 'bg-slate-100/80 group-hover:bg-indigo-50';
  const dragHandleColor = isDragHandleHovered ? treeHandleHoverColor : isDragHandleFocused || isRowHovered ? treeNodeColor : undefined;
  const dividerLeft = getTreeRowDividerLeft(treeMeta.depth);
  const isGroupDropActive = isTaskDropTarget && isOver && !isDragging;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: isMobile && isMovingThisGroup ? 'none' : undefined,
        userSelect: isMobile ? 'none' : undefined,
        WebkitUserSelect: isMobile ? 'none' : undefined,
        WebkitTouchCallout: isMobile ? 'none' : undefined,
        '--tree-row-divider-left': `${dividerLeft}px`,
      } as CSSProperties}
      data-dashboard-sort-id={sortId}
      data-task-moving={isMobile && isMovingThisGroup ? "true" : undefined}
      className={`grid grid-cols-[1fr_64px_76px] gap-1 items-center h-[72px] pl-2 pr-0 transition-all duration-200 relative group overflow-visible after:absolute after:bottom-0 after:left-[var(--tree-row-divider-left)] after:right-0 after:h-px after:bg-slate-100/50 after:content-[''] ${
        group.isSyntheticRoot ? 'bg-slate-100/80' : 'bg-slate-50/80'
      } ${!group.isSyntheticRoot ? 'cursor-pointer hover:bg-slate-50' : ''} ${isDragging ? 'z-50 shadow-lg ring-1 ring-primary/20 bg-white' : ''} ${
        isGroupDropActive ? 'bg-indigo-50/90 ring-2 ring-primary/30 ring-inset' : ''
      } ${isTaskDropTarget && !isGroupDropActive ? 'ring-1 ring-transparent ring-inset' : ''}`}
      onClick={() => {
        if (group.isSyntheticRoot) return;
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        onToggle();
      }}
      onContextMenu={(e) => {
        if (group.isSyntheticRoot) return;
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, { kind: 'group', groupBlockId: group.groupBlockId });
      }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
      role={!group.isSyntheticRoot ? 'button' : undefined}
      tabIndex={!group.isSyntheticRoot ? 0 : undefined}
      aria-expanded={!group.isSyntheticRoot ? group.isExpanded : undefined}
      onKeyDown={(e) => {
        if (group.isSyntheticRoot) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {!group.isSyntheticRoot && (
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
      )}

      <TreeTitleCell
        treeMeta={treeMeta}
        nodeKind="group"
        isExpanded={group.isExpanded}
        onToggle={onToggle}
        toggleTitle={group.isExpanded ? t('dashboard.collapseGroup', 'Collapse group') : t('dashboard.expandGroup', 'Expand group')}
        toggleAriaLabel={group.isExpanded ? t('dashboard.collapseGroup', 'Collapse group') : t('dashboard.expandGroup', 'Expand group')}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-700 truncate">{group.name}</span>
        </div>
        <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
          {group.startDate && group.targetDate ? `${group.startDate} - ${group.targetDate}` : t('dashboard.noGroupDates', 'No dates')}
        </div>
      </TreeTitleCell>
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
        <span>{t('dashboard.groupLabel', 'Group')}</span>
      </div>
      <div aria-hidden="true" />

      {!group.isSyntheticRoot && (
        <div className={`absolute right-2 bottom-full translate-y-[60%] flex items-center gap-1 ${actionToolbarClassName} transition-opacity z-10 bg-white/90 backdrop-blur rounded shadow-sm border border-slate-200 p-0.5`}>
          <IconButton
            icon="edit"
            variant="ghost"
            size="xs"
            className={actionButtonClassName}
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            title={t('dashboard.renameGroup', 'Rename group')}
            aria-label={t('dashboard.renameGroup', 'Rename group')}
          />
          <IconButton
            icon="folder_off"
            variant="ghost"
            size="xs"
            className={actionButtonClassName}
            onClick={(e) => {
              e.stopPropagation();
              onUngroup();
            }}
            title={t('dashboard.ungroup', 'Ungroup')}
            aria-label={t('dashboard.ungroup', 'Ungroup')}
          />
        </div>
      )}
    </div>
  );
}

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

const SortableTaskRow = memo(function SortableTaskRow({
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
