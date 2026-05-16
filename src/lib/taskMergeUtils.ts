import type { Task } from '../types';

export const LOCAL_TASK_UPDATE_PROTECTION_MS = 30000;

export function mergeFetchedTaskWithLocalState(existing: Task, fetched: Task, now = Date.now()): Task {
  const isRecentlyUpdatedLocally = existing.localUpdateTimestamp !== undefined
    && now - existing.localUpdateTimestamp < LOCAL_TASK_UPDATE_PROTECTION_MS;

  return {
    ...fetched,
    startDate: isRecentlyUpdatedLocally ? existing.startDate : fetched.startDate,
    targetDate: isRecentlyUpdatedLocally ? existing.targetDate : fetched.targetDate,
    autoUpdateStartDate: isRecentlyUpdatedLocally ? existing.autoUpdateStartDate : fetched.autoUpdateStartDate,
    localUpdateTimestamp: existing.localUpdateTimestamp,
  };
}
