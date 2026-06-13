import { useTranslation } from 'react-i18next';
import { DndContext, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragOverEvent, type DragStartEvent } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDashboard } from '../../context/DashboardContext';
import type { GitHubProjectV2Field, Task, TaskGroupBlock } from '../../types';
import { useCallback, useMemo, useRef, useState, useEffect, useLayoutEffect } from 'react';
import { IconButton } from '../UI/IconButton';
import { getStartDateForCal } from '../../lib/githubTaskMapper';
import { FloatingSequenceBuilder } from './FloatingSequenceBuilder';
import { getDashboardDropTargetGroupSortId, getDashboardGroupDropPlan, getDashboardItemSortId, getDashboardTaskGroupPathMovePlan, getGroupPathForCreatedTaskTarget, getTaskOrderId, getVisibleDashboardMovePlan, type DashboardFieldGroupContext } from '../../lib/taskOrderUtils';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { isTaskGroupBlock, parseSlashGroupPath, serializeSlashGroupPath } from '../../lib/taskGroupUtils';
import { buildBreakLinkPlan, type BreakLinkScope } from '../../lib/contextMenuLinkUtils';
import { Button } from '../UI/Button';
import {
  areFieldIdListsIdentical,
  getLastUsedFieldGroupStorageKey,
  getLocalStorageSafe,
  getRecommendedFieldGroups,
  getUsedFieldGroupsStorageKey,
  loadLastUsedFieldGroup,
  loadUsedFieldGroups,
  recordUsedFieldGroup,
  saveLastUsedFieldGroup,
  type UsedFieldGroup,
} from '../../lib/fieldGroupHistory';
import { buildDashboardTreeRows } from './taskSidebarTree';
import { TaskMouseSensor, TaskTouchSensor, blurActiveDragHandle } from './taskSidebarDnd';
import { SortableTaskRow, TaskGroupRow, type ContextMenuTarget } from './TaskSidebarRows';

type FieldGroupDialogTab = 'fields' | 'used' | 'recommended';

