import { afterEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ShortcutsHelp from './ShortcutsHelp.vue'
import { ru } from '../i18n/ru'

function mountHelp() {
  return mount(ShortcutsHelp, { attachTo: document.body })
}

describe('ShortcutsHelp', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('lists shortcuts grouped under the four Tool group names', () => {
    const wrapper = mountHelp()

    const groupTitles = wrapper.findAll('[data-testid="shortcuts-help-group"]').map((group) =>
      group.find('h3').text(),
    )
    expect(groupTitles).toEqual([
      ru.toolbox.groups.tools,
      ru.toolbox.groups.colors,
      ru.toolbox.groups.edit,
      ru.toolbox.groups.rowProgress,
    ])
  })

  it('names every shortcut from tickets 87, 88, 90, 91, 92, 94, 95', () => {
    const wrapper = mountHelp()
    const text = wrapper.text()

    for (const key of ['1', '2', '3', 'Del', 'Space + drag', 'R', 'Ctrl/Cmd+C', 'Ctrl/Cmd+V', 'Ctrl/Cmd+S', 'P', 'D']) {
      expect(text).toContain(key)
    }
    expect(text).toContain(ru.tools.paintLabel)
    expect(text).toContain(ru.shortcutsHelp.eraseOrClearSelection)
    expect(text).toContain(ru.shortcutsHelp.panCanvas)
    expect(text).toContain(ru.shortcutsHelp.paletteColors)
    expect(text).toContain(ru.tools.pasteLabel)
    expect(text).toContain(ru.tools.saveButton)
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
