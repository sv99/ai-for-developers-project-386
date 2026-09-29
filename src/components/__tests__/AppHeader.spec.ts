import { describe, it, expect } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

import BookingPage from '@/views/BookingPage.vue'
import EventsPage from '@/views/EventsPage.vue'
import LandingPage from '@/views/LandingPage.vue'

import AppHeader from '../AppHeader.vue'

const mountHeader = () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/', component: LandingPage },
      { path: '/booking', component: BookingPage },
      { path: '/events', component: EventsPage },
    ],
  })
  const wrapper = mount(AppHeader, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('AppHeader', () => {
  it('leads to the booking page from the «Записаться» link', async () => {
    const { wrapper, router } = mountHeader()
    await router.isReady()
    const bookingLink = wrapper.findAll('.el-link').find((link) => link.text() === 'Записаться')
    if (!bookingLink) throw new Error('Ссылка «Записаться» не найдена')
    await bookingLink.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/booking')
  })
})
