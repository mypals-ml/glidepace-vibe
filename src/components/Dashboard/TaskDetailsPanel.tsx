import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneeSelector } from './AssigneeSelector';
import { StatusSelector } from './StatusSelector';
import { getStatusColor, getStatusDotColor } from '../../utils/statusColors';
import type { Task, User } from '../../types';

interface TaskDetailsPanelProps {
  task: Task | null;
  onClose: () => void;
}


export function TaskDetailsPanel({ task, onClose }: TaskDetailsPanelProps) {
  const { t } = useTranslation();
  const { isCreateMode, setIsCreateMode } = useDashboard();

  if (!task && !isCreateMode) return null;

  const handleClose = () => {
    onClose();
    setIsCreateMode(false);
  };



  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose}></div>
      <div className="fixed md:absolute inset-0 md:inset-auto md:right-4 md:top-4 md:bottom-4 md:w-[26rem] md:rounded-xl md:shadow-lg z-50 flex flex-col">
        {/* Mobile View */}
        <div className="md:hidden bg-white h-full rounded-t-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900">{isCreateMode ? t('createTask.title', 'Create New Task') : t('dashboard.taskDetails')}</h2>
            <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-xl text-slate-600">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 pt-6 space-y-6">
            <TaskContent key={isCreateMode ? 'new-task' : task?.id} task={task} t={t} isCreateMode={isCreateMode} />
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/60 h-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200/60">
            <h2 className="text-sm font-bold text-slate-900">{isCreateMode ? t('createTask.title', 'Create New Task') : t('dashboard.taskDetails')}</h2>
            <button onClick={handleClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-lg text-slate-600">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 pt-4 space-y-4">
            <TaskContent key={isCreateMode ? 'new-task' : task?.id} task={task} t={t} isCreateMode={isCreateMode} />
          </div>
        </div>
      </div>
    </>
  );
}

