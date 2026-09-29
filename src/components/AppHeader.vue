<script setup lang="ts">
import { Calendar } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <el-header class="app-header">
    <RouterLink class="brand" to="/">
      <el-icon class="brand-icon" :size="28" color="#ff7a29">
        <Calendar />
      </el-icon>
      <span class="brand-name">Calendar</span>
    </RouterLink>
    <el-space :size="24" spacer-class="nav-links">
      <el-link underline="never" @click="router.push('/booking')">Записаться</el-link>
      <el-link underline="never" @click="router.push('/events')">Предстоящие события</el-link>
    </el-space>
  </el-header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 64px;
  padding: 0 40px;
  background-color: var(--el-fill-color-lighter);
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
}

.brand-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
</style>
