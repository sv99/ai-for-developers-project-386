import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import LandingPage from '../LandingPage.vue'

describe('LandingPage', () => {
  it('renders the brand and hero heading', () => {
    const wrapper = mount(LandingPage)
    expect(wrapper.text()).toContain('Calendar')
    expect(wrapper.text()).toContain('Один экран, понятные слоты')
  })

  it('renders the features card', () => {
    const wrapper = mount(LandingPage)
    expect(wrapper.text()).toContain('Что доступно прямо сейчас')
    expect(wrapper.text()).toContain('30-минутные слоты')
  })
})
