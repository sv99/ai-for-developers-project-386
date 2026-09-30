<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { FormInstance, FormRules } from 'element-plus'

import { createBooking } from '@/api/bookings'
import { listEventTypes } from '@/api/eventTypes'
import { listStartTimes } from '@/api/slots'
import type { Booking, EventType } from '@/api/types'
import EventTypeCard from '@/components/EventTypeCard.vue'

const route = useRoute()
const router = useRouter()

const eventTypes = listEventTypes()
const eventType = computed<EventType | undefined>(() =>
  eventTypes.find((type) => type.id === route.query.type),
)

const startTimes = listStartTimes()

const pad = (value: number) => String(value).padStart(2, '0')
const today = () => {
  const now = new Date()
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

const formatDate = (iso: string) => {
  const [year = '', month = '', day = ''] = iso.split('-')
  return `${day}.${month}.${year}`
}

const formRef = ref<FormInstance>()
const form = reactive({ date: today(), startTime: '', name: '', phone: '' })

const rules: FormRules = {
  date: [{ required: true, message: 'Выберите дату', trigger: 'change' }],
  startTime: [{ required: true, message: 'Выберите время начала', trigger: 'change' }],
  name: [{ required: true, whitespace: true, message: 'Введите имя', trigger: 'blur' }],
  phone: [
    {
      validator: (_rule, value: string, callback) => {
        const phone = String(value ?? '').trim()
        if (!phone) {
          callback(new Error('Введите телефон'))
          return
        }
        if (phone.replace(/\D/g, '').length < 10) {
          callback(new Error('Проверьте телефон — минимум 10 цифр'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

const confirmation = ref<Booking | null>(null)
const submitError = ref('')

const onSubmit = async () => {
  submitError.value = ''
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid || !eventType.value) {
    return
  }
  try {
    confirmation.value = createBooking({
      eventTypeId: eventType.value.id,
      date: form.date,
      startTime: form.startTime,
      contact: { name: form.name, phone: form.phone },
    })
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : 'Не удалось записаться. Попробуйте ещё раз.'
  }
}
</script>

<template>
  <el-main class="page">
    <h1 class="page-title">Запись на звонок</h1>

    <template v-if="!eventType">
      <p class="page-text">Сначала выберите тип события.</p>
      <el-button type="primary" @click="router.push('/events')">Выбрать тип события</el-button>
    </template>

    <el-card v-else-if="confirmation" class="confirmation" shadow="never">
      <h2 class="confirmation-title">Запись подтверждена</h2>
      <dl class="confirmation-list">
        <div class="confirmation-row">
          <dt>Тип события</dt>
          <dd>{{ eventType.name }}</dd>
        </div>
        <div class="confirmation-row">
          <dt>Дата</dt>
          <dd>{{ formatDate(confirmation.date) }}</dd>
        </div>
        <div class="confirmation-row">
          <dt>Время</dt>
          <dd>{{ confirmation.startTime }}</dd>
        </div>
        <div class="confirmation-row">
          <dt>Имя</dt>
          <dd>{{ confirmation.contact.name }}</dd>
        </div>
        <div class="confirmation-row">
          <dt>Телефон</dt>
          <dd>{{ confirmation.contact.phone }}</dd>
        </div>
      </dl>
      <el-button type="primary" @click="router.push('/events')">Записаться ещё</el-button>
    </el-card>

    <template v-else>
      <EventTypeCard
        class="type-summary"
        :event-type="eventType"
        aria-label="Выбранный тип события"
      />

      <el-form
        ref="formRef"
        class="booking-form"
        :model="form"
        :rules="rules"
        label-position="top"
        @submit.prevent="onSubmit"
      >
        <el-form-item label="Дата" prop="date">
          <el-date-picker
            v-model="form.date"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="Выберите дату"
          />
        </el-form-item>
        <el-form-item label="Время начала" prop="startTime">
          <el-radio-group v-model="form.startTime" class="slot-grid">
            <el-radio-button v-for="time in startTimes" :key="time" :value="time">
              {{ time }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="Имя" prop="name">
          <el-input v-model="form.name" placeholder="Имя" />
        </el-form-item>
        <el-form-item label="Телефон" prop="phone">
          <el-input v-model="form.phone" placeholder="Телефон" />
        </el-form-item>
        <p v-if="submitError" class="submit-error" role="alert">{{ submitError }}</p>
        <el-button native-type="submit" type="primary">Записаться</el-button>
      </el-form>
    </template>
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
  color: var(--el-text-color-secondary);
}

.type-summary {
  max-width: 640px;
  margin-bottom: 24px;
}

.booking-form {
  max-width: 640px;
}

.slot-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.slot-grid :deep(.el-radio-button__inner) {
  border-radius: 6px;
  border-left: 1px solid var(--el-border-color);
}

.submit-error {
  margin: 0 0 16px;
  color: var(--el-color-danger);
}

.confirmation {
  --el-card-border-color: var(--el-border-color);

  max-width: 640px;
  border-radius: 12px;
}

.confirmation-title {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.confirmation-list {
  margin: 0 0 20px;
}

.confirmation-row {
  display: flex;
  gap: 12px;
  padding: 6px 0;
}

.confirmation-row dt {
  min-width: 140px;
  color: var(--el-text-color-secondary);
}

.confirmation-row dd {
  margin: 0;
  color: var(--el-text-color-primary);
}
</style>
