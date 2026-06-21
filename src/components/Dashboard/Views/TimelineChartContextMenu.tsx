import { useTranslation } from 'react-i18next';
import type { BreakLinkScope } from '../../../lib/contextMenuLinkUtils';

interface TimelineChartContextMenuProps {
  x: number;
  y: number;
  taskId: string;
  viewportClientWidth: number;
  hasPredecessors: boolean;
  hasSuccessors: boolean;
  onClose: () => void;
  onAddSuccessors: (taskId: string) => void;
  onBreakLinks: (taskId: string, scope: BreakLinkScope) => void;
}

export function TimelineChartContextMenu({
  x,
  y,
  taskId,
  viewportClientWidth,
  hasPredecessors,
  hasSuccessors,
  onClose,
  onAddSuccessors,
  onBreakLinks,
}: TimelineChartContextMenuProps) {
  const { t } = useTranslation();
  const showBreakLinks = hasPredecessors || hasSuccessors;

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
        className="absolute bg-white/95 rounded-xl shadow-2xl border border-slate-200/60 py-1.5 min-w-[200px] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
        style={{
          left: x,
          top: y,
          transform: x > viewportClientWidth - 220 ? 'translateX(-100%)' : 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
          onClick={() => onAddSuccessors(taskId)}
        >
          <span className="material-symbols-outlined text-[16px]">add_link</span>
          {t('dashboard.addSuccessors')}
        </button>
        {showBreakLinks && (
          <>
            <button
              className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
              onClick={() => onBreakLinks(taskId, 'all')}
            >
              <span className="material-symbols-outlined text-[16px]">link_off</span>
              {t('dashboard.breakAllLinks')}
            </button>
            {hasPredecessors && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => onBreakLinks(taskId, 'predecessors')}
              >
                <span className="material-symbols-outlined text-[16px]">north_west</span>
                {t('dashboard.breakWithPredecessors')}
              </button>
            )}
            {hasSuccessors && (
              <button
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                onClick={() => onBreakLinks(taskId, 'successors')}
              >
                <span className="material-symbols-outlined text-[16px]">south_east</span>
                {t('dashboard.breakWithSuccessors')}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}