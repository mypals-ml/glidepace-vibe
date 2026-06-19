import type { Dispatch, SetStateAction } from 'react';
import type { TFunction } from 'i18next';
import type { GitHubProjectV2Field } from '../../types';
import { areFieldIdListsIdentical } from '../../lib/fieldGroupHistory';
import { Button } from '../UI/Button';
import { IconButton } from '../UI/IconButton';

export type FieldGroupDialogTab = 'fields' | 'used' | 'recommended';

interface FieldGroupOption {
  key: string;
  fields: GitHubProjectV2Field[];
}

interface TaskFieldGroupDialogProps {
  t: TFunction;
  draftGroupFieldIds: string[];
  setDraftGroupFieldIds: Dispatch<SetStateAction<string[]>>;
  fieldGroupDialogTab: FieldGroupDialogTab;
  setFieldGroupDialogTab: Dispatch<SetStateAction<FieldGroupDialogTab>>;
  fieldGroupSearchQuery: string;
  setFieldGroupSearchQuery: Dispatch<SetStateAction<string>>;
  draggedGroupFieldId: string | null;
  setDraggedGroupFieldId: Dispatch<SetStateAction<string | null>>;
  projectFieldsById: Map<string, GitHubProjectV2Field>;
  sortedProjectFields: GitHubProjectV2Field[];
  filteredProjectFields: GitHubProjectV2Field[];
  resolvedUsedFieldGroups: FieldGroupOption[];
  resolvedRecommendedFieldGroups: FieldGroupOption[];
  onToggleDraftGroupField: (fieldId: string) => void;
  onMoveDraftGroupFieldTo: (fieldId: string, targetFieldId: string) => void;
  onClose: () => void;
  onSave: () => void;
}

