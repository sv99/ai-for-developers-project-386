<script setup lang="ts">
import { ArrowRight } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()

const features = [
  'Фиксированные 30-минутные слоты с 09:00 до 18:00.',
  'Проверка конфликтов при бронировании.',
  'Просмотр предстоящих событий в отдельном разделе.',
]
</script>

<template>
  <el-main class="landing-main">
    <el-row :gutter="40" align="middle" class="hero">
      <el-col :xs="24" :md="12">
        <el-tag class="hero-tag" round>Быстрая запись на звонок</el-tag>
        <h1 class="hero-title">Calendar</h1>
        <p class="hero-text">
          Один экран, понятные слоты, быстрая бронь. Выберите время и запишитесь на звонок без
          лишних шагов.
        </p>
        <el-button class="hero-button" size="large" round @click="router.push('/events')">
          Записаться
          <el-icon class="hero-button-icon"><ArrowRight /></el-icon>
        </el-button>
      </el-col>
      <el-col :xs="24" :md="12">
        <el-card class="features-card" shadow="never">
          <template #header>
            <span class="features-title">Что доступно прямо сейчас</span>
          </template>
          <ul class="features-list">
            <li v-for="feature in features" :key="feature" class="features-item">
              {{ feature }}
            </li>
          </ul>
        </el-card>
      </el-col>
    </el-row>
  </el-main>
</template>

<style scoped>
.landing-main {
  padding: 0;
  height: calc(100vh - 64px);
  overflow: hidden;
  background: linear-gradient(to right, #e8f2fb 0%, #f7f7f8 55%, #fdf0e8 100%);
}

.hero {
  height: 100%;
  padding: 40px;
}

.hero-tag {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-title {
  margin: 24px 0 16px;
  font-size: 64px;
  font-weight: 800;
  line-height: 1.1;
  color: var(--el-color-info-dark-2);
}

.hero-text {
  max-width: 480px;
  margin-bottom: 32px;
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

.hero-button {
  font-weight: 700;
}

.hero-button-icon {
  margin-left: 8px;
}

.features-card {
  max-width: 520px;
  border: 1px solid var(--el-border-color);
  border-radius: 12px;
}

.features-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}

.features-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.features-item {
  position: relative;
  padding-left: 20px;
  color: var(--el-text-color-secondary);
  line-height: 1.8;
}

.features-item + .features-item {
  margin-top: 12px;
}

.features-item::before {
  content: '';
  position: absolute;
  top: 0.7em;
  left: 4px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background-color: var(--el-text-color-secondary);
}

@media (max-width: 991px) {
  .landing-main {
    height: auto;
    min-height: calc(100vh - 64px);
  }

  .hero {
    height: auto;
    min-height: calc(100vh - 64px);
    padding: 24px;
  }

  .hero-title {
    font-size: 44px;
  }
}
</style>
