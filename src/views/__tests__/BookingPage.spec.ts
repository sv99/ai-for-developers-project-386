import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'

import BookingPage from '../BookingPage.vue'

describe('BookingPage', () => {
  it('renders the booking heading', () => {
    const wrapper = mount(BookingPage)
    expect(wrapper.text()).toContain('Запись на звонок')
  })
})
