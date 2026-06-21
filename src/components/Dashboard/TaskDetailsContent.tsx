import { useState, useEffect, useMemo } from 'react';
import type { TFunction } from 'i18next';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneePicker } from './AssigneePicker';
import { StatusPicker } from './StatusPicker';
import { getStatusColor, getStatusDotColor } from '../../utils/statusColors';
import type { Task, User, AutoUpdateStartDateMode } from '../../types';
import { Button } from '../UI/Button';
import { ConfirmationModal } from '../UI/ConfirmationModal';
import { ResizableTextarea } from '../UI/ResizableTextarea';
import { calculateTargetDate } from '../../lib/dateUtils';
import { buildBreakLinkPlan, type BreakLinkScope } from '../../lib/contextMenuLinkUtils';
import { parseSlashGroupPath, serializeSlashGroupPath } from '../../lib/taskGroupUtils';
import { TaskDetailsCopyButton } from './TaskDetailsCopyButton';
import { TaskDetailsCreateForm } from './TaskDetailsCreateForm';
import { TaskDetailsGroupEditor } from './TaskDetailsGroupEditor';
import { TaskCommentsSection } from './TaskCommentsSection';

export function TaskDetailsContent({ task, t, isCreateMode = false }: { task: Task | null; t: TFunction; isCreateMode?: boolean }) {
  const { fetchTaskComments, githubToken, updateTaskTitle, updateTaskDescription, updateTaskDates, deleteTask, handleCreateTask, tasks, projectStatusOptions, setIsCreateMode, setIsTaskDetailsOpen, setSelectedTaskId, showToast, dateSettings, projectFields, pendingTaskInsertPosition, setPendingTaskInsertPosition, setIsLinkMode, setSelectedLinkTaskIds, updateTaskSuccessors, updateTaskGroupPath } = useDashboard();

  useEffect(() => {
    if (!isCreateMode && task?.itemId && githubToken) {
      if (task.contentId) {
        console.log(`[TaskDetailsPanel] 💬 Task detail view opened for task itemId: ${task.itemId}. Fetching comments...`);
        fetchTaskComments(task.id, task.contentId, githubToken)
          .catch((err: unknown) => {
            console.error(`[TaskDetailsPanel] ❌ Failed fetching comments for task: ${task.id}`, err);
          });
      }
    }
  }, [task?.itemId, task?.contentId, task?.id, githubToken, isCreateMode, fetchTaskComments]);

  // Derive a repository from existing tasks so the AssigneePicker can fetch assignable users
  const projectRepository = tasks.find(t => t.repository)?.repository;


  // Create Mode state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<string>(projectStatusOptions[0] || 'Todo');
  const [newAssignees, setNewAssignees] = useState<User[]>([]);
  const [newStartDate, setNewStartDate] = useState<string>('');
  const [newTargetDate, setNewTargetDate] = useState<string>('');
  const [newEstimate, setNewEstimate] = useState<string>('');
  const [newEstimateUnit, setNewEstimateUnit] = useState<string>(dateSettings.estimateUnit || 'hours');
  const [newAutoUpdateMode, setNewAutoUpdateMode] = useState<AutoUpdateStartDateMode>('auto');
  const [isCreating, setIsCreating] = useState(false);

  // Sync new task's estimate unit with project settings default when it changes
  const [prevEstimateUnitProp, setPrevEstimateUnitProp] = useState<string | undefined>(dateSettings.estimateUnit);

  if (isCreateMode && dateSettings.estimateUnit !== prevEstimateUnitProp) {
    setPrevEstimateUnitProp(dateSettings.estimateUnit);
    if (dateSettings.estimateUnit) {
      setNewEstimateUnit(dateSettings.estimateUnit);
    }
  }

  // Auto-calculate new target date in create mode
  const [prevCalcDeps, setPrevCalcDeps] = useState("");
  const currentDeps = `${newStartDate}-${newEstimate}-${newEstimateUnit}`;
  
  if (isCreateMode && currentDeps !== prevCalcDeps) {
    setPrevCalcDeps(currentDeps);
    const calculated = calculateTargetDate(newStartDate, parseFloat(newEstimate) || 0, newEstimateUnit);
    if (calculated !== newTargetDate) {
      setNewTargetDate(calculated);
    }
  }

  // Edit Mode state
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task?.title || '');

  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState(task?.body || '');

  const [isAssigneePickerOpen, setIsAssigneePickerOpen] = useState(false);
  const [isStatusPickerOpen, setIsStatusPickerOpen] = useState(false);

  const [isTaskDeleteConfirmOpen, setIsTaskDeleteConfirmOpen] = useState(false);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [draftEstimate, setDraftEstimate] = useState<string>(task?.estimate?.toString() || '');
  const [isGroupEditorOpen, setIsGroupEditorOpen] = useState(false);
  const [draftGroupPath, setDraftGroupPath] = useState(serializeSlashGroupPath(task?.groupPath));
  const [isSavingGroupPath, setIsSavingGroupPath] = useState(false);

  useEffect(() => {
    setDraftGroupPath(serializeSlashGroupPath(task?.groupPath));
  }, [task?.id, task?.itemId, task?.groupPath]);

  const breakLinkPlan = useMemo(() => {
    return task ? buildBreakLinkPlan(tasks, { firstTask: task, lastTask: task }, 'all') : null;
  }, [task, tasks]);

  const existingGroupPaths = useMemo(() => {
    const paths = new Set<string>();
    tasks.forEach(candidate => {
      const formatted = serializeSlashGroupPath(candidate.groupPath);
      if (formatted) paths.add(formatted);
    });
    return Array.from(paths).sort();
  }, [tasks]);

  // Derived estimate unit options (merged and deduplicated)
  const getMergedEstimateUnitOptions = () => {
    const optionsSet = new Set<string>();

    // 1. Task's current value (for edit mode)
    if (task?.estimateUnit) {
      optionsSet.add(task.estimateUnit);
    }

    // 2. newEstimateUnit (for create mode)
    if (isCreateMode && newEstimateUnit) {
      optionsSet.add(newEstimateUnit);
    }

    // 3. Task's specific options (from github mapping)
    if (task?.estimateUnitOptions) {
      Object.keys(task.estimateUnitOptions).forEach(name => optionsSet.add(name));
    }

    // 4. Global project fields options
    const globalOptions = projectFields.find(f => f.id === dateSettings.estimateUnitFieldId)?.options;
    if (globalOptions && globalOptions.length > 0) {
      globalOptions.forEach(opt => optionsSet.add(opt.name));
    }

    // 5. All unique values currently used in the project (only for text fields)
    const isSingleSelect = projectFields.find(f => f.id === dateSettings.estimateUnitFieldId)?.__typename === 'ProjectV2SingleSelectField';
    if (!isSingleSelect) {
      tasks.forEach(t => {
        if (t.estimateUnit) optionsSet.add(t.estimateUnit);
      });
    }

    // 6. Fallback defaults if list is still empty or has very few items
    if (optionsSet.size === 0 || (optionsSet.size === 1 && !globalOptions)) {
      ['hours', 'days', 'points'].forEach(opt => optionsSet.add(opt));
    }

    return Array.from(optionsSet);
  };

  const mergedEstimateUnitOptions = getMergedEstimateUnitOptions();



  const handleSaveTitle = async () => {
    if (!task) return;
    await updateTaskTitle(task, draftTitle);
    setEditingTitle(false);
  };

  const handleSaveDesc = async () => {
    if (!task) return;
    await updateTaskDescription(task, draftDesc);
    setEditingDesc(false);
  };

  const confirmDeleteTask = async () => {
    if (!task) return;
    setIsDeletingTask(true);
    const success = await deleteTask(task);
    setIsDeletingTask(false);
    setIsTaskDeleteConfirmOpen(false);

    if (success) {
      setSelectedTaskId(null);
      setIsTaskDetailsOpen(false);
      showToast(t('dashboard.taskDeleted', 'Task deleted.'), 'success');
    } else {
      showToast(t('dashboard.taskDeleteFailed', 'Failed to delete task.'), 'error');
    }
  };

  const handleSaveEstimate = async () => {
    if (!task) return;
    const val = parseFloat(draftEstimate) || 0;
    if (val !== task.estimate) {
      await updateTaskDates(task, undefined, undefined, val);
    }
  };

  const handleStartDateChange = (value: string) => {
    if (!task) return;
    void updateTaskDates(task, value || null, undefined);
  };

  const handleStartPositionedCreate = (placement: 'above' | 'below') => {
    if (!task) return;
    setPendingTaskInsertPosition({ targetTaskId: task.id, placement });
    setIsCreateMode(true);
    setSelectedTaskId(null);
    setIsTaskDetailsOpen(true);
  };

  const handleStartLinkMode = () => {
    if (!task) return;
    setIsLinkMode(true);
    setSelectedLinkTaskIds([task.id]);
    setIsTaskDetailsOpen(false);
  };

  const handleBreakLinks = async (scope: BreakLinkScope) => {
    if (!task) return;
    const plan = buildBreakLinkPlan(tasks, { firstTask: task, lastTask: task }, scope);
    for (const operation of plan.operations) {
      await updateTaskSuccessors(operation.taskId, operation.successorIds, true);
    }
  };

  const handleSaveGroupPath = async () => {
    if (!task || isSavingGroupPath) return;
    setIsSavingGroupPath(true);
    try {
      const success = await updateTaskGroupPath(task.id, parseSlashGroupPath(draftGroupPath));
      if (success) {
        setIsGroupEditorOpen(false);
      }
    } finally {
      setIsSavingGroupPath(false);
    }
  };

  const onHandleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    const created = await handleCreateTask({
      title: newTitle,
      body: newDesc,
      status: newStatus,
      startDate: newStartDate,
      targetDate: newTargetDate,
      estimate: parseFloat(newEstimate) || 0,
      estimateUnit: newEstimateUnit,
      autoUpdateStartDate: newAutoUpdateMode,
      assigneeIds: newAssignees.map(a => a.id).filter(id => id !== 'unassigned'),
      insertPosition: pendingTaskInsertPosition
    });
    setPendingTaskInsertPosition(null);
    setIsCreating(false);
    if (created) {
      setSelectedTaskId(null);
      setIsTaskDetailsOpen(false);
    }
  };

  const resizeTextFieldLabel = t('dashboard.resizeTextField', 'Resize text field');

  if (isCreateMode) {
    return (
      <TaskDetailsCreateForm
        t={t}
        newTitle={newTitle}
        setNewTitle={setNewTitle}
        newDesc={newDesc}
        setNewDesc={setNewDesc}
        newStatus={newStatus}
        setNewStatus={setNewStatus}
        newAssignees={newAssignees}
        setNewAssignees={setNewAssignees}
        newStartDate={newStartDate}
        setNewStartDate={setNewStartDate}
        newTargetDate={newTargetDate}
        newEstimate={newEstimate}
        setNewEstimate={setNewEstimate}
        newEstimateUnit={newEstimateUnit}
        setNewEstimateUnit={setNewEstimateUnit}
        newAutoUpdateMode={newAutoUpdateMode}
        setNewAutoUpdateMode={setNewAutoUpdateMode}
        isCreating={isCreating}
        isAssigneePickerOpen={isAssigneePickerOpen}
        setIsAssigneePickerOpen={setIsAssigneePickerOpen}
        isStatusPickerOpen={isStatusPickerOpen}
        setIsStatusPickerOpen={setIsStatusPickerOpen}
        mergedEstimateUnitOptions={mergedEstimateUnitOptions}
        projectRepository={projectRepository}
        resizeTextFieldLabel={resizeTextFieldLabel}
        onCreate={onHandleCreate}
        onCancel={() => {
          setPendingTaskInsertPosition(null);
          setSelectedTaskId(null);
          setIsCreateMode(false);
          setIsTaskDetailsOpen(false);
        }}
      />
    );
  }

  if (!task) return null;

  const detailStartDateValue = task.startDate || task.tempStartDate || '';
  const detailTargetDateValue = task.targetDate || task.tempTargetDate || '';

  return (
    <>
      {/* Title */}
      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <span className="text-xs font-mono text-slate-500">{task.displayId}</span>
          <div className="flex items-center gap-1">
            {!editingTitle && (
              <>
                <TaskDetailsCopyButton text={task.title} t={t} />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditingTitle(true)}
                >
                  {t('common.edit', 'Edit')}
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="px-3 pt-3">
          {editingTitle ? (
            <div className="space-y-2">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                className="w-full border border-slate-300 rounded p-2 text-sm focus:ring focus:ring-primary/20 outline-none"
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="primary" size="sm" onClick={handleSaveTitle}>{t('common.save')}</Button>
                <Button variant="secondary" size="sm" onClick={() => { setEditingTitle(false); setDraftTitle(task.title); }}>{t('common.cancel')}</Button>
              </div>
            </div>
          ) : (
            <h3 className="text-base md:text-sm font-bold text-slate-900 leading-tight">{task.title}</h3>
          )}
        </div>
      </div>

      {/* Task Description */}
      {editingDesc ? (
        <div className="space-y-2">
          <label className="block px-1 text-xs font-medium text-slate-600">{t('dashboard.description')}</label>
          <ResizableTextarea
            value={draftDesc}
            onChange={(e) => setDraftDesc(e.target.value)}
            resizeHandleLabel={resizeTextFieldLabel}
            className="w-full border border-slate-300 rounded-lg bg-white p-3 text-sm shadow-sm focus:ring focus:ring-primary/20 outline-none min-h-[100px] resize-y resizable-textarea"
            autoFocus
          />
          <div className="flex gap-2 justify-end">
            <Button variant="primary" size="sm" onClick={handleSaveDesc}>{t('common.save')}</Button>
            <Button variant="secondary" size="sm" onClick={() => { setEditingDesc(false); setDraftDesc(task.body || ''); }}>{t('common.cancel')}</Button>
          </div>
        </div>
      ) : (
        <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
          <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
            <label className="text-xs font-medium text-slate-600">{t('dashboard.description')}</label>
            <div className="flex items-center gap-1">
              <TaskDetailsCopyButton text={task.body || ''} t={t} />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEditingDesc(true)}
              >
                {t('common.edit', 'Edit')}
              </Button>
            </div>
          </div>

          <div className="px-3 pt-3">
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[2rem]">
              {task.body || <span className="text-slate-400 italic">{t('dashboard.noDescription')}</span>}
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="border-t border-slate-200/60 pt-3 relative">
        <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.status')}</label>
        <div
          className="flex flex-wrap gap-2 cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition-colors"
          onClick={() => setIsStatusPickerOpen(true)}
        >
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${getStatusColor(task.status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(task.status)}`}></span>
            <span className="text-sm font-medium">{task.status}</span>
          </div>
        </div>
        {isStatusPickerOpen && (
          <StatusPicker
            task={task}
            onClose={() => setIsStatusPickerOpen(false)}
          />
        )}
      </div>

      {/* Assignees */}
      <div className="border-t border-slate-200/60 pt-3 relative">
        <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.assignees')}</label>
        <div
          className="flex flex-wrap gap-2 cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition-colors"
          onClick={() => setIsAssigneePickerOpen(true)}
        >
          {task.assignees && task.assignees.length > 0 ? task.assignees.map(user => (
            <div key={user.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${user.avatarColor}`}>
              {user.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.name} className="w-5 h-5 rounded-full object-cover" />
              ) : (
                <span className="text-xs font-bold">{user.initials}</span>
              )}
              <span className="text-sm font-medium">{user.name}</span>
            </div>
          )) : (
            <span className="text-sm text-slate-500">{t('dashboard.unassigned')}</span>
          )}
        </div>
        {isAssigneePickerOpen && (
          <AssigneePicker
            taskId={task.id}
            currentAssignees={task.assignees}
            repository={task.repository || projectRepository}
            onClose={() => setIsAssigneePickerOpen(false)}
          />
        )}
      </div>

      {/* Repository */}
      {task.repository && (
        <div className="border-t border-slate-200/60 pt-3">
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.repository')}</label>
          <p className="text-sm text-slate-700">{task.repository}</p>
        </div>
      )}

      {/* Dates */}
      <div className="border-t border-slate-200/60 pt-3 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="flex h-4 items-center gap-2 mb-2">
              <label className="text-xs font-medium text-slate-600">{t('dashboard.startDate')}</label>
              <button
                type="button"
                onClick={() => updateTaskDates(task, null, undefined)}
                disabled={!task.startDate}
                aria-label={t('dashboard.resetStartDateToAuto', 'Reset to Auto')}
                title={!task.startDate ? t('dashboard.startDateAlreadyAuto', 'Start date is already automatic') : undefined}
                className="h-4 shrink-0 rounded border border-primary/20 bg-primary/10 px-1.5 text-[10px] font-medium leading-none text-primary transition-colors hover:bg-primary/15 hover:text-primary/80 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
              >
                {t('dashboard.resetStartDateToAuto', 'Reset to Auto')}
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={detailStartDateValue}
                onChange={(e) => handleStartDateChange(e.target.value)}
                className="min-w-0 flex-1 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 cursor-pointer outline-none focus:ring focus:ring-primary/20"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.targetDate')}</label>
            <input
              type="date"
              value={detailTargetDateValue}
              readOnly
              className="w-full text-sm text-slate-400 bg-slate-100 border border-slate-200 rounded p-1.5 cursor-not-allowed outline-none"
              title={t('dashboard.targetDateAutoCalc', 'Target date is calculated based on start date and estimate')}
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">
            {t('dashboard.estimate')}
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={draftEstimate}
              onChange={(e) => setDraftEstimate(e.target.value)}
              onBlur={handleSaveEstimate}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder="0"
              className="w-24 text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:ring focus:ring-primary/20"
            />
            <select
              value={task.estimateUnit}
              onChange={(e) => updateTaskDates(task, undefined, undefined, undefined, e.target.value)}
              className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:ring focus:ring-primary/20 cursor-pointer"
            >
              {mergedEstimateUnitOptions.map(opt => (
                <option key={opt} value={opt}>{t(`units.${opt}`, opt)}</option>
              ))}
            </select>
          </div>
        </div>
        {/* Auto Update Start Date Toggle */}
        <div className="pt-2">
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.autoUpdateStartDateLabel')}</label>
          <select
            value={task.autoUpdateStartDate || 'ask'}
            onChange={(e) => {
              updateTaskDates(task, undefined, undefined, undefined, undefined, e.target.value as AutoUpdateStartDateMode);
            }}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 outline-none focus:ring focus:ring-primary/20 cursor-pointer"
          >
            <option value="auto">{t('dashboard.modeAuto')}</option>
            <option value="locked">{t('dashboard.modeLocked')}</option>
            <option value="ask">{t('dashboard.modeAsk')}</option>
          </select>
        </div>
      </div>

      {/* Progress */}
      <div className="border-t border-slate-200/60 pt-3">
        <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.progress')}</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${task.progress === 100 ? 'bg-status-done-highlight' : task.progress > 0 ? 'bg-status-inprogress-highlight' : 'bg-status-todo-highlight'
                }`}
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-slate-600 w-10 text-right">{task.progress}%</span>
        </div>
      </div>

      <TaskCommentsSection task={task} t={t} resizeTextFieldLabel={resizeTextFieldLabel} />

      {/* Task Actions */}
      <div className="border border-slate-200/60 rounded-lg bg-white/95 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 border-b border-slate-200/60">
          <label className="text-xs font-medium text-slate-600">{t('dashboard.taskActions', 'Task actions')}</label>
        </div>
        <div className="grid grid-cols-2 gap-2 p-3">
          <Button
            variant="secondary"
            size="sm"
            leftIcon="add"
            onClick={() => handleStartPositionedCreate('above')}
          >
            {t('dashboard.addTaskAbove')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon="add"
            onClick={() => handleStartPositionedCreate('below')}
          >
            {t('dashboard.addTaskBelow')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon="add_link"
            onClick={handleStartLinkMode}
          >
            {t('dashboard.addSuccessors')}
          </Button>
          <Button
            variant="secondary"
            size="sm"
            leftIcon="folder"
            onClick={() => setIsGroupEditorOpen(true)}
          >
            {t('dashboard.groupLabel')}
          </Button>
        </div>
        {breakLinkPlan && (breakLinkPlan.hasPredecessors || breakLinkPlan.hasSuccessors) && (
          <div className="border-t border-slate-100 px-3 pb-3">
            <div className="grid grid-cols-1 gap-2 pt-3">
              <Button
                variant="ghost"
                size="sm"
                leftIcon="link_off"
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleBreakLinks('all')}
              >
                {t('dashboard.breakAllLinks')}
              </Button>
              {breakLinkPlan.hasPredecessors && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon="call_received"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleBreakLinks('predecessors')}
                >
                  {t('dashboard.breakWithPredecessors')}
                </Button>
              )}
              {breakLinkPlan.hasSuccessors && (
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon="call_made"
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => handleBreakLinks('successors')}
                >
                  {t('dashboard.breakWithSuccessors')}
                </Button>
              )}
            </div>
          </div>
        )}
        {/* Delete Task (danger zone) */}
        <div className="border-t border-red-100 p-3">
          <Button
            variant="danger"
            size="md"
            fullWidth
            leftIcon="delete"
            onClick={() => setIsTaskDeleteConfirmOpen(true)}
            disabled={isDeletingTask}
            isLoading={isDeletingTask}
          >
            {t('dashboard.deleteTask', 'Delete Task')}
          </Button>
        </div>
      </div>

      {/* Bottom spacer to prevent dropdown clipping in scrollable area */}
      <div className="h-24" />

      <ConfirmationModal
        isOpen={isTaskDeleteConfirmOpen}
        onClose={() => setIsTaskDeleteConfirmOpen(false)}
        onConfirm={confirmDeleteTask}
        title={t('dashboard.deleteTask', 'Delete Task')}
        message={t('dashboard.confirmDeleteTask', 'Delete this task from the GitHub project and delete the linked repository issue? This cannot be undone.')}
        confirmLabel={t('dashboard.deleteTask', 'Delete Task')}
        cancelLabel={t('common.cancel', 'Cancel')}
        variant="danger"
        isConfirming={isDeletingTask}
      />
      {isGroupEditorOpen && (
        <TaskDetailsGroupEditor
          t={t}
          draftGroupPath={draftGroupPath}
          setDraftGroupPath={setDraftGroupPath}
          existingGroupPaths={existingGroupPaths}
          isSavingGroupPath={isSavingGroupPath}
          onClose={() => setIsGroupEditorOpen(false)}
          onSave={handleSaveGroupPath}
        />
      )}
    </>
  );
}
