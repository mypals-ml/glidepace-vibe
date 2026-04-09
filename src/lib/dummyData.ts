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
    itemId: 'dummy-1',
    contentId: 'dummy-1-content',
    body: 'Design and implement a user-friendly OAuth flow UI that guides users through the authentication process step by step.',
    comments: [
      {
        id: 'comment-138-1',
        author: { id: 'u1', name: 'User 1', initials: 'U1', avatarColor: 'bg-amber-200 text-amber-700' },
        body: 'Completed the initial design mockups. Ready for implementation.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'comment-138-2',
        author: { id: 'u2', name: 'User 2', initials: 'U2', avatarColor: 'bg-indigo-200 text-indigo-700' },
        body: 'Great UI! I tested it with multiple OAuth providers and it works smoothly.',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
  },
  {
    id: '#142',
    title: 'Refactor API Auth Layer for OAuth2 Support (Refactor for narrow screen)',
    startDate: 'Oct 12',
    endDate: 'Oct 15',
    status: 'In Progress',
    assignees: [
      { id: 'u2', name: 'User 2', avatarColor: 'bg-indigo-200 text-indigo-700', initials: 'U2' },
      { id: 'u3', name: 'User 3', avatarColor: 'bg-emerald-200 text-emerald-700', initials: 'U3' }
    ],
    progress: 65,
    itemId: 'dummy-2',
    contentId: 'dummy-2-content',
    body: 'Refactor the existing authentication layer to support OAuth2 flows while maintaining backward compatibility with our legacy auth system.',
    comments: [
      {
        id: 'comment-142-1',
        author: { id: 'u2', name: 'User 2', initials: 'U2', avatarColor: 'bg-indigo-200 text-indigo-700' },
        body: 'Started refactoring the core auth module. Currently testing OAuth2 integration.',
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'comment-142-2',
        author: { id: 'u3', name: 'User 3', initials: 'U3', avatarColor: 'bg-emerald-200 text-emerald-700' },
        body: 'I\'ve been working on the token validation. Need to discuss error handling strategies.',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
      {
        id: 'comment-142-3',
        author: { id: 'u1', name: 'User 1', initials: 'U1', avatarColor: 'bg-amber-200 text-amber-700' },
        body: 'Looks good so far. Let\'s schedule a review meeting for this week.',
        createdAt: new Date(Date.now() - 21600000).toISOString(),
      },
    ],
  },
  {
    id: '#145',
    title: 'Update Database Schema for User Profiles',
    startDate: 'Oct 16',
    endDate: 'Oct 18',
    status: 'Todo',
    assignees: [{ id: 'u4', name: 'User 4', avatarColor: 'bg-rose-200 text-rose-700', initials: 'U4' }],
    progress: 0,
    itemId: 'dummy-3',
    contentId: 'dummy-3-content',
    body: 'Update the database schema to add new fields for user profile data including bio, profile picture URL, and social links.',
    comments: [
      {
        id: 'comment-145-1',
        author: { id: 'u4', name: 'User 4', initials: 'U4', avatarColor: 'bg-rose-200 text-rose-700' },
        body: 'Getting started on this. Will create a migration script for the schema changes.',
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ],
  }
];
