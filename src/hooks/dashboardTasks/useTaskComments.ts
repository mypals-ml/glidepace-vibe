import { useState, useCallback, useRef } from 'react';
import { fetchGitHubGraphQL } from '../../lib/githubService';
import { mapGitHubCommentToTaskComment } from '../../lib/githubTaskMapper';
import {
  UPDATE_ISSUE_COMMENT_MUTATION,
  DELETE_ISSUE_COMMENT_MUTATION,
  ADD_ISSUE_COMMENT_MUTATION,
  GET_ISSUE_COMMENTS_QUERY
} from '../../lib/githubQueries';
import type { Task, TaskComment } from '../../types';
import type { DashboardTasksCore } from './types';

interface UseTaskCommentsProps {
  core: DashboardTasksCore;
  fetchSingleProjectItem: (itemId: string, token: string) => Promise<Task | null>;
}

/** Paginated comment fetching plus add/update/delete comment mutations. */
export function useTaskComments({ core, fetchSingleProjectItem }: UseTaskCommentsProps) {
  const { githubToken, setTasks } = core;

  const [isFetchingComments, setIsFetchingComments] = useState<Record<string, boolean>>({});
  const ongoingCommentFetchesRef = useRef<Record<string, boolean>>({});

  const fetchTaskComments = useCallback(async (taskId: string, contentId: string, token: string) => {
    if (!contentId || !token) return;

    // Check if we are already fetching comments for this task to avoid concurrent duplicate requests
    if (ongoingCommentFetchesRef.current[taskId]) {
      console.log(`[DashboardTasks] 💬 Already fetching comments for task ${taskId} (active request check), skipping duplicate call`);
      return;
    }

    ongoingCommentFetchesRef.current[taskId] = true;
    console.log(`[DashboardTasks] 💬 Starting paginated comment fetch for task: ${taskId}, contentId: ${contentId}`);

    setIsFetchingComments(prev => ({ ...prev, [taskId]: true }));

    try {
      let hasNextPage = true;
      let cursor: string | undefined = undefined;
      let pageCount = 0;

      while (hasNextPage) {
        pageCount++;
        console.log(`[DashboardTasks] 💬 Fetching page ${pageCount} of comments for ${taskId} (cursor: ${cursor || 'start'})`);

        const variables: Record<string, string | number | boolean | undefined> = {
          nodeId: contentId,
          cursor
        };

        const json = await fetchGitHubGraphQL(GET_ISSUE_COMMENTS_QUERY, variables, token);

        const node = json.data?.node;
        const commentsData = node?.comments || (node?.__typename === 'Issue' || node?.__typename === 'PullRequest' ? node.comments : null);

        if (json.errors) {
          console.warn(`[DashboardTasks] GraphQL errors (possibly non-fatal) fetching comments for ${taskId}:`, json.errors);
          if (!node || !commentsData) {
            console.error(`[DashboardTasks] Fatal GraphQL error: comments data was not returned.`);
            break;
          }
        }

        if (!commentsData) {
          console.warn(`[DashboardTasks] ⚠️ No comments connection found on node for ${taskId}`);
          break;
        }

        const rawComments = commentsData.nodes || [];
        const mappedComments: TaskComment[] = rawComments
          .filter(Boolean)
          .map(mapGitHubCommentToTaskComment);

        console.log(`[DashboardTasks] 💬 Fetched ${mappedComments.length} comments in page ${pageCount}`);

        setTasks(prev => prev.map(t => {
          if (t.id === taskId || t.itemId === taskId) {
            const currentComments = pageCount === 1 ? [] : (t.comments || []);
            const existingIds = new Set(currentComments.map(c => c.id));
            const newComments = mappedComments.filter(c => !existingIds.has(c.id));
            return {
              ...t,
              comments: [...currentComments, ...newComments]
            };
          }
          return t;
        }));

        hasNextPage = commentsData.pageInfo?.hasNextPage || false;
        cursor = commentsData.pageInfo?.endCursor;
      }

      console.log(`[DashboardTasks] ✅ Finished comment fetch for task ${taskId}`);
    } catch (e) {
      console.error(`Failed to fetch comments for task ${taskId}:`, e);
    } finally {
      ongoingCommentFetchesRef.current[taskId] = false;
      setIsFetchingComments(prev => ({ ...prev, [taskId]: false }));
    }
  }, [setTasks]);

  const updateTaskComment = useCallback(async (task: Task, commentId: string, body: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t => {
        if (t.id === task.id || t.itemId === task.itemId) {
          const updatedComments = (t.comments || []).map(c =>
            c.id === commentId ? { ...c, body } : c
          );
          return { ...t, comments: updatedComments, localUpdateTimestamp: now };
        }
        return t;
      }));
      const res = await fetchGitHubGraphQL(UPDATE_ISSUE_COMMENT_MUTATION, { id: commentId, body }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      if (task.contentId) {
        await fetchTaskComments(task.id, task.contentId, githubToken);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, fetchTaskComments, setTasks]);

  const deleteTaskComment = useCallback(async (task: Task, commentId: string): Promise<boolean> => {
    if (!githubToken) return false;
    try {
      const now = Date.now();
      setTasks(prev => prev.map(t => {
        if (t.id === task.id || t.itemId === task.itemId) {
          const updatedComments = (t.comments || []).filter(c => c.id !== commentId);
          return { ...t, comments: updatedComments, localUpdateTimestamp: now };
        }
        return t;
      }));
      const res = await fetchGitHubGraphQL(DELETE_ISSUE_COMMENT_MUTATION, { id: commentId }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);
      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      if (task.contentId) {
        await fetchTaskComments(task.id, task.contentId, githubToken);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, fetchTaskComments, setTasks]);

  const addTaskComment = useCallback(async (task: Task, body: string): Promise<boolean> => {
    if (!task.contentId || !githubToken || task.isDraft) return false;
    try {
      const res = await fetchGitHubGraphQL(ADD_ISSUE_COMMENT_MUTATION, { subjectId: task.contentId, body }, githubToken);
      if (res.errors) throw new Error(res.errors[0]?.message);

      const addedNode = res.data?.addComment?.commentEdge?.node;
      const authorLogin = addedNode?.author?.login || 'me';
      const authorName = addedNode?.author?.name || authorLogin;
      const authorAvatar = addedNode?.author?.avatarUrl;

      const newComment: TaskComment = {
        id: addedNode?.id || `comment-local-${Date.now()}`,
        body: addedNode?.body || body,
        createdAt: addedNode?.createdAt || new Date().toISOString(),
        author: {
          id: authorLogin,
          login: authorLogin,
          name: authorName,
          avatarUrl: authorAvatar,
          initials: authorName.substring(0, 2).toUpperCase(),
          avatarColor: 'bg-slate-100 text-slate-500',
        }
      };

      const now = Date.now();
      setTasks(prev => prev.map(t => {
        if (t.id === task.id || t.itemId === task.itemId) {
          const updatedComments = [...(t.comments || []), newComment];
          return { ...t, comments: updatedComments, localUpdateTimestamp: now };
        }
        return t;
      }));

      if (task.itemId) {
        await fetchSingleProjectItem(task.itemId, githubToken);
      }
      if (task.contentId) {
        await fetchTaskComments(task.id, task.contentId, githubToken);
      }
      return true;
    } catch (e) {
      console.error(e);
      return false;
    }
  }, [githubToken, fetchSingleProjectItem, fetchTaskComments, setTasks]);

  return {
    isFetchingComments,
    fetchTaskComments,
    updateTaskComment,
    deleteTaskComment,
    addTaskComment,
  };
}
