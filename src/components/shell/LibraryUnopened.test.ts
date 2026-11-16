import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { en } from '../../i18n/en'
import LibraryUnopened from './LibraryUnopened.vue'

describe('LibraryUnopened', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('says the Projects on this device could not be opened and offers one action, Reload', async () => {
    const reload = vi.fn()
    vi.stubGlobal('location', { ...window.location, reload })
    const wrapper = mount(LibraryUnopened)

    expect(wrapper.get('[data-testid="library-unopened-message"]').text()).toBe(en.storage.libraryUnopened)
    expect(wrapper.findAll('button').map((button) => button.text())).toEqual([en.storage.reload])
    await wrapper.get('[data-testid="library-unopened-reload"]').trigger('click')
    expect(reload).toHaveBeenCalledOnce()
  })
})
