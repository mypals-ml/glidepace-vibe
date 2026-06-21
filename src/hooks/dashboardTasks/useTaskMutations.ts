import { useCallback } from 'react';
import { fetchGitHubGraphQL, updateProjectV2ItemField, batchUpdateProjectV2ItemFields, type ProjectV2FieldWrite } from '../../lib/githubService';
import { formatToGitHubDate, calculateTargetDate } from '../../lib/dateUtils';
import { autoCorrectDependencyFields, cascadeTaskDates, getFixedStartDateUpdateCandidates, recalculateFloatingSuccessorDates, shouldAskToUpdateFixedSuccessorStartDate, withUpdatedPredecessorIds } from '../../lib/taskDependencyUtils';
import {
  ADD_ASSIGNEES_MUTATION,
  REMOVE_ASSIGNEES_MUTATION,
  UPDATE_DRAFT_ASSIGNEES_MUTATION
} from '../../lib/githubQueries';
import { findProjectFieldId, getProjectFixedStartDateMode, getExistingPredecessorIds, persistDependencyFieldCorrections, preserveUniqueIds, uniqueTasks } from './taskFieldHelpers';
import type { Task, TaskStatus, User, GitHubProjectV2Field, GitHubAssignee, AutoUpdateStartDateMode, FixedSuccessorStartDateMode } from '../../types';
import type { DashboardTasksCore } from './types';

interface UseTaskMutationsProps {
  core: DashboardTasksCore;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<Task | null>;
  projectFields: GitHubProjectV2Field[];
  requestStartDateDecision: (tasks: Task[]) => Promise<'auto' | 'locked' | 'ask'>;
}

/**
 * Field-level task mutations: assignees, status, dates/estimates, and
 * successor/predecessor dependency links (with cascading date updates).
 */
