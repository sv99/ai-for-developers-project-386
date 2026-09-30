import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'

import MonthCalendar from '../MonthCalendar.vue'

const TODAY = '2026-03-28'

const mountCalendar = (props: Record<string, unknown> = {}) =>
  mount(MonthCalendar, {
    props: { modelValue: '', counts: () => 18, today: TODAY, ...props },
  })

const dayInMonth = (wrapper: ReturnType<typeof mountCalendar>, number: number) =>
  wrapper
    .findAll('.day:not(.day--outside)')
    .find((cell) => cell.find('.day-number').text() === String(number))

describe('MonthCalendar', () => {
  it('shows the month, the weekday header and six weeks of days', () => {
    const wrapper = mountCalendar()

    expect(wrapper.find('.calendar-month').text()).toBe('март 2026 г.')
    expect(wrapper.findAll('.calendar-weekdays span').map((span) => span.text())).toEqual([
      'Пн',
      'Вт',
      'Ср',
      'Чт',
      'Пт',
      'Сб',
      'Вс',
    ])
    expect(wrapper.findAll('.day')).toHaveLength(42)
    expect(wrapper.findAll('.day--outside')).toHaveLength(11)
  })

  it('shows the free slots count for today and future days only', () => {
    const wrapper = mountCalendar()

    expect(wrapper.findAll('.day-free')).toHaveLength(9)
    expect(dayInMonth(wrapper, 28)?.find('.day-free').text()).toBe('18 св.')
    expect(dayInMonth(wrapper, 27)?.find('.day-free').exists()).toBe(false)
    expect(dayInMonth(wrapper, 27)?.classes()).toContain('day--muted')
  })

  it('renders a five week month and counts its trailing days', () => {
    const wrapper = mountCalendar({ today: '2026-09-30' })

    expect(wrapper.find('.calendar-month').text()).toBe('сентябрь 2026 г.')
    expect(wrapper.findAll('.day')).toHaveLength(35)
    expect(wrapper.findAll('.day-free')).toHaveLength(5)
    expect(wrapper.findAll('.day-free').map((item) => item.text())).toEqual([
      '18 св.',
      '18 св.',
      '18 св.',
      '18 св.',
      '18 св.',
    ])
  })

  it('emits the picked date', async () => {
    const wrapper = mountCalendar()

    await dayInMonth(wrapper, 30)?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['2026-03-30']])
  })

  it('does not pick a past day', async () => {
    const wrapper = mountCalendar()

    await dayInMonth(wrapper, 27)?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('does not pick a day without free slots', async () => {
    const wrapper = mountCalendar({ counts: (date: string) => (date === '2026-03-30' ? 0 : 18) })

    await dayInMonth(wrapper, 30)?.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('marks the selected day', () => {
    const wrapper = mountCalendar({ modelValue: '2026-03-30' })

    expect(dayInMonth(wrapper, 30)?.classes()).toContain('day--selected')
  })

  it('marks today apart from the other days', () => {
    const wrapper = mountCalendar()

    expect(dayInMonth(wrapper, 28)?.classes()).toContain('day--today')
    expect(dayInMonth(wrapper, 27)?.classes()).not.toContain('day--today')
    expect(dayInMonth(wrapper, 30)?.classes()).not.toContain('day--today')
  })

  it('moves to the next and previous month', async () => {
    const wrapper = mountCalendar()

    await wrapper.findAll('.nav-button')[1]?.trigger('click')
    expect(wrapper.find('.calendar-month').text()).toBe('апрель 2026 г.')

    await wrapper.findAll('.nav-button')[0]?.trigger('click')
    expect(wrapper.find('.calendar-month').text()).toBe('март 2026 г.')
  })
})
