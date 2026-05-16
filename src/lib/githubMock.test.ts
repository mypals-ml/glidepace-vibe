import { describe, expect, it, vi } from 'vitest';
import { handleMockGraphQL } from './githubMock';
import { GET_PROJECT_TASKS_QUERY, GET_SINGLE_ITEM_QUERY, UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION } from './githubQueries';

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
  it('persists task successor links across project and item fetches', async () => {
    vi.useFakeTimers();

    const projectId = 'PVT_3';
    const sourceItemId = 'item-pat-support';
    const targetItemId = 'item-z-index-fix';

    const initialProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const successorField = initialProject.data.node.fields.nodes.find(field => field.name === 'Successors');

    expect(successorField).toBeDefined();
    expect(successorField?.id).toBeTruthy();

    await resolveMockGraphQL(UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION, {
      projectId,
      itemId: sourceItemId,
      fieldId: successorField?.id,
      value: { text: targetItemId },
    });

    const refetchedProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const refetchedSource = refetchedProject.data.node.items.nodes.find(item => item.id === sourceItemId);
    const refetchedSuccessors = refetchedSource?.fieldValues.nodes.find(fieldValue => fieldValue.field.id === successorField?.id);

    expect(refetchedSuccessors?.text).toBe(targetItemId);

    const refetchedItem = await resolveMockGraphQL(GET_SINGLE_ITEM_QUERY, { itemId: sourceItemId }) as MockItemResponse;
    const itemSuccessors = refetchedItem.data.node.fieldValues.nodes.find(fieldValue => fieldValue.field.id === successorField?.id);

    expect(itemSuccessors?.text).toBe(targetItemId);

    vi.useRealTimers();
  });
});
