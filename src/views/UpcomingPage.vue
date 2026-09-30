<script setup lang="ts">
import { reactive, ref } from 'vue'
import type { FormInstance, FormRules } from 'element-plus'

import { createEventType, listEventTypes } from '@/api/eventTypes'
import type { EventType } from '@/api/types'
import EventTypeCard from '@/components/EventTypeCard.vue'

const eventTypes = ref<EventType[]>(listEventTypes())
const createError = ref('')

const formRef = ref<FormInstance>()
const form = reactive<{ name: string; description: string; durationMinutes: number | undefined }>({
  name: '',
  description: '',
  durationMinutes: 30,
})

const rules: FormRules = {
  name: [
    { required: true, whitespace: true, message: 'Введите название типа события', trigger: 'blur' },
  ],
  durationMinutes: [
    { required: true, message: 'Укажите длительность в минутах', trigger: 'change' },
  ],
}

const refresh = () => {
  eventTypes.value = listEventTypes()
}

const onSubmit = async () => {
  createError.value = ''
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !form.durationMinutes) {
    return
  }
  try {
    createEventType({
      name: form.name,
      description: form.description,
      durationMinutes: form.durationMinutes,
    })
  } catch (error) {
    createError.value = error instanceof Error ? error.message : 'Не удалось создать тип события'
    return
  }
  formRef.value?.resetFields()
  refresh()
}
</script>

<template>
  <el-main class="page">
    <h1 class="page-title">Предстоящие события</h1>

    <section class="event-types" aria-label="Типы событий">
      <h2 class="section-title">Типы событий</h2>

      <p v-if="eventTypes.length === 0" class="section-empty">Пока нет ни одного типа событий.</p>
      <ul v-else class="type-list">
        <li v-for="eventType in eventTypes" :key="eventType.id">
          <EventTypeCard :event-type="eventType" />
        </li>
      </ul>

      <el-card class="create-card" shadow="never">
        <template #header>
          <span class="create-title">Новый тип события</span>
        </template>
        <el-form
          ref="formRef"
          :model="form"
          :rules="rules"
          label-position="top"
          @submit.prevent="onSubmit"
        >
          <el-form-item label="Название" prop="name">
            <el-input v-model="form.name" placeholder="Название" />
          </el-form-item>
          <el-form-item label="Описание" prop="description">
            <el-input v-model="form.description" placeholder="Описание" />
          </el-form-item>
          <el-form-item label="Длительность (минуты)" prop="durationMinutes">
            <el-input-number v-model="form.durationMinutes" :min="1" :precision="0" />
          </el-form-item>
          <p v-if="createError" class="create-error" role="alert">{{ createError }}</p>
          <el-button native-type="submit" type="primary">Создать</el-button>
        </el-form>
      </el-card>
    </section>
  </el-main>
</template>

<style scoped>
.page {
  padding: 40px;
}

.page-title {
  margin: 0 0 24px;
  font-size: 32px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.section-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.section-empty {
  margin: 0 0 24px;
  color: var(--el-text-color-secondary);
}

.type-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin: 0 0 24px;
  padding: 0;
  list-style: none;
}

.create-card {
  max-width: 520px;
  border-radius: 12px;
}

.create-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.create-error {
  margin: 0 0 16px;
  color: var(--el-color-danger);
}
</style>
