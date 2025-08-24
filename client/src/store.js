import { reactive } from 'vue';
import moment from 'moment';

export const store = reactive({
  tasks: [],
  setTasks(tasks) {
    console.log('Raw tasks input:', JSON.stringify(tasks, null, 2)); // Detailed debug
    // Filter out undefined/null tasks and ensure valid fields
    this.tasks = (tasks || [])
      .filter(task => task && typeof task === 'object') // Remove undefined/null
      .map((task, index) => {
        const startDate = moment(task.start_date, ['YYYY-MM-DD HH:mm', moment.ISO_8601], true);
        const endDate = task.end_date
          ? moment(task.end_date, ['YYYY-MM-DD HH:mm', moment.ISO_8601], true)
          : startDate.isValid()
            ? startDate.clone().add(1, 'day')
            : moment().add(1, 'day');

        if (!startDate.isValid()) {
          console.error(`Invalid start_date for task ${task.id || index}:`, task.start_date);
        }
        if (!endDate.isValid()) {
          console.error(`Invalid end_date for task ${task.id || index}:`, task.end_date);
        }

        return {
          id: task.id || `task-${index}`,
          text: task.text || task.title || `Task ${index + 1}`,
          start_date: startDate.isValid() ? startDate.format('YYYY-MM-DD HH:mm') : moment().format('YYYY-MM-DD HH:mm'),
          end_date: endDate.isValid() ? endDate.format('YYYY-MM-DD HH:mm') : moment().add(1, 'day').format('YYYY-MM-DD HH:mm'),
        };
      });
    console.log('Processed tasks:', JSON.stringify(this.tasks, null, 2)); // Detailed debug
  },
});