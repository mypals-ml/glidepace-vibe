import { useState, useMemo, useEffect, useCallback, useRef, useLayoutEffect } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import { useTranslation } from 'react-i18next';
import type { User } from '../../types';
import { Button } from '../UI/Button';

interface AssigneePickerProps {
  taskId: string;
  currentAssignees: User[];
  repository?: string;
  onClose: () => void;
  onSelect?: (users: User[]) => void;
}

export function AssigneePicker({ taskId, currentAssignees, repository, onClose, onSelect }: AssigneePickerProps) {
  const { fetchSearchUsers, updateTaskAssignees, selectedProject } = useDashboard();
  const isPrivate = selectedProject && !selectedProject.public;
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchedUsers, setSearchedUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');
  
  // Initial assignable users from repo
  const [assignableUsers, setAssignableUsers] = useState<User[]>([]);

  // Fetch initial assignable users (those who CAN be assigned)
  useEffect(() => {
    const fetchInitial = async () => {
      setIsSearching(true);
      try {
        const results = await fetchSearchUsers('', repository);
        setAssignableUsers(results);
      } finally {
        setIsSearching(false);
      }
    };
    fetchInitial();
  }, [repository, fetchSearchUsers]);

  // Local state for selections
  const initialIds = useMemo(() => 
    currentAssignees.map(u => u.id).filter(id => id !== 'unassigned'), 
    [currentAssignees]
  );
  const [localSelectedIds, setLocalSelectedIds] = useState<string[]>(initialIds);

  // Debounced search for discovery
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) {
      setSearchedUsers([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results = await fetchSearchUsers(searchTerm, repository);
        setSearchedUsers(results);
      } finally {
        setIsSearching(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, repository, fetchSearchUsers]);

  // Assignable users filtered by search term
  const filteredAssignable = useMemo(() => {
    if (!searchTerm) return assignableUsers;
    const lowerQuery = searchTerm.toLowerCase();
    return assignableUsers.filter(user => 
      user.name.toLowerCase().includes(lowerQuery) || 
      user.login?.toLowerCase().includes(lowerQuery)
    );
  }, [assignableUsers, searchTerm]);

  // Combine results, prioritizing assignable users and adding searched users if not already present
  const combinedResults = useMemo(() => {
    const results = [...filteredAssignable];
    const seenIds = new Set(results.map(u => u.id));
    const seenLogins = new Set(results.map(u => u.login).filter(Boolean) as string[]);
    
    searchedUsers.forEach(user => {
      const isDuplicate = seenIds.has(user.id) || (user.login && seenLogins.has(user.login));
      if (!isDuplicate) {
        results.push(user);
        seenIds.add(user.id);
        if (user.login) seenLogins.add(user.login);
      }
    });
    
    return results;
  }, [filteredAssignable, searchedUsers]);

  const handleApply = useCallback(() => {
    // Diff check: check if sets of IDs are different
    const isDifferent = localSelectedIds.length !== initialIds.length || 
      localSelectedIds.some(id => !initialIds.includes(id)) ||
      initialIds.some(id => !localSelectedIds.includes(id));
    
    if (isDifferent) {
      if (onSelect) {
        const selectedUsers = localSelectedIds.map(id => 
          combinedResults.find(u => u.id === id) || 
          currentAssignees.find(u => u.id === id)
        ).filter(Boolean) as User[];
        onSelect(selectedUsers);
      } else {
        updateTaskAssignees(taskId, localSelectedIds);
      }
    }
    onClose();
  }, [taskId, localSelectedIds, initialIds, updateTaskAssignees, onClose, onSelect, combinedResults, currentAssignees]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleApply();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleApply]);

  const handleToggleUser = (userId: string) => {
    setLocalSelectedIds(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId) 
        : [...prev, userId]
    );
  };

  useLayoutEffect(() => {
    const calculatePlacement = () => {
      if (containerRef.current && panelRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const panelHeight = panelRef.current.offsetHeight;
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        
        // If space below is less than panel height (plus some margin), flip to top
        if (spaceBelow < panelHeight + 20) {
          setPlacement('top');
        } else {
          setPlacement('bottom');
        }
      }
    };

    calculatePlacement();
    window.addEventListener('resize', calculatePlacement);
    return () => window.removeEventListener('resize', calculatePlacement);
  }, [combinedResults]);

  return (
    <div ref={containerRef} className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:absolute sm:inset-auto sm:right-0 sm:left-auto ${placement === 'top' ? 'sm:bottom-full sm:mb-2' : 'sm:top-full sm:mt-2'} sm:p-0 pointer-events-none`}>
      {/* Universal backdrop for mobile and click-outside capture for desktop */}
      <div 
        className="fixed inset-0 z-[-1] bg-slate-900/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none pointer-events-auto" 
        onClick={(e) => { e.stopPropagation(); handleApply(); }}
      />
      
      {/* Selector Panel */}
      <div 
        ref={panelRef}
        className={`glass-panel w-full rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 ${placement === 'top' ? 'origin-bottom-right' : 'origin-top-right'} min-w-[280px] pointer-events-auto`}
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
              className={`w-full bg-slate-100/50 border border-slate-200/50 rounded-lg pl-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all ${isPrivate ? 'pr-16' : 'pr-3'}`}
              placeholder={t('dashboard.searchPlaceholder', 'Search people...')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onClick={(e) => e.stopPropagation()}
            />
            {isPrivate && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-slate-100/80 text-[10px] text-slate-500 font-bold border border-slate-200/50 backdrop-blur-sm select-none pointer-events-none">
                <span className="material-symbols-outlined text-[14px]">lock</span>
                {t('dashboard.privateStatus', 'Private')}
              </div>
            )}
          </div>
        </div>

        {/* User List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1 bg-white/30">
          {combinedResults.length === 0 && !isSearching ? (
            <div className="px-4 py-10 text-center">
              <span className="material-symbols-outlined text-slate-300 text-3xl mb-2">person_search</span>
              <div className="text-slate-400 text-xs italic">{t('dashboard.noResults', 'No results found')}</div>
              {isPrivate && (
                <div className="mt-4 px-4 text-[10px] text-slate-400/70 leading-relaxed">
                  {t('dashboard.privateProjectSearchNotice', 'Global search is limited for private projects.')}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Assignable section */}
              {filteredAssignable.length > 0 && (
                <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                  {t('dashboard.assignable', 'Assignable')}
                </div>
              )}
              
              {filteredAssignable.map(user => {
                const isSelected = localSelectedIds.includes(user.id);
                return (
                  <UserButton 
                    key={user.id} 
                    user={user} 
                    isSelected={isSelected} 
                    onClick={() => handleToggleUser(user.id)} 
                  />
                );
              })}

              {/* Suggestions from Search */}
              {searchTerm && searchedUsers.filter(u => !assignableUsers.some(au => au.id === u.id || (u.login && au.login === u.login))).length > 0 && (
                <>
                  <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50 mt-1 border-t border-slate-100">
                    {t('dashboard.suggestions', 'Suggestions')}
                  </div>
                  {searchedUsers.filter(u => !assignableUsers.some(au => au.id === u.id || (u.login && au.login === u.login))).map(user => {
                    const isSelected = localSelectedIds.includes(user.id);
                    return (
                      <UserButton 
                        key={user.id} 
                        user={user} 
                        isSelected={isSelected} 
                        onClick={() => handleToggleUser(user.id)} 
                      />
                    );
                  })}
                </>
              )}

              {/* Private project notice at bottom of results */}
              {isPrivate && combinedResults.length > 0 && (
                <div className="px-3 py-1.5 border-t border-slate-100/50 mt-1">
                  <div className="flex items-center gap-2 text-slate-400/60">
                    <span className="material-symbols-outlined text-xs">info</span>
                    <p className="text-[9px] leading-tight italic">
                      {t('dashboard.privateProjectSearchNotice', 'Global search is limited for private projects.')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer/Action */}
        <div className="p-2 border-t border-slate-200/60 bg-slate-50/80 flex justify-between items-center sm:hidden">
          <span className="text-[10px] text-slate-400 ml-2">{t('common.selected', { count: localSelectedIds.length })}</span>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApply}
          >
            {t('common.done')}
          </Button>
        </div>
      </div>
      
      {/* Invisible overlay for desktop click-outside */}
      <div 
        className="fixed inset-0 z-[-1] hidden sm:block pointer-events-auto" 
        onClick={(e) => { e.stopPropagation(); handleApply(); }}
      />
    </div>
  );
}

function UserButton({ user, isSelected, onClick }: { user: User, isSelected: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-primary/5 transition-colors group text-left`}
    >
      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shadow-sm ${user.avatarColor} border-2 ${isSelected ? 'border-primary' : 'border-white'}`}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
        ) : user.initials}
      </div>
      <div className="flex-1 overflow-hidden">
        <div className="text-xs font-medium text-slate-700 truncate">{user.name}</div>
        {user.login && <div className="text-[10px] text-slate-400 truncate">@{user.login}</div>}
      </div>
      {isSelected && (
        <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
      )}
    </button>
  );
}
