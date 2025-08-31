<template>
  <div>
    <h1>Gantt Chart</h1>
    <div v-if="tasks && tasks.length > 0">
      <g-gantt-chart
        :chart-start="chartStart"
        :chart-end="chartEnd"
        :grid="true"
        :hide-timeaxis="false"
        :push-on-overlap="true"
        :row-label-width="200"
        precision="day"
      >
        <g-gantt-row
          v-for="task in formattedTasks"
          :key="task.id"
          :label="task.text"
          :bars="[task.bar]"
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
import { GGanttChart, GGanttRow } from '@infectoone/vue-ganttastic';
import moment from 'moment';
import { store } from '../store';
import { GGanttChart, GGanttRow } from "@infectoone/vue-ganttastic";
import moment from "moment";
import { store } from "../store";

export default {
  name: "GanttChart",
  components: {
    GGanttChart,
    GGanttRow,
  },
  props: {
    tasks: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      chartStart: "",
      chartEnd: "",
    };
  },
  computed: {
    tasks() {
      console.log('Store tasks:', store.tasks); // Debug store tasks
      return store.tasks;
    },
    formattedTasks() {
      if (!this.tasks || this.tasks.length === 0) {
        return [];
      }
      return this.tasks.map(task => {
        const bar = {
          start_date: moment(task.start_date),
          end_date: task.end_date ? moment(task.end_date) : moment(task.start_date).add(1, 'days'),
          ganttBarConfig: {
            id: task.id,
            label: task.text,
          }
        };
        return {
          id: task.id,
          text: task.text,
          bar: bar
        };
      });
    }
  },
  watch: {
    tasks: {
      immediate: true,
      handler(newTasks) {
        if (newTasks && newTasks.length > 0) {
          const startDates = newTasks.map(t => moment(t.start_date));
          const endDates = newTasks.map(t => t.end_date ? moment(t.end_date) : moment(t.start_date).add(1, 'days'));
          this.chartStart = moment.min(startDates).subtract(1, 'days');
          this.chartEnd = moment.max(endDates).add(1, 'days');
        }
      },
    },
  },
};
</script>
