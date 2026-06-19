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
  content?: {
    comments?: unknown;
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

  it('applies an aliased batch field mutation to a mock item', async () => {
    vi.useFakeTimers();

    const projectId = 'PVT_3';
    const itemId = 'item-pat-support';

    const initialProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const estimateField = initialProject.data.node.fields.nodes.find(field => field.name === 'Estimate');
    const successorField = initialProject.data.node.fields.nodes.find(field => field.name === 'Successors');
    expect(estimateField?.id).toBeTruthy();
    expect(successorField?.id).toBeTruthy();

    const batchMutation = `mutation BatchUpdateFields($projectId: ID!, $itemId: ID!, $fieldId0: ID!, $value0: ProjectV2FieldValue!, $fieldId1: ID!, $value1: ProjectV2FieldValue!) {
      u0: updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId0, value: $value0 }) { projectV2Item { id } }
      u1: updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId1, value: $value1 }) { projectV2Item { id } }
    }`;

    const result = await resolveMockGraphQL(batchMutation, {
      projectId,
      itemId,
      fieldId0: estimateField?.id,
      value0: { number: 7 },
      fieldId1: successorField?.id,
      value1: { text: 'item-z-index-fix' },
    }) as { data: Record<string, unknown> };

    expect(result.data.u0).toMatchObject({ projectV2Item: { id: itemId } });
    expect(result.data.u1).toMatchObject({ projectV2Item: { id: itemId } });

    const refetched = await resolveMockGraphQL(GET_SINGLE_ITEM_QUERY, { itemId }) as MockItemResponse;
    const successors = refetched.data.node.fieldValues.nodes.find(fv => fv.field.id === successorField?.id);
    expect(successors?.text).toBe('item-z-index-fix');

    vi.useRealTimers();
  });

  it('persists project item position changes across project fetches', async () => {
    vi.useFakeTimers();
    const infoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

    const projectId = 'PVT_3';
    const movedItemId = 'item-mock-data';
    const afterItemId = 'item-pat-support';

    await resolveMockGraphQL(UPDATE_PROJECT_ITEM_POSITION_MUTATION, {
      projectId,
      itemId: movedItemId,
      afterId: afterItemId,
    });

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[GitHubMock] Reorder action'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(`"reorderKind":"project_item_position"`));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(`"projectId":"${projectId}"`));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(`"itemId":"${movedItemId}"`));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(`"afterId":"${afterItemId}"`));
    expect(JSON.parse(infoSpy.mock.calls.at(-1)?.[0].replace('[GitHubMock] Reorder action ', '') || '{}')).toMatchObject({
      reorderKind: 'project_item_position',
      projectId,
      itemId: movedItemId,
      afterId: afterItemId,
    });

    const refetchedProject = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const itemIds = refetchedProject.data.node.items.nodes.map(item => item.id);

    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining('[GitHubMock] Refresh action'));
    expect(infoSpy).toHaveBeenCalledWith(expect.stringContaining(`"refreshKind":"project_items"`));
    expect(JSON.parse(infoSpy.mock.calls.at(-1)?.[0].replace('[GitHubMock] Refresh action ', '') || '{}')).toMatchObject({
      refreshKind: 'project_items',
      projectId,
      refreshedItemCount: refetchedProject.data.node.items.nodes.length,
    });

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

    const logMessages = infoSpy.mock.calls.map(call => String(call[0]));
    expect(logMessages).toContainEqual(expect.stringContaining(`"afterId":null`));
    expect(logMessages).toContainEqual(expect.stringContaining(`"itemId":"${movedItemId}"`));
    expect(logMessages).toContainEqual(expect.stringContaining('[GitHubMock] Refresh action'));
    expect(logMessages.at(-2)).toContain('[GitHubMock] Reorder action');
    expect(JSON.parse(logMessages.at(-2)?.replace('[GitHubMock] Reorder action ', '') || '{}')).toMatchObject({
      reorderKind: 'project_item_position',
      projectId,
      itemId: movedItemId,
      afterId: null,
    });
    expect(logMessages.at(-1)).toContain('[GitHubMock] Refresh action');
    expect(JSON.parse(logMessages.at(-1)?.replace('[GitHubMock] Refresh action ', '') || '{}')).toMatchObject({
      refreshKind: 'project_items',
      projectId,
      refreshedItemCount: topRefetch.data.node.items.nodes.length,
    });

    infoSpy.mockRestore();
    vi.useRealTimers();
  });

  it('supports paginated comments fetch for the 100-comments mock project', async () => {
    vi.useFakeTimers();

    const projectId = 'PVT_100_COMMENTS';
    const contentId = 'content-100-comments-1';

    // 1. Initial project fetch returns tasks list without comments in nodes
    const projectFetch = await resolveMockGraphQL(GET_PROJECT_TASKS_QUERY, { projectId }) as MockProjectResponse;
    const taskItem = projectFetch.data.node.items.nodes[0];
    expect(taskItem).toBeDefined();
    expect(taskItem.id).toBe('item-100-comments-1');
    expect(taskItem.content?.comments).toBeUndefined();

    // 2. Fetch first page of comments
    const page1Query = `
      query($nodeId: ID!, $cursor: String) {
        node(id: $nodeId) {
          ... on Issue {
            comments(first: 30, after: $cursor) {
              pageInfo { hasNextPage endCursor }
              nodes { id body }
            }
          }
        }
      }
    `;

    interface CommentsResponse {
      data: {
        node: {
          comments: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: Array<{ id: string; body: string }>;
          };
        };
      };
    }

    const page1Res = await resolveMockGraphQL(page1Query, { nodeId: contentId }) as CommentsResponse;
    const p1Comments = page1Res.data.node.comments;
    expect(p1Comments.nodes.length).toBe(30);
    expect(p1Comments.pageInfo.hasNextPage).toBe(true);
    expect(p1Comments.pageInfo.endCursor).toBe('30');
    expect(p1Comments.nodes[0].id).toBe('comment-100-comments-1');

    // 3. Fetch second page
    const page2Res = await resolveMockGraphQL(page1Query, { nodeId: contentId, cursor: p1Comments.pageInfo.endCursor }) as CommentsResponse;
    const p2Comments = page2Res.data.node.comments;
    expect(p2Comments.nodes.length).toBe(30);
    expect(p2Comments.pageInfo.hasNextPage).toBe(true);
    expect(p2Comments.pageInfo.endCursor).toBe('60');
    expect(p2Comments.nodes[0].id).toBe('comment-100-comments-31');

    // 4. Fetch third page
    const page3Res = await resolveMockGraphQL(page1Query, { nodeId: contentId, cursor: p2Comments.pageInfo.endCursor }) as CommentsResponse;
    const p3Comments = page3Res.data.node.comments;
    expect(p3Comments.nodes.length).toBe(30);
    expect(p3Comments.pageInfo.hasNextPage).toBe(true);
    expect(p3Comments.pageInfo.endCursor).toBe('90');

    // 5. Fetch fourth page (final 10 comments)
    const page4Res = await resolveMockGraphQL(page1Query, { nodeId: contentId, cursor: p3Comments.pageInfo.endCursor }) as CommentsResponse;
    const p4Comments = page4Res.data.node.comments;
    expect(p4Comments.nodes.length).toBe(10);
    expect(p4Comments.pageInfo.hasNextPage).toBe(false);
    expect(p4Comments.pageInfo.endCursor).toBeNull();
    expect(p4Comments.nodes[9].id).toBe('comment-100-comments-100');

    vi.useRealTimers();
  });
});
