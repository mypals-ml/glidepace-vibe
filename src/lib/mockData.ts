// Mock data for development/testing.
// Controlled by VITE_USE_MOCK_DATA env variable.
// Run `npm run dev:test` to enable mock mode (loads .env.test).

import type { GithubAccount, ProjectOwnerInfo } from '../types';

export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const MOCK_ACCOUNTS: GithubAccount[] = [
  { id: 'mock-1', login: 'octocat', name: 'Mona Lisa Octocat', avatarUrl: 'https://avatars.githubusercontent.com/u/583231?v=4', token: 'mock-token-123' },
];

export const MOCK_PROJECTS: ProjectOwnerInfo[] = [
  {
    login: 'octocat',
    isOrg: false,
    projects: [
      { id: 'PVT_1', title: 'Alpha Release Tracker', public: true },
      { id: 'PVT_2', title: 'Demo: Bug Tracker', public: false },
      { id: 'PVT_3', title: 'Connected GitHub Tasks', public: true },
      { id: 'PVT_4', title: 'Mobile App Redesign', public: false },
      { id: 'PVT_5', title: 'Zephyr Cloud Migration', public: true },
      { id: 'PVT_6', title: 'Customer Feedback Board', public: false },
      { id: 'PVT_7', title: 'Demo: Product Roadmap 2024', public: true },
      { id: 'PVT_EMPTY', title: 'Empty Project Demo', public: true },
    ],
  },
];


