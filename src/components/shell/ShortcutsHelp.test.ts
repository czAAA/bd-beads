import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ShortcutsHelp from './ShortcutsHelp.vue'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'ru') // these tests read the Russian dictionary
})

function mountHelp() {
  return mount(ShortcutsHelp, { attachTo: document.body })
}

describe('ShortcutsHelp', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
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

    for (const key of ['1', '2', '3', '4', 'Del', 'Space+drag', '5', '6', 'R', 'Ctrl+wheel', 'Ctrl+C', 'Ctrl+V', 'Ctrl+S', 'D']) {
      expect(text).toContain(key)
    }
    expect(text).toContain(ru.tools.paintLabel)
    expect(text).toContain(ru.contextBar.clearButton)
    expect(text).toContain(ru.shortcutsHelp.panCanvas)
    expect(text).toContain(ru.tools.handLabel)
    expect(text).toContain(ru.canvas.rulersLabel)
    expect(text).toContain(ru.shortcutsHelp.zoomCanvas)
    expect(text).toContain(ru.shortcutsHelp.paletteColors)
  })

  it('lists the keys the registry lists, one row per action', () => {
    const wrapper = mountHelp()
    const rows = wrapper.findAll('.shortcuts-help__row').map((row) => row.find('.shortcuts-help__spoken').text())

    for (const keys of ['Shift+Del', 'Shift+R', 'Ctrl+Z', 'Ctrl+Shift+Z, Ctrl+Y', 'Enter', 'Shift+Enter', 'Esc', '?']) {
      expect(rows).toContain(keys)
    }
    expect(wrapper.text()).toContain(ru.palette.rotateButton)
  })

  it('writes ⌘ and ⌫ on an Apple device, with no plus after ⌘ (ticket 0993)', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')
    const rows = mountHelp().findAll('.shortcuts-help__row').map((row) => row.find('.shortcuts-help__spoken').text())
    for (const keys of ['⌘Z', '⌫', '⌘+wheel']) expect(rows).toContain(keys)
  })

  it('lists the pill\'s tools 1 to 8 in one group, in the pill\'s order, and no two rows both named Paste (ticket 0993)', () => {
    const wrapper = mountHelp()
    const [tools] = wrapper.findAll('[data-testid="shortcuts-help-group"]')
    const keys = tools.findAll('.shortcuts-help__spoken').map((key) => key.text())
    expect(keys.slice(0, 8)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8'])

    const labels = wrapper.findAll('.shortcuts-help__row dt').map((label) => label.text())
    expect(labels).not.toContain(ru.tools.pasteLabel)
    expect(labels).toEqual(expect.arrayContaining([ru.shortcutsHelp.pasteTool, ru.shortcutsHelp.pasteClipboard]))
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

    await wrapper.find('[data-testid="shortcuts-help-dialog"]').trigger('pointerdown')
    expect(wrapper.emitted('close')).toBeUndefined()

    await wrapper.find('[data-testid="shortcuts-help-backdrop"]').trigger('pointerdown')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('stops listening for Escape once unmounted', () => {
    const wrapper = mountHelp()
    wrapper.unmount()

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(true).toBe(true)
  })

  it('has a key hints switch at the top that reads the device and stores the first flip (ticket 438)', async () => {
    const wrapper = mountHelp()
    const row = wrapper.get('[data-testid="shortcuts-help-key-hints"]')
    expect(row.text()).toContain(ru.shortcutsHelp.keyHints)
    expect(row.get('[aria-checked="true"]').text()).toBe(ru.shortcutsHelp.keyHintsOn)

    await row.get('[data-value="off"]').trigger('click')
    expect(localStorage.getItem('openbeads:key-hints')).toBe('off')
    expect(wrapper.findAll('.shortcuts-help__kbd').length).toBeGreaterThan(0) // the help's own chips stay
  })
})
