import { useState } from 'react';

export function useDashboardUI() {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [dashboardView, setDashboardView] = useState<'gantt' | 'burnup'>('gantt');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  return {
    isProjectModalOpen,
    setIsProjectModalOpen,
    isAccountModalOpen,
    setIsAccountModalOpen,
    isPatModalOpen,
    setIsPatModalOpen,
    isCreateTaskModalOpen,
    setIsCreateTaskModalOpen,
    isCreateMode,
    setIsCreateMode,
    isChartVisible,
    setIsChartVisible,
    dashboardView,
    setDashboardView,
    selectedTaskId,
    setSelectedTaskId,
  };
}
