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

const FORECAST_ASSUMPTIONS_SAVE_DEBOUNCE_MS = 600;

type ForecastAssumptionsUpdater =
  | ForecastAssumptions
  | ((current: ForecastAssumptions) => ForecastAssumptions);

interface UseForecastAssumptionsOptions {
  projectId: string | undefined;
  token: string;
  onSaveError?: (message: string) => void;
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
  const latestReadmeRef = useRef('');
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const refreshForecastAssumptionsFromGitHub = useCallback(async () => {
    if (!projectId || !token) return;

    const requestId = loadRequestIdRef.current + 1;
    loadRequestIdRef.current = requestId;

    const readme = await fetchProjectV2Readme(projectId, token);
    if (loadRequestIdRef.current !== requestId) return;

    latestReadmeRef.current = readme ?? '';
    const parsed = parseForecastAssumptionsFromReadme(readme);
    if (!parsed) return;

    applyParsedForecastAssumptions(parsed);
    await persistUpgradedForecastAssumptions(parsed, latestReadmeRef.current);
  }, [applyParsedForecastAssumptions, persistUpgradedForecastAssumptions, projectId, token]);

  if (sourceKey !== loadedSourceKey) {
    setLoadedSourceKey(sourceKey);
    setForecastAssumptions(resolveCachedForecastAssumptions(projectId));
    setIsLoadingForecastAssumptions(Boolean(projectId && token));
  }

  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
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

  useEffect(() => () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
  }, []);

  const updateForecastAssumptions = useCallback((updater: ForecastAssumptionsUpdater) => {
    if (!projectId) return;

    setForecastAssumptions((current) => {
      const next = normalizeForecastAssumptions(
        typeof updater === 'function' ? updater(current) : updater,
      );
      saveForecastAssumptionsToLocalStorage(localStorage, projectId, next);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (!token) return;

        void (async () => {
          const readme = await fetchProjectV2Readme(projectId, token);
          const baseReadme = readme ?? latestReadmeRef.current;
          const nextReadme = await persistForecastAssumptionsToGitHub(projectId, token, next, baseReadme);
          if (nextReadme) {
            latestReadmeRef.current = nextReadme;
            return;
          }

          onSaveError?.(t('dashboard.forecastAssumptionsSaveFailed', 'Failed to save forecast assumptions to GitHub.'));
        })();
      }, FORECAST_ASSUMPTIONS_SAVE_DEBOUNCE_MS);

      return next;
    });
  }, [onSaveError, projectId, t, token]);

  return {
    forecastAssumptions,
    updateForecastAssumptions,
    refreshForecastAssumptionsFromGitHub,
    isLoadingForecastAssumptions,
  };
}