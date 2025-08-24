import { reactive } from 'vue';
import moment from 'moment';

export const store = reactive({
  tasks: [],
  setTasks(tasks) {
    console.log('Raw tasks input:', tasks); // Debug input tasks
    this.tasks = tasks.map(task => {
      const startDate = moment(task.start_date, moment.ISO_8601, true);
      const endDate = task.end_date
        ? moment(task.end_date, moment.ISO_8601, true)
        : startDate.add(1, 'day');

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
    console.log('Processed tasks:', this.tasks); // Debug processed tasks
  },
});