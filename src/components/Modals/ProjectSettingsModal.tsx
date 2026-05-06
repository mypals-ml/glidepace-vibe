import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../context/DashboardContext';
import { Button } from '../UI/Button';
import { IconButton } from '../UI/IconButton';
import { CustomSelect } from '../UI/CustomSelect';
import { ConfirmationModal } from '../UI/ConfirmationModal';

export function ProjectSettingsModal() {
  const { t } = useTranslation();
  const { 
    isProjectSettingsModalOpen, 
    setIsProjectSettingsModalOpen, 
    projectFields, 
    dateSettings, 
    updateDateSettings,
    selectedProject,
    triggerFieldDetection,
    promptCreateSingleField,
    createSingleFieldNow,
    isCreatingFields,
    isLoadingTasks
  } = useDashboard();
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);

  if (!isProjectSettingsModalOpen) return null;

  const dateFields = projectFields.filter(f => 
    f.__typename === 'ProjectV2IterationField' || 
    (f.__typename === 'ProjectV2Field' && f.dataType === 'DATE')
  );

  const numberFields = projectFields.filter(f => 
    f.__typename === 'ProjectV2Field' && f.dataType === 'NUMBER'
  );

  const textFieldFields = projectFields.filter(f => 
    (f.__typename === 'ProjectV2Field' && f.dataType === 'TEXT') || 
    f.__typename === 'ProjectV2SingleSelectField'
  );

  const autoStartField = dateFields.find(f => f.name.toLowerCase().includes('start'));
  const autoTargetField = dateFields.find(f => f.name.toLowerCase().includes('target') || f.name.toLowerCase().includes('end'));
  const autoEstimateField = numberFields.find(f => 
    f.name.toLowerCase().includes('estimate') || 
    f.name.toLowerCase().includes('duration') || 
    f.name.toLowerCase().includes('days') || 
    f.name.toLowerCase().includes('hours')
  );
  const autoUnitField = textFieldFields.find(f => 
    f.name.toLowerCase().includes('estimate unit') || 
    f.name.toLowerCase().includes('unit') || 
    f.name.toLowerCase().includes('category')
  );

  const handleSave = () => {
    setIsProjectSettingsModalOpen(false);
  };

  const handleFieldChange = (type: 'start' | 'end' | 'estimate' | 'unitField' | 'unitValue', fieldId: string) => {
    if (fieldId === '__create_new__') {
      if (type === 'start') promptCreateSingleField('startDateFieldId');
      else if (type === 'end') promptCreateSingleField('targetDateFieldId');
      else if (type === 'unitField') {
        pendingActionRef.current = () => createSingleFieldNow('estimateUnitFieldId');
        setIsConfirmModalOpen(true);
      }
      return;
    }

    const newSettings = { ...dateSettings };
    if (type === 'start') {
      newSettings.startDateFieldId = fieldId || undefined;
    } else if (type === 'end') {
      newSettings.targetDateFieldId = fieldId || undefined;
    } else if (type === 'estimate') {
      newSettings.estimateFieldId = fieldId || undefined;
    } else if (type === 'unitField') {
      newSettings.estimateUnitFieldId = fieldId || undefined;
    } else if (type === 'unitValue') {
      newSettings.estimateUnit = fieldId || undefined;
    }
    updateDateSettings(newSettings);
  };

  const createNewOption = { id: '__create_new__', name: t('settings.createNewField', '+ Create new field...') };
  
  const getOptions = (fields: any[], fieldId: string | undefined) => {
    const isFound = fields.some(f => f.id === fieldId);
    if (!fieldId || !isFound) {
      return [...fields, createNewOption];
    }
    return fields;
  };

  const unitOptions = [
    { id: 'hours', name: 'hours' },
    { id: 'days', name: 'days' },
    { id: 'points', name: 'points' }
  ];

  const autoStartLabel = autoStartField ? `"${autoStartField.name}"` : '...';
  const autoTargetLabel = autoTargetField ? `"${autoTargetField.name}"` : '...';
  const autoEstimateLabel = autoEstimateField ? `"${autoEstimateField.name}"` : '...';
  const autoUnitLabel = autoUnitField ? `"${autoUnitField.name}"` : '...';

  const selectedUnitField = projectFields.find(f => f.id === dateSettings.estimateUnitFieldId);
  const isUnitFieldSingleSelect = selectedUnitField?.__typename === 'ProjectV2SingleSelectField';
  
  // For unit value selection, use the field's options if it's single select, otherwise default options
  const unitValueOptions = isUnitFieldSingleSelect 
    ? (selectedUnitField as any).options.map((opt: any) => ({ id: opt.name, name: opt.name }))
    : unitOptions;

  const anyFieldsMissing = !dateSettings.startDateFieldId || !dateSettings.targetDateFieldId || !dateSettings.estimateFieldId || !dateSettings.estimateUnitFieldId;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 border border-slate-200 my-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">settings</span>
            <h2 id="settings-modal-title" className="text-lg font-bold text-slate-800">
              {t('settings.projectSettings', 'Project Settings')}
            </h2>
          </div>
          <IconButton 
            icon="close" 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsProjectSettingsModalOpen(false)}
            aria-label="Close"
          />
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-semibold text-slate-700 mb-1">
              {selectedProject?.title}
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {t('settings.dateMappingDesc', 'Configure which fields from GitHub should be used for dates and estimates on the timeline.')}
            </p>
          </div>

          <div className="space-y-4">
            {/* Start Date Field */}
              <CustomSelect 
                label={t('dashboard.startDate', 'Start Date')}
                options={getOptions(dateFields, dateSettings.startDateFieldId)}
                value={dateSettings.startDateFieldId || ''}
                onChange={(val) => handleFieldChange('start', val)}
                placeholder={
                  (dateSettings.startDateFieldId && !dateFields.find(f => f.id === dateSettings.startDateFieldId)) ? t('settings.fieldNotFound', 'Not found') :
                  t('settings.autoDetected', { name: autoStartLabel })
                }
              />

            <div className="grid grid-cols-1 gap-4">
              {/* Estimate Field */}
              <CustomSelect 
                label={t('dashboard.estimate', 'Estimate')}
                options={getOptions(numberFields, dateSettings.estimateFieldId)}
                value={dateSettings.estimateFieldId || ''}
                onChange={(val) => handleFieldChange('estimate', val)}
                placeholder={
                  (dateSettings.estimateFieldId && !numberFields.find(f => f.id === dateSettings.estimateFieldId)) ? t('settings.fieldNotFound', 'Not found') :
                  t('settings.autoDetected', { name: autoEstimateLabel })
                }
              />

              {/* Estimate Unit Field */}
              <div className="space-y-1">
                <CustomSelect 
                  label={t('settings.estimateUnit', 'Estimate Unit')}
                  options={getOptions(textFieldFields, dateSettings.estimateUnitFieldId)}
                  value={dateSettings.estimateUnitFieldId || ''}
                  onChange={(val) => handleFieldChange('unitField', val)}
                  placeholder={
                    (dateSettings.estimateUnitFieldId && !textFieldFields.find(f => f.id === dateSettings.estimateUnitFieldId)) ? t('settings.fieldNotFound', 'Not found') :
                    t('settings.autoDetected', { name: autoUnitLabel })
                  }
                />
              </div>
            </div>

            {/* Estimate Unit Value Selection - Only show if field is mapped */}
            {dateSettings.estimateUnitFieldId && selectedUnitField && (
              <div className="animate-in fade-in slide-in-from-top-1 duration-200">
                <CustomSelect 
                  label={t('settings.estimateUnitValue', 'Unit Value')}
                  options={unitValueOptions}
                  value={dateSettings.estimateUnit || ''}
                  onChange={(val) => handleFieldChange('unitValue', val)}
                  placeholder="Select unit..."
                />
              </div>
            )}

            {/* Target Date Field */}
            <CustomSelect 
              label={t('dashboard.targetDate', 'Target Date')}
              options={getOptions(dateFields, dateSettings.targetDateFieldId)}
              value={dateSettings.targetDateFieldId || ''}
              onChange={(val) => handleFieldChange('end', val)}
              placeholder={
                (dateSettings.targetDateFieldId && !dateFields.find(f => f.id === dateSettings.targetDateFieldId)) ? t('settings.fieldNotFound', 'Not found') :
                t('settings.autoDetected', { name: autoTargetLabel })
              }
            />
          </div>

          <div className="bg-slate-50/80 rounded-xl p-5 border border-slate-200/60 shadow-sm space-y-4">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg mt-0.5">
                <span className="material-symbols-outlined text-primary text-[20px]">magic_button</span>
              </div>
              <div className="space-y-1.5 flex-1">
                <h4 className="text-sm font-bold text-slate-800">
                  {t('settings.automatedSetupTitle', 'Automated Setup')}
                </h4>
                <p className="text-xs text-slate-500 leading-relaxed max-w-[280px]">
                  {t('settings.automatedSetupDesc', 'Glidelines can automatically detect or create the necessary GitHub fields for your timeline.')}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3 ml-[44px]">
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => triggerFieldDetection(true)} 
                disabled={isCreatingFields || isLoadingTasks}
                className="font-semibold px-6 h-9 shadow-sm disabled:opacity-50"
              >
                {isCreatingFields || isLoadingTasks ? '...' : t('settings.triggerDetection', 'Re-scan')}
              </Button>
              {anyFieldsMissing && (
                <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                  Missing Fields
                </span>
              )}
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-3 border border-slate-100">
            <div className="flex gap-2">
              <span className="material-symbols-outlined text-slate-400 text-[20px]">info</span>
              <p className="text-xs text-slate-500 leading-relaxed">
                {t('settings.syncNotice', 'Field mapping changes are saved locally. Values edited in the app will sync back to these GitHub fields.')}
              </p>
            </div>
          </div>
        </div>


        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end rounded-b-xl">
          <Button variant="primary" onClick={handleSave}>
            {t('common.done', 'Done')}
          </Button>
        </div>
      </div>

      <ConfirmationModal 
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={() => {
          setIsConfirmModalOpen(false);
          pendingActionRef.current?.();
        }}
        title={t('settings.confirmCreateEstimateUnitTitle', "Confirm Field Creation")}
        message={t('settings.confirmCreateEstimateUnit', "Creating 'Estimate Unit' will add a new Single Select field to your GitHub project with options: hours, days, and points. Do you want to proceed?")}
        confirmLabel={t('common.confirm', 'Confirm')}
        cancelLabel={t('common.cancel', 'Cancel')}
        isConfirming={isCreatingFields}
      />
    </div>
  );
}