type ContextMenuState = { x: number; y: number; target: ContextMenuTarget; alignRight: boolean };

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
    projectFields,
    selectedProject,
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
  const [dragOverSortId, setDragOverSortId] = useState<string | null>(null);
  const [groupEditor, setGroupEditor] = useState<
    | { mode: 'taskPath'; taskId: string; value: string }
    | { mode: 'renameGroup'; groupBlockId: string; value: string }
    | null
  >(null);
  const [isSavingGroupEditor, setIsSavingGroupEditor] = useState(false);
  const [isFieldGroupDialogOpen, setIsFieldGroupDialogOpen] = useState(false);
  const [fieldGroupDialogTab, setFieldGroupDialogTab] = useState<FieldGroupDialogTab>('fields');
  const [usedFieldGroups, setUsedFieldGroups] = useState<UsedFieldGroup[]>([]);
  const [draftGroupFieldIds, setDraftGroupFieldIds] = useState<string[]>([]);
  const [fieldGroupSearchQuery, setFieldGroupSearchQuery] = useState('');
  const [draggedGroupFieldId, setDraggedGroupFieldId] = useState<string | null>(null);
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
  const resolveFieldGroupFields = useCallback((fieldIds: readonly string[]) => {
    return fieldIds.flatMap(fieldId => {
      const field = projectFieldsById.get(fieldId);
      return field ? [field] : [];
    });
  }, [projectFieldsById]);
  const resolvedUsedFieldGroups = useMemo(() => {
    return usedFieldGroups
      .map(entry => ({
        key: `used-${entry.savedAt}-${entry.fieldIds.join('|')}`,
        fields: resolveFieldGroupFields(entry.fieldIds),
      }))
      .filter(entry => entry.fields.length > 0);
  }, [usedFieldGroups, resolveFieldGroupFields]);
  const resolvedRecommendedFieldGroups = useMemo(() => {
    return getRecommendedFieldGroups(projectFields).map(fieldIds => ({
      key: `recommended-${fieldIds.join('|')}`,
      fields: resolveFieldGroupFields(fieldIds),
    }));
  }, [projectFields, resolveFieldGroupFields]);
  const isDraggingTask = useMemo(() => {
    if (!activeDragItemSortId) return false;
    const activeItem = dashboardItems.find(item => getDashboardItemSortId(item) === activeDragItemSortId);
    return Boolean(activeItem && !isTaskGroupBlock(activeItem));
  }, [activeDragItemSortId, dashboardItems]);
  const fieldGroupContext = useMemo<DashboardFieldGroupContext>(() => ({
    fieldIds: selectedGroupFieldIds,
    fields: projectFields,
  }), [selectedGroupFieldIds, projectFields]);

  const dropTargetGroupSortId = useMemo(() => {
    if (!activeDragItemSortId || !dragOverSortId) return null;
    return getDashboardDropTargetGroupSortId(dashboardItems, activeDragItemSortId, dragOverSortId, tasks, fieldGroupContext);
  }, [activeDragItemSortId, dragOverSortId, dashboardItems, tasks, fieldGroupContext]);

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

      const groupDropPlan = getDashboardGroupDropPlan(dashboardItems, String(active.id), String(over.id), tasks, fieldGroupContext);
      if (groupDropPlan) {
        await moveTaskToGroupPath(groupDropPlan.taskId, groupDropPlan.targetGroupPath, groupDropPlan.afterTaskId, groupDropPlan.fieldValueChanges);
        return;
      }

      const taskGroupPathMovePlan = getDashboardTaskGroupPathMovePlan(dashboardItems, String(active.id), String(over.id), tasks, fieldGroupContext);
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

  const usedFieldGroupsStorageKey = getUsedFieldGroupsStorageKey(selectedProject?.id);
  const lastUsedFieldGroupStorageKey = getLastUsedFieldGroupStorageKey(selectedProject?.id);

  useEffect(() => {
    const lastUsedFieldGroup = loadLastUsedFieldGroup(getLocalStorageSafe(), lastUsedFieldGroupStorageKey);
    if (lastUsedFieldGroup !== null) {
      setSelectedGroupFieldIds(lastUsedFieldGroup);
    }
  }, [lastUsedFieldGroupStorageKey, setSelectedGroupFieldIds]);

  const openFieldGroupDialog = () => {
    setDraftGroupFieldIds(selectedGroupFieldIds);
    setFieldGroupSearchQuery('');
    setFieldGroupDialogTab('fields');
    setUsedFieldGroups(loadUsedFieldGroups(getLocalStorageSafe(), usedFieldGroupsStorageKey));
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

  const renderFieldGroupOption = (option: { key: string; fields: GitHubProjectV2Field[] }) => {
    const fieldIds = option.fields.map(field => field.id);
    const isActive = areFieldIdListsIdentical(fieldIds, draftGroupFieldIds);
    return (
      <button
        key={option.key}
        type="button"
        onClick={() => setDraftGroupFieldIds(fieldIds)}
        aria-pressed={isActive}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
          isActive ? 'bg-primary/5 text-slate-800 ring-1 ring-primary/30' : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-y-1">
          {option.fields.map((field, fieldIndex) => (
            <span key={`${option.key}-${field.id}-${fieldIndex}`} className="inline-flex min-w-0 items-center">
              {fieldIndex > 0 && (
                <span className="material-symbols-outlined text-[14px] text-slate-300" aria-hidden="true">chevron_right</span>
              )}
              <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600" title={field.name}>
                {field.name}
              </span>
            </span>
          ))}
        </span>
        {isActive && (
          <span className="material-symbols-outlined shrink-0 text-[16px] text-primary" aria-hidden="true">check</span>
        )}
      </button>
    );
  };

  const saveFieldGroupSelection = () => {
    const storage = getLocalStorageSafe();
    const savedFieldIds = saveLastUsedFieldGroup(storage, lastUsedFieldGroupStorageKey, draftGroupFieldIds);
    if (draftGroupFieldIds.length > 0) {
      setUsedFieldGroups(
        recordUsedFieldGroup(storage, usedFieldGroupsStorageKey, draftGroupFieldIds)
      );
    }
    setSelectedGroupFieldIds(savedFieldIds);
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
            className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
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
            <div className="flex min-h-0 flex-1 flex-col space-y-4 px-4 py-4">
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
                          type="button"
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

              <div
                className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
                role="tablist"
                aria-label={t('dashboard.fieldGroupTabs', 'Field group views')}
              >
                {([
                  { id: 'fields', label: t('dashboard.fieldGroupTabFields', 'All fields') },
                  { id: 'used', label: t('dashboard.fieldGroupTabUsed', 'Used groups') },
                  { id: 'recommended', label: t('dashboard.fieldGroupTabRecommended', 'Recommended') },
                ] as const).map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    id={`field-group-tab-${tab.id}`}
                    aria-selected={fieldGroupDialogTab === tab.id}
                    aria-controls={`field-group-tabpanel-${tab.id}`}
                    onClick={() => setFieldGroupDialogTab(tab.id)}
                    className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                      fieldGroupDialogTab === tab.id
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="min-h-[290px] overflow-hidden">
              {fieldGroupDialogTab === 'used' && (
                <section
                  className="space-y-2"
                  role="tabpanel"
                  id="field-group-tabpanel-used"
                  aria-labelledby="field-group-tab-used"
                >
                  <div className="h-[290px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
                    {resolvedUsedFieldGroups.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400">
                        {t('dashboard.noUsedFieldGroups', 'No used groups yet. Saved field groupings will be listed here.')}
                      </div>
                    ) : resolvedUsedFieldGroups.map(renderFieldGroupOption)}
                  </div>
                </section>
              )}

              {fieldGroupDialogTab === 'recommended' && (
                <section
                  className="space-y-2"
                  role="tabpanel"
                  id="field-group-tabpanel-recommended"
                  aria-labelledby="field-group-tab-recommended"
                >
                  <div className="h-[290px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
                    {resolvedRecommendedFieldGroups.length === 0 ? (
                      <div className="px-3 py-6 text-center text-xs text-slate-400">
                        {t('dashboard.noRecommendedFieldGroups', 'No recommended groups available for this project.')}
                      </div>
                    ) : resolvedRecommendedFieldGroups.map(renderFieldGroupOption)}
                  </div>
                </section>
              )}

              {fieldGroupDialogTab === 'fields' && (
              <section
                className="space-y-2"
                role="tabpanel"
                id="field-group-tabpanel-fields"
                aria-labelledby="field-group-tab-fields"
              >
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
                <div className="h-[196px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
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
              )}
              </div>
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
