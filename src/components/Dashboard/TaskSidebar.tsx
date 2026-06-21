import { useTranslation } from 'react-i18next';
import { DndContext, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDashboard } from '../../context/DashboardContext';
import type { Task, TaskGroupBlock } from '../../types';
import { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { IconButton } from '../UI/IconButton';
import { getStartDateForCal } from '../../lib/githubTaskMapper';
import { FloatingSequenceBuilder } from './FloatingSequenceBuilder';
import { getDashboardDropTargetGroupSortId, getDashboardGroupDropPlan, getDashboardItemSortId, getDashboardTaskGroupPathMovePlan, getGroupPathForCreatedTaskTarget, getTaskOrderId, getVisibleDashboardMovePlan } from '../../lib/taskOrderUtils';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isTaskGroupBlock, parseSlashGroupPath, serializeSlashGroupPath } from '../../lib/taskGroupUtils';
import { buildBreakLinkPlan, type BreakLinkScope } from '../../lib/contextMenuLinkUtils';
import { buildDashboardTreeRows } from './taskSidebarTree';
import { TaskMouseSensor, TaskTouchSensor, blurActiveDragHandle } from './taskSidebarDnd';
import { TaskGroupRow } from './TaskGroupRow';
import { SortableTaskRow } from './SortableTaskRow';
import type { ContextMenuTarget } from './TaskGroupRow';
import { TaskFieldGroupDialog } from './TaskFieldGroupDialog';
import { TaskSidebarContextMenu, type TaskSidebarContextMenuState } from './TaskSidebarContextMenu';
import { TaskSidebarGroupEditor, type TaskSidebarGroupEditorState } from './TaskSidebarGroupEditor';
import { useTaskSidebarFieldGroups } from './useTaskSidebarFieldGroups';

