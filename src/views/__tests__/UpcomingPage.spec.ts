import { describe, expect, it } from 'vitest'

import { mount } from '@vue/test-utils'

import UpcomingPage from '../UpcomingPage.vue'

describe('UpcomingPage', () => {
  it('renders the owner heading and the journal placeholder', () => {
    const wrapper = mount(UpcomingPage)

    expect(wrapper.text()).toContain('Предстоящие события')
    expect(wrapper.text()).toContain('Журнал предстоящих Записей появится здесь')
  })
})
