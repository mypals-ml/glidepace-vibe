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
          :bars="[task]"
          bar-start="start_date"
          bar-end="end_date"
          :gantt-bar-config="{ id: task.id, label: task.text }"
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

export default {
  name: 'GanttChart',
  components: {
    GGanttChart,
    GGanttRow,
  },
  data() {
    return {
      chartStart: moment().format('YYYY-MM-DD HH:mm'),
      chartEnd: moment().add(1, 'day').format('YYYY-MM-DD HH:mm'),
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
      console.log('Raw tasks:', this.tasks); // Debug raw tasks
      return this.tasks.map(task => {
        const startDate = moment(task.start_date, 'YYYY-MM-DD HH:mm', true);
        const endDate = moment(task.end_date, 'YYYY-MM-DD HH:mm', true);

        if (!startDate.isValid()) {
          console.error(`Invalid start_date for task ${task.id}:`, task.start_date);
        }
        if (!endDate.isValid()) {
          console.error(`Invalid end_date for task ${task.id}:`, task.end_date);
        }

        return {
          ...task,
          start_date: startDate.isValid() ? startDate.format('YYYY-MM-DD HH:mm') : moment().format('YYYY-MM-DD HH:mm'),
          end_date: endDate.isValid() ? endDate.format('YYYY-MM-DD HH:mm') : moment().add(1, 'day').format('YYYY-MM-DD HH:mm'),
        };
      });
    },
  },
  watch: {
    tasks: {
      immediate: true,
      handler(newTasks) {
        if (newTasks && newTasks.length > 0) {
          const startDates = newTasks
            .map(t => moment(t.start_date, 'YYYY-MM-DD HH:mm', true))
            .filter(m => m.isValid());
          const endDates = newTasks
            .map(t => moment(t.end_date, 'YYYY-MM-DD HH:mm', true))
            .filter(m => m.isValid());

          this.chartStart = startDates.length > 0
            ? moment.min(startDates).subtract(1, 'day').format('YYYY-MM-DD HH:mm')
            : moment().format('YYYY-MM-DD HH:mm');
          this.chartEnd = endDates.length > 0
            ? moment.max(endDates).add(1, 'day').format('YYYY-MM-DD HH:mm')
            : moment().add(1, 'day').format('YYYY-MM-DD HH:mm');
        } else {
          this.chartStart = moment().format('YYYY-MM-DD HH:mm');
          this.chartEnd = moment().add(1, 'day').format('YYYY-MM-DD HH:mm');
        }
      },
    },
  },
};
</script>