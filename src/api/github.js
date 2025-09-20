const express = require('express');
const router = express.Router();

function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (match) {
    const [owner, repo] = match[1].split('/');
    return { owner, repo };
  }
  return null;
}

router.post('/connect', async (req, res) => {
  const { Octokit } = await import('@octokit/rest');
  const { graphql } = await import('@octokit/graphql');
  const { repoUrl, projectName, githubToken } = req.body;

  if (!repoUrl || !projectName || !githubToken) {
    return res.status(400).json({ error: 'Repository URL, Project Name, and GitHub Token are required' });
  }

  const repoInfo = parseRepoUrl(repoUrl);

  if (!repoInfo) {
    return res.status(400).json({ error: 'Invalid repository URL' });
  }

  try {
    const { owner, repo } = repoInfo;
    const octokit = new Octokit({ auth: githubToken });
    const graphqlWithAuth = graphql.defaults({ headers: { authorization: `token ${githubToken}` } });

    // 1. Get Projects Next (Beta) for the repository
    const projectsQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          projectsV2(first: 10) {
            nodes {
              id
              title
            }
          }
        }
      }
    `;
    const projectsResult = await graphqlWithAuth(projectsQuery, { owner, repo });
    const projects = projectsResult.repository.projectsV2.nodes;
    const project = projects.find(p => p.title === projectName);
    if (!project) {
      return res.status(404).json({ error: `Project '${projectName}' not found in this repository.` });
    }
    const project_id = project.id;

    // 2. Get items (tasks) in the project
    const itemsQuery = `
      query($projectId: ID!) {
        node(id: $projectId) {
          ... on ProjectV2 {
            items(first: 50) {
              nodes {
                id
                content {
                  ... on Issue {
                    id
                    number
                    title
                    state
                    createdAt
                    closedAt
                  }
                }
              }
            }
          }
        }
      }
    `;
    const itemsResult = await graphqlWithAuth(itemsQuery, { projectId: project_id });
    const items = itemsResult.node.items.nodes;
    const tasks = items
      .filter(item => item.content)
      .map(item => {
        const issue = item.content;
        return {
          id: issue.id,
          text: issue.title,
          start_date: issue.createdAt,
          end_date: issue.closedAt,
          progress: issue.state === 'CLOSED' ? 1 : 0,
          parent: 0,
        };
      });

    res.json({ project, tasks });
  } catch (error) {
    console.error('Error connecting to GitHub:', error);
    if (error.status === 401) {
        return res.status(401).json({ error: 'Authentication failed. Please check your GitHub token.' });
    }
    res.status(500).json({ error: 'Failed to connect to GitHub project. Check server logs for details.' });
  }
});

module.exports = router;
