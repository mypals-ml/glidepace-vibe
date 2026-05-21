import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { DndContext, KeyboardSensor, MouseSensor, TouchSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type DragStartEvent, type MouseSensorOptions, type TouchSensorOptions } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneePicker } from './AssigneePicker';
import { StatusPicker } from './StatusPicker';
import { getStatusDotColor } from '../../utils/statusColors';
import type { Task, User } from '../../types';
import { useRef, useState, useEffect, type Dispatch, type MouseEvent as ReactMouseEvent, type SetStateAction, type TouchEvent as ReactTouchEvent } from 'react';
import { IconButton } from '../UI/IconButton';
import { getStartDateForCal, getTargetDateForCal } from '../../lib/githubTaskMapper';
import { FloatingSequenceBuilder } from './FloatingSequenceBuilder';
import { getAfterIdForVisibleMove, getTaskOrderId } from '../../lib/taskOrderUtils';
import { useMediaQuery } from '../../hooks/useMediaQuery';

function eventTargetElement(target: EventTarget | null): HTMLElement | null {
  return target instanceof HTMLElement ? target : null;
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
    centerGanttOnDate,
    isLinkMode,
    setIsLinkMode,
    selectedLinkTaskIds,
    setSelectedLinkTaskIds,
    updateTaskSuccessors,
    reorderTask,
    setPendingTaskInsertPosition,
  } = useDashboard();
  const isMobile = !useMediaQuery('(min-width: 768px)');
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [openPickerTaskId, setOpenPickerTaskId] = useState<string | null>(null);
  const [openStatusPickerTaskId, setOpenStatusPickerTaskId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; taskId: string; alignRight: boolean } | null>(null);
  const [activeDragTaskId, setActiveDragTaskId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const suppressNextClickRef = useRef(false);
  const dragHasMovedRef = useRef(false);

  useEffect(() => {
    if (!movingTaskId) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target?.closest(`[data-task-id="${movingTaskId}"]`)) {
        setMovingTaskId(null);
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
  }, [movingTaskId]);

  const openContextMenu = (clientX: number, clientY: number, taskId: string) => {
    if (activeDragTaskId && dragHasMovedRef.current) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;

    setContextMenu({
      x: clientX - rect.left,
      y: clientY - rect.top,
      taskId,
      alignRight: clientX - rect.left > rect.width - 220
    });
  };

  const startCreateTaskAt = (taskId: string, placement: 'above' | 'below') => {
    setPendingTaskInsertPosition({ targetTaskId: taskId, placement });
    setIsCreateMode(true);
    setSelectedTaskId(null);
    setIsTaskDetailsOpen(true);
    setContextMenu(null);
  };

  const handleTaskActivate = (taskId: string) => {
    if (isLinkMode) {
      setSelectedLinkTaskIds(prev =>
        prev.includes(taskId) ? prev.filter(id => id !== taskId) : [...prev, taskId]
      );
      return;
    }

    setIsCreateMode(false);
    setSelectedTaskId(taskId);
    setIsTaskDetailsOpen(true);
  };

  const handleJumpToChart = (taskId: string) => {
    const task = filteredTasks.find(task => task.id === taskId);
    setIsCreateMode(false);
    setSelectedTaskId(taskId);
    setIsTaskDetailsOpen(false);
    setDashboardView('gantt');
    setIsChartVisible(true);

    const startDate = task ? getStartDateForCal(task) : null;
    if (startDate) {
      centerGanttOnDate(startDate);
    }

    setContextMenu(null);
  };

  const sensors = useSensors(
    useSensor(TaskMouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TaskTouchSensor, {
      activationConstraint: movingTaskId
        ? { distance: 5 }
        : { delay: 550, tolerance: 8 }
    }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const sortableTaskIds = filteredTasks.map(getTaskOrderId);

  const handleDragStart = (event: DragStartEvent) => {
    dragHasMovedRef.current = false;
    setActiveDragTaskId(String(event.active.id));
    suppressNextClickRef.current = true;
  };

  const handleDragMove = () => {
    dragHasMovedRef.current = true;
    setContextMenu(null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    try {
      const { active, over } = event;
      if (!over) return;

      const afterTaskId = getAfterIdForVisibleMove(filteredTasks, String(active.id), String(over.id));
      if (afterTaskId === undefined) return;

      await reorderTask(String(active.id), afterTaskId);
    } finally {
      setActiveDragTaskId(null);
      setMovingTaskId(null);
      dragHasMovedRef.current = false;
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden relative" ref={rootRef}>
      {/* Header - Moved outside scroll container for alignment */}
      <div className="bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)] grid grid-cols-[40px_1fr_64px_76px] gap-2 pl-4 pr-0 h-[var(--dashboard-header-height)] items-center flex-shrink-0" aria-label={t('dashboard.issuesList')}>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('table.id')}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('table.title')}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t('table.status')}</div>
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">{t('table.assignees')}</div>
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
                setActiveDragTaskId(null);
                setMovingTaskId(null);
                dragHasMovedRef.current = false;
              }}
            >
              <SortableContext items={sortableTaskIds} strategy={verticalListSortingStrategy}>
                {filteredTasks.map((task, index) => (
                  <SortableTaskRow
                    isFirst={index === 0}
                    key={task.id}
                    task={task}
                    isLinkMode={isLinkMode}
                    isSelected={selectedTaskId === task.id}
                    isLinkSelected={selectedLinkTaskIds.includes(task.id)}
                    isDragActive={activeDragTaskId === getTaskOrderId(task)}
                    isMobile={isMobile}
                    movingTaskId={movingTaskId}
                    openPickerTaskId={openPickerTaskId}
                    openStatusPickerTaskId={openStatusPickerTaskId}
                    suppressNextClickRef={suppressNextClickRef}
                    openContextMenu={openContextMenu}
                    handleTaskActivate={handleTaskActivate}
                    setOpenPickerTaskId={setOpenPickerTaskId}
                    setOpenStatusPickerTaskId={setOpenStatusPickerTaskId}
                    setIsLinkMode={setIsLinkMode}
                    setSelectedLinkTaskIds={setSelectedLinkTaskIds}
                    centerGanttOnDate={centerGanttOnDate}
                    t={t}
                  />
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
              onClick={() => startCreateTaskAt(contextMenu.taskId, 'above')}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t('dashboard.addTaskAbove', 'Add task above')}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => startCreateTaskAt(contextMenu.taskId, 'below')}
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              {t('dashboard.addTaskBelow', 'Add task below')}
            </button>
            {isMobile && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                onClick={() => {
                  setMovingTaskId(contextMenu.taskId);
                  setContextMenu(null);
                }}
              >
                <span className="material-symbols-outlined text-[16px]">drag_pan</span>
                {t('dashboard.moveTask', 'Move task')}
              </button>
            )}
            <div className="my-1 border-t border-slate-100" />
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => handleJumpToChart(contextMenu.taskId)}
            >
              <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
              {t('dashboard.jumpToChart')}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => {
                setIsLinkMode(true);
                setSelectedLinkTaskIds([contextMenu.taskId]);
                setContextMenu(null);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">add_link</span>
              {t('dashboard.addSuccessors')}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => {
                const tObj = filteredTasks.find(tObj => tObj.id === contextMenu.taskId);
                if (tObj?.successorIds?.length) {
                  updateTaskSuccessors(contextMenu.taskId, []);
                }
                setContextMenu(null);
              }}
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              {t('dashboard.breakAllLinks')}
            </button>
          </div>
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
                className="w-full h-9 bg-white border border-slate-200 shadow-sm rounded-md pl-9 pr-3 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
                placeholder={t('dashboard.filterPlaceholder')}
                aria-label={t('dashboard.filterPlaceholder')}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
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

