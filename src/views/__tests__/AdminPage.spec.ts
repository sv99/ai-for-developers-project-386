import { beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'

import { createEventType, listEventTypes } from '@/api/eventTypes'
import { getCalendarName, setCalendarName } from '@/api/settings'

import AdminPage from '../AdminPage.vue'
import { fifteenMinutes, thirtyMinutes } from './fixtures'

vi.mock('@/api/eventTypes', () => ({
  createEventType: vi.fn(),
  listEventTypes: vi.fn(),
}))

vi.mock('@/api/settings', () => ({
  DEFAULT_CALENDAR_NAME: 'Владелец',
  getCalendarName: vi.fn(),
  setCalendarName: vi.fn(),
}))

const mockedCreate = vi.mocked(createEventType)
const mockedList = vi.mocked(listEventTypes)
const mockedGetName = vi.mocked(getCalendarName)
const mockedSetName = vi.mocked(setCalendarName)

const mountPage = async () => {
  const wrapper = mount(AdminPage)
  await flushPromises()
  return wrapper
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>

const nameInput = (wrapper: Wrapper) => wrapper.find('input[placeholder="Имя календаря"]')

const nameForm = (wrapper: Wrapper) => wrapper.find('form.form--calendar')
const typesForm = (wrapper: Wrapper) => wrapper.find('form.form--types')

describe('AdminPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockResolvedValue([])
    mockedGetName.mockResolvedValue('Владелец')
    mockedSetName.mockResolvedValue(undefined)
    mockedCreate.mockResolvedValue(fifteenMinutes)
  })

  it('renders the settings sections', async () => {
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Настройки')
    expect(wrapper.text()).toContain('Календарь')
    expect(wrapper.text()).toContain('Типы событий')
  })

  it('shows the current calendar name', async () => {
    mockedGetName.mockResolvedValue('Команда Тота')
    const wrapper = await mountPage()

    expect((nameInput(wrapper).element as HTMLInputElement).value).toBe('Команда Тота')
  })

  it('saves a new calendar name', async () => {
    const wrapper = await mountPage()

    await nameInput(wrapper).setValue('Команда Тота')
    await nameForm(wrapper).trigger('submit')
    await flushPromises()

    expect(mockedSetName).toHaveBeenCalledWith('Команда Тота')
    expect(wrapper.text()).toContain('Имя календаря сохранено')
  })

  it('does not save an empty calendar name', async () => {
    const wrapper = await mountPage()

    await nameInput(wrapper).setValue('   ')
    await nameForm(wrapper).trigger('submit')
    await flushPromises()

    expect(mockedSetName).not.toHaveBeenCalled()
  })

  it('lists existing event types', async () => {
    mockedList.mockResolvedValue([fifteenMinutes, thirtyMinutes])
    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('Встреча 15 минут')
    expect(wrapper.text()).toContain('15 мин')
    expect(wrapper.text()).toContain('Встреча 30 минут')
    expect(wrapper.text()).toContain('30 мин')
  })

  it('adds an event type from the form and refreshes the list', async () => {
    mockedList.mockResolvedValueOnce([]).mockResolvedValueOnce([fifteenMinutes])
    const wrapper = await mountPage()

    await wrapper.find('input[placeholder="Название"]').setValue('Встреча 15 минут')
    await wrapper
      .find('input[placeholder="Описание"]')
      .setValue('Короткий тип события для быстрого слота.')
    const duration = wrapper.find('input[role="spinbutton"]')
    await duration.setValue('15')
    await duration.trigger('change')
    await typesForm(wrapper).trigger('submit')
    await flushPromises()

    expect(mockedCreate).toHaveBeenCalledWith({
      name: 'Встреча 15 минут',
      description: 'Короткий тип события для быстрого слота.',
      durationMinutes: 15,
    })
    expect(wrapper.text()).toContain('Встреча 15 минут')
  })

  it('does not add an empty event type', async () => {
    const wrapper = await mountPage()

    await typesForm(wrapper).trigger('submit')
    await flushPromises()

    expect(mockedCreate).not.toHaveBeenCalled()
  })
})