const CONTEXT_MENU_VIEWPORT_PADDING = 8;

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
  const [contextMenu, setContextMenu] = useState<TaskSidebarContextMenuState | null>(null);
  const [activeDragItemSortId, setActiveDragItemSortId] = useState<string | null>(null);
  const [dragOverSortId, setDragOverSortId] = useState<string | null>(null);
  const [groupEditor, setGroupEditor] = useState<TaskSidebarGroupEditorState | null>(null);
  const [isSavingGroupEditor, setIsSavingGroupEditor] = useState(false);

  const fieldGroups = useTaskSidebarFieldGroups();

  const rootRef = useRef<HTMLDivElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef(false);
  const dragHasMovedRef = useRef(false);
  const justDroppedRef = useRef(false);
  const dragOverSortIdRef = useRef<string | null>(null);

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

  const handleJumpToChart = useCallback((taskId: string) => {
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
  }, [centerGanttOnTask, findTaskByOrderId, setDashboardView, setIsChartVisible, setIsCreateMode, setIsTaskDetailsOpen, setSelectedTaskId]);

  const handleJumpContextTargetToChart = useCallback((target: ContextMenuTarget) => {
    const boundaryTasks = getContextBoundaryTasks(target);
    if (!boundaryTasks) return;
    handleJumpToChart(boundaryTasks.firstTask.id);
  }, [getContextBoundaryTasks, handleJumpToChart]);

  const handleAddSuccessorsFromContext = useCallback((target: ContextMenuTarget) => {
    const boundaryTasks = getContextBoundaryTasks(target);
    if (!boundaryTasks) return;

    setIsLinkMode(true);
    setSelectedLinkTaskIds([boundaryTasks.lastTask.id]);
    setContextMenu(null);
  }, [getContextBoundaryTasks, setIsLinkMode, setSelectedLinkTaskIds]);

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
  const isDraggingTask = useMemo(() => {
    if (!activeDragItemSortId) return false;
    const activeItem = dashboardItems.find(item => getDashboardItemSortId(item) === activeDragItemSortId);
    return Boolean(activeItem && !isTaskGroupBlock(activeItem));
  }, [activeDragItemSortId, dashboardItems]);
  const dropTargetGroupSortId = useMemo(() => {
    if (!activeDragItemSortId || !dragOverSortId) return null;
    return getDashboardDropTargetGroupSortId(dashboardItems, activeDragItemSortId, dragOverSortId, tasks, fieldGroups.fieldGroupContext);
  }, [activeDragItemSortId, dragOverSortId, dashboardItems, tasks, fieldGroups.fieldGroupContext]);

  const handleDragStart = (event: DragStartEvent) => {
    const nextActiveSortId = String(event.active.id);
    dragHasMovedRef.current = false;
    dragOverSortIdRef.current = null;
    setActiveDragItemSortId(nextActiveSortId);
    setDragOverSortId(null);
    suppressNextClickRef.current = true;
    setContextMenu(null);
  };

  const handleDragMove = () => {
    dragHasMovedRef.current = true;
    if (contextMenu) setContextMenu(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const nextDragOverSortId = event.over ? String(event.over.id) : null;
    if (dragOverSortIdRef.current === nextDragOverSortId) return;
    dragOverSortIdRef.current = nextDragOverSortId;
    setDragOverSortId(nextDragOverSortId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    try {
      const { active, over } = event;
      if (!over) return;

      const groupDropPlan = getDashboardGroupDropPlan(dashboardItems, String(active.id), String(over.id), tasks, fieldGroups.fieldGroupContext);
      if (groupDropPlan) {
        await moveTaskToGroupPath(groupDropPlan.taskId, groupDropPlan.targetGroupPath, groupDropPlan.afterTaskId, groupDropPlan.fieldValueChanges);
        return;
      }

      const taskGroupPathMovePlan = getDashboardTaskGroupPathMovePlan(dashboardItems, String(active.id), String(over.id), tasks, fieldGroups.fieldGroupContext);
      if (taskGroupPathMovePlan) {
        await moveTaskToGroupPath(
          taskGroupPathMovePlan.taskId,
          taskGroupPathMovePlan.targetGroupPath,
          taskGroupPathMovePlan.afterTaskId,
          taskGroupPathMovePlan.fieldValueChanges
        );
        return;
      }

      const movePlan = getVisibleDashboardMovePlan(dashboardItems, String(active.id), String(over.id), tasks);
      if (!movePlan) return;

      if (movePlan.taskIds.length === 1) {
        await reorderTask(movePlan.taskIds[0], movePlan.afterTaskId);
      } else {
        await reorderTaskBlock(movePlan.taskIds, movePlan.afterTaskId);
      }
    } finally {
      dragOverSortIdRef.current = null;
      setActiveDragItemSortId(null);
      setDragOverSortId(null);
      setMovingItemSortId(null);
      blurActiveDragHandle();
      dragHasMovedRef.current = false;
      justDroppedRef.current = true;
      setTimeout(() => {
        justDroppedRef.current = false;
      }, 100);
    }
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
          onClick={fieldGroups.openFieldGroupDialog}
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
          ) : (apiError && tasks.length === 0) ? (
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
            <>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragMove={handleDragMove}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
                onDragCancel={() => {
                  dragOverSortIdRef.current = null;
                  setActiveDragItemSortId(null);
                  setDragOverSortId(null);
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
                        isDropTargetGroup={dropTargetGroupSortId === getDashboardItemSortId(item)}
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
            </>
          )}
        </div>
      </div>

      {contextMenu && (
        <TaskSidebarContextMenu
          contextMenu={contextMenu}
          contextMenuRef={contextMenuRef}
          contextBreakLinkPlan={contextBreakLinkPlan}
          isMobile={isMobile}
          t={t}
          onAddSuccessors={handleAddSuccessorsFromContext}
          onBreakLinks={handleBreakLinksFromContext}
          onClose={() => setContextMenu(null)}
          onCreateTask={startCreateTaskAt}
          onEditTaskGroup={(target) => {
            if (target.kind !== 'task') return;
            promptTaskGroupPath(target.taskId);
          }}
          onJumpToChart={handleJumpContextTargetToChart}
          onMove={(target) => {
            setMovingItemSortId(getContextTargetSortId(target));
            setContextMenu(null);
          }}
          onRenameGroup={(target) => {
            if (target.kind !== 'group') return;
            const group = findGroupById(target.groupBlockId);
            if (group) promptRenameGroup(group);
          }}
          onUngroup={(target) => {
            if (target.kind !== 'group') return;
            ungroupGroupBlock(target.groupBlockId);
            setContextMenu(null);
          }}
        />
      )}

      {groupEditor && (
        <TaskSidebarGroupEditor
          groupEditor={groupEditor}
          existingGroupPaths={getExistingGroupPaths()}
          isSaving={isSavingGroupEditor}
          t={t}
          onClose={() => setGroupEditor(null)}
          onSave={handleSaveGroupEditor}
          onValueChange={(value) => setGroupEditor(current => current ? { ...current, value } : current)}
        />
      )}

      {fieldGroups.isFieldGroupDialogOpen && (
        <TaskFieldGroupDialog
          t={t}
          draftGroupFieldIds={fieldGroups.draftGroupFieldIds}
          setDraftGroupFieldIds={fieldGroups.setDraftGroupFieldIds}
          fieldGroupDialogTab={fieldGroups.fieldGroupDialogTab}
          setFieldGroupDialogTab={fieldGroups.setFieldGroupDialogTab}
          fieldGroupSearchQuery={fieldGroups.fieldGroupSearchQuery}
          setFieldGroupSearchQuery={fieldGroups.setFieldGroupSearchQuery}
          draggedGroupFieldId={fieldGroups.draggedGroupFieldId}
          setDraggedGroupFieldId={fieldGroups.setDraggedGroupFieldId}
          projectFieldsById={fieldGroups.projectFieldsById}
          sortedProjectFields={fieldGroups.sortedProjectFields}
          filteredProjectFields={fieldGroups.filteredProjectFields}
          resolvedUsedFieldGroups={fieldGroups.resolvedUsedFieldGroups}
          resolvedRecommendedFieldGroups={fieldGroups.resolvedRecommendedFieldGroups}
          onToggleDraftGroupField={fieldGroups.toggleDraftGroupField}
          onMoveDraftGroupFieldTo={fieldGroups.moveDraftGroupFieldTo}
          onClose={fieldGroups.closeFieldGroupDialog}
          onSave={fieldGroups.saveFieldGroupSelection}
        />
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
