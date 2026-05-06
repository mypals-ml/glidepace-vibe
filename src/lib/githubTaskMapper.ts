import i18n from '../i18n';
import type { Task, GitHubProjectItem, GitHubFieldValue, ProjectDateSettings } from '../types';

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
  if (!item) return { id: 'error', title: i18n.t('dashboard.invalidItem'), startDate: '', targetDate: '', status: 'Todo', assignees: [], progress: 0 };
  
  const content = item.content;
  const fieldValues = item.fieldValues?.nodes || [];

  const statusField = fieldValues.find((f: GitHubFieldValue) => 
    f.field?.name?.toLowerCase() === 'status' || 
    f.__typename === 'ProjectV2ItemFieldSingleSelectValue' && f.field?.name?.toLowerCase() === 'status'
  );
  const status = statusField?.name || 'Todo';

  // Find Start Date
  let startDateField = dateSettings?.startDateFieldId 
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.startDateFieldId)
    : fieldValues.find((f: GitHubFieldValue) => f.field?.name?.toLowerCase().includes('start'));
  
  // Find Target Date
  let targetDateField = dateSettings?.targetDateFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.targetDateFieldId)
    : fieldValues.find((f: GitHubFieldValue) => f.field?.name?.toLowerCase().includes('target') || f.field?.name?.toLowerCase().includes('end'));
  
  // Also check Iteration fields if start/target dates are missing
  const iterationField = fieldValues.find((f: GitHubFieldValue) => f.__typename === 'ProjectV2ItemFieldIterationValue');

  const startDate = startDateField?.date || iterationField?.startDate || new Date().toISOString().split('T')[0];
  const iterationEnd = (iterationField && iterationField.startDate) 
    ? new Date(new Date(iterationField.startDate).getTime() + (iterationField.duration || 0) * 86400000).toISOString().split('T')[0]
    : startDate;
  const targetDate = targetDateField?.date || iterationEnd;
  
  // Find Estimate
  let estimateField = dateSettings?.estimateFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.estimateFieldId)
    : fieldValues.find((f: GitHubFieldValue) => 
        f.__typename === 'ProjectV2ItemFieldNumberValue' && 
        (f.field?.name?.toLowerCase().includes('estimate') || 
         f.field?.name?.toLowerCase().includes('duration') || 
         f.field?.name?.toLowerCase().includes('days') || 
         f.field?.name?.toLowerCase().includes('hours'))
      );

  const estimate = estimateField?.number || iterationField?.duration;

  // Find Estimate Unit (Category)
  let unitField = dateSettings?.estimateUnitFieldId
    ? fieldValues.find((f: GitHubFieldValue) => f.field?.id === dateSettings.estimateUnitFieldId)
    : fieldValues.find((f: GitHubFieldValue) => 
        f.__typename === 'ProjectV2ItemFieldTextValue' && 
        (f.field?.name?.toLowerCase().includes('estimate unit') || 
         f.field?.name?.toLowerCase().includes('unit') || 
         f.field?.name?.toLowerCase().includes('category'))
      );

  const estimateUnit = unitField?.text || dateSettings?.estimateUnit || 'days';

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

  const assignees = (assigneeNodes || []).map((a: any, idx: number) => ({
    id: a.id || a.login || 'unknown',
    login: a.login,
    name: a.name || a.login || 'Unknown',
    avatarUrl: a.avatarUrl,
    initials: (a.name || a.login || '??').substring(0, 2).toUpperCase(),
    avatarColor: ['bg-amber-200 text-amber-700', 'bg-indigo-200 text-indigo-700', 'bg-emerald-200 text-emerald-700', 'bg-rose-200 text-rose-700'][idx % 4],
  }));

  const comments = (content?.comments?.nodes || []).map((comment: any) => ({
    id: comment.id,
    body: comment.body,
    createdAt: comment.createdAt,
    author: {
      id: comment.author?.login || 'unknown',
      login: comment.author?.login,
      name: comment.author?.name || comment.author?.login || 'Unknown',
      avatarUrl: comment.author?.avatarUrl,
      initials: (comment.author?.name || comment.author?.login || 'UK').substring(0, 2).toUpperCase(),
      avatarColor: 'bg-slate-100 text-slate-500',
    },
  }));

  // Extract Field IDs for mutations
  const projectFieldIds: Record<string, string> = {};
  const statusOptions: Record<string, string> = {};
  const statusColorMap: Record<string, string> = {};
  
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

  // Clean IDs
  const idPrefix = content?.number ? `#${content.number}` : (item.id ? item.id.slice(-6) : Math.random().toString(36).slice(-6));

  return {
    id: idPrefix,
    itemId: item.id,
    contentId: content?.id,
    title: content?.title || i18n.t('dashboard.noTitle'),
    body: content?.body || '',
    startDate,
    targetDate,
    estimate,
    estimateUnit,
    status: status || 'Todo',
    assignees: assignees,
    progress: /^(done|closed|completed|merged)$/i.test(status) ? 100 : /^(todo|backlog|open|not started)$/i.test(status) ? 0 : 50,
    repository: content?.repository?.nameWithOwner,
    contentId: content?.id,
    projectFieldIds,
    statusOptions,
    statusColorMap,
    isDraft: content?.__typename === 'DraftIssue' || !content?.number,
  };
}
