<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import { listEventTypes } from '@/api/eventTypes'
import type { EventType } from '@/api/types'
import EventTypeCard from '@/components/EventTypeCard.vue'

const router = useRouter()
const eventTypes = ref<EventType[]>(listEventTypes())

const choose = (eventType: EventType) => {
  router.push({ path: '/booking', query: { type: eventType.id } })
}
</script>

<template>
  <el-main class="page">
    <h1 class="page-title">Выбор типа события</h1>
    <p class="page-text">
      Выберите вид звонка — на следующем шаге останется подобрать удобное время.
    </p>

    <p v-if="eventTypes.length === 0" class="page-empty">
      Пока нет ни одного типа событий. Владелец календаря может создать их в разделе «Предстоящие
      события».
    </p>
    <ul v-else class="type-list">
      <li v-for="eventType in eventTypes" :key="eventType.id">
        <EventTypeCard
          class="type-card--selectable"
          :event-type="eventType"
          role="button"
          tabindex="0"
          @click="choose(eventType)"
          @keydown.enter.prevent="choose(eventType)"
        />
      </li>
    </ul>
  </el-main>
</template>

<style scoped>
.page {
  padding: 40px;
}

.page-title {
  margin: 0 0 12px;
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.page-text {
  margin: 0 0 24px;
  max-width: 640px;
  color: var(--el-text-color-secondary);
}

.page-empty {
  margin: 0;
  max-width: 640px;
  color: var(--el-text-color-secondary);
}

.type-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.type-card--selectable {
  cursor: pointer;
  transition: box-shadow 0.2s ease;
}

.type-card--selectable:hover,
.type-card--selectable:focus-visible {
  box-shadow: var(--el-box-shadow-light);
}
</style>
