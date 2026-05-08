import { useState, useCallback, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { GitHubProjectV2Field, ProjectDateSettings } from '../types';

export interface MissingFieldDef {
  type: 'date' | 'number' | 'text' | 'single_select';
  keywords: string[];
  defaultName: string;
  statusLabel: string;
  settingsKey: 'startDateFieldId' | 'targetDateFieldId' | 'estimateFieldId' | 'estimateUnitFieldId';
  usageKey: string;
}

const REQUIRED_FIELDS: MissingFieldDef[] = [
  { type: 'date', keywords: ['start'], defaultName: 'Start Date', statusLabel: 'Start Date', settingsKey: 'startDateFieldId', usageKey: 'settings.usageStartDate' },
  { type: 'date', keywords: ['target', 'end'], defaultName: 'Target Date', statusLabel: 'Target Date', settingsKey: 'targetDateFieldId', usageKey: 'settings.usageTargetDate' },
  { type: 'number', keywords: ['estimate', 'duration', 'days', 'hours'], defaultName: 'Estimate', statusLabel: 'Estimate', settingsKey: 'estimateFieldId', usageKey: 'settings.usageEstimate' },
  { type: 'single_select', keywords: ['estimate unit', 'unit', 'category'], defaultName: 'Estimate Unit', statusLabel: 'Estimate Unit', settingsKey: 'estimateUnitFieldId', usageKey: 'settings.usageEstimateUnit' }
];

export function useFieldSetup({
  projectFields,
  dateSettings,
  updateDateSettings,
  createProjectV2Field,
  selectedProjectId,
  showToast,
  isLoadingTasks
}: {
  projectFields: GitHubProjectV2Field[];
  dateSettings: ProjectDateSettings;
  updateDateSettings: (settings: ProjectDateSettings) => void;
  createProjectV2Field: (name: string, dataType: string, singleSelectOptions?: { name: string; description: string; color: string }[]) => Promise<string | null>;
  selectedProjectId?: string;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  isLoadingTasks?: boolean;
}) {
  const { t } = useTranslation();
  const [isMissingFieldsPromptOpen, setIsMissingFieldsPromptOpen] = useState(false);
  const [missingFieldsList, setMissingFieldsList] = useState<MissingFieldDef[]>([]);
  const [isCreatingFields, setIsCreatingFields] = useState(false);
  const [mappingStatus, setMappingStatus] = useState<'idle' | 'scanning' | 'mapping' | 'complete'>('idle');
  const hasPromptedForProject = useRef<string | null>(null);

  // Filter helpers
  const getFieldsByType = useCallback((type: string) => {
    return projectFields.filter(f => {
      if (type === 'date') return f.__typename === 'ProjectV2IterationField' || (f.__typename === 'ProjectV2Field' && f.dataType === 'DATE');
      if (type === 'number') return f.__typename === 'ProjectV2Field' && f.dataType === 'NUMBER';
      if (type === 'text') return (f.__typename === 'ProjectV2Field' && f.dataType === 'TEXT');
      if (type === 'single_select') return f.__typename === 'ProjectV2SingleSelectField' || (f.__typename === 'ProjectV2Field' && f.dataType === 'SINGLE_SELECT');
      return false;
    });
  }, [projectFields]);

  const triggerFieldDetection = useCallback((forcePrompt: boolean = false) => {
    if (!selectedProjectId || projectFields.length === 0) return;
    
    // If we're already loading tasks, we'll wait for the projectFields update
    if (isLoadingTasks) {
      setMappingStatus('scanning');
      return;
    }

    // Only auto-prompt once per project
    if (!forcePrompt && hasPromptedForProject.current === selectedProjectId) {
      setMappingStatus('complete');
      return;
    }

    setMappingStatus('mapping');
    let changedSettings = false;
    const newSettings = { ...dateSettings };
    const missing: MissingFieldDef[] = [];

    for (const req of REQUIRED_FIELDS) {
      const typeFields = getFieldsByType(req.type);
      const currentId = newSettings[req.settingsKey];

      // 1. Is it already mapped and valid?
      if (currentId && typeFields.some(f => f.id === currentId)) {
        continue; // Valid
      }

      // 2. Try to auto-detect by keywords
      const found = typeFields.find(f => req.keywords.some(k => f.name.toLowerCase().includes(k)));
      if (found) {
        newSettings[req.settingsKey] = found.id;
        changedSettings = true;
        continue;
      }

      // 3. Strictly missing
      missing.push(req);
    }

    if (!newSettings.estimateUnit) {
      newSettings.estimateUnit = 'hours';
      changedSettings = true;
    }

    if (changedSettings) {
      updateDateSettings(newSettings);
    }

    if (missing.length > 0) {
      setMissingFieldsList(missing);
      if (forcePrompt || hasPromptedForProject.current !== selectedProjectId) {
        setIsMissingFieldsPromptOpen(true);
        hasPromptedForProject.current = selectedProjectId;
      }
    } else if (forcePrompt) {
      // If forced but none missing, show success toast
      showToast(t('settings.allFieldsDetected'), 'success');
    }
    setMappingStatus('complete');
  }, [projectFields, dateSettings, selectedProjectId, updateDateSettings, showToast, t, getFieldsByType, isLoadingTasks]);

  // Run auto-detection when fields load
  useEffect(() => {
    if (selectedProjectId && projectFields.length > 0) {
      triggerFieldDetection(false);
    }
  }, [selectedProjectId, projectFields.length, triggerFieldDetection]); 

  const promptCreateSingleField = useCallback((settingsKey: 'startDateFieldId' | 'targetDateFieldId' | 'estimateFieldId' | 'estimateUnitFieldId') => {
    const fieldDef = REQUIRED_FIELDS.find(f => f.settingsKey === settingsKey);
    if (fieldDef) {
      setMissingFieldsList([fieldDef]);
      setIsMissingFieldsPromptOpen(true);
    }
  }, []);

  const handleCreateMissingFields = useCallback(async () => {
    if (missingFieldsList.length === 0) return;
    
    setIsCreatingFields(true);
    const newSettings = { ...dateSettings };
    let changed = false;

    for (const req of missingFieldsList) {
      try {
        const dataType = req.type === 'single_select' ? 'SINGLE_SELECT' : req.type.toUpperCase();
        let options;
        
        if (req.type === 'single_select') {
          options = [
            { name: 'hours', description: 'Hours', color: 'BLUE' },
            { name: 'days', description: 'Days', color: 'GREEN' },
            { name: 'points', description: 'Points', color: 'RED' }
          ];
        }

        const newId = await createProjectV2Field(req.defaultName, dataType, options);
        if (newId) {
          newSettings[req.settingsKey] = newId;
          changed = true;
        }
      } catch (e) {
        console.error(`Failed to create missing field: ${req.defaultName}`, e);
      }
    }

    if (changed) {
      updateDateSettings(newSettings);
    }
    
    setIsCreatingFields(false);
    setIsMissingFieldsPromptOpen(false);
    setMissingFieldsList([]);
  }, [missingFieldsList, dateSettings, createProjectV2Field, updateDateSettings]);

  const createSingleFieldNow = useCallback(async (settingsKey: 'startDateFieldId' | 'targetDateFieldId' | 'estimateFieldId' | 'estimateUnitFieldId') => {
    const req = REQUIRED_FIELDS.find(f => f.settingsKey === settingsKey);
    if (!req) return;

    setIsCreatingFields(true);
    try {
      const dataType = req.type === 'single_select' ? 'SINGLE_SELECT' : req.type.toUpperCase();
      let options;
      
      if (req.type === 'single_select') {
        options = [
          { name: 'hours', description: 'Hours', color: 'BLUE' },
          { name: 'days', description: 'Days', color: 'GREEN' },
          { name: 'points', description: 'Points', color: 'RED' }
        ];
      }

      const newId = await createProjectV2Field(req.defaultName, dataType, options);
      if (newId) {
        const newSettings = { ...dateSettings, [req.settingsKey]: newId };
        updateDateSettings(newSettings);
      }
    } catch (e) {
      console.error(`Failed to create field: ${req.defaultName}`, e);
    } finally {
      setIsCreatingFields(false);
    }
  }, [dateSettings, createProjectV2Field, updateDateSettings]);

  return {
    isMissingFieldsPromptOpen,
    setIsMissingFieldsPromptOpen,
    missingFieldsList,
    triggerFieldDetection,
    promptCreateSingleField,
    createSingleFieldNow,
    handleCreateMissingFields,
    isCreatingFields,
    mappingStatus
  };
}
