import { useState, useRef, useLayoutEffect } from 'react';
import { getStatusColor, getStatusDotColor } from '../../utils/statusColors';
import type { Task, TaskStatus } from '../../types';
import { Button } from '../UI/Button';
import { useDashboard } from '../../context/DashboardContext';

/** Fallback used before a project is loaded (demo without mock response yet, etc.) */
const DEFAULT_STATUSES = ['Todo', 'In Progress', 'Done'];

interface StatusPickerProps {
  task: Task | null;
  onClose: () => void;
  onSelect?: (status: string) => void;
}

export function StatusPicker({ task, onClose, onSelect }: StatusPickerProps) {
  const { updateTaskStatus, projectStatusOptions } = useDashboard();
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<'top' | 'bottom'>('bottom');

  // Use project statuses from context; fall back to defaults if not yet loaded.
  const statuses = projectStatusOptions.length > 0 ? projectStatusOptions : DEFAULT_STATUSES;

  const handleSelectStatus = async (status: string) => {
    if (onSelect) {
      onSelect(status);
    } else if (task) {
      await updateTaskStatus(task, status as TaskStatus);
    }
    onClose();
  };

  useLayoutEffect(() => {
    const calculatePlacement = () => {
      if (containerRef.current && panelRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const panelHeight = panelRef.current.offsetHeight;
        const viewportHeight = window.innerHeight;
        const spaceBelow = viewportHeight - rect.bottom;
        
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
  }, [statuses]);

  return (
    <div ref={containerRef} className={`fixed inset-0 z-[100] flex items-center justify-center p-4 sm:absolute sm:inset-auto sm:-left-2 ${placement === 'top' ? 'sm:bottom-full sm:mb-2' : 'sm:top-full sm:mt-2'} sm:p-0 pointer-events-none`}>
      {/* Universal backdrop for mobile and click-outside capture for desktop */}
      <div 
        className="fixed inset-0 z-[-1] bg-slate-900/20 backdrop-blur-[2px] sm:bg-transparent sm:backdrop-blur-none pointer-events-auto" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
      
      {/* Selector Panel */}
      <div 
        ref={panelRef}
        className={`glass-panel w-full sm:w-auto sm:min-w-[160px] rounded-xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in duration-200 ${placement === 'top' ? 'origin-bottom-left' : 'origin-top-left'} pointer-events-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Status List */}
        <div className="max-h-[300px] overflow-y-auto custom-scrollbar py-1 bg-white/30">
          {statuses.map((statusName: string) => {
            const isSelected = task ? task.status === statusName : false;
            return (
              <button
                key={statusName}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSelectStatus(statusName);
                }}
                className="w-full px-3 py-2 flex items-center gap-3 hover:bg-primary/5 transition-colors group text-left"
              >
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shadow-sm border-2 ${isSelected ? 'border-primary' : 'border-white'} ${getStatusColor(statusName)}`}>
                  <span className={`w-2 h-2 rounded-full ${getStatusDotColor(statusName)}`}></span>
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="text-xs font-medium text-slate-700 truncate">{statusName}</div>
                </div>
                {isSelected && (
                  <span className="material-symbols-outlined text-primary text-lg">check_circle</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Footer/Action (mobile only) */}
        <div className="p-2 border-t border-slate-200/60 bg-slate-50/80 flex justify-end items-center sm:hidden">
          <Button
            variant="primary"
            size="sm"
            onClick={(e) => { e.stopPropagation(); onClose(); }}
          >
            Done
          </Button>
        </div>
      </div>
      
      {/* Invisible overlay for desktop click-outside */}
      <div 
        className="fixed inset-0 z-[-1] hidden sm:block pointer-events-auto" 
        onClick={(e) => { e.stopPropagation(); onClose(); }}
      />
    </div>
  );
}
