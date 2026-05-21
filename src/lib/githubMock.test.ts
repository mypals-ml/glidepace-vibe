import { describe, expect, it, vi } from 'vitest';
import { handleMockGraphQL } from './githubMock';
import { GET_PROJECT_TASKS_QUERY, GET_SINGLE_ITEM_QUERY, UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, UPDATE_PROJECT_ITEM_POSITION_MUTATION } from './githubQueries';

interface MockField {
  id: string;
  name: string;
}

interface MockFieldValue {
  text?: string;
  field: {
    id: string;
  };
}

interface MockProjectItem {
  id: string;
  fieldValues: {
    nodes: MockFieldValue[];
  };
}

interface MockProjectResponse {
  data: {
    node: {
      fields: {
        nodes: MockField[];
      };
      items: {
        nodes: MockProjectItem[];
      };
    };
  };
}

interface MockItemResponse {
  data: {
    node: MockProjectItem;
  };
}

async function resolveMockGraphQL(query: string, variables: Parameters<typeof handleMockGraphQL>[1]) {
  const response = handleMockGraphQL(query, variables);
  await vi.advanceTimersByTimeAsync(800);
  return response;
}

describe('githubMock in-memory project fields', () => {
  it('persists task dependency links across project and item fetches', async () => {
    vi.useFakeTimers();

    const projectId = 'PVT_3';
    const sourceItemId = 'item-pat-support';
    const targetItemId = 'item-z-index-fix';

    const initialProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const successorField = initialProject.data.node.fields.nodes.find(field => field.name === 'Successors');
    const predecessorField = initialProject.data.node.fields.nodes.find(field => field.name === 'Predecessors');

    expect(successorField).toBeDefined();
    expect(successorField?.id).toBeTruthy();
    expect(predecessorField).toBeDefined();
    expect(predecessorField?.id).toBeTruthy();

    await resolveMockGraphQL(UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, {
      projectId,
      itemId: sourceItemId,
      fieldId: successorField?.id,
      value: { text: targetItemId },
    });
    await resolveMockGraphQL(UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, {
      projectId,
      itemId: targetItemId,
      fieldId: predecessorField?.id,
      value: { text: sourceItemId },
    });

    const refetchedProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const refetchedSource = refetchedProject.data.node.items.nodes.find(item => item.id === sourceItemId);
    const refetchedTarget = refetchedProject.data.node.items.nodes.find(item => item.id === targetItemId);
    const refetchedSuccessors = refetchedSource?.fieldValues.nodes.find(fieldValue => fieldValue.field.id === successorField?.id);
    const refetchedPredecessors = refetchedTarget?.fieldValues.nodes.find(fieldValue => fieldValue.field.id === predecessorField?.id);

    expect(refetchedSuccessors?.text).toBe(targetItemId);
    expect(refetchedPredecessors?.text).toBe(sourceItemId);

    const refetchedItem = await resolveMockGraphQL(GET_SINGLE_ITEM_QUERY, { itemId: sourceItemId }) as MockItemResponse;
    const itemSuccessors = refetchedItem.data.node.fieldValues.nodes.find(fieldValue => fieldValue.field.id === successorField?.id);

    expect(itemSuccessors?.text).toBe(targetItemId);

    vi.useRealTimers();
  });

  it('persists project item position changes across project fetches', async () => {
    vi.useFakeTimers();

    const projectId = 'PVT_3';
    const movedItemId = 'item-mock-data';
    const afterItemId = 'item-pat-support';

    await resolveMockGraphQL(UPDATE_PROJECT_ITEM_POSITION_MUTATION, {
      projectId,
      itemId: movedItemId,
      afterId: afterItemId,
    });

    const refetchedProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const itemIds = refetchedProject.data.node.items.nodes.map(item => item.id);

    expect(itemIds.slice(0, 3)).toEqual([
      'item-pat-support',
      'item-mock-data',
      'item-z-index-fix',
    ]);

    await resolveMockGraphQL(UPDATE_PROJECT_ITEM_POSITION_MUTATION, {
      projectId,
      itemId: movedItemId,
      afterId: null,
    });

    const topRefetch = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    expect(topRefetch.data.node.items.nodes[0]?.id).toBe(movedItemId);

    vi.useRealTimers();
  });
});