export function useTaskMutations({ core, fetchSingleProjectItem, projectFields, requestStartDateDecision }: UseTaskMutationsProps) {
  const { githubToken, selectedProject, dateSettings, tasksRef, setTasks, updateSyncTime } = core;

  const updateTaskAssignees = useCallback(async (taskId: string, userIds: string[], skipRefresh = false) => {
    const task = tasksRef.current.find(t => t.id === taskId || t.itemId === taskId);
    if (!task || !task.contentId || !githubToken) return false;

    if (task.isDraft) {
      try {
        const res = await fetchGitHubGraphQL(UPDATE_DRAFT_ASSIGNEES_MUTATION, { id: task.contentId, assigneeIds: userIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        if (task.itemId && !skipRefresh) await fetchSingleProjectItem(task.itemId, githubToken);
        return true;
      } catch (e) {
        console.error('Update draft assignees failed:', e);
        return false;
      }
    }

    const currentIds = task.assignees.map(a => a.id).filter(id => id !== 'unassigned');
    const addedIds = userIds.filter(id => !currentIds.includes(id));
    const removedIds = currentIds.filter(id => !userIds.includes(id));

    if (addedIds.length === 0 && removedIds.length === 0) return true;

    try {
      let latestAssigneeNodes: GitHubAssignee[] | undefined;

      if (addedIds.length > 0) {
        const res = await fetchGitHubGraphQL(ADD_ASSIGNEES_MUTATION, { issueId: task.contentId, assigneeIds: addedIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.addAssigneesToAssignable?.assignable?.assignees?.nodes;
      }

      if (removedIds.length > 0) {
        const res = await fetchGitHubGraphQL(REMOVE_ASSIGNEES_MUTATION, { issueId: task.contentId, assigneeIds: removedIds }, githubToken);
        if (res.errors) throw new Error(res.errors[0]?.message);
        latestAssigneeNodes = res.data?.removeAssigneesFromAssignable?.assignable?.assignees?.nodes;
      }

      if (latestAssigneeNodes) {
        const updatedAssignees: User[] = latestAssigneeNodes.map((a: GitHubAssignee, idx: number) => ({
          id: a.id || a.login || 'unknown',
          name: a.name || a.login || 'Unknown',
          avatarUrl: a.avatarUrl,
          initials: (a.name || a.login || '??').substring(0, 2).toUpperCase(),
          avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4],
        }));

        const now = Date.now();
        setTasks(prev => prev.map(t =>
          (t.id === taskId || t.itemId === taskId) ? { ...t, assignees: updatedAssignees, localUpdateTimestamp: now } : t
        ));
      }

      // The add/remove mutations return the authoritative assignee node list,
      // which we applied above; no confirmation refetch needed.
      if (task.itemId && !skipRefresh) updateSyncTime();
      return true;
    } catch (e) {
      console.error('Update task assignees failed:', e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, setTasks, tasksRef, updateSyncTime]);

  const updateTaskStatus = useCallback(async (task: Task, status: TaskStatus, skipRefresh = false): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !task.projectFieldIds?.status || !task.statusOptions || !githubToken) return false;
    try {
      const optionId = task.statusOptions[status];
      if (!optionId) return false;

      const now = Date.now();
      const progress = /^(done|closed|completed|merged)$/i.test(status) ? 100 : /^(todo|backlog|open|not started)$/i.test(status) ? 0 : 50;
      setTasks(prev => prev.map(t =>
        (t.id === task.id || t.itemId === task.itemId)
          ? { ...t, status, progress, localUpdateTimestamp: now }
          : t
      ));

      const success = await updateProjectV2ItemField(selectedProject.id, task.itemId, task.projectFieldIds.status, { singleSelectOptionId: optionId }, githubToken);
      // Optimistic state already reflects the new status/progress; no refetch.
      if (success && !skipRefresh) updateSyncTime();
      return success;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [selectedProject?.id, githubToken, setTasks, updateSyncTime]);

  const updateTaskDates = useCallback(async (task: Task, startDate?: string | null, targetDate?: string, estimate?: number, estimateUnit?: string, autoUpdateStartDate?: AutoUpdateStartDateMode, skipRefresh = false): Promise<boolean> => {
    if (!selectedProject?.id || !task.itemId || !githubToken) return false;

    // Optimistic Update
    const oldTasks = [...tasksRef.current];
    const projectFixedMode = getProjectFixedStartDateMode(dateSettings);
    const shouldClearStartDate = startDate === null;
    const normalizedStartDate = shouldClearStartDate ? '' : startDate;
    let nextTasks: Task[] = [];
    let effectiveFixedMode = projectFixedMode;
    const updatedBeforeCascade = oldTasks.map(t =>
      (t.itemId === task.itemId || (t.contentId && t.contentId === task.contentId))
        ? {
            ...t,
            startDate: normalizedStartDate !== undefined ? normalizedStartDate : t.startDate,
            targetDate: (!shouldClearStartDate && (startDate !== undefined || estimate !== undefined || estimateUnit !== undefined))
              ? calculateTargetDate(
                  normalizedStartDate !== undefined ? normalizedStartDate : t.startDate,
                  estimate !== undefined ? estimate : (t.estimate || 0),
                  estimateUnit !== undefined ? estimateUnit : (t.estimateUnit || 'days')
                )
              : t.targetDate,
            estimate: estimate !== undefined ? estimate : t.estimate,
            estimateUnit: estimateUnit !== undefined ? estimateUnit : t.estimateUnit,
            autoUpdateStartDate: autoUpdateStartDate !== undefined ? autoUpdateStartDate : t.autoUpdateStartDate,
            localUpdateTimestamp: (startDate !== undefined || targetDate !== undefined) ? Date.now() : t.localUpdateTimestamp,
            tempStartDate: startDate !== undefined ? undefined : t.tempStartDate,
            tempTargetDate: (startDate !== undefined || targetDate !== undefined) ? undefined : t.tempTargetDate
          }
        : t
    );

    if (!shouldClearStartDate && projectFixedMode === 'ask') {
      const fixedStartDateCandidates = uniqueTasks(getFixedStartDateUpdateCandidates(updatedBeforeCascade, task.itemId));
      if (fixedStartDateCandidates.length > 0) {
        const decision = await requestStartDateDecision(fixedStartDateCandidates);
        effectiveFixedMode = decision === 'auto' ? 'auto' : 'ask';
      }
    }

    nextTasks = shouldClearStartDate
      ? recalculateFloatingSuccessorDates(updatedBeforeCascade, task.itemId, new Set(), effectiveFixedMode)
      : cascadeTaskDates(updatedBeforeCascade, task.itemId!, new Set(), {
          fixedStartDateMode: effectiveFixedMode,
        });
    const dependencyRepair = autoCorrectDependencyFields(nextTasks);
    nextTasks = dependencyRepair.tasks;
    setTasks(nextTasks);

    let anySuccess = false;
    try {
      // Accumulate every field write for this item, then persist them all in a
      // single aliased mutation (one HTTP round trip instead of one per field).
      const changes: ProjectV2FieldWrite[] = [];
      // The field name lets the service resolve an issue-backed field (e.g. the
      // org-level Start/Target date) when GitHub rejects the ProjectV2 write.
      const fieldNameFor = (fieldId: string) => projectFields.find(field => field.id === fieldId)?.name;
      const addSet = (fieldId: string | undefined, value: Record<string, string | number | boolean | undefined>) => {
        if (fieldId) changes.push({ kind: 'set', fieldId, value, name: fieldNameFor(fieldId) });
      };
      const resolveKnownProjectFieldId = (fieldId: string | undefined) => {
        if (!fieldId) return undefined;
        return projectFields.length === 0 || projectFields.some(field => field.id === fieldId)
          ? fieldId
          : undefined;
      };
      const resolveDateFieldId = (configuredId: string | undefined, taskFieldId: string | undefined, names: string[]) =>
        resolveKnownProjectFieldId(configuredId)
        || resolveKnownProjectFieldId(taskFieldId)
        || findProjectFieldId(projectFields, {
          names,
          dataTypes: ['DATE'],
          typenames: ['ProjectV2Field'],
        });
      const resolveProjectFieldId = (
        configuredId: string | undefined,
        taskFieldId: string | undefined,
        names: string[],
        dataTypes?: string[],
        typenames?: string[]
      ) => resolveKnownProjectFieldId(configuredId)
        || resolveKnownProjectFieldId(taskFieldId)
        || findProjectFieldId(projectFields, { names, dataTypes, typenames });

      // Auto-calculate new target date if dependencies changed
      let finalTargetDate = targetDate;
      const effectiveStartDate = normalizedStartDate !== undefined ? normalizedStartDate : task.startDate;
      const effectiveEstimate = estimate !== undefined ? estimate : (task.estimate || 0);
      const effectiveUnit = estimateUnit !== undefined ? estimateUnit : (task.estimateUnit || 'days');

      if (!shouldClearStartDate && (startDate !== undefined || estimate !== undefined || estimateUnit !== undefined)) {
        const calculated = calculateTargetDate(effectiveStartDate, effectiveEstimate, effectiveUnit);
        if (calculated !== task.targetDate) {
          finalTargetDate = calculated;
        }
      }

      if (shouldClearStartDate) {
        const fieldId = resolveDateFieldId(dateSettings.startDateFieldId, task.projectFieldIds?.startDate, ['start']);
        if (fieldId) changes.push({ kind: 'clear', fieldId, name: fieldNameFor(fieldId) });
      } else if (normalizedStartDate) {
        const fieldId = resolveDateFieldId(dateSettings.startDateFieldId, task.projectFieldIds?.startDate, ['start']);
        addSet(fieldId, { date: formatToGitHubDate(normalizedStartDate) });
      }
      if (finalTargetDate) {
        const fieldId = resolveDateFieldId(dateSettings.targetDateFieldId, task.projectFieldIds?.targetDate, ['target', 'end']);
        addSet(fieldId, { date: formatToGitHubDate(finalTargetDate) });
      }
      if (estimate !== undefined) {
        const fieldId = resolveProjectFieldId(
          dateSettings.estimateFieldId,
          task.projectFieldIds?.estimate,
          ['estimate', 'duration', 'days', 'hours'],
          ['NUMBER'],
          ['ProjectV2Field']
        );
        addSet(fieldId, { number: estimate });
      }
      if (estimateUnit !== undefined) {
        const fieldId = resolveProjectFieldId(
          dateSettings.estimateUnitFieldId,
          task.projectFieldIds?.estimateUnit,
          ['estimate unit', 'unit', 'category'],
          ['SINGLE_SELECT', 'TEXT'],
          ['ProjectV2SingleSelectField', 'ProjectV2Field']
        );
        if (fieldId) {
          const globalField = projectFields.find(f => f.id === fieldId);
          const isSingleSelect =
            globalField?.dataType === 'SINGLE_SELECT' ||
            globalField?.__typename === 'ProjectV2SingleSelectField' ||
            (task.estimateUnitOptions && Object.keys(task.estimateUnitOptions).length > 0);

          if (isSingleSelect) {
            let optionId = task.estimateUnitOptions?.[estimateUnit];
            if (!optionId && globalField?.options) {
              const globalOption = globalField.options.find(o => o.name === estimateUnit);
              if (globalOption) optionId = globalOption.id;
            }
            if (optionId) addSet(fieldId, { singleSelectOptionId: optionId });
          } else {
            addSet(fieldId, { text: estimateUnit });
          }
        }
      }

      // Handle autoUpdateStartDate persistence if a field is configured
      if (autoUpdateStartDate !== undefined) {
        const fieldId = dateSettings.autoUpdateStartDateFieldId; // New setting
        if (fieldId) addSet(fieldId, { text: autoUpdateStartDate });
      }

      if (changes.length > 0) {
        anySuccess = await batchUpdateProjectV2ItemFields(
          selectedProject.id,
          task.itemId!,
          changes,
          githubToken,
          { issueId: task.contentId }
        );
      }

      if (anySuccess) {
        await persistDependencyFieldCorrections(dependencyRepair.corrections, nextTasks, selectedProject.id, githubToken, dateSettings);
        // Optimistic local state already reflects these field edits. Avoid an
        // immediate confirmation read; webhook sync reconciles any divergence.
        if (!skipRefresh) updateSyncTime();
      } else {
        console.warn('[useTaskMutations] updateTaskDates persisted no changes; reverting optimistic state', {
          taskId: task.itemId,
          changesCount: changes.length,
        });
        setTasks(oldTasks);
      }
      return anySuccess;
    } catch (e) {
      console.error(e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, dateSettings, projectFields, requestStartDateDecision, setTasks, tasksRef, updateSyncTime]);

  const updateTaskSuccessors = useCallback(async (taskId: string, successorIds: string[], skipRefresh = true, decision?: 'auto' | 'locked' | 'ask'): Promise<boolean> => {
    if (!selectedProject?.id || !githubToken || !dateSettings.successorFieldId) return false;

    // 1. Identify the source task using the absolute latest ref
    const currentTasks = tasksRef.current;
    const task = currentTasks.find(t => t.itemId === taskId || t.id === taskId);
    if (!task || !task.itemId) return false;
    const sourceTaskId = task.itemId;
    const oldSuccessorIds = task.successorIds || [];
    const nextSuccessorIds = preserveUniqueIds(successorIds);
    const addedSuccessorIds = nextSuccessorIds.filter(successorId => !oldSuccessorIds.includes(successorId));
    const removedSuccessorIds = oldSuccessorIds.filter(successorId => !nextSuccessorIds.includes(successorId));
    const affectedSuccessorIds = preserveUniqueIds([...addedSuccessorIds, ...removedSuccessorIds]);

    // 2. Resolve prompt if needed
    const projectFixedMode = getProjectFixedStartDateMode(dateSettings);
    let effectiveFixedMode: FixedSuccessorStartDateMode = decision === 'auto'
      ? 'auto'
      : (decision === 'ask' || decision === 'locked') ? 'ask' : projectFixedMode;

    if (!decision && projectFixedMode === 'ask') {
      const successorsToAsk = currentTasks.filter(successor =>
        addedSuccessorIds.includes(successor.itemId || successor.id) &&
        shouldAskToUpdateFixedSuccessorStartDate(task, successor)
      );
      if (successorsToAsk.length > 0) {
        const promptDecision = await requestStartDateDecision(successorsToAsk);
        effectiveFixedMode = promptDecision === 'auto' ? 'auto' : 'ask';
      }
    }

    // 3. Synchronous State Calculation
    const oldTasks = [...tasksRef.current];

    // a. Update successors for the source task
    const dependencyEditTimestamp = Date.now();
    const updated = oldTasks.map(t => {
      const currentTaskId = t.itemId || t.id;
      if (currentTaskId === sourceTaskId) {
        return { ...t, successorIds: nextSuccessorIds, localUpdateTimestamp: dependencyEditTimestamp };
      }
      if (affectedSuccessorIds.includes(currentTaskId)) {
        const existingPredecessorIds = getExistingPredecessorIds(oldTasks, t);
        const predecessorIds = addedSuccessorIds.includes(currentTaskId)
          ? preserveUniqueIds([...existingPredecessorIds, sourceTaskId])
          : existingPredecessorIds.filter(predecessorId => predecessorId !== sourceTaskId);
        return {
          ...withUpdatedPredecessorIds(t, predecessorIds),
          localUpdateTimestamp: dependencyEditTimestamp,
        };
      }
      return t;
    });

    // b. Cascade dependency-derived dates into temp display fields.
    let nextTasks = cascadeTaskDates(updated, sourceTaskId, new Set(), {
      fixedStartDateMode: effectiveFixedMode,
    });

    for (const affectedSuccessorId of affectedSuccessorIds) {
      nextTasks = recalculateFloatingSuccessorDates(nextTasks, affectedSuccessorId, new Set(), effectiveFixedMode);
    }

    const dependencyRepair = removedSuccessorIds.length === 0
      ? autoCorrectDependencyFields(nextTasks)
      : { tasks: nextTasks, corrections: [] };
    nextTasks = dependencyRepair.tasks;

    // 4. Atomic Update (synchronous to the ref via our wrapper)
    setTasks(nextTasks);

    // 5. Persistence
    try {
      const sourceSuccessorsTextValue = nextSuccessorIds.join(',');
      let success = await updateProjectV2ItemField(
        selectedProject.id,
        sourceTaskId,
        dateSettings.successorFieldId,
        { text: sourceSuccessorsTextValue },
        githubToken
      );

      const predecessorFieldId = dateSettings.predecessorFieldId;
      if (success && predecessorFieldId) {
        for (const affectedSuccessorId of affectedSuccessorIds) {
          const affectedTask = nextTasks.find(t => (t.itemId || t.id) === affectedSuccessorId);
          if (!affectedTask?.itemId) continue;
          const predecessorsTextValue = (affectedTask.predecessorIds || []).join(',');
          const predecessorSuccess = await updateProjectV2ItemField(
            selectedProject.id,
            affectedTask.itemId,
            predecessorFieldId,
            { text: predecessorsTextValue },
            githubToken
          );
          success = success && predecessorSuccess;
        }
      }

      if (success) {
        await persistDependencyFieldCorrections(dependencyRepair.corrections, nextTasks, selectedProject.id, githubToken, dateSettings);
      }

      if (success) {
        if (!skipRefresh) fetchSingleProjectItem(sourceTaskId, githubToken);
        updateSyncTime();
      } else {
        // Rollback to precisely what we had before this specific operation started
        setTasks(oldTasks);
      }
      return success;
    } catch (e) {
      console.error('[DashboardTasks] updateTaskSuccessors failed:', e);
      setTasks(oldTasks);
      return false;
    }
  }, [selectedProject?.id, githubToken, dateSettings, requestStartDateDecision, fetchSingleProjectItem, setTasks, tasksRef, updateSyncTime]);

  return {
    updateTaskAssignees,
    updateTaskStatus,
    updateTaskDates,
    updateTaskSuccessors,
  };
}
