import type { Task } from '../types';

export const LOCAL_TASK_UPDATE_PROTECTION_MS = 30000;

export function mergeFetchedTaskWithLocalState(existing: Task, fetched: Task, now = Date.now()): Task {
  const isRecentlyUpdatedLocally = existing.localUpdateTimestamp !== undefined
    && now - existing.localUpdateTimestamp < LOCAL_TASK_UPDATE_PROTECTION_MS;

  return {
    ...fetched,
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
