const express = require('express');
const { Octokit } = require('@octokit/rest');
const router = express.Router();

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

function parseRepoUrl(url) {
  const match = url.match(/github\.com\/([^/]+\/[^/]+)/);
  if (match) {
    const [owner, repo] = match[1].split('/');
    return { owner, repo };
  }
  return null;
}

router.post('/connect', async (req, res) => {
  const { repoUrl, projectId } = req.body;

  if (!repoUrl || !projectId) {
    return res.status(400).json({ error: 'Repository URL and Project ID are required' });
  }

  const repoInfo = parseRepoUrl(repoUrl);

  if (!repoInfo) {
    return res.status(400).json({ error: 'Invalid repository URL' });
  }

  try {
    const { owner, repo } = repoInfo;

    // The GitHub API for Projects (classic) requires project_id as an integer
    const project_id = parseInt(projectId, 10);

    if (isNaN(project_id)) {
      return res.status(400).json({ error: 'Project ID must be a number.' });
    }

    // 1. Get project
    const { data: project } = await octokit.projects.get({
      project_id,
    });

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
        // We are interested in issues, which are the tasks
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
            start_date: issue.created_at, // This is not correct for a Gantt chart, but a placeholder
            end_date: issue.closed_at,     // This is also a placeholder
            progress: issue.state === 'closed' ? 1 : 0,
            parent: 0 // Placeholder for parent task
          });
        }
      }
    }

    res.json({ project, tasks });
  } catch (error) {
    console.error('Error connecting to GitHub:', error);
    res.status(500).json({ error: 'Failed to connect to GitHub project' });
  }
});

module.exports = router;
