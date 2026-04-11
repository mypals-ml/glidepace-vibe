import { useState, useMemo, useEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';

interface AssigneeSelectorProps {
  taskId: string;
  currentAssignees: User[];
  onClose: () => void;
}

export function AssigneeSelector({ taskId, currentAssignees, onClose }: AssigneeSelectorProps) {
  const { availableUsers, fetchSearchUsers, updateTaskAssignees } = useDashboard();
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchedUsers([]);
      setIsSearching(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await fetchSearchUsers(searchTerm);
        setSearchedUsers(results);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, fetchSearchUsers]);

  const currentAssigneeIds = useMemo(() => 
    currentAssignees.map(u => u.id).filter(id => id !== 'unassigned'), 
    [currentAssignees]
  );

  // Group users into "Project Mates" and "Search Results"
  const projectMates = useMemo(() => {
    return availableUsers.filter(user => 
      !searchTerm || 
      user.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      user.id.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [availableUsers, searchTerm]);

  // Combine results, prioritizing project mates and adding searched users if not already present
  const combinedResults = useMemo(() => {
    const results = [...projectMates];
    const mateIds = new Set(results.map(u => u.id));
    
    searchedUsers.forEach(user => {
      if (!mateIds.has(user.id)) {
        results.push(user);
      }
    });
    
    return results;
  }, [projectMates, searchedUsers]);

  const handleToggleUser = async (userId: string) => {
    if (isUpdating) return;
    
    let nextIds: string[];
    if (currentAssigneeIds.includes(userId)) {
      nextIds = currentAssigneeIds.filter(id => id !== userId);
    } else {
      nextIds = [...currentAssigneeIds, userId];
    }
    
    setIsUpdating(true);
    try {
      const success = await updateTaskAssignees(taskId, nextIds);
      if (!success) {
        // Option: show error toast here
      }
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:absolute sm:inset-auto sm:right-0 sm:left-auto sm:top-full sm:mt-2 sm:p-0">
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-slate-900/20 backdrop-blur-[2px] sm:hidden" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      
      {/* Selector Panel */}
      <div 
        className="glass-panel w-full rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 origin-top-right min-w-[280px]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Header */}
        <div className="p-3 border-b border-slate-200/60 bg-white/50">
          <div className="relative">
            <span className={`material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm ${isSearching ? 'animate-spin' : ''}`}>
              {isSearching ? 'sync' : 'search'}
            </span>
            <input
              autoFocus
              type="text"
              className="w-full bg-slate-100/50 border border-slate-200/50 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              placeholder={t('dashboard.searchPlaceholder', 'Search people...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>

        {/* User List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1 bg-white/30">
          {combinedResults.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">person_search</span>
              <div className="text-slate-400 text-xs italic">{t('dashboard.noResults', 'No results found')}</div>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Project Mates section if searching */}
              {searchTerm && projectMates.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  {t('dashboard.projectMates', 'Project Mates')}
                </div>
              )}
              
              {projectMates.map(user => {
                const isSelected = currentAssigneeIds.includes(user.id);
                return (
                  <UserButton 
                    key={user.id} 
                    user={user} 
                    isSelected={isSelected} 
                    isUpdating={isUpdating}
                    onClick={() => handleToggleUser(user.id)} 
                  />
                );
              })}

              {/* Suggestions from Search */}
              {searchTerm && searchedUsers.filter(u => !projectMates.some(pm => pm.id === u.id)).length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 mt-1 border-t border-slate-100">
                    {t('dashboard.suggestions', 'Suggestions')}
                  </div>
                  {searchedUsers.filter(u => !projectMates.some(pm => pm.id === u.id)).map(user => {
                    const isSelected = currentAssigneeIds.includes(user.id);
                    return (
                      <UserButton 
                        key={user.id} 
                        user={user} 
                        isSelected={isSelected} 
                        isUpdating={isUpdating}
                        onClick={() => handleToggleUser(user.id)} 
                      />
                    );
                  })}
                </>
              )}
            </div>
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

function UserButton({ user, isSelected, isUpdating, onClick }: { user: User, isSelected: boolean, isUpdating: boolean, onClick: () => void }) {
  return (
    <button
      disabled={isUpdating}
      onClick={onClick}
      className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-primary/5 transition-colors group text-left ${isUpdating ? 'opacity-50 grayscale' : ''}`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${user.avatarColor} border-2 ${isSelected ? 'border-primary' : 'border-white'}`}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.initials} className="w-full h-full rounded-full object-cover" />
        ) : user.initials}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="text-xs font-medium text-slate-700 truncate">{user.name}</div>
        <div className="text-[10px] text-slate-400 truncate">@{user.id.length > 20 ? user.id.slice(0, 8) + '...' : user.id}</div>
      </div>
      {isSelected && (
        <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
      )}
    </button>
  );
}
