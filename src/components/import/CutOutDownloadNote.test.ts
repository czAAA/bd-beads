import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import CutOutDownloadNote from './CutOutDownloadNote.vue'

beforeEach(() => localStorage.setItem('openbeads:locale', 'en'))

describe('the download note (ticket 0767)', () => {
  it('says it runs on the device, uploads nothing and downloads its size once, in whole MB', () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 59_187_000, lowMemory: false, lowSpace: false } })
    expect(wrapper.text()).toContain('Runs on this device: nothing is uploaded. Downloads 59 MB once.')
  })

  it('asks with Download, the AI-marked button, focused when it shows, and Cancel', async () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 59_187_000, lowMemory: false, lowSpace: false }, attachTo: document.body })
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

describe('the struggling device (ticket 0768)', () => {
  it('adds a line for memory under 4 GB and one for too little free space, the note still asking', () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 44_000_000, lowMemory: true, lowSpace: true } })
    expect(wrapper.get('[data-testid="cut-out-low-memory"]').text()).toBe('This device reports under 4\u00a0GB of memory, so it may be slow.')
    expect(wrapper.get('[data-testid="cut-out-low-space"]').text()).toBe(
      'This device reports too little free space for the download, so it may not finish.',
    )
    expect(wrapper.get('[data-testid="cut-out-download"]').text()).toBe('Download')
  })

  it('says neither where the checks found nothing', () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 44_000_000, lowMemory: false, lowSpace: false } })
    expect(wrapper.find('[data-testid="cut-out-low-memory"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cut-out-low-space"]').exists()).toBe(false)
  })

  it('with nothing to download, asks once more after a stopped run, with Try again', async () => {
    const wrapper = mount(CutOutDownloadNote, { props: { bytes: 0, lowMemory: false, lowSpace: false } })
    expect(wrapper.text()).toContain('The cut out stopped last time, probably for lack of memory on this device. Try again, or use Simple.')
    expect(wrapper.text()).not.toContain('AI')
    const again = wrapper.get('[data-testid="cut-out-download"]')
    expect(again.text()).toBe('Try again')
    await again.trigger('click')
    expect(wrapper.emitted('download')).toHaveLength(1)
  })
})
