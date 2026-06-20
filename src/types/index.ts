// ========================================
// Shared type definitions for the app.
// Consolidated from GanttDashboard, dummyData, and mockData.
// ========================================

// --- Task-related types (previously in dummyData.ts) ---

export type TaskStatus = string;
export type AutoUpdateStartDateMode = 'auto' | 'locked' | 'ask';
export type FixedSuccessorStartDateMode = 'auto' | 'ask';
export type GroupPath = string[];

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
  kind?: 'task';
  id: string;
  displayId: string;
  title: string;
  groupPath?: GroupPath;
  depth?: number;
  startDate: string;
  targetDate: string;
  localUpdateTimestamp?: number;
  fullStartDate?: string;
  fullTargetDate?: string;
  status: TaskStatus;
  assignees: User[];
  progress: number;
  estimate?: number;
  estimateUnit?: string;
  estimateUnitOptions?: Record<string, string>;
  repository?: string;
  itemId?: string;
  contentId?: string;
  body?: string;
  comments?: TaskComment[];
  projectFieldIds?: Record<string, string>;
  projectFieldValues?: Record<string, string>;
  statusOptions?: Record<string, string>;
  statusColorMap?: Record<string, string>;
  isDraft?: boolean;
  tempEstimateUnit?: string;
  tempStartDate?: string;
  tempEstimate?: number;
  tempTargetDate?: string;
  closedAt?: string;
  updatedAt?: string;
  successorIds?: string[];
  predecessorIds?: string[];
  url?: string;
  autoUpdateStartDate?: AutoUpdateStartDateMode;
}

export interface TaskGroupBlock {
  kind: 'group';
  groupBlockId: string;
  name: string;
  path: GroupPath;
  depth: number;
  startTaskIndex: number;
  endTaskIndex: number;
  startDate: string;
  targetDate: string;
  childTaskIds: string[];
  isExpanded: boolean;
  isSyntheticRoot?: boolean;
}

export type DashboardItem = Task | TaskGroupBlock;

// --- GitHub / Project types (previously in GanttDashboard.tsx & mockData.ts) ---

export type SortMethod = 'recent' | 'oldest' | 'nameAZ' | 'nameZA';

export interface GitHubProject {
  id: string;
  title: string;
  public: boolean;
  accountId?: string;
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
  accountId?: string;
}

export interface GithubAccount {
  id: string; // This is the REST API integer ID as a string
  nodeId?: string; // This is the GraphQL Global Node ID
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
  url?: string;
  repository?: GitHubRepository;
  closedAt?: string;
  updatedAt?: string;
  assignees?: {
    nodes: GitHubAssignee[];
  };
  comments?: {
    nodes: GitHubComment[];
  };
  // Org-level issue-backed fields (e.g. Start/Target date) are stored on the
  // issue itself and never surface in the ProjectV2 item `fieldValues`.
  issueFieldValues?: {
    nodes: Array<{
      __typename?: string;
      date?: string;
      field?: { id?: string; name?: string };
    }>;
  };
  __typename?: string;
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
  users?: {
    nodes: Array<{ id: string, login: string, name?: string, avatarUrl: string }>;
  };
}

export interface GitHubProjectItem {
  id: string;
  content: GitHubProjectContent;
  fieldValues: {
    nodes: GitHubFieldValue[];
  };
}

export interface GitHubProjectV2Field {
  __typename: string;
  id: string;
  name: string;
  dataType?: string;
  options?: Array<{
    id: string;
    name: string;
    color?: string;
  }>;
}

export interface ProjectDateSettings {
  startDateFieldId?: string;
  targetDateFieldId?: string;
  estimateFieldId?: string;
  estimateUnitFieldId?: string;
  autoUpdateStartDateFieldId?: string;
  fixedSuccessorStartDateMode?: FixedSuccessorStartDateMode;
  estimateUnit?: string;
  successorFieldId?: string;
  predecessorFieldId?: string;
  groupPathFieldId?: string;
}

export interface TaskInsertPosition {
  targetTaskId: string;
  placement: 'above' | 'below';
  groupPath?: GroupPath;
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
