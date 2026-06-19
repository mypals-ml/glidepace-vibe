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
    comments: isRecentlyUpdatedLocally
      ? existing.comments
      : (fetched.comments !== undefined ? fetched.comments : existing.comments),
    assignees: isRecentlyUpdatedLocally ? existing.assignees : fetched.assignees,
    // Always adopt fetched date values (no local protection). This ensures external GitHub changes
    // to "Start Date" (and target) are always reflected. Our optimistic writes + webhook refresh
    // (with delay) ensure post-edit UI stays correct without relying on immediate stale fetches.
    startDate: fetched.startDate,
    targetDate: fetched.targetDate,
    tempStartDate: fetched.tempStartDate,
    tempTargetDate: fetched.tempTargetDate,
    autoUpdateStartDate: isRecentlyUpdatedLocally ? existing.autoUpdateStartDate : fetched.autoUpdateStartDate,
    successorIds: isRecentlyUpdatedLocally ? existing.successorIds : fetched.successorIds,
    predecessorIds: isRecentlyUpdatedLocally ? existing.predecessorIds : fetched.predecessorIds,
    localUpdateTimestamp: existing.localUpdateTimestamp,
  };
}
