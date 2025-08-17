<template>
  <div>
    <h1>Gantt Chart</h1>
    <div v-if="effectiveTasks && effectiveTasks.length > 0">
      <g-gantt-chart
        :chart-start="chartStart"
        :chart-end="chartEnd"
        :grid="true"
        :hide-timeaxis="false"
        :push-on-overlap="true"
        :row-label-width="200"
      >
        <g-gantt-row
          v-for="task in formattedTasks"
          :key="task.id"
          :label="task.text"
          :bars="[task]"
          bar-start="start_date"
          bar-end="end_date"
        />
      </g-gantt-chart>
    </div>
    <div v-else>
      <p>No tasks to display. Please connect to a GitHub project first.</p>
      <router-link to="/connect">Connect to GitHub</router-link>
    </div>
  </div>
</template>

<script>
import { GGanttChart, GGanttRow } from "@infectoone/vue-ganttastic";
import moment from "moment";

export default {
  name: "GanttChart",
  components: {
    GGanttChart,
    GGanttRow,
  },
  props: {
    tasks: {
      type: Array,
      default: null,
    },
  },
  data() {
    return {
      chartStart: "",
      chartEnd: "",
      localTasks: [],
    };
  },
  computed: {
    effectiveTasks() {
      // Use prop if provided, else fallback to localStorage
      if (this.tasks && this.tasks.length > 0) {
        return this.tasks;
      }
      const stored = localStorage.getItem('githubTasks');
      return stored ? JSON.parse(stored) : [];
    },
    formattedTasks() {
      if (!this.effectiveTasks || this.effectiveTasks.length === 0) {
        return [];
      }
      return this.effectiveTasks.map(task => ({
        ...task,
        start_date: moment(task.start_date).format("YYYY-MM-DD HH:mm:ss"),
        end_date: task.end_date ? moment(task.end_date).format("YYYY-MM-DD HH:mm:ss") : moment(task.start_date).add(1, 'days').format("YYYY-MM-DD HH:mm:ss"),
      }));
    }
  },
  watch: {
    effectiveTasks: {
      immediate: true,
      handler(newTasks) {
        if (newTasks && newTasks.length > 0) {
          const startDates = newTasks.map(t => moment(t.start_date));
          const endDates = newTasks.map(t => t.end_date ? moment(t.end_date) : moment(t.start_date).add(1, 'days'));
          this.chartStart = moment.min(startDates).subtract(1, 'days').format("YYYY-MM-DD HH:mm:ss");
          this.chartEnd = moment.max(endDates).add(1, 'days').format("YYYY-MM-DD HH:mm:ss");
        }
      },
    },
  },
};
</script>
