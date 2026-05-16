// Mock data for development/testing.
// Controlled by VITE_USE_MOCK_DATA env variable.
// Run `npm run dev:test` to enable mock mode (loads .env.test).

import type { GithubAccount, ProjectOwnerInfo } from '../types';
import { MOCK_ACCOUNTS_DATA, MOCK_PROJECTS_DATA } from './githubMock';

export const USE_MOCK_DATA = import.meta.env.VITE_USE_MOCK_DATA === 'true';

export const MOCK_ACCOUNTS: GithubAccount[] = MOCK_ACCOUNTS_DATA;
export const MOCK_PROJECTS: ProjectOwnerInfo[] = MOCK_PROJECTS_DATA;

