<template>
  <div>
    <h1>Connect to GitHub Project</h1>
    <form @submit.prevent="connect">
      <div>
        <label for="repoUrl">Repository URL:</label>
        <input type="text" id="repoUrl" v-model="repoUrl" required>
      </div>
      <div>
        <label for="projectName">Project Name:</label>
        <input type="text" id="projectName" v-model="projectName" required>
      </div>
      <div>
        <label for="githubToken">GitHub Token:</label>
        <input type="password" id="githubToken" v-model="githubToken" required>
      </div>
      <button type="submit" :disabled="loading">
        {{ loading ? 'Connecting...' : 'Connect' }}
      </button>
    </form>
    <p v-if="error" style="color: red;">{{ error }}</p>
  </div>
</template>

<script>
import axios from 'axios';

export default {
  name: 'GithubConnect',
  data() {
    return {
      repoUrl: '',
      projectName: '',
      githubToken: '',
      loading: false,
      error: null,
    };
  },
  methods: {
    async connect() {
      this.loading = true;
      this.error = null;
      try {
        const response = await axios.post('/api/github/connect', {
          repoUrl: this.repoUrl,
          projectName: this.projectName,
          githubToken: this.githubToken,
        });
        const { tasks } = response.data;
        this.$router.push({ name: 'GanttChart', params: { tasks } });
      } catch (err) {
        this.error = 'Failed to connect to GitHub project. Check the console for more details.';
        console.error(err);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>
