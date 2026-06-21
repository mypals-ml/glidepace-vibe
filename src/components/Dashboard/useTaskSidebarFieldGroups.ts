import { useState, useEffect, useMemo } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useDashboard } from '../../context/DashboardContext';
import {
  getLastUsedFieldGroupStorageKey,
  getLocalStorageSafe,
  getRecommendedFieldGroups,
  getUsedFieldGroupsStorageKey,
  loadLastUsedFieldGroup,
  loadUsedFieldGroups,
  recordUsedFieldGroup,
  saveLastUsedFieldGroup,
  type UsedFieldGroup,
} from '../../lib/fieldGroupHistory';
import type { GitHubProjectV2Field } from '../../types';
import { type DashboardFieldGroupContext } from '../../lib/taskOrderUtils';
import { type FieldGroupDialogTab } from './TaskFieldGroupDialog';

interface UseTaskSidebarFieldGroupsResult {
  isFieldGroupDialogOpen: boolean;
  fieldGroupDialogTab: FieldGroupDialogTab;
  fieldGroupSearchQuery: string;
  draftGroupFieldIds: string[];
  usedFieldGroups: UsedFieldGroup[];
  draggedGroupFieldId: string | null;
  projectFieldsById: Map<string, GitHubProjectV2Field>;
  sortedProjectFields: GitHubProjectV2Field[];
  filteredProjectFields: GitHubProjectV2Field[];
  resolvedUsedFieldGroups: Array<{ key: string; fields: GitHubProjectV2Field[] }>;
  resolvedRecommendedFieldGroups: Array<{ key: string; fields: GitHubProjectV2Field[] }>;
  fieldGroupContext: DashboardFieldGroupContext;
  openFieldGroupDialog: () => void;
  closeFieldGroupDialog: () => void;
  setFieldGroupDialogTab: Dispatch<SetStateAction<FieldGroupDialogTab>>;
  setFieldGroupSearchQuery: Dispatch<SetStateAction<string>>;
  setDraggedGroupFieldId: Dispatch<SetStateAction<string | null>>;
  setDraftGroupFieldIds: Dispatch<SetStateAction<string[]>>;
  toggleDraftGroupField: (fieldId: string) => void;
  moveDraftGroupFieldTo: (fieldId: string, targetFieldId: string) => void;
  saveFieldGroupSelection: () => void;
}

