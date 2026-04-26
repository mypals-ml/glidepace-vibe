import { PROJECT_ITEM_FRAGMENT } from './githubTaskMapper';

export const GET_SINGLE_ITEM_QUERY = `
  query($itemId: ID!) {
    node(id: $itemId) {
      ... on ProjectV2Item {
        ${PROJECT_ITEM_FRAGMENT}
      }
    }
  }
`;

export const GET_PROJECT_TASKS_QUERY = `
  query($projectId: ID!) {
    node(id: $projectId) {
      ... on ProjectV2 {
        public
        fields(first: 20) {
          nodes {
            ... on ProjectV2SingleSelectField {
              id
              name
              options { id name color }
            }
          }
        }
        items(first: 50) {
          nodes {
            ${PROJECT_ITEM_FRAGMENT}
          }
        }
      }
    }
  }
`;

export const GET_USER_PROJECTS_QUERY = `
  query {
    viewer {
      login
      databaseId
      projectsV2(first: 20) {
        nodes { id title public }
      }
      organizations(first: 10) {
        nodes {
          login
          databaseId
          projectsV2(first: 20) {
            nodes { id title public }
          }
        }
      }
    }
  }
`;

export const SEARCH_ASSIGNABLE_USERS_QUERY = `
  query($owner: String!, $name: String!, $query: String) {
    repository(owner: $owner, name: $name) {
      assignableUsers(first: 20, query: $query) {
        nodes {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const SEARCH_ORG_MEMBERS_QUERY = `
  query($login: String!) {
    organization(login: $login) {
      membersWithRole(first: 20) {
        nodes {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const SEARCH_GLOBAL_USERS_QUERY = `
  query($searchQuery: String!) {
    search(query: $searchQuery, type: USER, first: 10) {
      nodes {
        ... on User {
          id
          login
          name
          avatarUrl
        }
      }
    }
  }
`;

export const ADD_ASSIGNEES_MUTATION = `
  mutation($issueId: ID!, $assigneeIds: [ID!]!) {
    addAssigneesToAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
      assignable {
        ... on Issue {
          id
          assignees(first: 10) {
            nodes { id login name avatarUrl }
          }
        }
      }
    }
  }
`;

export const REMOVE_ASSIGNEES_MUTATION = `
  mutation($issueId: ID!, $assigneeIds: [ID!]!) {
    removeAssigneesFromAssignable(input: { assignableId: $issueId, assigneeIds: $assigneeIds }) {
      assignable {
        ... on Issue {
          id
          assignees(first: 10) {
            nodes { id login name avatarUrl }
          }
        }
      }
    }
  }
`;

export const UPDATE_PROJECT_ITEM_FIELD_VALUE_MUTATION = `
  mutation UpdateProjectV2ItemFieldValue($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) { 
    updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) { 
      projectV2Item { id } 
    } 
  }
`;

export const GET_REPOSITORY_ID_QUERY = `
  query GetRepository($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
    }
  }
`;

export const CREATE_ISSUE_MUTATION = `
  mutation CreateIssue($repositoryId: ID!, $title: String!, $body: String) {
    createIssue(input: {
      repositoryId: $repositoryId
      title: $title
      body: $body
    }) {
      issue {
        id
      }
    }
  }
`;

export const ADD_PROJECT_ITEM_MUTATION = `
  mutation AddProjectItem($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: {
      projectId: $projectId
      contentId: $contentId
    }) {
      item {
        id
      }
    }
  }
`;

export const ADD_DRAFT_ISSUE_MUTATION = `
  mutation AddDraftItem($projectId: ID!, $title: String!, $body: String) {
    addProjectV2DraftIssue(input: {
      projectId: $projectId
      title: $title
      body: $body
    }) {
      projectItem {
        id
      }
    }
  }
`;

export const UPDATE_ISSUE_TITLE_MUTATION = `
  mutation UpdateIssue($id: ID!, $title: String!) { 
    updateIssue(input: { id: $id, title: $title }) { 
      issue { id } 
    } 
  }
`;

export const UPDATE_ISSUE_BODY_MUTATION = `
  mutation UpdateIssue($id: ID!, $body: String!) { 
    updateIssue(input: { id: $id, body: $body }) { 
      issue { id } 
    } 
  }
`;

export const UPDATE_DRAFT_TITLE_MUTATION = `
  mutation UpdateDraftIssue($id: ID!, $title: String!) {
    updateProjectV2DraftIssue(input: { draftIssueId: $id, title: $title }) {
      draftIssue { id }
    }
  }
`;

export const UPDATE_DRAFT_BODY_MUTATION = `
  mutation UpdateDraftIssue($id: ID!, $body: String!) {
    updateProjectV2DraftIssue(input: { draftIssueId: $id, body: $body }) {
      draftIssue { id }
    }
  }
`;

export const UPDATE_DRAFT_ASSIGNEES_MUTATION = `
  mutation UpdateDraftAssignees($id: ID!, $assigneeIds: [ID!]!) {
    updateProjectV2DraftIssue(input: { draftIssueId: $id, assigneeIds: $assigneeIds }) {
      draftIssue { id }
    }
  }
`;

export const UPDATE_ISSUE_COMMENT_MUTATION = `
  mutation UpdateIssueComment($id: ID!, $body: String!) { 
    updateIssueComment(input: { id: $id, body: $body }) { 
      issueComment { id } 
    } 
  }
`;

export const DELETE_ISSUE_COMMENT_MUTATION = `
  mutation DeleteIssueComment($id: ID!) { 
    deleteIssueComment(input: { id: $id }) { 
      clientMutationId 
    } 
  }
`;

export const ADD_ISSUE_COMMENT_MUTATION = `
  mutation AddComment($subjectId: ID!, $body: String!) { 
    addComment(input: { subjectId: $subjectId, body: $body }) { 
      commentEdge { node { id } } 
    } 
  }
`;