interface SortableTaskRowProps {
  task: Task;
  isFirst: boolean;
  isLinkMode: boolean;
  isSelected: boolean;
  isLinkSelected: boolean;
  isDragActive: boolean;
  isMobile: boolean;
  movingTaskId: string | null;
  openPickerTaskId: string | null;
  openStatusPickerTaskId: string | null;
  suppressNextClickRef: React.MutableRefObject<boolean>;
  openContextMenu: (clientX: number, clientY: number, taskId: string) => void;
  handleTaskActivate: (taskId: string) => void;
  setOpenPickerTaskId: Dispatch<SetStateAction<string | null>>;
  setOpenStatusPickerTaskId: Dispatch<SetStateAction<string | null>>;
  setIsLinkMode: (mode: boolean) => void;
  setSelectedLinkTaskIds: (tasks: string[] | ((prev: string[]) => string[])) => void;
  centerGanttOnDate: (date: string | null) => void;
  t: TFunction;
}

function SortableTaskRow({
  task,
  isFirst,
  isLinkMode,
  isSelected,
  isLinkSelected,
  isDragActive,
  isMobile,
  movingTaskId,
  openPickerTaskId,
  openStatusPickerTaskId,
  suppressNextClickRef,
  openContextMenu,
  handleTaskActivate,
  setOpenPickerTaskId,
  setOpenStatusPickerTaskId,
  setIsLinkMode,
  setSelectedLinkTaskIds,
  centerGanttOnDate,
  t,
}: SortableTaskRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: getTaskOrderId(task) });
  const isMovingThisTask = movingTaskId === task.id;
  const dragHandleFillClass = isLinkMode
    ? isLinkSelected ? 'bg-drag-handle-selected-link' : 'bg-white group-hover:bg-drag-handle-hovered'
    : isSelected ? 'bg-drag-handle-selected' : 'bg-white group-hover:bg-drag-handle-hovered';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: isMobile && isMovingThisTask ? 'none' : undefined,
      }}
      data-task-sortable-row="true"
      data-task-id={task.id}
      data-task-moving={isMobile && isMovingThisTask ? "true" : undefined}
      className={`grid grid-cols-[40px_1fr_64px_76px] gap-2 items-center h-[72px] pl-4 pr-0 border-b border-slate-100/50 cursor-pointer transition-all duration-200 relative group overflow-visible ${
        isLinkMode
          ? isLinkSelected ? 'bg-primary/10 ring-1 ring-primary/30 shadow-sm' : 'hover:bg-slate-50/80 bg-white'
          : isSelected ? 'bg-primary/[0.04] ring-1 ring-primary/10 shadow-sm' : 'hover:bg-slate-50/80 bg-white'
      } ${isDragging ? 'z-50 shadow-lg ring-1 ring-primary/20 bg-white' : ''}`}
      onClick={() => {
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        handleTaskActivate(task.id);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, task.id);
      }}
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
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full z-10" />
      )}

      <button
        type="button"
        data-task-drag-handle="true"
        className={`pointer-events-auto absolute left-0 top-1/2 z-20 inline-flex h-7 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-slate-400 transition-opacity hover:text-primary cursor-grab active:cursor-grabbing focus:outline-none border-none shadow-none ${dragHandleFillClass} task-drag-handle ${
          isDragging || isDragActive ? 'is-dragging' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
        title={t('dashboard.dragToReorder', 'Drag to reorder')}
        aria-label={t('dashboard.dragToReorder', 'Drag to reorder')}
        {...attributes}
        {...listeners}
      >
        <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
      </button>

      <div className="pl-3 text-xs text-slate-400 font-medium relative">
        <div
          className={`absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-3 rounded-full ${getStatusDotColor(task.status).replace(' animate-pulse', '')}`}
          aria-hidden="true"
        />
        {task.displayId}
      </div>

      <div className="flex flex-col justify-center min-w-0 pr-1">
        <span className={`text-sm font-medium transition-colors leading-tight line-clamp-2 break-words ${task.status === 'Done' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-700 group-hover:text-primary'}`}>
          {task.title}
        </span>
        <div className="text-[10px] text-slate-400 mt-0.5 font-medium">{getStartDateForCal(task)} - {getTargetDateForCal(task)}</div>
      </div>

      <div className="group/status relative h-full flex items-center min-w-0">
        <div
          className="flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 transition-colors py-1 h-full w-full"
          onClick={(e) => {
            e.stopPropagation();
            setOpenStatusPickerTaskId(openStatusPickerTaskId === task.id ? null : task.id);
          }}
          title={t('dashboard.updateStatus', 'Update status')}
        >
          <span className={`w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm mb-1 ${getStatusDotColor(task.status)}`}></span>
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate max-w-[40px]">
            {task.status}
          </span>
        </div>
        {openStatusPickerTaskId === task.id && (
          <StatusPicker
            task={task}
            onClose={() => setOpenStatusPickerTaskId(null)}
          />
        )}
      </div>

      <div className="group/assignee relative h-full flex items-center justify-center pr-2">
        <div
          className="flex -space-x-1.5 cursor-pointer hover:scale-110 transition-transform p-1"
          onClick={(e) => {
            e.stopPropagation();
            setOpenPickerTaskId(openPickerTaskId === task.id ? null : task.id);
          }}
          title={t('dashboard.updateAssignees', 'Update assignees')}
        >
          {task.assignees.length > 0 ? (
            <>
              {task.assignees.slice(0, 3).map((user: User, idx: number) => (
                <div key={user.id} className={`w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[10px] font-bold ${user.avatarColor}`} style={{ zIndex: 10 - idx }} title={user.name}>
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt={user.initials} className="w-full h-full rounded-full object-cover" />
                  ) : user.initials}
                </div>
              ))}
              {task.assignees.length > 3 && (
                <div className="w-6 h-6 rounded-full border-2 border-white shadow-sm flex items-center justify-center text-[8px] font-bold bg-slate-100 text-slate-500" style={{ zIndex: 0 }}>
                  +{task.assignees.length - 3}
                </div>
              )}
            </>
          ) : (
            <div className="w-6 h-6 rounded-full border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-300">
              <span className="material-symbols-outlined text-[14px]">person_add</span>
            </div>
          )}
        </div>
        {openPickerTaskId === task.id && (
          <AssigneePicker
            taskId={task.id}
            currentAssignees={task.assignees}
            repository={task.repository}
            onClose={() => setOpenPickerTaskId(null)}
          />
        )}
      </div>

      <div className={`absolute right-2 ${isFirst ? 'top-full translate-y-[-60%]' : 'bottom-full translate-y-[60%]'} flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10 pointer-events-none bg-white/90 backdrop-blur rounded shadow-sm border border-slate-200 p-0.5`}>
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
            const startDate = getStartDateForCal(task);
            if (startDate) centerGanttOnDate(startDate);
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
            openContextMenu(e.clientX, e.clientY, task.id);
          }}
          title={t('dashboard.moreActions', 'More actions')}
          aria-label={t('dashboard.moreActions', 'More actions')}
        />
      </div>
    </div>
  );
}
