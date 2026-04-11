import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { AssigneeSelector } from './AssigneeSelector';
import type { User } from '../../types';
import { useState } from 'react';

export function Sidebar() {
  const { t } = useTranslation();
  const { filteredTasks, tasks, isLoadingTasks, searchQuery, setSearchQuery, selectedTaskId, setSelectedTaskId, setIsCreateTaskModalOpen, apiError } = useDashboard();
  const [openSelectorTaskId, setOpenSelectorTaskId] = useState<string | null>(null);

  return (
    <>
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left border-collapse" aria-label={t('dashboard.issuesList')}>
          <thead className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-slate-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <tr>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-12">{t('table.id')}</th>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500">{t('table.title')}</th>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-24">{t('table.status')}</th>
              <th scope="col" className="px-4 py-2.5 text-xs font-medium text-slate-500 w-20 text-center">{t('table.assignees')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 relative z-0">
            {isLoadingTasks ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="animate-spin h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>{t('dashboard.loadingTasks')}</span>
                  </div>
                </td>
              </tr>
            ) : (apiError) ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center">
                  <div className="flex flex-col items-center gap-2 p-4 bg-red-50 border border-red-100 rounded-lg mx-4">
                    <span className="material-symbols-outlined text-red-400">error</span>
                    <p className="text-sm text-red-700 font-medium">{t('dashboard.githubApiErrorTitle')}</p>
                    <p className="text-xs text-red-600 line-clamp-3 overflow-hidden text-ellipsis px-2">{apiError}</p>
                  </div>
                </td>
              </tr>
            ) : tasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                  {t('dashboard.noTasksInProject')}
                </td>
              </tr>
            ) : filteredTasks.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-400 text-xs italic">
                  {t('dashboard.noMatchingTasks')}
                </td>
              </tr>
            ) : (
              filteredTasks.map(task => (
                <tr 
                  key={task.id} 
                  className={`h-[50px] hover:bg-slate-50/80 transition-colors cursor-pointer group bg-white relative ${
                    selectedTaskId === task.id ? 'bg-primary/5 border-l-2 border-primary' : ''
                  }`} 
                  tabIndex={0} 
                  aria-label={`${task.title} - ${t('table.status')} ${task.status}`}
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <td className="px-4 py-0 text-xs text-slate-400 font-mono align-middle relative">
                    {task.status === 'In Progress' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-inprogress-highlight" aria-hidden="true"></div>}
                    {task.status === 'Done' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-done-highlight" aria-hidden="true"></div>}
                    {task.status === 'Todo' && <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-status-todo-highlight" aria-hidden="true"></div>}
                    {task.id}
                  </td>
                  <td className="px-4 py-0 align-middle">
                    <span className={`text-sm font-medium transition-colors block leading-tight ${task.status === 'Done' ? 'text-slate-500 line-through decoration-slate-300' : 'text-slate-700 group-hover:text-primary'}`}>{task.title}</span>
                    <div className="text-[10px] text-slate-400 mt-0.5">{task.startDate} - {task.endDate}</div>
                  </td>
                  <td className="px-4 py-0 align-middle">
                    {task.status === 'Done' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-done-bg text-status-done-text border border-status-done-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-done-highlight mr-1.5"></span>{t('taskStatuses.done')}
                      </span>
                    )}
                    {task.status === 'In Progress' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-inprogress-bg text-status-inprogress-text border border-status-inprogress-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-inprogress-highlight mr-1.5 animate-pulse"></span>{t('taskStatuses.inProgress')}
                      </span>
                    )}
                    {task.status === 'Todo' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-status-todo-bg text-status-todo-text border border-status-todo-border">
                        <span className="w-1.5 h-1.5 rounded-full bg-status-todo-highlight mr-1.5"></span>{t('taskStatuses.todo')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top pt-3 group/assignee relative">
                    <div
                      className="flex justify-center -space-x-1.5 cursor-pointer hover:scale-110 transition-transform"
                      onClick={(e) => {
                        e.stopPropagation();
                        setOpenSelectorTaskId(openSelectorTaskId === task.id ? null : task.id);
                      }}
                      title="Update assignees"
                    >
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
                    </div>
                    {openSelectorTaskId === task.id && (
                      <AssigneeSelector
                        taskId={task.id}
                        currentAssignees={task.assignees}
                        onClose={() => setOpenSelectorTaskId(null)}
                      />
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Bottom Search Box with Add Task Button */}
      <div className="p-3 border-t border-slate-200/80 bg-slate-50/50 backdrop-blur-md mt-auto">
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-[18px]" aria-hidden="true">search</span>
            <input
              className="w-full bg-white border border-slate-200 shadow-sm rounded-md pl-9 pr-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              placeholder={t('dashboard.filterPlaceholder')}
              aria-label={t('dashboard.filterPlaceholder')}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setIsCreateTaskModalOpen(true)}
            className="p-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-md shadow-sm transition-colors flex items-center justify-center"
            title={t('createTask.addButton') || 'Add new task'}
            aria-label={t('createTask.addButton') || 'Add new task'}
          >
            <span className="material-symbols-outlined text-[20px]">add</span>
          </button>
        </div>
      </div>
    </>
  );
}
