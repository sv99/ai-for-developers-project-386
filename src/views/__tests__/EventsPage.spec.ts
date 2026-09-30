import { beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

import { listEventTypes } from '@/api/eventTypes'

import BookingPage from '../BookingPage.vue'
import EventsPage from '../EventsPage.vue'
import { fifteenMinutes, thirtyMinutes } from './fixtures'

vi.mock('@/api/eventTypes', () => ({
  createEventType: vi.fn(),
  listEventTypes: vi.fn(),
}))

const mockedList = vi.mocked(listEventTypes)

const mountPage = async () => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/events', component: EventsPage },
      { path: '/booking', component: BookingPage },
    ],
  })
  await router.push('/events')
  await router.isReady()
  const wrapper = mount(EventsPage, { global: { plugins: [router] } })
  return { wrapper, router }
}

describe('EventsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockReturnValue([])
  })

  it('renders the host card with the type-choice heading and hint', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Владелец календаря')
    expect(wrapper.text()).toContain('Выберите тип события')
    expect(wrapper.text()).toContain('Нажмите на карточку, чтобы открыть календарь')
  })

  it('starts with an empty state when there are no types yet', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Пока нет ни одного типа событий')
  })

  it('lists existing types with name, duration and description', async () => {
    mockedList.mockReturnValue([fifteenMinutes, thirtyMinutes])
    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Встреча 15 минут')
    expect(wrapper.text()).toContain('15 мин')
    expect(wrapper.text()).toContain('Короткий тип события для быстрого слота.')
    expect(wrapper.text()).toContain('Встреча 30 минут')
    expect(wrapper.text()).toContain('30 мин')
  })

  it('leads to the booking page with the chosen type', async () => {
    mockedList.mockReturnValue([fifteenMinutes, thirtyMinutes])
    const { wrapper, router } = await mountPage()

    await wrapper.findAll('.type-card')[1]?.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.path).toBe('/booking')
    expect(router.currentRoute.value.query.type).toBe('et-2')
  })
})
