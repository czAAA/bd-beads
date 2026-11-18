import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { en } from '../../i18n/en'
import PageNotFound from './PageNotFound.vue'

describe('PageNotFound (ticket 1053)', () => {
  it('says there is no page at the address and leads to the Homepage at the main address', () => {
    const wrapper = mount(PageNotFound, { props: { homepage: '/' } })

    expect(wrapper.get('[data-testid="page-not-found-message"]').text()).toBe(en.homepage.notFound)
    const link = wrapper.get('[data-testid="page-not-found-homepage"]')
    expect(link.element.tagName).toBe('A')
    expect(link.attributes('href')).toBe('/')
    expect(link.text()).toBe(en.homepage.notFoundHomepage)
  })
})
