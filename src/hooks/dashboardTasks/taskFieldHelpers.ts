import { updateProjectV2ItemField } from '../../lib/githubService';
import type { DashboardFieldValueChange } from '../../lib/taskOrderUtils';
import type { DependencyFieldCorrection } from '../../lib/taskDependencyUtils';
import type { Task, ProjectDateSettings, FixedSuccessorStartDateMode, GitHubProjectV2Field } from '../../types';

export function uniqueTasks(tasks: Task[]): Task[] {
  const seen = new Set<string>();
  return tasks.filter(task => {
    const id = task.itemId || task.id;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function getProjectFixedStartDateMode(dateSettings: ProjectDateSettings): FixedSuccessorStartDateMode {
  return dateSettings.fixedSuccessorStartDateMode || 'ask';
}

export function findProjectFieldId(
  projectFields: GitHubProjectV2Field[],
  matches: {
    names: string[];
    dataTypes?: string[];
    typenames?: string[];
  }
): string | undefined {
  const dataTypes = matches.dataTypes?.map(type => type.toLowerCase());
  const typenames = matches.typenames;

  return projectFields.find(field => {
    const fieldName = field.name.toLowerCase();
    const nameMatches = matches.names.some(name => fieldName.includes(name.toLowerCase()));
    if (!nameMatches) return false;

    const dataTypeMatches = !dataTypes || (field.dataType && dataTypes.includes(field.dataType.toLowerCase()));
    const typenameMatches = !typenames || typenames.includes(field.__typename);
    return dataTypeMatches && typenameMatches;
  })?.id;
}

export function preserveUniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.filter(Boolean)));
}

export function getExistingPredecessorIds(tasks: Task[], successorTask: Task): string[] {
  if (successorTask.predecessorIds && successorTask.predecessorIds.length > 0) {
    return successorTask.predecessorIds;
  }

  const successorTaskId = successorTask.itemId || successorTask.id;
  return tasks
    .filter(task => (task.successorIds || []).includes(successorTaskId))
    .map(task => task.itemId || task.id);
}

export function getProjectFieldUpdateValue(field: GitHubProjectV2Field | undefined, value: string): unknown {
  const optionId = field?.options?.find(option => option.name === value)?.id;
  return optionId ? { singleSelectOptionId: optionId } : { text: value };
}

export function applyTaskFieldValueChanges(task: Task, fieldValueChanges: DashboardFieldValueChange[]): Task {
  if (fieldValueChanges.length === 0) return task;

  const nextProjectFieldValues = { ...(task.projectFieldValues || {}) };
  let nextTask = task;

  for (const change of fieldValueChanges) {
    nextProjectFieldValues[change.fieldId] = change.value;

    if (task.projectFieldIds?.status === change.fieldId) {
      const progress = /^(done|closed|completed|merged)$/i.test(change.value)
        ? 100
        : /^(todo|backlog|open|not started)$/i.test(change.value)
          ? 0
          : 50;
      nextTask = {
        ...nextTask,
        status: change.value,
        progress,
      };
    }
  }

  return {
    ...nextTask,
    projectFieldValues: nextProjectFieldValues,
  };
}

export async function persistDependencyFieldCorrections(
  corrections: DependencyFieldCorrection[],
  tasks: Task[],
  selectedProjectId: string,
  githubToken: string,
  dateSettings: ProjectDateSettings
) {
  for (const correction of corrections) {
    const task = tasks.find(t => (t.itemId || t.id) === correction.taskId);
    if (!task?.itemId) continue;

    const fieldId = correction.field === 'successor'
      ? (dateSettings.successorFieldId || task.projectFieldIds?.successor)
      : (dateSettings.predecessorFieldId || task.projectFieldIds?.predecessor);
    if (!fieldId) continue;

    await updateProjectV2ItemField(
      selectedProjectId,
      task.itemId,
      fieldId,
      { text: correction.ids.join(',') },
      githubToken
    );
  }
}
