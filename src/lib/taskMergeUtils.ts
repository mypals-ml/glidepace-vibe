import type { Task } from '../types';

export const LOCAL_TASK_UPDATE_PROTECTION_MS = 30000;

export function mergeFetchedTaskWithLocalState(existing: Task, fetched: Task, now = Date.now()): Task {
  const isRecentlyUpdatedLocally = existing.localUpdateTimestamp !== undefined
    && now - existing.localUpdateTimestamp < LOCAL_TASK_UPDATE_PROTECTION_MS;

  return {
    ...fetched,
    title: isRecentlyUpdatedLocally ? existing.title : fetched.title,
    body: isRecentlyUpdatedLocally ? existing.body : fetched.body,
    status: isRecentlyUpdatedLocally ? existing.status : fetched.status,
    progress: isRecentlyUpdatedLocally ? existing.progress : fetched.progress,
    comments: isRecentlyUpdatedLocally ? existing.comments : fetched.comments,
    assignees: isRecentlyUpdatedLocally ? existing.assignees : fetched.assignees,
    startDate: isRecentlyUpdatedLocally ? existing.startDate : fetched.startDate,
    targetDate: isRecentlyUpdatedLocally ? existing.targetDate : fetched.targetDate,
    tempStartDate: isRecentlyUpdatedLocally ? existing.tempStartDate : fetched.tempStartDate,
    tempTargetDate: isRecentlyUpdatedLocally ? existing.tempTargetDate : fetched.tempTargetDate,
    autoUpdateStartDate: isRecentlyUpdatedLocally ? existing.autoUpdateStartDate : fetched.autoUpdateStartDate,
    successorIds: isRecentlyUpdatedLocally ? existing.successorIds : fetched.successorIds,
    predecessorIds: isRecentlyUpdatedLocally ? existing.predecessorIds : fetched.predecessorIds,
    localUpdateTimestamp: existing.localUpdateTimestamp,
  };
}
