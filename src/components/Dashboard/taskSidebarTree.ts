import type { DashboardItem } from '../../types';
import { isTaskGroupBlock } from '../../lib/taskGroupUtils';
import { TREE_DEPTH_COLORS } from '../../lib/treeColors';

export const TREE_NODE_BASE_X = 12;
export const TREE_DEPTH_STEP = 20;
export const TREE_CONTENT_GAP = 18;
export const TREE_ELBOW_HEIGHT = 16;
export const TREE_ELBOW_RADIUS = 8;
export const TREE_ROW_HEIGHT = 72;
export const TREE_ROW_PADDING_LEFT = 8;

export interface TreeRowMeta {
  depth: number;
  guideSegments: TreeGuideSegment[];
}

export interface TreeGuideSegment {
  level: number;
  startsAtNode: boolean;
  endsAtJoint: boolean;
}

export interface DashboardTreeRow {
  item: DashboardItem;
  treeMeta: TreeRowMeta;
}

export function getDashboardItemTreeDepth(item: DashboardItem): number {
  if (isTaskGroupBlock(item)) return item.depth;
  return item.depth ?? (item.groupPath?.length ?? 0) + 1;
}

export function getTreeNodeX(depth: number): number {
  return TREE_NODE_BASE_X + Math.min(Math.max(depth, 0), TREE_DEPTH_COLORS.length - 1) * TREE_DEPTH_STEP;
}

export function getTreeDragHandleX(): number {
  return TREE_ROW_PADDING_LEFT;
}

export function getTreeRowDividerLeft(depth: number): number {
  return TREE_ROW_PADDING_LEFT + getTreeNodeX(depth) + TREE_CONTENT_GAP;
}

export function buildDashboardTreeRows(items: DashboardItem[]): DashboardTreeRow[] {
  const depths = items.map(getDashboardItemTreeDepth);
  const subtreeEndIndexes = depths.map((depth, index) => {
    let endIndex = index;
    for (let candidateIndex = index + 1; candidateIndex < depths.length; candidateIndex += 1) {
      if (depths[candidateIndex] <= depth) break;
      endIndex = candidateIndex;
    }
    return endIndex;
  });
  const hasNextSibling = depths.map((depth, index) => {
    const nextIndexAfterSubtree = subtreeEndIndexes[index] + 1;
    return depths[nextIndexAfterSubtree] === depth;
  });
  const branchStack: number[] = [];

  return items.map((item, index) => {
    const depth = depths[index];
    const nextDepth = depths[index + 1] ?? null;
    const hasChildren = nextDepth !== null && nextDepth > depth;

    branchStack.length = depth + 1;
    branchStack[depth] = index;

    const guideSegments: TreeGuideSegment[] = [];
    for (let level = 0; level < depth; level += 1) {
      const childBranchIndex = branchStack[level + 1];
      if (childBranchIndex === undefined) continue;

      const isChildBranchRoot = childBranchIndex === index;
      if (hasNextSibling[childBranchIndex] || isChildBranchRoot) {
        guideSegments.push({
          level,
          startsAtNode: false,
          endsAtJoint: !hasNextSibling[childBranchIndex] && isChildBranchRoot,
        });
      }
    }

    if (hasChildren) {
      guideSegments.push({
        level: depth,
        startsAtNode: true,
        endsAtJoint: false,
      });
    }

    return {
      item,
      treeMeta: {
        depth,
        guideSegments,
      },
    };
  });
}
