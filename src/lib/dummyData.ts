import type { Task, User, TaskStatus } from '../types';

// Re-export types for backward compatibility
export type { Task, User, TaskStatus };

export const DUMMY_TASKS: Task[] = [
  {
    id: '#138',
    title: 'Implement Basic OAuth Flow UI',
    startDate: 'Oct 10',
    endDate: 'Oct 11',
    status: 'Done',
    assignees: [{ id: 'u1', name: 'User 1', avatarColor: 'bg-amber-200 text-amber-700', initials: 'U1' }],
    progress: 100,
  },
  {
    id: '#142',
    title: 'Refactor API Auth Layer for OAuth2 Support',
    startDate: 'Oct 12',
    endDate: 'Oct 15',
    status: 'In Progress',
    assignees: [
      { id: 'u2', name: 'User 2', avatarColor: 'bg-indigo-200 text-indigo-700', initials: 'U2' },
      { id: 'u3', name: 'User 3', avatarColor: 'bg-emerald-200 text-emerald-700', initials: 'U3' }
    ],
    progress: 65,
  },
  {
    id: '#145',
    title: 'Update Database Schema for User Profiles',
    startDate: 'Oct 16',
    endDate: 'Oct 18',
    status: 'Todo',
    assignees: [{ id: 'u4', name: 'User 4', avatarColor: 'bg-rose-200 text-rose-700', initials: 'U4' }],
    progress: 0,
  }
];
