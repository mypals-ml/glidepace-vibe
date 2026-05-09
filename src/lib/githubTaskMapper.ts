import i18n from '../i18n';
import type { Task, GitHubProjectItem, GitHubFieldValue, ProjectDateSettings, GitHubAssignee, GitHubComment } from '../types';
import { formatToGitHubDate, calculateTargetDate, calculateStartDate, diffDays } from './dateUtils';

export function getEstimateUnitForCal(task: Partial<Task>): string {
  return task.estimateUnit || task.tempEstimateUnit || 'days';
}

export function getDefaultEstimateForCal(task: Partial<Task>): number {
  const unit = getEstimateUnitForCal(task).toLowerCase();
  return (unit === 'hours' || unit === 'hour') ? 8 : 1;
}

export function getStartDateForCal(task: Partial<Task>): string {
  return task.startDate || task.tempStartDate || '';
}

export function getEstimateForCal(task: Partial<Task>): number {
  return task.estimate !== undefined ? task.estimate : (task.tempEstimate !== undefined ? task.tempEstimate : getDefaultEstimateForCal(task));
}

export function getTargetDateForCal(task: Partial<Task>): string {
  return task.targetDate || task.tempTargetDate || '';
}

export const PROJECT_ITEM_FRAGMENT = `
  id
  content {
    __typename
    ... on DraftIssue { id title body }
    ... on Issue {
      id
      title
      number
      state
      body
      closedAt
      updatedAt
      repository { nameWithOwner }
      assignees(first: 20) {
        nodes { id login name avatarUrl }
      }
      comments(first: 10) {
        nodes {
          id
          body
          createdAt
          author {
            login
            avatarUrl
            ... on User { name }
            ... on Organization { name }
          }
        }
      }
    }
    ... on PullRequest {
      id
      title
      number
      state
      body
      closedAt
      updatedAt
      repository { nameWithOwner }
      assignees(first: 20) {
        nodes { id login name avatarUrl }
      }
      comments(first: 10) {
        nodes {
          id
          body
          createdAt
          author {
            login
            avatarUrl
            ... on User { name }
            ... on Organization { name }
          }
        }
      }
    }
  }
  fieldValues(first: 20) {
    nodes {
      __typename
      ... on ProjectV2ItemFieldSingleSelectValue {
        id
        name
        field { ... on ProjectV2SingleSelectField { id name options { id name color } } }
        optionId
      }
      ... on ProjectV2ItemFieldIterationValue {
        id
        title
        startDate
        duration
        field { ... on ProjectV2IterationField { id name } }
      }
      ... on ProjectV2ItemFieldDateValue {
        id
        date
        field { ... on ProjectV2Field { id name } }
      }
      ... on ProjectV2ItemFieldTextValue {
        id
        text
        field { ... on ProjectV2Field { id name } }
      }
      ... on ProjectV2ItemFieldNumberValue {
        id
        number
        field { ... on ProjectV2Field { id name } }
      }
      ... on ProjectV2ItemFieldUserValue {
        users(first: 10) {
          nodes { id login name avatarUrl }
        }
        field { ... on ProjectV2FieldCommon { name } }
      }
    }
  }
`;

