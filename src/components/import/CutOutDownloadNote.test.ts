import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CutOutDownloadNote from './CutOutDownloadNote.vue'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))

describe('the download note (ticket 0767)', () => {
  it('says it runs on the device, uploads nothing and downloads its size once, in whole MB', () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 59_187_000 } })
    expect(wrapper.text()).toContain('Runs on this device: nothing is uploaded. Downloads 59 MB once.')
  })

  it('asks with Download, the AI-marked button, focused when it shows, and Cancel', async () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 59_187_000 }, attachTo: document.body })
    const download = wrapper.get('[data-testid="cut-out-download"]')
    expect(document.activeElement).toBe(download.element)
    expect(download.find('[data-icon="cut-out-ai"]').exists()).toBe(true)

    await download.trigger('click')
    await wrapper.get('[data-testid="cut-out-download-cancel"]').trigger('click')
    expect(wrapper.emitted('download')).toHaveLength(1)
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
})
