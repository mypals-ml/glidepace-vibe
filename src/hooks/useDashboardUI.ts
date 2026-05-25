import { useState } from 'react';
import type { TaskInsertPosition } from '../types';

export function useDashboardUI() {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [dashboardView, setDashboardView] = useState<'gantt' | 'burndown'>('gantt');
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [selectedLinkTaskIds, setSelectedLinkTaskIds] = useState<string[]>([]);
  const [pendingTaskInsertPosition, setPendingTaskInsertPosition] = useState<TaskInsertPosition | null>(null);

  return {
    isProjectModalOpen,
    setIsProjectModalOpen,
    isAccountModalOpen,
    setIsAccountModalOpen,
    isAboutModalOpen,
    setIsAboutModalOpen,
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
    isTaskDetailsOpen,
    setIsTaskDetailsOpen,
    selectedTaskId,
    setSelectedTaskId,
    isLinkMode,
    setIsLinkMode,
    selectedLinkTaskIds,
    setSelectedLinkTaskIds,
    pendingTaskInsertPosition,
    setPendingTaskInsertPosition,
  };
}
