import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  embedForecastAssumptionsInReadme,
  loadForecastAssumptionsFromLocalStorage,
  normalizeForecastAssumptions,
  parseForecastAssumptionsFromReadme,
  saveForecastAssumptionsToLocalStorage,
  type ForecastAssumptions,
  type ParsedForecastAssumptions,
} from '../lib/forecastAssumptionsConfig';
import { fetchProjectV2Readme, updateProjectV2Readme } from '../lib/githubService';

interface UseForecastAssumptionsOptions {
  projectId: string | undefined;
  token: string;
  onSaveError?: (message: string) => void;
  onSaveSuccess?: (message: string) => void;
}

function resolveCachedForecastAssumptions(projectId: string | undefined): ForecastAssumptions {
  if (!projectId) return DEFAULT_FORECAST_ASSUMPTIONS;
  return loadForecastAssumptionsFromLocalStorage(localStorage, projectId)?.assumptions ?? DEFAULT_FORECAST_ASSUMPTIONS;
}

async function persistForecastAssumptionsToGitHub(
  projectId: string,
  token: string,
  assumptions: ForecastAssumptions,
  baseReadme: string,
): Promise<string | null> {
  const nextReadme = embedForecastAssumptionsInReadme(baseReadme, assumptions);
  const saved = await updateProjectV2Readme(projectId, nextReadme, token);
  return saved ? nextReadme : null;
}

export function useForecastAssumptions({
  projectId,
  token,
  onSaveError,
  onSaveSuccess,
}: UseForecastAssumptionsOptions) {
  const { t } = useTranslation();
  const [forecastAssumptions, setForecastAssumptions] = useState<ForecastAssumptions>(
    () => resolveCachedForecastAssumptions(projectId),
  );
  const sourceKey = `${projectId ?? ''}:${token}`;
  const [loadedSourceKey, setLoadedSourceKey] = useState(sourceKey);
  const [isLoadingForecastAssumptions, setIsLoadingForecastAssumptions] = useState(
    () => Boolean(projectId && token),
  );
  const [isRefreshingForecastAssumptions, setIsRefreshingForecastAssumptions] = useState(false);
  const [isSavingForecastAssumptions, setIsSavingForecastAssumptions] = useState(false);
  const latestReadmeRef = useRef('');
  const loadRequestIdRef = useRef(0);

  const applyParsedForecastAssumptions = useCallback((parsed: ParsedForecastAssumptions) => {
    if (!projectId) return;
    setForecastAssumptions(parsed.assumptions);
    saveForecastAssumptionsToLocalStorage(localStorage, projectId, parsed.assumptions);
  }, [projectId]);

  const persistUpgradedForecastAssumptions = useCallback(async (
    parsed: ParsedForecastAssumptions,
    baseReadme: string,
  ) => {
    if (!projectId || !token || parsed.upgradedFromVersion === null) return;

    const upgradedReadme = await persistForecastAssumptionsToGitHub(
      projectId,
      token,
      parsed.assumptions,
      baseReadme,
    );
    if (upgradedReadme) {
      latestReadmeRef.current = upgradedReadme;
      return;
    }

    onSaveError?.(t('dashboard.forecastAssumptionsSaveFailed', 'Failed to save forecast assumptions to GitHub.'));
  }, [onSaveError, projectId, t, token]);

  const loadForecastAssumptionsFromGitHub = useCallback(async (): Promise<ForecastAssumptions | null> => {
    if (!projectId || !token) return null;

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const readme = await fetchProjectV2Readme(projectId, token);
    if (loadRequestIdRef.current !== requestId) return null;

    latestReadmeRef.current = readme ?? '';
    const parsed = parseForecastAssumptionsFromReadme(readme);
    if (!parsed) return null;

    applyParsedForecastAssumptions(parsed);
    await persistUpgradedForecastAssumptions(parsed, latestReadmeRef.current);
    return parsed.assumptions;
  }, [applyParsedForecastAssumptions, persistUpgradedForecastAssumptions, projectId, token]);

  const refreshForecastAssumptionsFromGitHub = useCallback(async (): Promise<ForecastAssumptions | null> => {
    if (!projectId || !token) return null;

    setIsRefreshingForecastAssumptions(true);
    try {
      return await loadForecastAssumptionsFromGitHub();
    } finally {
      setIsRefreshingForecastAssumptions(false);
    }
  }, [loadForecastAssumptionsFromGitHub, projectId, token]);

  const saveForecastAssumptionsToGitHub = useCallback(async (assumptions: ForecastAssumptions): Promise<boolean> => {
    if (!projectId || !token) return false;

    const normalized = normalizeForecastAssumptions(assumptions);
    setIsSavingForecastAssumptions(true);
    try {
      const readme = await fetchProjectV2Readme(projectId, token);
      const baseReadme = readme ?? latestReadmeRef.current;
      const nextReadme = await persistForecastAssumptionsToGitHub(projectId, token, normalized, baseReadme);
      if (!nextReadme) {
        onSaveError?.(t('dashboard.forecastAssumptionsSaveFailed', 'Failed to save forecast assumptions to GitHub.'));
        return false;
      }

      latestReadmeRef.current = nextReadme;
      setForecastAssumptions(normalized);
      saveForecastAssumptionsToLocalStorage(localStorage, projectId, normalized);
      onSaveSuccess?.(t('dashboard.forecastAssumptionsSaveSuccess', 'Forecast assumptions saved.'));
      return true;
    } finally {
      setIsSavingForecastAssumptions(false);
    }
  }, [onSaveError, onSaveSuccess, projectId, t, token]);

  if (sourceKey !== loadedSourceKey) {
    setLoadedSourceKey(sourceKey);
    setForecastAssumptions(resolveCachedForecastAssumptions(projectId));
    setIsLoadingForecastAssumptions(Boolean(projectId && token));
  }

  useEffect(() => {
    latestReadmeRef.current = '';
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !token) {
      return;
    }

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    void (async () => {
      const readme = await fetchProjectV2Readme(projectId, token);
      if (loadRequestIdRef.current !== requestId) return;

      latestReadmeRef.current = readme ?? '';
      const parsed = parseForecastAssumptionsFromReadme(readme);
      if (parsed) {
        applyParsedForecastAssumptions(parsed);
        await persistUpgradedForecastAssumptions(parsed, latestReadmeRef.current);
      }

      setIsLoadingForecastAssumptions(false);
    })();
  }, [applyParsedForecastAssumptions, persistUpgradedForecastAssumptions, projectId, token]);

  return {
    forecastAssumptions,
    refreshForecastAssumptionsFromGitHub,
    saveForecastAssumptionsToGitHub,
    isLoadingForecastAssumptions,
    isRefreshingForecastAssumptions,
    isSavingForecastAssumptions,
  };
}