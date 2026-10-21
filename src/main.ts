import './assets/main.css'

import { createApp } from 'vue'

import App from './App.vue'
import router from './router'

// Данные теперь живут на сервере (Go, calendar-slot-api): сеялка дефолтных
// типов из v1 ушла вместе с localStorage — владелец создаёт типы в «Настройках».
createApp(App).use(router).mount('#app')
