## Objective
Automate the Glidelines task board workflow using the GitHub GraphQL API (via `gh api graphql` or Node.js scripts) instead of browser automation.

## Setup
1. **Retrieve the GitHub Token from the Web App**: 
   Since the web app saves connected account tokens in the browser's `localStorage`, you can retrieve the token by:
   - Opening the browser's Developer Tools Console on the Glidelines app tab.
   - Running the following JavaScript snippet:
     ```javascript
     JSON.parse(localStorage.getItem('github_accounts')).map(a => `${a.login}: ${a.token}`).join('\n')
     ```
   - Copying the token corresponding to your target account.
2. **Configure Authentication**: 
   Set the token in your terminal environment:
   ```bash
   export GITHUB_TOKEN="your_retrieved_token"
   ```
   Alternatively, you can authenticate the GitHub CLI (`gh`) using:
   ```bash
   echo "your_retrieved_token" | gh auth login --with-token
   ```
3. **Project ID**: The target project node ID is `PVT_kwDODNQhvs4BWmqS`.

## Step-by-Step API Guide

To interact with the project and issues, use the following GraphQL queries and mutations. You can execute them using `gh api graphql -f query='...'` or write a custom Node.js helper script.

### 1. Fetch Status Field and Options
Query the project fields to retrieve the Status field ID and the option IDs (for `Todo`, `In progress`, and `In review`).

```graphql
query GetProjectFields($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2FieldCommon {
            id
            name
          }
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
            }
          }
        }
      }
    }
  }
}
```

### 2. Fetch Project Items (Tasks)
Fetch the project items to find tasks and their statuses.

```graphql
query GetProjectItems($projectId: ID!) {
  node(id: $projectId) {
    ... on ProjectV2 {
      items(first: 100) {
        nodes {
          id
          content {
            __typename
            ... on Issue {
              id
              title
              body
              comments(first: 50) {
                nodes {
                  id
                  body
                  createdAt
                }
              }
            }
          }
          fieldValues(first: 100) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                optionId
                name
                field {
                  ... on ProjectV2FieldCommon {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
```

### 3. Update Item Status
Update the status of a project item (e.g., transition from `Todo` to `In progress`).

```graphql
mutation UpdateItemStatus($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $projectId
      itemId: $itemId
      fieldId: $fieldId
      value: {
        singleSelectOptionId: $optionId
      }
    }
  ) {
    projectV2Item {
      id
    }
  }
}
```

### 4. Add Comment to Issue
Add a comment to the issue corresponding to the task. Use the Issue's Node ID (retrieved from `content.id` above) as the `subjectId`.

```graphql
mutation AddIssueComment($subjectId: ID!, $body: String!) {
  addComment(input: { subjectId: $subjectId, body: $body }) {
    commentEdge {
      node {
        id
        body
      }
    }
  }
}
```

---

## Task Workflow (repeat until no more Todo tasks or time/context limit reached)
1. Query the project fields to determine the `Status` field ID, and the option IDs for `Todo`, `In progress`, and `In review`.
2. Fetch the project items and find the **first** item whose `Status` field matches the `Todo` option ID.
3. If no `Todo` tasks exist, terminate the automation and report completion.
4. Using the `UpdateItemStatus` mutation, change that task's state to `In progress`.
5. Add a comment to the associated Issue: `CodeX Automation is working on it <current datetime in Asia/Tokyo>`.
6. Print the task's title, description, and existing comments to the console/chat so you can read and understand the task requirements.

## Implementation Workflow
- Follow the repository instructions in `AGENTS.md` and any files it references (especially `ANTIGRAVITY.md`) **before** editing any code.
- In the workspace, create a clear implementation + test plan for the task.
- Review the plan for gaps, risks, edge cases, and missing verification steps.
- Implement the changes.
- Run relevant tests and all required repository checks (lint, type-check, build, etc.).

## Completion Workflow
1. Commit the changes locally.
2. Push the commit to remote `origin`.
3. Using the `UpdateItemStatus` mutation, change the task state to `In review`.
4. Add a comment to the issue in this exact format (must be ≤ 220 characters):
   `CodeX Automation committed the changes <current datetime> | <brief execution walkthrough>`
   - The walkthrough must concisely summarize what was implemented and how it was verified.

## Continuation & Guardrails
- After finishing one task, immediately check for the next `Todo` task using the API.
- Maximum 3 tasks per automation run (to avoid runaway loops).
- If any step fails (API query/mutation failure, tests, push, etc.), stop, report the failure, and do not continue to the next task.

## Reporting (at the end of the run)
- Which task(s) were handled.
- What code changes were made.
- What tests/checks were executed and their results.
- Any blockers or failures encountered.
