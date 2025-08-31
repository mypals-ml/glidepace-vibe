import { reactive } from 'vue';

export const store = reactive({
  tasks: [],
  setTasks(tasks) {
    this.tasks = tasks;
  },
});