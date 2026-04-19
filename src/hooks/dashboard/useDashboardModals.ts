import { useState } from 'react';

export function useDashboardModals() {
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [isPatModalOpen, setIsPatModalOpen] = useState(false);
  const [isCreateTaskModalOpen, setIsCreateTaskModalOpen] = useState(false);
  const [isCreateMode, setIsCreateMode] = useState(false);

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
  };
}
