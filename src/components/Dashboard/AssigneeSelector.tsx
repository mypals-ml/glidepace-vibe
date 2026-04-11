import { useState, useMemo } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import type { User } from '../../types';

interface AssigneeSelectorProps {
  taskId: string;
  currentAssignees: User[];
  onClose: () => void;
}

export function AssigneeSelector({ taskId, currentAssignees, onClose }: AssigneeSelectorProps) {
  const { availableUsers, updateTaskAssignees } = useDashboard();
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = useMemo(() => {
    return availableUsers.filter(user => 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableUsers, searchTerm]);

  const currentAssigneeIds = useMemo(() => 
    currentAssignees.map(u => u.id).filter(id => id !== 'unassigned'), 
    [currentAssignees]
  );

  const handleToggleUser = (userId: string) => {
    let nextIds: string[];
    if (currentAssigneeIds.includes(userId)) {
      nextIds = currentAssigneeIds.filter(id => id !== userId);
    } else {
      nextIds = [...currentAssigneeIds, userId];
    }
    updateTaskAssignees(taskId, nextIds);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:absolute sm:inset-auto sm:left-0 sm:right-0 sm:top-full sm:mt-2 sm:p-0">
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] sm:hidden" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      
      {/* Selector Panel */}
      <div className="glass-panel w-full rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 origin-top-right">
        {/* Search Header */}
        <div className="p-3 border-b border-slate-200/60 bg-white/50">
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input
              autoFocus
              type="text"
              className="w-full bg-slate-100/50 border border-slate-200/50 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder="Search people..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* User List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1 bg-white/30">
          {filteredUsers.length === 0 ? (
            <div className="px-4 py-6 text-center text-slate-400 text-xs italic">
              No results found
            </div>
          ) : (
            filteredUsers.map(user => {
              const isSelected = currentAssigneeIds.includes(user.id);
              return (
                <button
                  key={user.id}
                  onClick={() => handleToggleUser(user.id)}
                  className="w-full px-3 py-2 flex items-center gap-3 hover:bg-primary/5 transition-colors group text-left"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${user.avatarColor} border-2 ${isSelected ? 'border-primary' : 'border-white'}`}>
                    {user.avatarUrl ? (
                      <img src={user.avatarUrl} alt={user.initials} className="w-full h-full rounded-full object-cover" />
                    ) : user.initials}
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="text-xs font-medium text-slate-700 truncate">{user.name}</div>
                    <div className="text-[10px] text-slate-400 truncate">@{user.id}</div>
                  </div>
                  {isSelected && (
                    <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer/Action */}
        <div className="p-2 border-t border-slate-200/60 bg-slate-50/80 flex justify-between items-center sm:hidden">
          <span className="text-[10px] text-slate-400 ml-2">{currentAssigneeIds.length} selected</span>
          <button 
            onClick={onClose}
            className="px-4 py-1.5 bg-primary text-white text-xs font-semibold rounded-lg shadow-glow hover:bg-primary-hover transition-all"
          >
            Done
          </button>
        </div>
      </div>
      
      {/* Invisible overlay for desktop click-outside */}
      <div 
        className="fixed inset-0 z-[-1] hidden sm:block" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
    </div>
  );
}
