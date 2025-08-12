const express = require('express');
const { Octokit } = require('@octokit/rest');
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

    // 1. Find the project ID from the project name
    const { data: projects } = await octokit.projects.listForRepo({
      owner,
      repo,
      state: 'open',
    });

    const project = projects.find(p => p.name === projectName);

    if (!project) {
      return res.status(404).json({ error: `Project '${projectName}' not found in this repository.` });
    }

    const project_id = project.id;

    // 2. Get columns
    const { data: columns } = await octokit.projects.listColumns({
      project_id,
    });

    // 3. Get cards for each column
    const tasks = [];
    for (const column of columns) {
      const { data: cards } = await octokit.projects.listCards({
        column_id: column.id,
      });
      for (const card of cards) {
        if (card.content_url) {
          const issueUrlParts = card.content_url.split('/');
          const issue_number = issueUrlParts[issueUrlParts.length - 1];
          const { data: issue } = await octokit.issues.get({
            owner,
            repo,
            issue_number,
          });
          tasks.push({
            id: issue.id,
            text: issue.title,
            start_date: issue.created_at,
            end_date: issue.closed_at,
            progress: issue.state === 'closed' ? 1 : 0,
            parent: 0,
          });
        }
      }
    }

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
