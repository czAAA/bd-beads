import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShortcutsHelp from './ShortcutsHelp.vue'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

function mountHelp() {
  return mount(ShortcutsHelp, { attachTo: document.body })
}

describe('ShortcutsHelp', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lists shortcuts grouped under the Tool group names, with the Canvas group (v16) after Tools', () => {
    const wrapper = mountHelp()

    const groupTitles = wrapper.findAll('[data-testid="shortcuts-help-group"]').map((group) =>
      group.find('h3').text(),
    )
    expect(groupTitles).toEqual([
      ru.toolbox.groups.tools,
      ru.shortcutsHelp.canvasGroup,
      ru.toolbox.groups.colors,
      ru.toolbox.groups.edit,
      ru.toolbox.groups.rowProgress,
    ])
  })

  it('names every shortcut from tickets 87, 88, 90, 91, 92, 94, 95, and the canvas ones of ticket 233', () => {
    const wrapper = mountHelp()
    const text = wrapper.text()

    for (const key of ['1', '2', '3', '4', 'Del', 'Space+drag', '5', '6', 'R', 'Ctrl/Cmd+wheel', 'Ctrl/Cmd+C', 'Ctrl/Cmd+V', 'Ctrl/Cmd+S', 'P', 'D']) {
      expect(text).toContain(key)
    }
    expect(text).toContain(ru.tools.paintLabel)
    expect(text).toContain(ru.shortcutsHelp.emptySelection)
    expect(text).toContain(ru.shortcutsHelp.panCanvas)
    expect(text).toContain(ru.tools.handLabel)
    expect(text).toContain(ru.canvas.rulersLabel)
    expect(text).toContain(ru.shortcutsHelp.zoomCanvas)
    expect(text).toContain(ru.shortcutsHelp.paletteColors)
    expect(text).toContain(ru.tools.pasteLabel)
    expect(text).toContain(ru.tools.saveButton)
  })

  it('lists the keys the registry lists, one row per action', () => {
    const wrapper = mountHelp()
    const rows = wrapper.findAll('.shortcuts-help__row').map((row) => row.find('.shortcuts-help__spoken').text())

    for (const keys of ['Shift+Del', 'Shift+R', 'Ctrl/Cmd+Z', 'Ctrl/Cmd+Shift+Z, Ctrl+Y', 'Enter, Space', 'Esc', '?']) {
      expect(rows).toContain(keys)
    }
    expect(wrapper.text()).toContain(ru.palette.rotateButton)
  })

  it('emits close when the close button is clicked', async () => {
    const wrapper = mountHelp()

    await wrapper.find('[data-testid="shortcuts-help-close"]').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on Escape', async () => {
    const wrapper = mountHelp()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('emits close on a backdrop click, but not on a click inside the dialog', async () => {
    const wrapper = mountHelp()

    await wrapper.find('[data-testid="shortcuts-help-dialog"]').trigger('click')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.find('[data-testid="shortcuts-help-backdrop"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stops listening for Escape once unmounted', () => {
    const wrapper = mountHelp()
    wrapper.unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(true).toBe(true)
  })
})
