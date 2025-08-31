import { createApp } from 'vue'
import App from './App.vue'
import router from './router'
import ganttastic from '@infectoone/vue-ganttastic';    

const app = createApp(App);
app.use(ganttastic);
app.use(router);
app.mount('#app');