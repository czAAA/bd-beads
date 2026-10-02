import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SaveBox from './SaveBox.vue'
import { en } from '../../i18n/en'

beforeEach(() => localStorage.setItem('bd-beads:locale', 'en'))

function mountBox(props: Record<string, unknown> = {}) {
  return mount(SaveBox, { props: { saveFailed: false, ...props }, attachTo: document.body })
}

async function openMenu(wrapper: ReturnType<typeof mountBox>) {
  await wrapper.find('[data-testid="export-menu-button"]').trigger('click')
}

describe('SaveBox (ticket 148)', () => {
  it('says the library is saved on this device, with a check', () => {
    const wrapper = mountBox()

    const state = wrapper.find('[data-testid="save-state"]')
    expect(state.text()).toBe(en.saveBox.savedState)
    expect(state.find('[data-icon="check"]').exists()).toBe(true)
    expect(state.classes()).not.toContain('save-box__state--failed')
  })

  it('turns to a danger warning when a save fails', () => {
    const state = mountBox({ saveFailed: true }).find('[data-testid="save-state"]')

    expect(state.text()).toBe(en.saveBox.failedState)
    expect(state.find('[data-icon="warning"]').exists()).toBe(true)
    expect(state.classes()).toContain('save-box__state--failed')
  })

  it('has Save Pattern as its primary action, naming its shortcut, and asks for a save', async () => {
    const wrapper = mountBox()
    const save = wrapper.find('[data-testid="save-button"]')

    expect(save.text()).toBe(en.saveBox.saveButton)
    expect(save.classes()).toContain('app-button--primary')
    expect(save.attributes('title')).toContain('Ctrl/Cmd+S')
    await save.trigger('click')
    expect(wrapper.emitted('save')).toHaveLength(1)
  })

  it('opens the Export menu with QR code, PNG image and PDF for printing, and the formats hint beside it', async () => {
    const wrapper = mountBox()
    expect(wrapper.find('[data-testid="export-formats"]').text()).toBe('qr · png · pdf')

    await openMenu(wrapper)

    const items = wrapper.findAll('[role="menuitem"]').map((item) => item.text())
    // Then the name on exports row (ticket 161).
    expect(items).toEqual([en.saveBox.menuQr, en.saveBox.menuPng, en.saveBox.menuPdf, en.saveBox.addName])
  })

  it.each([
    ['export-qr', 'export-qr'],
    ['export-png', 'export-png'],
    ['export-pdf', 'export-pdf'],
  ])('asks for %s from its menu item, closing the menu', async (testId, event) => {
    const wrapper = mountBox()
    await openMenu(wrapper)

    await wrapper.find(`[data-testid="${testId}"]`).trigger('click')

    expect(wrapper.emitted(event)).toHaveLength(1)
    expect(wrapper.find('[role="menu"]').exists()).toBe(false)
  })

  it('turns QR code off for a Pattern too large for one, saying why in words', async () => {
    const wrapper = mountBox({ qrTooLarge: true })
    await openMenu(wrapper)

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-qr"]').element.disabled).toBe(true)
    expect(wrapper.find('[data-testid="export-qr-reason"]').text()).toBe(en.transfer.qrTooLargeMessage)
    await wrapper.find('[data-testid="export-qr"]').trigger('click')
    expect(wrapper.emitted('export-qr')).toBeUndefined()
  })

  it('holds PNG and PDF while one is being drawn', async () => {
    const wrapper = mountBox({ exporting: 'pdf' })
    await openMenu(wrapper)

    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-png"]').element.disabled).toBe(true)
    expect(wrapper.find<HTMLButtonElement>('[data-testid="export-pdf"]').element.disabled).toBe(true)
  })
})

describe('SaveBox ways out (ticket 158)', () => {
  it('offers Export Pattern under the QR reason when the Pattern is too large for a code', async () => {
    const wrapper = mountBox({ qrTooLarge: true })
    await openMenu(wrapper)

    await wrapper.find('[data-testid="export-qr-way-out"]').trigger('click')

    expect(wrapper.emitted('export-pattern')).toHaveLength(1)
  })
})
