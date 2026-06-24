import type { TFunction } from 'i18next';
import { memo, useState, type CSSProperties, type ReactNode } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { TaskGroupBlock } from '../../types';
import { IconButton } from '../UI/IconButton';
import { getDashboardItemSortId } from '../../lib/taskOrderUtils';
import { TREE_DEPTH_COLORS, getTreeColor, getTreeLineColor, getTreeHandleHoverColor } from '../../lib/treeColors';
import {
  TREE_CONTENT_GAP,
  TREE_ELBOW_HEIGHT,
  TREE_ELBOW_RADIUS,
  TREE_ROW_HEIGHT,
  getTreeDragHandleX,
  getTreeNodeX,
  getTreeRowDividerLeft,
  type TreeRowMeta,
} from './taskSidebarTree';

export type ContextMenuTarget =
  | { kind: 'task'; taskId: string }
  | { kind: 'group'; groupBlockId: string };

interface TreeTitleCellProps {
  children: ReactNode;
  treeMeta: TreeRowMeta;
  nodeKind: 'group' | 'task';
  isExpanded?: boolean;
  onToggle?: () => void;
  toggleTitle?: string;
  toggleAriaLabel?: string;
}

export function TreeTitleCell({
  children,
  treeMeta,
  nodeKind,
  isExpanded = false,
  onToggle,
  toggleTitle,
  toggleAriaLabel,
}: TreeTitleCellProps) {
  const visualDepth = Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1);
  const nodeX = getTreeNodeX(visualDepth);
  const parentDepth = Math.max(visualDepth - 1, 0);
  const parentX = getTreeNodeX(parentDepth);
  const railColor = getTreeColor(visualDepth);
  const contentPaddingLeft = nodeX + TREE_CONTENT_GAP;
  const parentLineColor = getTreeLineColor(parentDepth);
  const nodeCenterY = TREE_ROW_HEIGHT / 2;
  const elbowCenterY = nodeCenterY - 1;
  const elbowTopY = elbowCenterY - TREE_ELBOW_HEIGHT;
  const elbowCurveStartY = elbowCenterY - TREE_ELBOW_RADIUS;
  const elbowCurveEndX = parentX + TREE_ELBOW_RADIUS;

  const nodeCommonClassName = 'absolute top-1/2 z-[2] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white';
  const nodeStyle: CSSProperties = {
    left: nodeX,
    color: railColor,
  };

  return (
    <div className="relative h-full min-w-0">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {treeMeta.guideSegments.map(segment => (
          <span
            key={segment.level}
            className="absolute w-0.5 -translate-x-1/2 rounded-full"
            style={{
              left: getTreeNodeX(segment.level),
              top: segment.startsAtNode ? '50%' : 0,
              bottom: segment.endsAtJoint ? `calc(50% + ${TREE_ELBOW_HEIGHT}px)` : 0,
              backgroundColor: getTreeLineColor(segment.level),
            }}
          />
        ))}
        {visualDepth > 0 && (
          <svg className="absolute inset-0 overflow-visible" aria-hidden="true">
            <path
              d={`M ${parentX} ${elbowTopY} V ${elbowCurveStartY} Q ${parentX} ${elbowCenterY} ${elbowCurveEndX} ${elbowCenterY} H ${nodeX}`}
              fill="none"
              stroke={parentLineColor}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      {nodeKind === 'group' ? (
        <button
          type="button"
          className={`${nodeCommonClassName} pointer-events-auto inline-flex h-[18px] w-[18px] items-center justify-center border-2 transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30`}
          style={{
            ...nodeStyle,
            backgroundColor: isExpanded ? `color-mix(in srgb, ${railColor} 10%, white)` : '#fff',
            borderColor: railColor,
          }}
          onClick={(e) => {
            e.stopPropagation();
            onToggle?.();
          }}
          title={toggleTitle}
          aria-label={toggleAriaLabel}
          aria-expanded={isExpanded}
        >
          <span className="h-0.5 w-1.5 rounded-full" style={{ backgroundColor: railColor }} />
          {!isExpanded && (
            <span className="absolute h-1.5 w-0.5 rounded-full" style={{ backgroundColor: railColor }} />
          )}
        </button>
      ) : (
        <span
          className={`${nodeCommonClassName} h-2.5 w-2.5 border-2`}
          style={{
            ...nodeStyle,
            borderColor: railColor,
          }}
          aria-hidden="true"
        />
      )}

      <div
        className="relative z-[1] flex h-full min-w-0 flex-col justify-center overflow-hidden pr-1"
        style={{ paddingLeft: contentPaddingLeft }}
      >
        {children}
      </div>
    </div>
  );
}

interface TaskGroupRowProps {
  group: TaskGroupBlock;
  treeMeta: TreeRowMeta;
  onToggle: () => void;
  onRename: () => void;
  onUngroup: () => void;
  isDragActive: boolean;
  isAnyDragging: boolean;
  isTaskDropTarget: boolean;
  isDropTargetGroup: boolean;
  isMobile: boolean;
  movingItemSortId: string | null;
  suppressNextClickRef: React.MutableRefObject<boolean>;
  openContextMenu: (clientX: number, clientY: number, target: ContextMenuTarget) => void;
  t: TFunction;
}

export const TaskGroupRow = memo(function TaskGroupRow({
  group,
  treeMeta,
  onToggle,
  onRename,
  onUngroup,
  isDragActive,
  isAnyDragging,
  isTaskDropTarget,
  isDropTargetGroup,
  isMobile,
  movingItemSortId,
  suppressNextClickRef,
  openContextMenu,
  t,
}: TaskGroupRowProps) {
  const sortId = getDashboardItemSortId(group);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: sortId,
    disabled: group.isSyntheticRoot ? { draggable: true, droppable: false } : false,
  });
  const [isRowHovered, setIsRowHovered] = useState(false);
  const [isDragHandleHovered, setIsDragHandleHovered] = useState(false);
  const [isDragHandleFocused, setIsDragHandleFocused] = useState(false);
  const isMovingThisGroup = movingItemSortId === sortId;
  const showHoverActions = !isDragging && !isDragActive && !isAnyDragging;
  const actionToolbarClassName = `opacity-0 ${showHoverActions ? 'group-hover:opacity-100' : ''} pointer-events-none`;
  const actionButtonClassName = 'pointer-events-none group-hover:pointer-events-auto text-slate-500 hover:text-primary hover:bg-primary/10';
  const dragHandleLeft = getTreeDragHandleX();
  const treeNodeColor = getTreeColor(Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1));
  const treeHandleHoverColor = getTreeHandleHoverColor(Math.min(Math.max(treeMeta.depth, 0), TREE_DEPTH_COLORS.length - 1));
  const dragHandleFillClass = isDragging || isDragActive ? 'bg-white' : 'bg-slate-100/80 group-hover:bg-indigo-50';
  const dragHandleColor = isDragHandleHovered ? treeHandleHoverColor : isDragHandleFocused || isRowHovered ? treeNodeColor : undefined;
  const dividerLeft = getTreeRowDividerLeft(treeMeta.depth);
  const isGroupDropActive = isTaskDropTarget && isDropTargetGroup && !isDragging;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        touchAction: isMobile && isMovingThisGroup ? 'none' : undefined,
        userSelect: isMobile ? 'none' : undefined,
        WebkitUserSelect: isMobile ? 'none' : undefined,
        WebkitTouchCallout: isMobile ? 'none' : undefined,
        '--tree-row-divider-left': `${dividerLeft}px`,
      } as CSSProperties}
      data-dashboard-sort-id={sortId}
      data-task-moving={isMobile && isMovingThisGroup ? "true" : undefined}
      className={`grid grid-cols-[1fr_64px_76px] gap-1 items-center h-[72px] pl-2 pr-0 transition-all duration-200 relative group overflow-visible after:absolute after:bottom-0 after:left-[var(--tree-row-divider-left)] after:right-0 after:h-px after:bg-slate-100/50 after:content-[''] ${
        group.isSyntheticRoot ? 'bg-slate-100/80' : 'bg-slate-50/80'
      } ${!group.isSyntheticRoot ? 'cursor-pointer hover:bg-slate-50' : ''} ${isDragging ? 'z-50 shadow-lg ring-1 ring-primary/20 bg-white' : ''} ${
        isGroupDropActive ? 'bg-indigo-50/90 ring-2 ring-primary/30 ring-inset' : ''
      } ${isTaskDropTarget && !isGroupDropActive ? 'ring-1 ring-transparent ring-inset' : ''}`}
      onClick={() => {
        if (group.isSyntheticRoot) return;
        if (suppressNextClickRef.current) {
          suppressNextClickRef.current = false;
          return;
        }
        onToggle();
      }}
      onContextMenu={(e) => {
        if (group.isSyntheticRoot) return;
        e.preventDefault();
        openContextMenu(e.clientX, e.clientY, { kind: 'group', groupBlockId: group.groupBlockId });
      }}
      onMouseEnter={() => setIsRowHovered(true)}
      onMouseLeave={() => setIsRowHovered(false)}
      role={!group.isSyntheticRoot ? 'button' : undefined}
      tabIndex={!group.isSyntheticRoot ? 0 : undefined}
      aria-expanded={!group.isSyntheticRoot ? group.isExpanded : undefined}
      onKeyDown={(e) => {
        if (group.isSyntheticRoot) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      {!group.isSyntheticRoot && (
        <button
          type="button"
          data-task-drag-handle="true"
          className={`pointer-events-auto absolute top-1/2 z-20 inline-flex h-[72px] w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-none text-slate-400 transition-[opacity,color,background-color] cursor-grab active:cursor-grabbing focus:outline-none border-none shadow-none ${dragHandleFillClass} ${
            isAnyDragging && !isDragging && !isDragActive ? 'opacity-0 pointer-events-none' : 'task-drag-handle'
          } ${
            isDragging || isDragActive ? 'is-dragging' : ''
          }`}
          style={{
            left: dragHandleLeft,
            color: dragHandleColor,
          } as CSSProperties}
          onMouseEnter={() => setIsDragHandleHovered(true)}
          onMouseLeave={() => setIsDragHandleHovered(false)}
          onFocus={() => setIsDragHandleFocused(true)}
          onBlur={() => setIsDragHandleFocused(false)}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          title={t('dashboard.dragToReorder', 'Drag to reorder')}
          aria-label={t('dashboard.dragToReorder', 'Drag to reorder')}
          {...attributes}
          {...listeners}
        >
          <span className="material-symbols-outlined text-[14px]">drag_indicator</span>
        </button>
      )}

      <TreeTitleCell
        treeMeta={treeMeta}
        nodeKind="group"
        isExpanded={group.isExpanded}
        onToggle={onToggle}
        toggleTitle={group.isExpanded ? t('dashboard.collapseGroup', 'Collapse group') : t('dashboard.expandGroup', 'Expand group')}
        toggleAriaLabel={group.isExpanded ? t('dashboard.collapseGroup', 'Collapse group') : t('dashboard.expandGroup', 'Expand group')}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-bold text-slate-700 truncate">{group.name}</span>
        </div>
        <div className="mt-0.5 truncate text-[10px] font-medium text-slate-400">
          {group.startDate && group.targetDate ? `${group.startDate} - ${group.targetDate}` : t('dashboard.noGroupDates', 'No dates')}
        </div>
      </TreeTitleCell>
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
        <span>{t('dashboard.groupLabel', 'Group')}</span>
      </div>
      <div aria-hidden="true" />

      {!group.isSyntheticRoot && (
        <div className={`absolute right-2 bottom-full translate-y-[60%] flex items-center gap-1 ${actionToolbarClassName} transition-opacity z-10 bg-white/90 backdrop-blur rounded shadow-sm border border-slate-200 p-0.5`}>
          <IconButton
            icon="edit"
            variant="ghost"
            size="xs"
            className={actionButtonClassName}
            onClick={(e) => {
              e.stopPropagation();
              onRename();
            }}
            title={t('dashboard.renameGroup', 'Rename group')}
            aria-label={t('dashboard.renameGroup', 'Rename group')}
          />
          <IconButton
            icon="folder_off"
            variant="ghost"
            size="xs"
            className={actionButtonClassName}
            onClick={(e) => {
              e.stopPropagation();
              onUngroup();
            }}
            title={t('dashboard.ungroup', 'Ungroup')}
            aria-label={t('dashboard.ungroup', 'Ungroup')}
          />
        </div>
      )}
    </div>
  );
});
