import { useState, useEffect } from 'react';
import type { TaskInsertPosition } from '../types';

export function useDashboardUI() {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isChartVisible, setIsChartVisible] = useState(true);
  const [dashboardView, setDashboardView] = useState<'gantt' | 'forecast'>('forecast');
  const [isTaskDetailsOpen, setIsTaskDetailsOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isLinkMode, setIsLinkMode] = useState(false);
  const [selectedLinkTaskIds, setSelectedLinkTaskIds] = useState<string[]>([]);
  const [pendingTaskInsertPosition, setPendingTaskInsertPosition] = useState<TaskInsertPosition | null>(null);

  const [ganttZoomPercent, setGanttZoomPercent] = useState(() => {
    const saved = localStorage.getItem('gantt_zoom_percent');
    const parsed = saved ? parseInt(saved, 10) : NaN;
    return (parsed >= 50 && parsed <= 100) ? parsed : 100;
  });

  useEffect(() => {
    localStorage.setItem('gantt_zoom_percent', String(ganttZoomPercent));
  }, [ganttZoomPercent]);

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
    ganttZoomPercent,
    setGanttZoomPercent,
  };
}
