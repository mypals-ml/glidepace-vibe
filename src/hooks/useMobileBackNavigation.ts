import { useEffect, useRef } from 'react';
import { useDashboard } from '../context/DashboardContext';

const MOBILE_BACK_STATE_KEY = '__glidepaceMobileBack';

type MobileBackHistoryState = {
  [MOBILE_BACK_STATE_KEY]?: true;
};

function isMobileBackState(state: unknown): state is MobileBackHistoryState {
  return Boolean(
    state &&
    typeof state === 'object' &&
    (state as MobileBackHistoryState)[MOBILE_BACK_STATE_KEY]
  );
}

export function useMobileBackNavigation(isMobile: boolean) {
  const {
    isPatModalOpen,
    setIsPatModalOpen,
    isAccountModalOpen,
    setIsAccountModalOpen,
    isProjectModalOpen,
    setIsProjectModalOpen,
    isProjectSettingsModalOpen,
    setIsProjectSettingsModalOpen,
    isMissingFieldsPromptOpen,
    setIsMissingFieldsPromptOpen,
    isStartDatePromptOpen,
    startDatePromptTasks,
    onStartDatePromptDecision,
    isTaskDetailsOpen,
    setIsTaskDetailsOpen,
    isCreateMode,
    setIsCreateMode,
    setPendingTaskInsertPosition,
    isChartVisible,
    setIsChartVisible,
  } = useDashboard();

  const stateRef = useRef({
    isMobile,
    isPatModalOpen,
    isAccountModalOpen,
    isProjectModalOpen,
    isProjectSettingsModalOpen,
    isMissingFieldsPromptOpen,
    isStartDatePromptOpen,
    startDatePromptTasks,
    isTaskDetailsOpen,
    isCreateMode,
    isChartVisible,
  });

  useEffect(() => {
    stateRef.current = {
      isMobile,
      isPatModalOpen,
      isAccountModalOpen,
      isProjectModalOpen,
      isProjectSettingsModalOpen,
      isMissingFieldsPromptOpen,
      isStartDatePromptOpen,
      startDatePromptTasks,
      isTaskDetailsOpen,
      isCreateMode,
      isChartVisible,
    };
  }, [
    isMobile,
    isPatModalOpen,
    isAccountModalOpen,
    isProjectModalOpen,
    isProjectSettingsModalOpen,
    isMissingFieldsPromptOpen,
    isStartDatePromptOpen,
    startDatePromptTasks,
    isTaskDetailsOpen,
    isCreateMode,
    isChartVisible,
  ]);

  const hasInterceptableMobileState =
    isMobile &&
    (
      isPatModalOpen ||
      isAccountModalOpen ||
      isProjectModalOpen ||
      isProjectSettingsModalOpen ||
      isMissingFieldsPromptOpen ||
      isStartDatePromptOpen ||
      isTaskDetailsOpen ||
      isCreateMode ||
      isChartVisible
    );

  useEffect(() => {
    if (!hasInterceptableMobileState || isMobileBackState(window.history.state)) {
      return;
    }

    window.history.pushState(
      { ...(window.history.state ?? {}), [MOBILE_BACK_STATE_KEY]: true },
      '',
      window.location.href
    );
  }, [
    hasInterceptableMobileState,
    isAccountModalOpen,
    isChartVisible,
    isCreateMode,
    isMissingFieldsPromptOpen,
    isPatModalOpen,
    isProjectModalOpen,
    isProjectSettingsModalOpen,
    isStartDatePromptOpen,
    isTaskDetailsOpen,
  ]);

  useEffect(() => {
    const handlePopState = () => {
      const current = stateRef.current;
      if (!current.isMobile) return;

      if (current.isPatModalOpen) {
        setIsPatModalOpen(false);
      } else if (current.isAccountModalOpen) {
        setIsAccountModalOpen(false);
      } else if (current.isProjectModalOpen) {
        setIsProjectModalOpen(false);
      } else if (current.isProjectSettingsModalOpen) {
        setIsProjectSettingsModalOpen(false);
      } else if (current.isMissingFieldsPromptOpen) {
        setIsMissingFieldsPromptOpen(false);
      } else if (current.isStartDatePromptOpen) {
        onStartDatePromptDecision('ask', current.startDatePromptTasks);
      } else if (current.isTaskDetailsOpen || current.isCreateMode) {
        setIsTaskDetailsOpen(false);
        setPendingTaskInsertPosition(null);
        setIsCreateMode(false);
      } else if (current.isChartVisible) {
        setIsChartVisible(false);
      } else {
        return;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [
    onStartDatePromptDecision,
    setIsAccountModalOpen,
    setIsChartVisible,
    setIsCreateMode,
    setPendingTaskInsertPosition,
    setIsMissingFieldsPromptOpen,
    setIsPatModalOpen,
    setIsProjectModalOpen,
    setIsProjectSettingsModalOpen,
    setIsTaskDetailsOpen,
  ]);
}
