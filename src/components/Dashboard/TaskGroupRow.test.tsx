import { fireEvent, render, screen } from '@testing-library/react';
import type { TFunction } from 'i18next';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TaskGroupBlock } from '../../types';
import { TaskGroupRow } from './TaskGroupRow';

const sortableMock = vi.hoisted(() => ({
  useSortable: vi.fn(),
}));

vi.mock('@dnd-kit/sortable', () => ({
  useSortable: sortableMock.useSortable,
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: { Transform: { toString: vi.fn(() => undefined) } },
}));

const group: TaskGroupBlock = {
  kind: 'group',
  groupBlockId: 'status-todo',
  name: 'Status: Todo',
  path: ['Status: Todo'],
  depth: 1,
  startTaskIndex: 0,
  endTaskIndex: 0,
  startDate: '2026-07-01',
  targetDate: '2026-07-02',
  childTaskIds: ['task-1'],
  isExpanded: true,
};

const t = ((key: string, fallback?: string) => fallback ?? key) as TFunction;

function renderGroup(isFieldDerived: boolean, openContextMenu = vi.fn()) {
  render(
    <TaskGroupRow
      group={group}
      treeMeta={{ depth: 1, guideSegments: [] }}
      onToggle={vi.fn()}
      onRename={vi.fn()}
      onUngroup={vi.fn()}
      isDragActive={false}
      isAnyDragging={false}
      isTaskDropTarget={false}
      isDropTargetGroup={false}
      isFieldDerived={isFieldDerived}
      isMobile={false}
      movingItemSortId={null}
      suppressNextClickRef={{ current: false }}
      openContextMenu={openContextMenu}
      t={t}
    />
  );
  return openContextMenu;
}

describe('TaskGroupRow field-derived controls', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sortableMock.useSortable.mockReturnValue({
      attributes: {},
      listeners: {},
      setNodeRef: vi.fn(),
      transform: null,
      transition: undefined,
      isDragging: false,
    });
  });

  it('keeps display-only field headers collapsible and droppable without mutation controls', () => {
    const openContextMenu = renderGroup(true);

    expect(screen.getByRole('button', { name: 'Collapse group' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Drag to reorder' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Rename group' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ungroup' })).toBeNull();
    expect(sortableMock.useSortable).toHaveBeenCalledWith({
      id: 'group:status-todo',
      disabled: { draggable: true, droppable: false },
    });

    fireEvent.contextMenu(screen.getByRole('button', { name: /Status: Todo/ }));
    expect(openContextMenu).not.toHaveBeenCalled();
  });

  it('retains mutation and reorder controls for persisted Group Path headers', () => {
    renderGroup(false);

    expect(screen.getByRole('button', { name: 'Drag to reorder' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Rename group' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ungroup' })).toBeTruthy();
    expect(sortableMock.useSortable).toHaveBeenCalledWith({
      id: 'group:status-todo',
      disabled: false,
    });
  });
});
