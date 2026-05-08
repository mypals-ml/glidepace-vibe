import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';

export function MissingFieldsPromptModal() {
  const { t } = useTranslation();
  const { 
    isMissingFieldsPromptOpen, 
    setIsMissingFieldsPromptOpen, 
    missingFieldsList, 
    handleCreateMissingFields, 
    isCreatingFields 
  } = useDashboard();

  if (!isMissingFieldsPromptOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 border border-slate-200 my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-fields-modal-title"
      >
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-amber-50/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">warning</span>
            <h2 id="missing-fields-modal-title" className="text-lg font-bold text-slate-800">
              {t('settings.missingFieldsPromptTitle', 'Missing Fields Detected')}
            </h2>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            {t('settings.missingFieldsPromptDesc', 'The following fields were not found in this project. Would you like to create them automatically?')}
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <ul className="space-y-3 text-sm text-slate-700">
              {missingFieldsList.map((field) => (
                <li key={field.settingsKey} className="flex flex-col bg-white p-2 rounded-md border border-slate-100 shadow-sm">
                  <span className="font-semibold text-slate-800 flex items-center gap-1.5 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary/60"></span>
                    {field.defaultName}
                  </span>
                  <div className="flex flex-col gap-0.5 text-[11px] ml-3 mt-1 p-1.5 bg-slate-50/80 rounded border border-slate-100/50">
                    {field.usageKey && (
                      <span className="text-slate-700 leading-normal">
                        {t(field.usageKey, '')}
                      </span>
                    )}
                    <span className="text-slate-500 font-medium italic">
                      {field.type === 'date' && t('settings.typeDate', 'Type: Date')}
                      {field.type === 'number' && t('settings.typeNumber', 'Type: Number')}
                      {field.type === 'single_select' && t('settings.typeSingleSelect', 'Type: Single Select (Options: hours, days, points)')}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 rounded-b-xl">
          <Button 
            variant="ghost" 
            onClick={() => setIsMissingFieldsPromptOpen(false)}
            disabled={isCreatingFields}
          >
            {t('common.cancel', 'Cancel')}
          </Button>
          <Button 
            variant="primary" 
            onClick={handleCreateMissingFields}
            disabled={isCreatingFields}
            className="min-w-[120px]"
          >
            {isCreatingFields 
              ? t('settings.creatingMissingFields', 'Creating fields...') 
              : t('settings.createMissingFields', 'Create Fields')}
          </Button>
        </div>
      </div>
    </div>
  );
}