export function TaskFieldGroupDialog({
  t,
  draftGroupFieldIds,
  setDraftGroupFieldIds,
  fieldGroupDialogTab,
  setFieldGroupDialogTab,
  fieldGroupSearchQuery,
  setFieldGroupSearchQuery,
  draggedGroupFieldId,
  setDraggedGroupFieldId,
  projectFieldsById,
  sortedProjectFields,
  filteredProjectFields,
  resolvedUsedFieldGroups,
  resolvedRecommendedFieldGroups,
  onToggleDraftGroupField,
  onMoveDraftGroupFieldTo,
  onClose,
  onSave,
}: TaskFieldGroupDialogProps) {
  const renderFieldGroupOption = (option: FieldGroupOption) => {
    const fieldIds = option.fields.map(field => field.id);
    const isActive = areFieldIdListsIdentical(fieldIds, draftGroupFieldIds);
    return (
      <button
        key={option.key}
        type="button"
        onClick={() => setDraftGroupFieldIds(fieldIds)}
        aria-pressed={isActive}
        className={`flex w-full cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition-colors ${
          isActive ? 'bg-primary/5 text-slate-800 ring-1 ring-primary/30' : 'text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-y-1">
          {option.fields.map((field, fieldIndex) => (
            <span key={`${option.key}-${field.id}-${fieldIndex}`} className="inline-flex min-w-0 items-center">
              {fieldIndex > 0 && (
                <span className="material-symbols-outlined text-[14px] text-slate-300" aria-hidden="true">chevron_right</span>
              )}
              <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600" title={field.name}>
                {field.name}
              </span>
            </span>
          ))}
        </span>
        {isActive && (
          <span className="material-symbols-outlined shrink-0 text-[16px] text-primary" aria-hidden="true">check</span>
        )}
      </button>
    );
  };

  return (
    <div
      className="absolute inset-0 z-[130] flex items-center justify-center bg-slate-900/25 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="field-group-dialog-title"
      onClick={onClose}
    >
      <form
        className="flex max-h-[min(720px,calc(100vh-2rem))] w-full max-w-md flex-col rounded-xl border border-slate-200 bg-white shadow-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h3 id="field-group-dialog-title" className="text-sm font-bold text-slate-800">
            {t('dashboard.fieldGroupDialogTitle', 'Group by Fields')}
          </h3>
          <IconButton
            icon="close"
            variant="ghost"
            size="xs"
            onClick={onClose}
            aria-label={t('dashboard.close', 'Close')}
          />
        </div>
        <div className="flex min-h-0 flex-1 flex-col space-y-4 px-4 py-4">
          <section className="space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {t('dashboard.selectedFields', 'Selected fields')}
            </div>
            <div className="flex min-h-11 items-center gap-2 overflow-x-auto rounded-lg border border-slate-100 bg-slate-50/80 p-2 custom-scrollbar">
              {draftGroupFieldIds.length === 0 ? (
                <span className="text-xs text-slate-400">{t('dashboard.noFieldsSelected', 'No fields selected')}</span>
              ) : draftGroupFieldIds.map((fieldId) => {
                const field = projectFieldsById.get(fieldId);
                if (!field) return null;
                return (
                  <div
                    key={fieldId}
                    draggable
                    onDragStart={() => setDraggedGroupFieldId(fieldId)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (draggedGroupFieldId) onMoveDraftGroupFieldTo(draggedGroupFieldId, fieldId);
                      setDraggedGroupFieldId(null);
                    }}
                    onDragEnd={() => setDraggedGroupFieldId(null)}
                    className="inline-flex max-w-[180px] shrink-0 cursor-grab items-stretch gap-1 rounded-md border border-primary/15 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm active:cursor-grabbing"
                  >
                    <span className="material-symbols-outlined self-center text-[14px] text-slate-400">drag_indicator</span>
                    <span className="flex min-w-0 flex-1 items-center">
                      <span className="line-clamp-2 min-w-0 whitespace-normal break-words leading-snug" title={field.name}>{field.name}</span>
                    </span>
                    <IconButton
                      type="button"
                      icon="close"
                      variant="ghost"
                      size="xs"
                      className="shrink-0 self-center"
                      onClick={() => onToggleDraftGroupField(fieldId)}
                      aria-label={t('dashboard.removeField', 'Remove field')}
                    />
                  </div>
                );
              })}
            </div>
          </section>

          <div
            className="flex items-center gap-1 rounded-lg bg-slate-100 p-1"
            role="tablist"
            aria-label={t('dashboard.fieldGroupTabs', 'Field group views')}
          >
            {([
              { id: 'fields', label: t('dashboard.fieldGroupTabFields', 'All fields') },
              { id: 'used', label: t('dashboard.fieldGroupTabUsed', 'Used groups') },
              { id: 'recommended', label: t('dashboard.fieldGroupTabRecommended', 'Recommended') },
            ] as const).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`field-group-tab-${tab.id}`}
                aria-selected={fieldGroupDialogTab === tab.id}
                aria-controls={`field-group-tabpanel-${tab.id}`}
                onClick={() => setFieldGroupDialogTab(tab.id)}
                className={`flex-1 rounded-md px-2 py-1.5 text-xs font-semibold transition-colors ${
                  fieldGroupDialogTab === tab.id
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="min-h-[290px] overflow-hidden">
            {fieldGroupDialogTab === 'used' && (
              <section
                className="space-y-2"
                role="tabpanel"
                id="field-group-tabpanel-used"
                aria-labelledby="field-group-tab-used"
              >
                <div className="h-[290px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
                  {resolvedUsedFieldGroups.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      {t('dashboard.noUsedFieldGroups', 'No used groups yet. Saved field groupings will be listed here.')}
                    </div>
                  ) : resolvedUsedFieldGroups.map(renderFieldGroupOption)}
                </div>
              </section>
            )}

            {fieldGroupDialogTab === 'recommended' && (
              <section
                className="space-y-2"
                role="tabpanel"
                id="field-group-tabpanel-recommended"
                aria-labelledby="field-group-tab-recommended"
              >
                <div className="h-[290px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
                  {resolvedRecommendedFieldGroups.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      {t('dashboard.noRecommendedFieldGroups', 'No recommended groups available for this project.')}
                    </div>
                  ) : resolvedRecommendedFieldGroups.map(renderFieldGroupOption)}
                </div>
              </section>
            )}

            {fieldGroupDialogTab === 'fields' && (
              <section
                className="space-y-2"
                role="tabpanel"
                id="field-group-tabpanel-fields"
                aria-labelledby="field-group-tab-fields"
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {t('dashboard.availableFields', 'Available fields')}
                </div>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-slate-400" aria-hidden="true">search</span>
                  <input
                    className="h-9 w-full rounded-md border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-700 shadow-sm transition-colors placeholder:text-slate-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                    type="text"
                    value={fieldGroupSearchQuery}
                    onChange={(e) => setFieldGroupSearchQuery(e.target.value)}
                    placeholder={t('dashboard.fieldSearchPlaceholder', 'Filter fields...')}
                    aria-label={t('dashboard.fieldSearchPlaceholder', 'Filter fields...')}
                  />
                  {fieldGroupSearchQuery && (
                    <IconButton
                      type="button"
                      icon="close"
                      variant="ghost"
                      size="xs"
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      onClick={() => setFieldGroupSearchQuery('')}
                      aria-label={t('dashboard.clearFieldSearch', 'Clear field filter')}
                    />
                  )}
                </div>
                <div className="h-[196px] space-y-1 overflow-y-auto rounded-lg border border-slate-100 p-1 custom-scrollbar">
                  {sortedProjectFields.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      {t('dashboard.noProjectFields', 'No project fields available')}
                    </div>
                  ) : filteredProjectFields.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-slate-400">
                      {t('dashboard.noMatchingFields', 'No fields match your search.')}
                    </div>
                  ) : filteredProjectFields.map(field => (
                    <label
                      key={field.id}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-2 text-sm text-slate-700 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                        checked={draftGroupFieldIds.includes(field.id)}
                        onChange={() => onToggleDraftGroupField(field.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{field.name}</span>
                      {field.dataType && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {field.dataType}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 rounded-b-xl border-t border-slate-100 bg-slate-50 px-4 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button type="submit" variant="primary" size="sm">
            {t('common.save', 'Save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
