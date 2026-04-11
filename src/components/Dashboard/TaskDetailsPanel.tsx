import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneeSelector } from './AssigneeSelector';
import type { Task, TaskStatus } from '../../types';

interface TaskDetailsPanelProps {
  task: Task | null;
  onClose: () => void;
}

function ActionMenu({ onEdit, onDelete, showDelete = false }: { onEdit: () => void; onDelete?: () => void; showDelete?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { t } = useTranslation();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button onClick={() => setIsOpen(!isOpen)} className="p-1 rounded-md hover:bg-slate-200 text-slate-500">
        <span className="material-symbols-outlined text-sm">more_vert</span>
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-md shadow-lg border border-slate-200 z-[60] py-1">
          <button 
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100"
            onClick={() => { onEdit(); setIsOpen(false); }}
          >
            {t('common.edit', 'Edit')}
          </button>
          {showDelete && onDelete && (
            <button 
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
              onClick={() => { onDelete(); setIsOpen(false); }}
            >
              {t('common.delete', 'Delete')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function TaskDetailsPanel({ task, onClose }: TaskDetailsPanelProps) {
  const { t } = useTranslation();

  if (!task) return null;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Done':
        return 'bg-status-done-bg text-status-done-text border border-status-done-border';
      case 'In Progress':
        return 'bg-status-inprogress-bg text-status-inprogress-text border border-status-inprogress-border';
      default:
        return 'bg-status-todo-bg text-status-todo-text border border-status-todo-border';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Done':
        return 'check_circle';
      case 'In Progress':
        return 'progress_activity';
      default:
        return 'radio_button_unchecked';
    }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40 md:hidden" onClick={onClose}></div>
      <div className="fixed md:absolute inset-0 md:inset-auto md:right-4 md:top-4 md:bottom-4 md:w-[26rem] md:rounded-xl md:shadow-lg z-50 flex flex-col">
        {/* Mobile View */}
        <div className="md:hidden bg-white h-full rounded-t-2xl flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/60">
            <h2 className="text-lg font-bold text-slate-900">{t('dashboard.taskDetails')}</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-xl text-slate-600">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4 space-y-6">
            <TaskContent task={task} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} t={t} />
          </div>
        </div>

        {/* Desktop View */}
        <div className="hidden md:flex flex-col bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-slate-200/60 h-full overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-200/60">
            <h2 className="text-sm font-bold text-slate-900">{t('dashboard.taskDetails')}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
              <span className="material-symbols-outlined text-lg text-slate-600">close</span>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
            <TaskContent task={task} getStatusColor={getStatusColor} getStatusIcon={getStatusIcon} t={t} />
          </div>
        </div>
      </div>
    </>
  );
}

function TaskContent({ task, getStatusColor, getStatusIcon, t }: { task: Task; getStatusColor: (s: string) => string; getStatusIcon: (s: string) => string; t: any }) {
  const { updateTaskTitle, updateTaskDescription, updateTaskComment, deleteTaskComment, updateTaskStatus, updateTaskDates } = useDashboard();
  
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState(task.body || '');

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');

  const [isAssigneeSelectorOpen, setIsAssigneeSelectorOpen] = useState(false);

  // Sync state if task changes
  useEffect(() => {
    setDraftTitle(task.title);
    setDraftDesc(task.body || '');
  }, [task]);

  const handleSaveTitle = async () => {
    await updateTaskTitle(task, draftTitle);
    setEditingTitle(false);
  };

  const handleSaveDesc = async () => {
    await updateTaskDescription(task, draftDesc);
    setEditingDesc(false);
  };

  const handleSaveComment = async (commentId: string) => {
    await updateTaskComment(task, commentId, draftComment);
    setEditingCommentId(null);
  };

  const handleDeleteComment = async (commentId: string) => {
    if (window.confirm(t('common.confirmDelete', 'Are you sure you want to delete this comment?'))) {
      await deleteTaskComment(task, commentId);
    }
  };

  return (
    <>
      {/* Title */}
      <div>
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
              <button onClick={handleSaveTitle} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover">Save</button>
              <button onClick={() => { setEditingTitle(false); setDraftTitle(task.title); }} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 group">
            <div className="flex-1">
              <span className="text-xs font-mono text-slate-500 mt-1 flex-shrink-0 mb-1 block">{task.id}</span>
              <h3 className="text-base md:text-sm font-bold text-slate-900 pr-5">{task.title}</h3>
            </div>
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu onEdit={() => setEditingTitle(true)} />
            </div>
          </div>
        )}
      </div>

      {/* Status */}
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">{t('table.status')}</label>
        <div className="relative inline-block group">
          <select 
            className={`appearance-none cursor-pointer inline-flex items-center gap-2 pr-8 pl-3 py-2 rounded-lg font-medium text-sm outline-none ${getStatusColor(task.status)}`}
            value={task.status}
            onChange={(e) => updateTaskStatus(task, e.target.value as TaskStatus)}
          >
            <option value="Todo">{t('taskStatuses.todo', 'Todo')}</option>
            <option value="In Progress">{t('taskStatuses.inProgress', 'In Progress')}</option>
            <option value="Done">{t('taskStatuses.done', 'Done')}</option>
          </select>
          <span className={`material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 text-sm pointer-events-none ${getStatusColor(task.status).split(' ')[1]}`}>
            expand_more
          </span>
        </div>
      </div>

      {/* Repository */}
      {task.repository && (
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.repository')}</label>
          <p className="text-sm text-slate-700">{task.repository}</p>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
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
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-2">{t('dashboard.progress')}</label>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${
                task.progress === 100 ? 'bg-status-done-highlight' : task.progress > 0 ? 'bg-status-inprogress-highlight' : 'bg-status-todo-highlight'
              }`}
              style={{ width: `${task.progress}%` }}
            ></div>
          </div>
          <span className="text-sm font-medium text-slate-600 w-10 text-right">{task.progress}%</span>
        </div>
      </div>

      {/* Assignees */}
      <div className="border-t border-slate-200/60 pt-4 relative">
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
            <div className="text-sm text-slate-400 italic py-1.5 px-2">No assignees</div>
          )}
        </div>
        {isAssigneeSelectorOpen && (
          <AssigneeSelector 
            taskId={task.id} 
            currentAssignees={task.assignees} 
            onClose={() => setIsAssigneeSelectorOpen(false)} 
          />
        )}
      </div>

      {/* Task Description */}
      <div className="border-t border-slate-200/60 pt-4 group">
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-600 block">Description</label>
          {!editingDesc && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu onEdit={() => setEditingDesc(true)} />
            </div>
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
              <button onClick={handleSaveDesc} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover">Save</button>
              <button onClick={() => { setEditingDesc(false); setDraftDesc(task.body || ''); }} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap min-h-[2rem]">
            {task.body || <span className="text-slate-400 italic">No description provided.</span>}
          </div>
        )}
      </div>

      {/* Comments Section */}
      <div className="border-t border-slate-200/60 pt-4">
        <label className="text-xs font-medium text-slate-600 block mb-3">
          Comments ({(task.comments || []).length})
        </label>
        <div className="space-y-3">
          {(task.comments || []).map((comment) => (
            <div key={comment.id} className="bg-slate-50/50 rounded-lg p-3 border border-slate-200/40 group relative">
              <div className="flex items-center gap-2 mb-1.5 pr-6">
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
                <div className="space-y-2 mt-2">
                  <textarea 
                    value={draftComment}
                    onChange={(e) => setDraftComment(e.target.value)}
                    className="w-full border border-slate-300 rounded p-2 text-sm focus:ring focus:ring-primary/20 outline-none min-h-[60px] resize-y"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleSaveComment(comment.id)} className="px-3 py-1 bg-primary text-white text-xs rounded hover:bg-primary-hover">Save</button>
                    <button onClick={() => setEditingCommentId(null)} className="px-3 py-1 bg-slate-200 text-slate-700 text-xs rounded hover:bg-slate-300">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-700 leading-relaxed pr-2 whitespace-pre-wrap">{comment.body}</p>
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ActionMenu 
                      showDelete 
                      onEdit={() => { setEditingCommentId(comment.id); setDraftComment(comment.body); }} 
                      onDelete={() => handleDeleteComment(comment.id)} 
                    />
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
