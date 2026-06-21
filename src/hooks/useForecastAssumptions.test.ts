import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_FORECAST_ASSUMPTIONS, buildForecastAssumptionsConfigBlock } from '../lib/forecastAssumptionsConfig';
import { useForecastAssumptions } from './useForecastAssumptions';

vi.mock('../lib/githubService', () => ({
  fetchProjectV2Readme: vi.fn(),
  updateProjectV2Readme: vi.fn(),
}));

import { fetchProjectV2Readme } from '../lib/githubService';

describe('useForecastAssumptions', () => {
  beforeEach(() => {
    vi.mocked(fetchProjectV2Readme).mockReset();
    localStorage.clear();
  });

  it('refreshes assumptions from GitHub when refreshForecastAssumptionsFromGitHub is called', async () => {
    vi.mocked(fetchProjectV2Readme).mockResolvedValue(
      buildForecastAssumptionsConfigBlock({
        ...DEFAULT_FORECAST_ASSUMPTIONS,
        capacityDaysPerWeek: 6,
      }),
    );

    const { result } = renderHook(() => useForecastAssumptions({
      projectId: 'PVT_1',
      token: 'token',
    }));

    await act(async () => {
      await result.current.refreshForecastAssumptionsFromGitHub();
    });

    expect(result.current.forecastAssumptions.capacityDaysPerWeek).toBe(6);
    expect(fetchProjectV2Readme).toHaveBeenCalled();
  });

  it('does not reload from GitHub when only toast callbacks change', async () => {
    vi.mocked(fetchProjectV2Readme).mockResolvedValue(
      buildForecastAssumptionsConfigBlock(DEFAULT_FORECAST_ASSUMPTIONS),
    );

    const { rerender } = renderHook(
      ({ onSaveError, onSaveSuccess }) => useForecastAssumptions({
        projectId: 'PVT_1',
        token: 'token',
        onSaveError,
        onSaveSuccess,
      }),
      {
        initialProps: {
          onSaveError: vi.fn(),
          onSaveSuccess: vi.fn(),
        },
      },
    );

    await waitFor(() => expect(fetchProjectV2Readme).toHaveBeenCalledTimes(1));

    rerender({
      onSaveError: vi.fn(),
      onSaveSuccess: vi.fn(),
    });

    await new Promise(resolve => setTimeout(resolve, 0));

    expect(fetchProjectV2Readme).toHaveBeenCalledTimes(1);
  });
});
