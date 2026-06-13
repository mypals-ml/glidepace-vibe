import type { RefObject } from 'react';
import type { TFunction } from 'i18next';
import type { BreakLinkPlan, BreakLinkScope } from '../../lib/contextMenuLinkUtils';
import type { ContextMenuTarget } from './TaskSidebarRows';

export type TaskSidebarContextMenuState = {
  x: number;
  y: number;
  target: ContextMenuTarget;
  alignRight: boolean;
};

interface TaskSidebarContextMenuProps {
  contextMenu: TaskSidebarContextMenuState;
  contextMenuRef: RefObject<HTMLDivElement | null>;
  contextBreakLinkPlan: BreakLinkPlan | null;
  isMobile: boolean;
  t: TFunction;
  onAddSuccessors: (target: ContextMenuTarget) => void;
  onBreakLinks: (target: ContextMenuTarget, scope: BreakLinkScope) => void;
  onClose: () => void;
  onCreateTask: (target: ContextMenuTarget, placement: 'above' | 'below') => void;
  onEditTaskGroup: (target: ContextMenuTarget) => void;
  onJumpToChart: (target: ContextMenuTarget) => void;
  onMove: (target: ContextMenuTarget) => void;
  onRenameGroup: (target: ContextMenuTarget) => void;
  onUngroup: (target: ContextMenuTarget) => void;
}

export function TaskSidebarContextMenu({
  contextMenu,
  contextMenuRef,
  contextBreakLinkPlan,
  isMobile,
  t,
  onAddSuccessors,
  onBreakLinks,
  onClose,
  onCreateTask,
  onEditTaskGroup,
  onJumpToChart,
  onMove,
  onRenameGroup,
  onUngroup,
}: TaskSidebarContextMenuProps) {
  return (
    <div
      className="absolute inset-0 z-[100]"
      onClick={onClose}
      onContextMenu={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div
        ref={contextMenuRef}
        data-testid="task-context-menu"
        className="absolute bg-white/95 rounded-xl shadow-2xl border border-slate-200/60 py-1.5 min-w-[200px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          left: contextMenu.x,
          top: contextMenu.y,
          transform: contextMenu.alignRight ? 'translateX(-100%)' : 'none'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          onClick={() => onCreateTask(contextMenu.target, 'above')}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          {t('dashboard.addTaskAbove', 'Add task above')}
        </button>
        <button
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          onClick={() => onCreateTask(contextMenu.target, 'below')}
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          {t('dashboard.addTaskBelow', 'Add task below')}
        </button>
        {isMobile && (
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            onClick={() => onMove(contextMenu.target)}
          >
            <span className="material-symbols-outlined text-[16px]">drag_pan</span>
            {t('dashboard.moveTask', 'Move task')}
          </button>
        )}
        <div className="my-1 border-t border-slate-100" />
        {contextMenu.target.kind === 'group' ? (
          <>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => onRenameGroup(contextMenu.target)}
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
              {t('dashboard.renameGroup', 'Rename group')}
            </button>
            <button
              className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
              onClick={() => onUngroup(contextMenu.target)}
            >
              <span className="material-symbols-outlined text-[16px]">folder_off</span>
              {t('dashboard.ungroup', 'Ungroup')}
            </button>
          </>
        ) : (
          <button
            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
            onClick={() => onEditTaskGroup(contextMenu.target)}
          >
            <span className="material-symbols-outlined text-[16px]">folder</span>
            {t('dashboard.groupLabel', 'Group')}
          </button>
        )}
        <button
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          onClick={() => onJumpToChart(contextMenu.target)}
        >
          <span className="material-symbols-outlined text-[16px]">center_focus_strong</span>
          {t('dashboard.jumpToChart')}
        </button>
        <button
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          onClick={() => onAddSuccessors(contextMenu.target)}
        >
          <span className="material-symbols-outlined text-[16px]">add_link</span>
          {t('dashboard.addSuccessors')}
        </button>
        {contextBreakLinkPlan && (contextBreakLinkPlan.hasPredecessors || contextBreakLinkPlan.hasSuccessors) && (
          <>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => onBreakLinks(contextMenu.target, 'all')}
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              {t('dashboard.breakAllLinks')}
            </button>
            {contextBreakLinkPlan.hasPredecessors && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => onBreakLinks(contextMenu.target, 'predecessors')}
              >
                <span className="material-symbols-outlined text-[16px]">call_received</span>
                {t('dashboard.breakWithPredecessors')}
              </button>
            )}
            {contextBreakLinkPlan.hasSuccessors && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => onBreakLinks(contextMenu.target, 'successors')}
              >
                <span className="material-symbols-outlined text-[16px]">call_made</span>
                {t('dashboard.breakWithSuccessors')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