export function useTaskSidebarFieldGroups(): UseTaskSidebarFieldGroupsResult {
  const {
    selectedProject,
    projectFields,
    selectedGroupFieldIds,
    setSelectedGroupFieldIds,
  } = useDashboard();

  const [isFieldGroupDialogOpen, setIsFieldGroupDialogOpen] = useState(false);
  const [fieldGroupDialogTab, setFieldGroupDialogTab] = useState<FieldGroupDialogTab>('fields');
  const [usedFieldGroups, setUsedFieldGroups] = useState<UsedFieldGroup[]>([]);
  const [draftGroupFieldIds, setDraftGroupFieldIds] = useState<string[]>([]);
  const [fieldGroupSearchQuery, setFieldGroupSearchQuery] = useState('');
  const [draggedGroupFieldId, setDraggedGroupFieldId] = useState<string | null>(null);

  const usedFieldGroupsStorageKey = getUsedFieldGroupsStorageKey(selectedProject?.id);
  const lastUsedFieldGroupStorageKey = getLastUsedFieldGroupStorageKey(selectedProject?.id);

  useEffect(() => {
    const lastUsedFieldGroup = loadLastUsedFieldGroup(getLocalStorageSafe(), lastUsedFieldGroupStorageKey);
    if (lastUsedFieldGroup !== null) {
      setSelectedGroupFieldIds(lastUsedFieldGroup);
    }
  }, [lastUsedFieldGroupStorageKey, setSelectedGroupFieldIds]);

  const openFieldGroupDialog = () => {
    setDraftGroupFieldIds(selectedGroupFieldIds);
    setFieldGroupSearchQuery('');
    setFieldGroupDialogTab('fields');
    setUsedFieldGroups(loadUsedFieldGroups(getLocalStorageSafe(), usedFieldGroupsStorageKey));
    setIsFieldGroupDialogOpen(true);
  };

  const closeFieldGroupDialog = () => {
    setFieldGroupSearchQuery('');
    setIsFieldGroupDialogOpen(false);
  };

  const toggleDraftGroupField = (fieldId: string) => {
    setDraftGroupFieldIds(prev =>
      prev.includes(fieldId)
        ? prev.filter(id => id !== fieldId)
        : [...prev, fieldId]
    );
  };

  const moveDraftGroupFieldTo = (fieldId: string, targetFieldId: string) => {
    setDraftGroupFieldIds(prev => {
      const sourceIndex = prev.indexOf(fieldId);
      const targetIndex = prev.indexOf(targetFieldId);
      if (sourceIndex === -1 || targetIndex === -1 || sourceIndex === targetIndex) return prev;
      const next = [...prev];
      const [movedFieldId] = next.splice(sourceIndex, 1);
      next.splice(targetIndex, 0, movedFieldId);
      return next;
    });
  };

  const saveFieldGroupSelection = () => {
    const storage = getLocalStorageSafe();
    const savedFieldIds = saveLastUsedFieldGroup(storage, lastUsedFieldGroupStorageKey, draftGroupFieldIds);
    if (draftGroupFieldIds.length > 0) {
      setUsedFieldGroups(
        recordUsedFieldGroup(storage, usedFieldGroupsStorageKey, draftGroupFieldIds)
      );
    }
    setSelectedGroupFieldIds(savedFieldIds);
    closeFieldGroupDialog();
  };

  // Derived for dialog
  const projectFieldsById = useMemo(() => {
    return new Map(projectFields.map(field => [field.id, field]));
  }, [projectFields]);

  const sortedProjectFields = useMemo(() => {
    return [...projectFields].sort((a, b) => a.name.localeCompare(b.name));
  }, [projectFields]);

  const filteredProjectFields = useMemo(() => {
    const q = fieldGroupSearchQuery.trim().toLowerCase();
    if (!q) return sortedProjectFields;
    return sortedProjectFields.filter(f => f.name.toLowerCase().includes(q));
  }, [sortedProjectFields, fieldGroupSearchQuery]);

  const resolvedUsedFieldGroups = useMemo(() => {
    return usedFieldGroups.map(entry => ({
      key: `used-${entry.savedAt}-${entry.fieldIds.join('|')}`,
      fields: entry.fieldIds.flatMap(fieldId => {
        const f = projectFieldsById.get(fieldId);
        return f ? [f] : [];
      }),
    })).filter(e => e.fields.length > 0);
  }, [usedFieldGroups, projectFieldsById]);

  const resolvedRecommendedFieldGroups = useMemo(() => {
    return getRecommendedFieldGroups(projectFields).map(fieldIds => ({
      key: `recommended-${fieldIds.join('|')}`,
      fields: fieldIds.flatMap(fieldId => {
        const f = projectFieldsById.get(fieldId);
        return f ? [f] : [];
      }),
    }));
  }, [projectFields, projectFieldsById]);

  const fieldGroupContext = useMemo<DashboardFieldGroupContext>(() => ({
    fieldIds: selectedGroupFieldIds,
    fields: projectFields,
  }), [selectedGroupFieldIds, projectFields]);

  return {
    isFieldGroupDialogOpen,
    fieldGroupDialogTab,
    fieldGroupSearchQuery,
    draftGroupFieldIds,
    usedFieldGroups,
    draggedGroupFieldId,
    projectFieldsById,
    sortedProjectFields,
    filteredProjectFields,
    resolvedUsedFieldGroups,
    resolvedRecommendedFieldGroups,
    fieldGroupContext,
    openFieldGroupDialog,
    closeFieldGroupDialog,
    setFieldGroupDialogTab,
    setFieldGroupSearchQuery,
    setDraggedGroupFieldId,
    setDraftGroupFieldIds,
    toggleDraftGroupField,
    moveDraftGroupFieldTo,
    saveFieldGroupSelection,
  };
}
