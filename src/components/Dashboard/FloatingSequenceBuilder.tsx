import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDashboard } from '../../context/DashboardContext';
import { IconButton } from '../UI/IconButton';

interface FloatingSequenceBuilderProps {
  variant?: 'floating' | 'inline';
  className?: string;
}

interface SortableTaskItemProps {
  id: string;
  title: string;
}

function SortableTaskItem({ id, title }: SortableTaskItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 bg-white rounded border ${isDragging ? 'border-primary shadow-lg' : 'border-slate-200'} mb-2`}
    >
      <div
        {...attributes}
        {...listeners}
        className="cursor-grab p-1 hover:bg-slate-100 rounded text-slate-400"
      >
        <span className="material-symbols-outlined text-[16px]">drag_indicator</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-slate-400">{id}</div>
        <div className="text-sm text-slate-700 truncate">{title}</div>
      </div>
    </div>
  );
}

export function FloatingSequenceBuilder({ variant = 'floating', className = '' }: FloatingSequenceBuilderProps) {
  const { t } = useTranslation();
  const {
    isLinkMode,
    setIsLinkMode,
    selectedLinkTaskIds,
    setSelectedLinkTaskIds,
    tasks,
    updateTaskSuccessors,
    requestStartDateDecision,
  } = useDashboard();

  const [orderedTasks, setOrderedTasks] = useState<{ id: string; title: string }[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Sync selected items while preserving local order if possible
    const newOrderedTasks = selectedLinkTaskIds.map(id => {
      const existing = orderedTasks.find(ot => ot.id === id);
      if (existing) return existing;
      const t = tasks.find(t => t.id === id);
      return { id, title: t?.title || 'Unknown Task' };
    });
    setOrderedTasks(newOrderedTasks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLinkTaskIds, tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setOrderedTasks((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);

        const newOrder = arrayMove(items, oldIndex, newIndex);
        setSelectedLinkTaskIds(newOrder.map(i => i.id));
        return newOrder;
      });
    }
  };

  const handleEstablishChain = async () => {
    if (orderedTasks.length < 2) return;
    setIsProcessing(true);

    try {
      // 1. Pre-check for any successors that need asking to avoid multiple prompts
      const allSuccessorsToAsk = [];
      for (let i = 0; i < orderedTasks.length - 1; i++) {
        const nextTaskId = orderedTasks[i + 1].id;
        const nextTask = tasks.find(t => t.id === nextTaskId);
        if (nextTask && (!nextTask.autoUpdateStartDate || nextTask.autoUpdateStartDate === 'ask')) {
          allSuccessorsToAsk.push(nextTask);
        }
      }

      let decision: 'auto' | 'locked' | 'ask' | undefined;
      if (allSuccessorsToAsk.length > 0) {
        decision = await requestStartDateDecision(allSuccessorsToAsk);
      }

      // 2. Create Finish-to-Start chain
      for (let i = 0; i < orderedTasks.length - 1; i++) {
        const currentTask = tasks.find(t => t.id === orderedTasks[i].id);
        const nextTaskId = orderedTasks[i + 1].id;
        const nextTask = tasks.find(t => t.id === nextTaskId);

        if (currentTask && currentTask.itemId && nextTask && nextTask.itemId) {
          const currentSuccessors = currentTask.successorIds || [];
          if (!currentSuccessors.includes(nextTask.itemId)) {
            // Pass the decision down to prevent redundant prompts
            await updateTaskSuccessors(currentTask.id, [...currentSuccessors, nextTask.itemId], false, decision);
          }
        }
      }
      setIsLinkMode(false);
      setSelectedLinkTaskIds([]);
    } catch (error) {
      console.error('Failed to establish chain', error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isLinkMode) return null;

  const isInline = variant === 'inline';
  const containerClassName = isInline
    ? `w-full bg-white flex flex-col overflow-hidden ${className}`
    : `fixed bottom-6 right-6 w-80 bg-white/90 backdrop-blur-md shadow-2xl rounded-xl border border-indigo-100 flex flex-col overflow-hidden z-50 ${className}`;
  const bodyClassName = isInline
    ? 'p-3 flex-1 overflow-y-auto max-h-56 bg-slate-50/50'
    : 'p-4 flex-1 overflow-y-auto max-h-[60vh] bg-slate-50/50';

  return (
    <div className={containerClassName}>
      <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100 flex items-center justify-between">
        <h3 className="font-semibold text-indigo-900 flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">account_tree</span>
          {t('dashboard.sequenceBuilderTitle')}
        </h3>
        <IconButton
          icon="close"
          variant="ghost"
          size="xs"
          className="text-indigo-400 hover:text-indigo-600 hover:bg-indigo-100"
          onClick={() => {
            setIsLinkMode(false);
            setSelectedLinkTaskIds([]);
          }}
          aria-label={t('dashboard.close') || "Close"}
        />
      </div>

      <div className={bodyClassName}>
        {orderedTasks.length === 0 ? (
          <div className="text-center text-sm text-slate-400 py-4">
            {t('dashboard.sequenceBuilderEmpty')}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={orderedTasks.map(t => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {orderedTasks.map((task) => (
                <SortableTaskItem key={task.id} id={task.id} title={task.title} />
              ))}
            </SortableContext>
          </DndContext>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <button
          className={`w-full py-2 px-4 rounded-lg font-medium text-sm transition-all shadow-sm ${
            orderedTasks.length >= 2
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
          disabled={orderedTasks.length < 2 || isProcessing}
          onClick={handleEstablishChain}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('dashboard.linking')}
            </span>
          ) : (
            t('dashboard.establishChain')
          )}
        </button>
      </div>
    </div>
  );
}