export function mapProjectItemToTask(item: GitHubProjectItem, dateSettings?: ProjectDateSettings): Task {
  if (!item) return { id: 'error', displayId: 'error', title: i18n.t('dashboard.invalidItem'), startDate: '', targetDate: '', status: 'Todo', assignees: [], progress: 0 };
  
  const content = item.content;
  const fieldValues = item.fieldValues?.nodes || [];

  const statusField = fieldValues.find((f: GitHubFieldValue) => 
    f.field?.name?.toLowerCase() === 'status' || 
    f.__typename === 'ProjectV2ItemFieldSingleSelectValue' && f.field?.name?.toLowerCase() === 'status'
  );
  const status = statusField?.name || 'Todo';

  // Find Start Date
  const startDateField = dateSettings?.startDateFieldId 
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.startDateFieldId)
    : fieldValues.find((f: GitHubFieldValue) => f.field?.name?.toLowerCase().includes('start'));
  
  // Find Target Date
  const targetDateField = dateSettings?.targetDateFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.targetDateFieldId)
    : fieldValues.find((f: GitHubFieldValue) => f.field?.name?.toLowerCase().includes('target') || f.field?.name?.toLowerCase().includes('end'));
  
  // Also check Iteration fields if start/target dates are missing
  const iterationField = fieldValues.find((f: GitHubFieldValue) => f.__typename === 'ProjectV2ItemFieldIterationValue');

  const actualStartDate = startDateField?.date || iterationField?.startDate || '';
  const actualIterationEnd = (iterationField && iterationField.startDate) 
    ? new Date(new Date(iterationField.startDate).getTime() + (iterationField.duration || 0) * 86400000).toISOString().split('T')[0]
    : '';
  const actualTargetDate = targetDateField?.date || actualIterationEnd;
  
  // Find Estimate
  const estimateField = dateSettings?.estimateFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.estimateFieldId)
    : fieldValues.find((f: GitHubFieldValue) => 
        f.__typename === 'ProjectV2ItemFieldNumberValue' && 
        (f.field?.name?.toLowerCase().includes('estimate') || 
         f.field?.name?.toLowerCase().includes('duration') || 
         f.field?.name?.toLowerCase().includes('days') || 
         f.field?.name?.toLowerCase().includes('hours'))
      );

  const actualEstimate = estimateField?.number ?? iterationField?.duration;

  // Find Estimate Unit (Category)
  const unitField = dateSettings?.estimateUnitFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.estimateUnitFieldId)
    : fieldValues.find((f: GitHubFieldValue) => 
        (f.__typename === 'ProjectV2ItemFieldTextValue' || f.__typename === 'ProjectV2ItemFieldSingleSelectValue') && 
        (f.field?.name?.toLowerCase().includes('estimate unit') || 
         f.field?.name?.toLowerCase().includes('unit') || 
         f.field?.name?.toLowerCase().includes('category'))
      );

  const estimateUnit = unitField?.name || unitField?.text || dateSettings?.estimateUnit || 'days';

  // Find Successors
  const successorField = dateSettings?.successorFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.successorFieldId)
    : fieldValues.find((f: GitHubFieldValue) => 
        (f.__typename === 'ProjectV2ItemFieldTextValue') && 
        (f.field?.name?.toLowerCase().includes('successor') || 
         f.field?.name?.toLowerCase().includes('dependency') || 
         f.field?.name?.toLowerCase().includes('link'))
      );

  const successorsText = successorField?.text || '';
  const successorIds = successorsText.split(',').map(s => s.trim()).filter(Boolean);

  // Extract assignees from either the content (Issues/PRs) or the User field (Drafts)
  let assigneeNodes = content?.assignees?.nodes || [];
  if (assigneeNodes.length === 0) {
    const userField = fieldValues.find((f: GitHubFieldValue) => 
      f.__typename === 'ProjectV2ItemFieldUserValue' && f.field?.name?.toLowerCase() === 'assignees'
    );
    if (userField?.users?.nodes) {
      assigneeNodes = userField.users.nodes;
    }
  }

  const assignees = (assigneeNodes || []).map((a: GitHubAssignee, idx: number) => ({
    id: a.id || a.login || 'unknown',
    login: a.login,
    name: a.name || a.login || 'Unknown',
    avatarUrl: a.avatarUrl,
    initials: (a.name || a.login || '??').substring(0, 2).toUpperCase(),
    avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4],
  }));

  const comments = (content?.comments?.nodes || []).map((comment: GitHubComment) => ({
    id: comment.id,
    author: {
      id: comment.author?.login || 'unknown',
      login: comment.author?.login,
      name: comment.author?.name || comment.author?.login || 'Unknown',
      avatarUrl: comment.author?.avatarUrl,
      initials: (comment.author?.name || comment.author?.login || 'UK').substring(0, 2).toUpperCase(),
      avatarColor: 'bg-slate-100 text-slate-500',
    },
    body: comment.body,
    createdAt: comment.createdAt,
  }));

  const projectFieldIds: Record<string, string> = {};
  const statusOptions: Record<string, string> = {};
  const statusColorMap: Record<string, string> = {};
  const estimateUnitOptions: Record<string, string> = {};
  
  if (statusField?.field?.id) projectFieldIds.status = statusField.field.id;
  if (startDateField?.field?.id) projectFieldIds.startDate = startDateField.field.id;
  if (targetDateField?.field?.id) projectFieldIds.targetDate = targetDateField.field.id;
  if (estimateField?.field?.id) projectFieldIds.estimate = estimateField.field.id;
  if (unitField?.field?.id) projectFieldIds.estimateUnit = unitField.field.id;
  
  if (statusField?.field?.options) {
    statusField.field.options.forEach((opt: { id: string, name: string, color?: string }) => {
      statusOptions[opt.name] = opt.id;
      if (opt.color) statusColorMap[opt.name] = opt.color;
    });
  }

  if (unitField?.field?.options) {
    unitField.field.options.forEach((opt: { id: string, name: string }) => {
      estimateUnitOptions[opt.name] = opt.id;
    });
  }

  // Clean IDs
  const idPrefix = content?.number ? `#${content.number}` : (item.id ? item.id.slice(-6) : Math.random().toString(36).slice(-6));

  const partialTask: Partial<Task> = {
    progress: /^(done|closed|completed|merged)$/i.test(status) ? 100 : /^(todo|backlog|open|not started)$/i.test(status) ? 0 : 50,
    closedAt: content?.closedAt,
    updatedAt: content?.updatedAt,
    startDate: actualStartDate,
    targetDate: actualTargetDate,
    estimate: actualEstimate,
    estimateUnit: estimateUnit,
    successorIds: successorIds,
  };

  // 1. Estimate Unit
  if (!partialTask.estimateUnit) {
    partialTask.tempEstimateUnit = dateSettings?.estimateUnit || 'days';
  }

  // 2. Start Date
  const isDone = partialTask.progress === 100;
  let fallbackDate = formatToGitHubDate(new Date());
  if (isDone) {
    if (partialTask.closedAt) fallbackDate = partialTask.closedAt.split('T')[0];
    else if (partialTask.updatedAt) fallbackDate = partialTask.updatedAt.split('T')[0];
  }

  if (!partialTask.startDate) {
    if (partialTask.targetDate && partialTask.estimate !== undefined) {
      partialTask.tempStartDate = calculateStartDate(partialTask.targetDate, partialTask.estimate, getEstimateUnitForCal(partialTask));
    } else if (partialTask.targetDate && partialTask.estimate === undefined) {
      partialTask.tempStartDate = calculateStartDate(partialTask.targetDate, getDefaultEstimateForCal(partialTask), getEstimateUnitForCal(partialTask));
    } else {
      partialTask.tempStartDate = fallbackDate;
    }
  }

  // 3. Estimate
  if (partialTask.estimate === undefined) {
    if (partialTask.startDate && partialTask.targetDate) {
      const calcEst = diffDays(partialTask.startDate, partialTask.targetDate);
      partialTask.tempEstimate = calcEst === 0 ? getDefaultEstimateForCal(partialTask) : calcEst;
    } else {
      partialTask.tempEstimate = getDefaultEstimateForCal(partialTask);
    }
  }

  // 4. Target Date
  if (!partialTask.targetDate) {
    partialTask.tempTargetDate = calculateTargetDate(getStartDateForCal(partialTask), getEstimateForCal(partialTask), getEstimateUnitForCal(partialTask));
  }

  return {
    id: item.id,
    displayId: idPrefix,
    itemId: item.id,
    contentId: content?.id,
    title: content?.title || i18n.t('dashboard.noTitle'),
    body: content?.body || '',
    startDate: actualStartDate,
    targetDate: actualTargetDate,
    estimate: actualEstimate,
    estimateUnit: estimateUnit,
    tempStartDate: partialTask.tempStartDate,
    tempTargetDate: partialTask.tempTargetDate,
    tempEstimate: partialTask.tempEstimate,
    tempEstimateUnit: partialTask.tempEstimateUnit,
    closedAt: partialTask.closedAt,
    updatedAt: partialTask.updatedAt,
    estimateUnitOptions,
    successorIds: partialTask.successorIds,
    status: status || 'Todo',
    assignees: assignees,
    comments: comments,
    progress: partialTask.progress || 0,
    repository: content?.repository?.nameWithOwner,
    projectFieldIds,
    statusOptions,
    statusColorMap,
    isDraft: content?.__typename === 'DraftIssue' || !content?.number,
  };
}