function TaskContent({ task, t, isCreateMode = false }: { task: Task | null; t: TFunction; isCreateMode?: boolean }) {
  const { updateTaskTitle, updateTaskDescription, updateTaskComment, deleteTaskComment, updateTaskDates, addTaskComment, handleCreateTask, tasks, projectStatusOptions, setIsCreateMode } = useDashboard();

  // Derive a repository from existing tasks so the AssigneeSelector can fetch assignable users
  const projectRepository = tasks.find(t => t.repository)?.repository;

  // Create Mode state
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStatus, setNewStatus] = useState<string>(projectStatusOptions[0] || 'Todo');
  const [newAssignees, setNewAssignees] = useState<User[]>([]);
  const [newStartDate, setNewStartDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [newEndDate, setNewEndDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isCreating, setIsCreating] = useState(false);

  // Edit Mode state
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task?.title || '');

  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState(task?.body || '');

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');

  const [isAssigneeSelectorOpen, setIsAssigneeSelectorOpen] = useState(false);
  const [isStatusSelectorOpen, setIsStatusSelectorOpen] = useState(false);

  const [newCommentBody, setNewCommentBody] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);


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

  const handleSaveComment = async (commentId: string) => {
    if (!task) return;
    await updateTaskComment(task, commentId, draftComment);
    setEditingCommentId(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!task) return;
    if (window.confirm(t('common.confirmDelete'))) {
      await deleteTaskComment(task, commentId);
    }
  };

  const handleAddComment = async () => {
    if (!task || !newCommentBody.trim()) return;
    setIsSubmittingComment(true);
    const success = await addTaskComment(task, newCommentBody);
    if (success) {
      setNewCommentBody('');
    }
    setIsSubmittingComment(false);
  };

  const onHandleCreate = async () => {
    if (!newTitle.trim()) return;
    setIsCreating(true);
    await handleCreateTask({
      title: newTitle,
      body: newDesc,
      status: newStatus,
      startDate: newStartDate,
      endDate: newEndDate,
      assigneeIds: newAssignees.map(a => a.id).filter(id => id !== 'unassigned')
    });
    setIsCreating(false);
  };

  if (isCreateMode) {
    return (
      <div className="space-y-6">
        {/* Title */}
        <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
          <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
            <label className="text-xs font-medium text-slate-600">{t('createTask.titlePlaceholder', 'Task Title')}</label>
          </div>
          <div className="px-3 pt-3">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={t('createTask.titlePlaceholder', 'Task title')}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all"
              autoFocus
            />
          </div>
        </div>

        {/* Description */}
        <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
          <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
            <label className="text-xs font-medium text-slate-600">{t('dashboard.description')}</label>
          </div>
          <div className="px-3 pt-3">
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder={t('dashboard.descriptionPlaceholder', 'Add description...')}
              className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[120px] resize-none"
            />
          </div>
        </div>

        {/* Status */}
        <div className="relative">
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('table.status')}</label>
          <div
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer hover:bg-slate-50 transition-colors ${getStatusColor(newStatus)}`}
            onClick={() => setIsStatusSelectorOpen(true)}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(newStatus)}`}></span>
            <span className="text-sm font-medium">{newStatus}</span>
          </div>
          {isStatusSelectorOpen && (
            <StatusSelector
              task={null}
              onClose={() => setIsStatusSelectorOpen(false)}
              onSelect={(status) => {
                setNewStatus(status);
                setIsStatusSelectorOpen(false);
              }}
            />
          )}
        </div>

        {/* Assignees */}
        <div className="relative">
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('table.assignees')}</label>
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer hover:bg-slate-50 transition-colors"
            onClick={() => setIsAssigneeSelectorOpen(true)}
          >
            <div className="flex -space-x-1 overflow-hidden">
              {newAssignees.length > 0 ? newAssignees.slice(0, 3).map(user => (
                <div key={user.id} className={`w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold border border-white ${user.avatarColor}`}>
                  {user.avatarUrl ? <img src={user.avatarUrl} className="w-full h-full rounded-full" /> : user.initials}
                </div>
              )) : <span className="text-sm text-slate-400">?</span>}
            </div>
            <span className="text-sm font-medium text-slate-700 truncate">
              {newAssignees.length === 0 ? t('dashboard.unassigned') : newAssignees.length === 1 ? newAssignees[0].name : `${newAssignees.length} people`}
            </span>
          </div>
          {isAssigneeSelectorOpen && (
            <AssigneeSelector
              taskId="new"
              currentAssignees={newAssignees}
              repository={projectRepository}
              onClose={() => setIsAssigneeSelectorOpen(false)}
              onSelect={(users) => setNewAssignees(users)}
            />
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.startDate')}</label>
            <input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.endDate')}</label>
            <input
              type="date"
              value={newEndDate}
              onChange={(e) => setNewEndDate(e.target.value)}
              className="w-full text-sm text-slate-700 bg-white border border-slate-200 rounded-lg p-2 outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-4 flex flex-col gap-3">
          <button
            onClick={onHandleCreate}
            disabled={!newTitle.trim() || isCreating}
            className={`w-full py-3 bg-primary text-white font-bold rounded-xl shadow-lg shadow-primary/20 hover:bg-primary-hover transition-all flex items-center justify-center gap-2 ${!newTitle.trim() || isCreating ? 'opacity-50 grayscale' : ''}`}
          >
            {isCreating ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : (
              <span className="material-symbols-outlined text-lg">add_circle</span>
            )}
            {t('createTask.create', 'Create Task')}
          </button>
          <button
            onClick={() => setIsCreateMode(false)}
            className="w-full py-2 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
          >
            {t('common.cancel', 'Cancel')}
          </button>
        </div>
        <div className="h-20" />
      </div>
    );
  }

  if (!task) return null;

  return (
    <>
      {/* Title */}
      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <span className="text-xs font-mono text-slate-500">{task.id}</span>
          {!editingTitle && (
            <button 
              onClick={() => setEditingTitle(true)}
              className="px-2 py-1 rounded-md hover:bg-slate-200 text-slate-600 text-xs font-medium"
            >
              {t('common.edit', 'Edit')}
            </button>
          )}
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
              <div className="flex gap-2">
                <button onClick={handleSaveTitle} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover">{t('common.save')}</button>
                <button onClick={() => { setEditingTitle(false); setDraftTitle(task.title); }} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">{t('common.cancel')}</button>
              </div>
            </div>
          ) : (
            <h3 className="text-base md:text-sm font-bold text-slate-900 leading-tight">{task.title}</h3>
          )}
        </div>
      </div>

      {/* Task Description */}
      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <label className="text-xs font-medium text-slate-600">{t('dashboard.description')}</label>
          {!editingDesc && (
            <button 
              onClick={() => setEditingDesc(true)}
              className="px-2 py-1 rounded-md hover:bg-slate-200 text-slate-600 text-xs font-medium"
            >
              {t('common.edit', 'Edit')}
            </button>
          )}
        </div>

        {editingDesc ? (
          <div className="space-y-2">
            <textarea
              value={draftDesc}
              onChange={(e) => setDraftDesc(e.target.value)}
              className="w-full border border-slate-300 rounded p-2 text-sm focus:ring focus:ring-primary/20 outline-none min-h-[100px] resize-y"
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={handleSaveDesc} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover">{t('common.save')}</button>
              <button onClick={() => { setEditingDesc(false); setDraftDesc(task.body || ''); }} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">{t('common.cancel')}</button>
            </div>
          </div>
        ) : (
          <div className="px-3 pt-2 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[2rem]">
            {task.body || <span className="text-slate-400 italic">{t('dashboard.noDescription')}</span>}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="border-t border-slate-200/60 pt-3 relative">
        <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.status')}</label>
        <div
          className="flex flex-wrap gap-2 cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition-colors"
          onClick={() => setIsStatusSelectorOpen(true)}
        >
          <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${getStatusColor(task.status)}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${getStatusDotColor(task.status)}`}></span>
            <span className="text-sm font-medium">{task.status}</span>
          </div>
        </div>
        {isStatusSelectorOpen && (
          <StatusSelector
            task={task}
            onClose={() => setIsStatusSelectorOpen(false)}
          />
        )}
      </div>

      {/* Assignees */}
      <div className="border-t border-slate-200/60 pt-3 relative">
        <label className="text-xs font-medium text-slate-600 block mb-3">{t('table.assignees')}</label>
        <div
          className="flex flex-wrap gap-2 cursor-pointer p-1 -m-1 rounded hover:bg-slate-50 transition-colors"
          onClick={() => setIsAssigneeSelectorOpen(true)}
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
        {isAssigneeSelectorOpen && (
          <AssigneeSelector
            taskId={task.id}
            currentAssignees={task.assignees}
            repository={task.repository}
            onClose={() => setIsAssigneeSelectorOpen(false)}
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
      <div className="border-t border-slate-200/60 pt-3 grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.startDate')}</label>
          <input
            type="date"
            value={task.fullStartDate ? task.fullStartDate.split('T')[0] : ''}
            onChange={(e) => updateTaskDates(task, e.target.value, undefined)}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 cursor-pointer outline-none focus:ring focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.endDate')}</label>
          <input
            type="date"
            value={task.fullEndDate ? task.fullEndDate.split('T')[0] : ''}
            onChange={(e) => updateTaskDates(task, undefined, e.target.value)}
            className="w-full text-sm text-slate-700 bg-slate-50 border border-slate-200 rounded p-1.5 cursor-pointer outline-none focus:ring focus:ring-primary/20"
          />
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

      {/* Comments Section */}
      <div className="border-t border-slate-200/60 pt-3">
        <label className="text-xs font-medium text-slate-600 block mb-3">
          {t('dashboard.comments', { count: (task.comments || []).length })}
        </label>
        <div className="space-y-2.5">
          {(task.comments || []).map((comment) => (
            <div key={comment.id} className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group relative">
              <div className="flex items-center gap-2 bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${comment.author.avatarColor}`}>
                  {comment.author.avatarUrl ? (
                    <img src={comment.author.avatarUrl} alt={comment.author.name} className="w-full h-full rounded-full object-cover" />
                  ) : comment.author.initials}
                </div>
                <span className="text-xs font-medium text-slate-700">{comment.author.name}</span>
                <span className="text-xs text-slate-500">
                  {new Date(comment.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {editingCommentId === comment.id ? (
                <div className="space-y-2">
                  <textarea
                    value={draftComment}
                    onChange={(e) => setDraftComment(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring focus:ring-primary/20 outline-none min-h-[60px] resize-y"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveComment(comment.id)} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover">{t('common.save')}</button>
                    <button onClick={() => setEditingCommentId(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">{t('common.cancel')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="px-3 pt-2 text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{comment.body}</p>
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button 
                      onClick={() => { setEditingCommentId(comment.id); setDraftComment(comment.body); }}
                      className="px-2 py-1 rounded-md hover:bg-slate-200 text-slate-600 text-xs font-medium"
                    >
                      {t('common.edit', 'Edit')}
                    </button>
                    <button 
                      onClick={() => handleDeleteComment(comment.id)}
                      className="px-2 py-1 rounded-md hover:bg-red-50 text-red-600 text-xs font-medium"
                    >
                      {t('common.delete', 'Delete')}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {/* Add Comment Input */}
        <div className="mt-8 border-t border-slate-200/60 pt-4">
          <label className="text-xs font-medium text-slate-600 block mb-3">
            {t('dashboard.addTaskComment', 'Add a comment')}
          </label>
          <textarea
            value={newCommentBody}
            onChange={(e) => setNewCommentBody(e.target.value)}
            placeholder={t('dashboard.addCommentPlaceholder', 'Comment here ...')}
            className="w-full border border-slate-200 rounded-lg p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none min-h-[80px] resize-y bg-white placeholder:text-slate-400"
            disabled={isSubmittingComment}
          />
        </div>
        <div className="flex justify-end mt-2">
          <button
            onClick={handleAddComment}
            disabled={isSubmittingComment || !newCommentBody.trim()}
            className={`px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg hover:bg-primary-hover transition-colors flex items-center gap-2 ${
              (isSubmittingComment || !newCommentBody.trim()) ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isSubmittingComment ? (
              <>
                <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                {t('common.submitting', 'Submitting...')}
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-sm">send</span>
                {t('dashboard.addComment', 'Comment')}
              </>
            )}
          </button>
        </div>
      </div>
      {/* Bottom spacer to prevent dropdown clipping in scrollable area */}
      <div className="h-40" />
    </>
  );
}
