import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { mount } from '@vue/test-utils'

import { listUpcomingBookings } from '@/api/bookings'
import { listEventTypes } from '@/api/eventTypes'
import type { Booking } from '@/api/types'

import MonthCalendar from '@/components/MonthCalendar.vue'
import UpcomingPage from '../UpcomingPage.vue'
import { thirtyMinutes } from './fixtures'

vi.mock('@/api/eventTypes', () => ({
  listEventTypes: vi.fn(),
}))

vi.mock('@/api/bookings', () => ({
  listUpcomingBookings: vi.fn(),
}))

const mockedListUpcoming = vi.mocked(listUpcomingBookings)
const mockedListTypes = vi.mocked(listEventTypes)

/** Сегодня — понедельник 28 сентября 2026; Записи стоят на среду и четверг. */
const TODAY = '2026-09-28'
const WEDNESDAY = '2026-09-30'
const THURSDAY = '2026-10-01'

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'bk-1',
  eventTypeId: thirtyMinutes.id,
  date: WEDNESDAY,
  startTime: '17:00',
  contact: { name: 'Анна', phone: '+7 900 000-00-00' },
  status: 'active',
  createdAt: '2026-09-27T10:00:00.000Z',
  ...overrides,
})

type Wrapper = ReturnType<typeof mountPage>

const mountPage = () => mount(UpcomingPage)

const pickDate = async (wrapper: Wrapper, date: string) => {
  wrapper.findComponent(MonthCalendar).vm.$emit('update:modelValue', date)
  await wrapper.vm.$nextTick()
}

const dayCell = (wrapper: Wrapper, day: number) =>
  wrapper
    .findAll('.day:not(.day--outside)')
    .find((cell) => cell.find('.day-number').text() === String(day))

const detail = (wrapper: Wrapper, label: string) => {
  const row = wrapper.findAll('.details-row').find((item) => item.find('dt').text() === label)
  return row?.find('dd').text()
}

describe('UpcomingPage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`${TODAY}T12:00:00`))
    vi.clearAllMocks()
    mockedListTypes.mockReturnValue([thirtyMinutes])
    mockedListUpcoming.mockReturnValue([])
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the journal placeholder when nothing is booked yet', () => {
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('Предстоящих Записей пока нет')
    expect(wrapper.text()).toContain('Выберите Запись в списке.')
    expect(wrapper.findAll('.booking')).toHaveLength(0)
  })

  it('asks to pick a date before showing the day', () => {
    mockedListUpcoming.mockReturnValue([booking()])
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('Выберите дату в календаре.')
    expect(wrapper.findAll('.booking')).toHaveLength(0)
  })

  it('lists the bookings of the picked day with time, event type and contact', async () => {
    mockedListUpcoming.mockReturnValue([booking(), booking({ id: 'bk-2', date: THURSDAY })])
    const wrapper = mountPage()

    await pickDate(wrapper, WEDNESDAY)

    expect(wrapper.text()).toContain('среда, 30 сентября')
    expect(wrapper.findAll('.booking')).toHaveLength(1)
    expect(wrapper.find('.booking-time').text()).toBe('17:00 - 17:30')
    expect(wrapper.find('.booking-type').text()).toBe('Встреча 30 минут')
    expect(wrapper.find('.booking-contact').text()).toBe('Анна, +7 900 000-00-00')
  })

  it('shows the details of the picked booking', async () => {
    mockedListUpcoming.mockReturnValue([booking()])
    const wrapper = mountPage()

    await pickDate(wrapper, WEDNESDAY)
    await wrapper.find('.booking').trigger('click')

    expect(detail(wrapper, 'Тип события')).toBe('Встреча 30 минут')
    expect(detail(wrapper, 'Дата')).toBe('30.09.2026')
    expect(detail(wrapper, 'Время')).toBe('17:00 - 17:30')
    expect(detail(wrapper, 'Имя')).toBe('Анна')
    expect(detail(wrapper, 'Телефон')).toBe('+7 900 000-00-00')
    expect(wrapper.find('.booking').classes()).toContain('booking--selected')
  })

  it('drops the picked booking when another day is picked', async () => {
    mockedListUpcoming.mockReturnValue([booking(), booking({ id: 'bk-2', date: THURSDAY })])
    const wrapper = mountPage()

    await pickDate(wrapper, WEDNESDAY)
    await wrapper.find('.booking').trigger('click')
    expect(detail(wrapper, 'Имя')).toBe('Анна')

    await pickDate(wrapper, THURSDAY)

    expect(wrapper.text()).toContain('Выберите Запись в списке.')
    expect(wrapper.findAll('.details-row')).toHaveLength(0)
  })

  it('counts the bookings of a day in the calendar and mutes the empty days', () => {
    mockedListUpcoming.mockReturnValue([
      booking({ startTime: '12:00' }),
      booking({ id: 'bk-2', startTime: '17:00' }),
    ])
    const wrapper = mountPage()

    expect(dayCell(wrapper, 30)?.find('.day-count').text()).toBe('2 зап.')
    expect(dayCell(wrapper, 30)?.classes()).not.toContain('day--muted')

    expect(dayCell(wrapper, 29)?.find('.day-count').text()).toBe('0 зап.')
    expect(dayCell(wrapper, 29)?.classes()).toContain('day--muted')
  })
})
