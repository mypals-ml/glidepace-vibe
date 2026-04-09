// ========================================
// Shared type definitions for the app.
// Consolidated from GanttDashboard, dummyData, and mockData.
// ========================================

// --- Task-related types (previously in dummyData.ts) ---

export type TaskStatus = 'Todo' | 'In Progress' | 'Done';

export interface User {
  id: string;
  name: string;
  avatarColor: string;
  initials: string;
  avatarUrl?: string;
}

export interface TaskComment {
  id: string;
  author: User;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  fullStartDate?: string;
  fullEndDate?: string;
  status: TaskStatus;
  assignees: User[];
  progress: number;
  repository?: string;
  itemId?: string;
  contentId?: string;
  body?: string;
  comments?: TaskComment[];
}

// --- GitHub / Project types (previously in GanttDashboard.tsx & mockData.ts) ---

export type SortMethod = 'recent' | 'oldest' | 'nameAZ' | 'nameZA';

export interface GitHubProject {
  id: string;
  title: string;
}

export interface ProjectOwnerInfo {
  login: string;
  isOrg: boolean;
  databaseId?: number;
  projects: GitHubProject[];
}

export interface ProjectHistoryItem {
  id: string;
  title: string;
  lastOpened: number;
}

export interface GithubAccount {
  id: string;
  login: string;
  name?: string;
  avatarUrl: string;
  token: string;
}
