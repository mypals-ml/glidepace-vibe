import { createRouter, createWebHistory } from 'vue-router';
import Home from './views/Home.vue';
import GithubConnect from './views/GithubConnect.vue';
import GanttChart from './views/GanttChart.vue';

const routes = [
  {
    path: '/',
    name: 'Home',
    component: Home,
  },
  {
    path: '/connect',
    name: 'GithubConnect',
    component: GithubConnect,
  },
  {
    path: '/gantt',
    name: 'GanttChart',
    component: GanttChart,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
