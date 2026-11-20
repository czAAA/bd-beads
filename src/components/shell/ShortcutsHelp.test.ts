import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import ShortcutsHelp from './ShortcutsHelp.vue'
import { en } from '../../i18n/en'
import { ru } from '../../i18n/ru'

beforeEach(() => {
  localStorage.setItem('openbeads:locale', 'en')
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

function mountHelp() {
  return mount(ShortcutsHelp, { attachTo: document.body })
}

/** Each group's rows as "name: keys spoken". */
function groups(wrapper: VueWrapper) {
  return wrapper.findAll('[data-testid="shortcuts-help-group"]').map((group) => ({
    title: group.get('h3').text(),
    rows: group.findAll('.shortcuts-help__row').map((row) => `${row.get('dt').text()}: ${row.get('.shortcuts-help__spoken').text()}`),
  }))
}

const onApple = () => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0)')

describe('ShortcutsHelp', () => {
  it('holds the card\'s groups in its order: tools, colors, edit, canvas, on a handle, row progress (ticket 1159)', () => {
    expect(groups(mountHelp()).map((group) => group.title)).toEqual([
      en.toolbox.groups.tools,
      en.toolbox.groups.colors,
      en.toolbox.groups.edit,
      en.shortcutsHelp.canvasGroup,
      en.shortcutsHelp.handleGroup,
      en.toolbox.groups.rowProgress,
    ])
  })

  it('lists the card\'s rows on an Apple keyboard, one chord each, and no row for `?` (ticket 1159)', () => {
    onApple()
    const [tools, colors, edit, canvas, handle, rowProgress] = groups(mountHelp()).map((group) => group.rows)
    expect(tools.map((row) => row.split(': ')[1])).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '⌘A', 'Esc'])
    expect(colors).toEqual(['A recent color: Shift+1…3', 'Palette colors 1 to 6: Shift+4…9', 'Palette color 7: Shift+0'])
    expect(edit).toEqual([
      'Undo: ⌘Z',
      'Redo: Shift+⌘Z',
      'Copy: ⌘C',
      'Cut: ⌘X',
      'Paste from clipboard: ⌘V',
      'Remove selected beads: ⌫',
      'Remove selected row/column: Shift+⌫',
      'Rotate: Shift+R',
      'Save Project file: ⌘S',
      'Save Project file as…: Shift+⌘S',
    ])
    expect(canvas).toEqual([
      'Rulers: R',
      'Reference image: I',
      'Zoom in: ⌘+',
      'Zoom out: ⌘−',
      'Fit: ⌘0',
      'Move the Canvas: Space+drag',
      'Move it from any tool: middle-drag',
      'Scroll the Canvas: wheel',
      'Scroll it sideways: Shift+wheel',
      'Zoom the Canvas: ⌘+wheel',
      'Zoom on a trackpad: pinch',
      'Tools at the pointer: right-click',
      'Tools at a finger or Pencil: hold',
    ])
    expect(handle).toEqual([
      'Move the selection, Piece or Mirror area: ←↑↓→',
      'Move the Frame: ←↑↓→',
      'Resize the Frame: Shift+←↑↓→',
      'Move the reference picture: ←↑↓→',
      '… ten beads at a time: Shift+←↑↓→',
      'Move a Palette color: ⌥+←→',
    ])
    expect(rowProgress.map((row) => row.split(': ')[1])).toEqual(['D', 'Enter', 'Shift+Enter'])
  })

  it('writes Ctrl, Alt and Del on any other keyboard, and Redo with its main chord only (tickets 0993, 1159)', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    const rows = groups(mountHelp()).flatMap((group) => group.rows)
    expect(rows).toEqual(expect.arrayContaining(['Redo: Ctrl+Shift+Z', 'Remove selected beads: Del', 'Move a Palette color: Alt+←→', 'Zoom the Canvas: Ctrl+wheel']))
  })

  it('says under the handle group\'s heading that the keys wait for a focused handle', () => {
    const handle = mountHelp().findAll('[data-testid="shortcuts-help-group"]')[4]
    expect(handle.get('.shortcuts-help__hint').text()).toBe(en.shortcutsHelp.handleHint)
  })

  it('draws every key as a chip and speaks each row\'s keys as one phrase', () => {
    onApple()
    const row = mountHelp().findAll('.shortcuts-help__row').find((each) => each.get('dt').text() === 'Resize the Frame')!
    expect(row.findAll('kbd').map((chip) => chip.text())).toEqual(['Shift', '←↑↓→'])
    expect(row.findAll('kbd').map((chip) => chip.classes())).toEqual([expect.arrayContaining(['kbd-chip--word']), expect.arrayContaining(['kbd-chip--arrows'])])
    expect(row.get('.shortcuts-help__spoken').text()).toBe('Shift+←↑↓→')
  })

  it('opens on the Show key hints switch, which reads the device and stores the first flip (ticket 438)', async () => {
    const wrapper = mountHelp()
    const toggle = wrapper.get('[data-testid="shortcuts-help-key-hints"]')
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-checked')).toBe('true')

    await toggle.trigger('click')
    expect(localStorage.getItem('openbeads:key-hints')).toBe('off')
    expect(wrapper.findAll('.shortcuts-help__row kbd').length).toBeGreaterThan(0) // the list's own chips stay
  })

  it('names its rows in the shown language', () => {
    localStorage.setItem('openbeads:locale', 'ru')
    const rows = groups(mountHelp()).flatMap((group) => group.rows)
    expect(rows).toEqual(expect.arrayContaining([`${ru.shortcutsHelp.moveFrame}: ←↑↓→`, `${ru.shortcutsHelp.recentColor}: Shift+1…3`]))
  })
})
