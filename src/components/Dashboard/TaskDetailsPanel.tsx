import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneeSelector } from './AssigneeSelector';
import { StatusSelector } from './StatusSelector';
import { getStatusColor, getStatusDotColor } from '../../utils/statusColors';
import type { Task } from '../../types';

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
          <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-6 pt-6 space-y-6">
            <TaskContent key={task.id} task={task} t={t} />
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
          <div className="flex-1 overflow-y-auto custom-scrollbar px-4 pb-4 pt-4 space-y-4">
            <TaskContent key={task.id} task={task} t={t} />
          </div>
        </div>
      </div>
    </>
  );
}

function TaskContent({ task, t }: { task: Task; t: TFunction }) {
  const { updateTaskTitle, updateTaskDescription, updateTaskComment, deleteTaskComment, updateTaskDates } = useDashboard();

  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(task.title);

  const [editingDesc, setEditingDesc] = useState(false);
  const [draftDesc, setDraftDesc] = useState(task.body || '');

  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [draftComment, setDraftComment] = useState('');

  const [isAssigneeSelectorOpen, setIsAssigneeSelectorOpen] = useState(false);
  const [isStatusSelectorOpen, setIsStatusSelectorOpen] = useState(false);


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
    if (window.confirm(t('common.confirmDelete'))) {
      await deleteTaskComment(task, commentId);
    }
  };

  return (
    <>
      {/* Title */}
      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <span className="text-xs font-mono text-slate-500">{task.id}</span>
          {!editingTitle && (
            <div className="opacity-0 group-hover:opacity-100 transition-opacity">
              <ActionMenu onEdit={() => setEditingTitle(true)} />
            </div>
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
            <span className="text-sm text-slate-500">Unassigned</span>
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
      <div className="border border-slate-200/60 rounded-lg bg-white/95 pt-0 px-0 pb-3 shadow-sm group">
        <div className="flex items-center justify-between bg-slate-50 px-3 h-11 rounded-t-lg border-b border-slate-200/60 mb-0">
          <label className="text-xs font-medium text-slate-600">{t('dashboard.description')}</label>
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
