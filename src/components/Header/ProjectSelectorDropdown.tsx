import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useDashboard } from '../../context/DashboardContext';

export function ProjectSelectorDropdown() {
  const { t } = useTranslation();
  const {
    hasProject,
    setHasProject,
    selectedProject,
    setSelectedProject,
    handleOpenProjectClick,
    handleSelectRealProject,
    handleRemoveFromHistory,
    groupHistoryByDate,
  } = useDashboard();

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useClickOutside(dropdownRef, () => setIsOpen(false), isOpen);

  return (
    <div className="relative" ref={dropdownRef}>
      <div
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-colors h-[var(--header-button-height)] overflow-hidden focus-within:ring-1 focus-within:ring-primary focus-within:border-primary"
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <div className="px-3 py-1.5 bg-slate-50 border-r border-slate-200 text-[10px] font-bold uppercase tracking-wider text-slate-500 hidden lg:block">{t('app.projectLabel')}</div>
        <div className="px-2.5 sm:px-3 py-1.5 text-sm font-bold text-slate-700 flex items-center gap-2 min-w-0 overflow-hidden">
          <span className="material-symbols-outlined text-[20px] text-primary shrink-0" aria-hidden="true">folder_open</span>
          <span className="truncate hidden sm:inline max-w-[100px] lg:max-w-[200px]">
            {hasProject
              ? (selectedProject ? selectedProject.title : t('app.emptyProjectOption'))
              : t('app.emptyProjectOption')}
          </span>
          <span className={`material-symbols-outlined text-[18px] text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
        </div>
      </div>

      {isOpen && (
        <div className="absolute left-0 top-full mt-2 min-w-[280px] max-w-[440px] w-max bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150 border border-slate-200/60" role="listbox">
          <div className="p-2 space-y-1">
            {/* Current Project Section */}
            {hasProject && selectedProject && (
              <div className="px-0 pt-1 mb-4">
                <div className="border border-slate-200/60 rounded-lg bg-white shadow-sm overflow-hidden">
                  <div className="flex items-center bg-slate-50/80 px-3 h-9 border-b border-slate-200/60">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {t('dashboard.currentProject')}
                    </span>
                  </div>
                  <div className="px-3 py-3">
                    <div className="text-sm font-bold text-slate-600 line-clamp-2 leading-relaxed">
                      {selectedProject.title}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Hide empty/dummy when a real project is selected */}
            {!(hasProject && selectedProject) && (
              <button
                onClick={() => {
                  setHasProject(true);
                  setSelectedProject(null);
                  setIsOpen(false);
                  localStorage.removeItem('selected_project');
                  localStorage.setItem('selected_project_type', 'none');
                }}
                className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between ${!selectedProject && localStorage.getItem('selected_project_type') === 'none' ? 'text-primary font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                role="option"
                aria-selected={!selectedProject && localStorage.getItem('selected_project_type') === 'none'}
              >
                <span className="truncate pr-10">{t('app.emptyProjectOption')}</span>
                {!selectedProject && localStorage.getItem('selected_project_type') === 'none' && <span className="material-symbols-outlined text-sm" aria-hidden="true">check</span>}
              </button>
            )}

            {/* Project History */}
            {(() => {
              const groups = groupHistoryByDate();
              const groupOrder = [
                { key: 'today', label: t('dashboard.historyToday') },
                { key: 'yesterday', label: t('dashboard.historyYesterday') },
                { key: 'last7Days', label: t('dashboard.historyLast7Days') },
                { key: 'earlier', label: t('dashboard.historyEarlier') },
              ];

              return groupOrder.map(group => {
                const items = groups[group.key];
                if (items.length === 0) return null;

                return (
                  <div key={group.key} className="space-y-1">
                    <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 first:border-0 mt-1 first:mt-0 pt-3 first:pt-1">
                      {group.label}
                    </div>
                    {items.map(item => (
                      <div key={item.id} className="relative group">
                        <button
                          onClick={() => { handleSelectRealProject(item.id, item.title, item.public); setIsOpen(false); }}
                          className={`w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center ${selectedProject?.id === item.id ? 'text-slate-600 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}
                          role="option"
                          aria-selected={selectedProject?.id === item.id}
                        >
                          <span className="truncate pr-10">{item.title}</span>
                          {selectedProject?.id === item.id && (
                            <div className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center group-hover:opacity-0 transition-opacity pointer-events-none" aria-hidden="true">
                              <span className="material-symbols-outlined text-[20px]">check</span>
                            </div>
                          )}
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRemoveFromHistory(item.id); }}
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity rounded-md hover:bg-rose-50 z-10"
                          title={t('dashboard.removeFromHistory')}
                        >
                          <span className="material-symbols-outlined text-[20px]">close</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              });
            })()}
          </div>

          <div className="p-2 border-t border-slate-100 bg-slate-50/50">
            <button
              onClick={() => { handleOpenProjectClick(); setIsOpen(false); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-all shadow-md shadow-primary/20"
            >
              <span className="material-symbols-outlined text-[18px]" aria-hidden="true">folder_open</span>
              {t('dashboard.addProjectButton')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
