import { beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createRouter, createWebHistory } from 'vue-router'

import { createBooking } from '@/api/bookings'
import { listEventTypes } from '@/api/eventTypes'

import BookingPage from '../BookingPage.vue'
import EventsPage from '../EventsPage.vue'
import { thirtyMinutes } from './fixtures'

vi.mock('@/api/eventTypes', () => ({
  createEventType: vi.fn(),
  listEventTypes: vi.fn(),
}))

vi.mock('@/api/bookings', () => ({
  createBooking: vi.fn(),
}))

const mockedListTypes = vi.mocked(listEventTypes)
const mockedCreateBooking = vi.mocked(createBooking)

const mountPage = async (query: Record<string, string> = { type: thirtyMinutes.id }) => {
  const router = createRouter({
    history: createWebHistory(),
    routes: [
      { path: '/events', component: EventsPage },
      { path: '/booking', component: BookingPage },
    ],
  })
  await router.push({ path: '/booking', query })
  await router.isReady()
  const wrapper = mount(BookingPage, { global: { plugins: [router] } })
  return { wrapper, router }
}

const pickTime = async (
  wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'],
  time: string,
) => {
  const button = wrapper.findAll('.el-radio-button').find((item) => item.text() === time)
  if (!button) throw new Error(`Время ${time} не найдено`)
  await button.find('input').setValue(true)
}

const fillContact = async (
  wrapper: Awaited<ReturnType<typeof mountPage>>['wrapper'],
  name = 'Анна',
  phone = '+7 900 000-00-00',
) => {
  await wrapper.find('input[placeholder="Имя"]').setValue(name)
  await wrapper.find('input[placeholder="Телефон"]').setValue(phone)
}

describe('BookingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedListTypes.mockReturnValue([thirtyMinutes])
  })

  it('asks to choose a type when none is selected', async () => {
    const { wrapper } = await mountPage({})

    expect(wrapper.text()).toContain('Сначала выберите тип события')
  })

  it('shows the chosen type with description and duration', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.text()).toContain('Встреча 30 минут')
    expect(wrapper.text()).toContain('30 мин')
    expect(wrapper.text()).toContain('Базовый тип события для бронирования.')
  })

  it('offers 30-minute start times across the 09:00–18:00 window', async () => {
    const { wrapper } = await mountPage()

    expect(wrapper.findAll('.el-radio-button')).toHaveLength(18)
    expect(wrapper.text()).toContain('09:00')
    expect(wrapper.text()).toContain('09:30')
    expect(wrapper.text()).toContain('17:30')
  })

  it('creates a booking and shows the confirmation details', async () => {
    const { wrapper } = await mountPage()
    mockedCreateBooking.mockReturnValue({
      id: 'bk-1',
      eventTypeId: thirtyMinutes.id,
      date: '2026-10-05',
      startTime: '10:00',
      contact: { name: 'Анна', phone: '+7 900 000-00-00' },
      status: 'active',
      createdAt: '2026-10-01T00:00:00.000Z',
    })

    await pickTime(wrapper, '10:00')
    await fillContact(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockedCreateBooking).toHaveBeenCalledWith({
      eventTypeId: thirtyMinutes.id,
      date: expect.any(String),
      startTime: '10:00',
      contact: { name: 'Анна', phone: '+7 900 000-00-00' },
    })
    expect(wrapper.text()).toContain('Запись подтверждена')
    expect(wrapper.text()).toContain('Встреча 30 минут')
    expect(wrapper.text()).toContain('05.10.2026')
    expect(wrapper.text()).toContain('10:00')
    expect(wrapper.text()).toContain('Анна')
    expect(wrapper.text()).toContain('+7 900 000-00-00')
  })

  it('does not submit without a start time and a contact', async () => {
    const { wrapper } = await mountPage()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockedCreateBooking).not.toHaveBeenCalled()
  })

  it('rejects a too short phone next to the field', async () => {
    const { wrapper } = await mountPage()

    await pickTime(wrapper, '10:00')
    await fillContact(wrapper, 'Анна', '123')
    await wrapper.find('form').trigger('submit')
    await flushPromises()
    // Element Plus показывает текст ошибки через debounce (refDebounced, 100 мс).
    await new Promise((resolve) => setTimeout(resolve, 150))

    expect(mockedCreateBooking).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Проверьте телефон')
  })

  it('shows a friendly message when the time is already taken', async () => {
    const { wrapper } = await mountPage()
    mockedCreateBooking.mockImplementation(() => {
      throw new Error('Это время уже занято. Выберите другое время.')
    })

    await pickTime(wrapper, '10:00')
    await fillContact(wrapper)
    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(wrapper.text()).toContain('Это время уже занято')
    expect(wrapper.text()).not.toContain('Запись подтверждена')
  })
})
