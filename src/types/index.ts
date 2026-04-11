// ========================================
// Shared type definitions for the app.
// Consolidated from GanttDashboard, dummyData, and mockData.
// ========================================

// --- Task-related types (previously in dummyData.ts) ---

export type TaskStatus = string;

export interface User {
  id: string;
  login?: string;
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
  projectFieldIds?: Record<string, string>;
  statusOptions?: Record<string, string>;
  statusColorMap?: Record<string, string>;
}

// --- GitHub / Project types (previously in GanttDashboard.tsx & mockData.ts) ---

export type SortMethod = 'recent' | 'oldest' | 'nameAZ' | 'nameZA';

export interface GitHubProject {
  id: string;
  title: string;
  public: boolean;
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
  public?: boolean;
}

export interface GithubAccount {
  id: string;
  login: string;
  name?: string;
  avatarUrl: string;
  token: string;
}

// --- GitHub GraphQL types ---

export interface GitHubAuthor {
  login: string;
  avatarUrl: string;
  name?: string;
  __typename?: string;
}

export interface GitHubComment {
  id: string;
  body: string;
  createdAt: string;
  author: GitHubAuthor;
}

export interface GitHubAssignee {
  id: string;
  login: string;
  name?: string;
  avatarUrl: string;
}

export interface GitHubRepository {
  nameWithOwner: string;
}

export interface GitHubProjectContent {
  id: string;
  title: string;
  number?: number;
  state?: string;
  body?: string;
  repository?: GitHubRepository;
  assignees?: {
    nodes: GitHubAssignee[];
  };
  comments?: {
    nodes: GitHubComment[];
  };
}

export interface GitHubFieldValue {
  __typename: string;
  id: string;
  name?: string;
  text?: string;
  number?: number;
  date?: string;
  title?: string;
  startDate?: string;
  duration?: number;
  field?: {
    id: string;
    name: string;
    options?: Array<{
      id: string;
      name: string;
      color?: string;
    }>;
  };
  optionId?: string;
}

export interface GitHubProjectItem {
  id: string;
  content: GitHubProjectContent;
  fieldValues: {
    nodes: GitHubFieldValue[];
  };
}

export interface GitHubProjectV2Field {
  id: string;
  name: string;
  options?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
}

export interface GitHubProjectV2 {
  id: string;
  title: string;
  public: boolean;
  fields: {
    nodes: GitHubProjectV2Field[];
  };
  items: {
    nodes: GitHubProjectItem[];
  };
}
