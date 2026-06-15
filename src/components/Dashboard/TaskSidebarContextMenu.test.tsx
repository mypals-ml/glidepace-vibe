import { createRef } from 'react';
import { render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { describe, expect, it, vi } from 'vitest';
import { TaskSidebarContextMenu, type TaskSidebarContextMenuState } from './TaskSidebarContextMenu';
import type { BreakLinkPlan } from '../../lib/contextMenuLinkUtils';

const contextMenu: TaskSidebarContextMenuState = {
  x: 12,
  y: 24,
  target: { kind: 'task', taskId: 'task-1' },
  alignRight: false,
};

const breakLinkPlan: BreakLinkPlan = {
  hasPredecessors: true,
  hasSuccessors: true,
  operations: [],
};

const t = ((key: string, fallback?: string) => fallback ?? key) as TFunction;

describe('TaskSidebarContextMenu', () => {
  it('uses directional icons for predecessor and successor break actions', () => {
    render(
      <TaskSidebarContextMenu
        contextMenu={contextMenu}
        contextMenuRef={createRef<HTMLDivElement>()}
        contextBreakLinkPlan={breakLinkPlan}
        isMobile={false}
        t={t}
        onAddSuccessors={vi.fn()}
        onBreakLinks={vi.fn()}
        onClose={vi.fn()}
        onCreateTask={vi.fn()}
        onEditTaskGroup={vi.fn()}
        onJumpToChart={vi.fn()}
        onMove={vi.fn()}
        onRenameGroup={vi.fn()}
        onUngroup={vi.fn()}
      />,
    );

    expect(screen.getByText('north_west')).not.toBeNull();
    expect(screen.getByText('south_east')).not.toBeNull();
  });
});
