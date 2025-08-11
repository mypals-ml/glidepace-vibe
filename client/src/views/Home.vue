<template>
  <div>
    <h1>Welcome to Ganttify</h1>
    <p>Visualize your GitHub projects as Gantt charts.</p>
    <router-link to="/connect">
      <button>Connect to GitHub</button>
    </router-link>
  </div>
</template>

<script>
export default {
  name: 'Home',
};
</script>
