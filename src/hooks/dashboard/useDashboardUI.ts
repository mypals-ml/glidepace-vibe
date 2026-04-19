import { useState } from 'react';

export function useDashboardUI() {
  const [isChartVisible, setIsChartVisible] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  return {
    isChartVisible,
    setIsChartVisible,
    selectedTaskId,
    setSelectedTaskId,
  };
}
