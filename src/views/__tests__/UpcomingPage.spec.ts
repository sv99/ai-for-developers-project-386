import { beforeEach, describe, expect, it, vi } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'

import { createEventType, listEventTypes } from '@/api/eventTypes'

import UpcomingPage from '../UpcomingPage.vue'
import { fifteenMinutes, thirtyMinutes } from './fixtures'

vi.mock('@/api/eventTypes', () => ({
  createEventType: vi.fn(),
  listEventTypes: vi.fn(),
}))

const mockedCreate = vi.mocked(createEventType)
const mockedList = vi.mocked(listEventTypes)

const mountPage = () => mount(UpcomingPage)

const findInput = (wrapper: ReturnType<typeof mountPage>, placeholder: string) =>
  wrapper.find(`input[placeholder="${placeholder}"]`)

const findDurationInput = (wrapper: ReturnType<typeof mountPage>) =>
  wrapper.find('input[role="spinbutton"]')

const fillAndSubmit = async (
  wrapper: ReturnType<typeof mountPage>,
  overrides: { name?: string; description?: string; duration?: string } = {},
) => {
  await findInput(wrapper, 'Название').setValue(overrides.name ?? 'Встреча 30 минут')
  await findInput(wrapper, 'Описание').setValue(overrides.description ?? 'Базовый тип события.')
  await findDurationInput(wrapper).setValue(overrides.duration ?? '30')
  await findDurationInput(wrapper).trigger('change')
  await wrapper.find('form').trigger('submit')
  await flushPromises()
}

describe('UpcomingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedList.mockReturnValue([])
  })

  it('renders the owner heading and the event types section', () => {
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('Предстоящие события')
    expect(wrapper.text()).toContain('Типы событий')
  })

  it('starts with an empty list when there are no types yet', () => {
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('Пока нет ни одного типа событий')
  })

  it('lists existing event types with name, duration and description', () => {
    mockedList.mockReturnValue([fifteenMinutes, thirtyMinutes])
    const wrapper = mountPage()

    expect(wrapper.text()).toContain('Встреча 15 минут')
    expect(wrapper.text()).toContain('15 мин')
    expect(wrapper.text()).toContain('Короткий тип события для быстрого слота.')
    expect(wrapper.text()).toContain('Встреча 30 минут')
    expect(wrapper.text()).toContain('30 мин')
    expect(wrapper.text()).toContain('Базовый тип события для бронирования.')
  })

  it('creates an event type from the form and refreshes the list', async () => {
    mockedList.mockReturnValueOnce([]).mockReturnValueOnce([fifteenMinutes])
    mockedCreate.mockReturnValue(fifteenMinutes)
    const wrapper = mountPage()

    await fillAndSubmit(wrapper, {
      name: 'Встреча 15 минут',
      description: 'Короткий тип события для быстрого слота.',
      duration: '15',
    })

    expect(mockedCreate).toHaveBeenCalledWith({
      name: 'Встреча 15 минут',
      description: 'Короткий тип события для быстрого слота.',
      durationMinutes: 15,
    })
    expect(wrapper.text()).toContain('Встреча 15 минут')
  })

  it('clears the form after a successful create', async () => {
    mockedList.mockReturnValueOnce([]).mockReturnValueOnce([thirtyMinutes])
    mockedCreate.mockReturnValue(thirtyMinutes)
    const wrapper = mountPage()

    await fillAndSubmit(wrapper)

    expect(findInput(wrapper, 'Название').element as HTMLInputElement).toHaveProperty('value', '')
    expect(findInput(wrapper, 'Описание').element as HTMLInputElement).toHaveProperty('value', '')
  })

  it('does not submit an empty form', async () => {
    const wrapper = mountPage()

    await wrapper.find('form').trigger('submit')
    await flushPromises()

    expect(mockedCreate).not.toHaveBeenCalled()
  })
})
