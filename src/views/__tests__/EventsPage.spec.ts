import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'

import EventsPage from '../EventsPage.vue'

describe('EventsPage', () => {
  it('renders the events heading', () => {
    const wrapper = mount(EventsPage)
    expect(wrapper.text()).toContain('Предстоящие события')
    expect(wrapper.text()).toContain('Раздел скоро появится')
  })
})
