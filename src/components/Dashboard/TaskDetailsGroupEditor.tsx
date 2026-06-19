import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import { Button } from '../UI/Button';
import { IconButton } from '../UI/IconButton';

interface TaskDetailsGroupEditorProps {
  t: TFunction;
  draftGroupPath: string;
  setDraftGroupPath: Dispatch<SetStateAction<string>>;
  existingGroupPaths: string[];
  isSavingGroupPath: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function TaskDetailsGroupEditor({
  t,
  draftGroupPath,
  setDraftGroupPath,
  existingGroupPaths,
  isSavingGroupPath,
  onClose,
  onSave,
}: TaskDetailsGroupEditorProps) {
  const closeIfIdle = () => {
    if (!isSavingGroupPath) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/25 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-details-group-editor-title"
      onClick={closeIfIdle}
    >
      <form
        className="w-full max-w-sm rounded-xl border border-slate-200 bg-white shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 id="task-details-group-editor-title" className="text-sm font-bold text-slate-800">
            {t('dashboard.groupLabel', 'Group')}
          </h3>
          <IconButton
            icon="close"
            variant="ghost"
            size="xs"
            onClick={onClose}
            disabled={isSavingGroupPath}
            aria-label={t('dashboard.close', 'Close')}
          />
        </div>
        <div className="space-y-4 px-4 py-4 max-h-[400px] overflow-y-auto custom-scrollbar">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500" htmlFor="task-details-group-path">
              {t('settings.groupPathField', 'Group Path')}
            </label>
            <input
              id="task-details-group-path"
              type="text"
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
              value={draftGroupPath}
              onChange={(e) => setDraftGroupPath(e.target.value)}
              placeholder={t('dashboard.groupPathExample', 'e.g. group1 / sub-group')}
              autoFocus
            />
            <p className="text-xs leading-relaxed text-slate-400">
              {t('dashboard.groupPathSlashHelp', 'Use slashes for nested groups. Leave empty for no group.')}
            </p>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              {t('dashboard.selectExistingGroup', 'Select Existing Group')}
            </span>
            <div className="flex flex-col gap-1 max-h-[160px] overflow-y-auto custom-scrollbar pr-1">
              <button
                type="button"
                onClick={() => setDraftGroupPath('')}
                className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                  draftGroupPath.trim() === ''
                    ? 'bg-primary/5 text-primary border-primary/20 font-bold'
                    : 'text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-800'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-slate-400">folder_off</span>
                <span>{t('dashboard.noGroup', 'None (Root)')}</span>
              </button>
              {existingGroupPaths.map((pathStr) => (
                <button
                  key={pathStr}
                  type="button"
                  onClick={() => setDraftGroupPath(pathStr)}
                  className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors border ${
                    draftGroupPath.trim() === pathStr
                      ? 'bg-primary/5 text-primary border-primary/20 font-bold'
                      : 'text-slate-600 hover:bg-slate-50 border-transparent hover:text-slate-800'
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px] text-slate-400">folder</span>
                  <span className="truncate">{pathStr}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={isSavingGroupPath}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" variant="primary" size="sm" isLoading={isSavingGroupPath}>
            {t('common.save', 'Save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
