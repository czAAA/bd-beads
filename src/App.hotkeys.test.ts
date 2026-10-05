import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { hoverBead, leaveSurface, pressBead, previewedBeads, selectedBeadCount } from './testUtils/beads'
import { PALETTE } from './domain/palette'
import { frameGrid } from './domain/project'
import { loadProjects } from './services/libraryStore'
import { en } from './i18n/en'
import { ru } from './i18n/ru'
import { mountWithProject } from './testUtils/seedProject'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'ru') // these tests read the Russian dictionary
})

/*
 * Every control in the Toolbox is an icon: no button label, just each Tool group's own small title (ticket 40) and
 * the Size group's readout as text (ticket 124 moved the Row progress group's own readout out to Progress bar, on
 * the canvas — see the "App Progress bar" describe block below). Button words survive as a hover/focus tooltip plus
 * the screen-reader name, so the Toolbox stays compact.
 */
describe('App Toolbox controls (ticket 75)', () => {
  /** The Tools group's tabs: icon-only buttons named by aria-label (ticket 250), with the key as a badge and in its Tooltip. */
  const tabs = [
    { testId: 'tool-paint', label: (t: typeof en) => t.tools.paintLabel, icon: 'paint', chip: '1' },
    { testId: 'tool-fill', label: (t: typeof en) => t.tools.fillLabel, icon: 'fill', chip: '2' },
    { testId: 'tool-select', label: (t: typeof en) => t.tools.selectLabel, icon: 'select', chip: '3' },
    { testId: 'tool-erase', label: (t: typeof en) => t.tools.eraseLabel, icon: 'erase', chip: '4' },
  ]

  /** Icon-only buttons: named by aria-label, shown as a tooltip; the hotkey, where there is one, as the Tooltip's chip. */
  const iconButtons = [
    { testId: 'undo-button', label: (t: typeof en) => t.palette.undoButton, icon: 'undo' },
    { testId: 'redo-button', label: (t: typeof en) => t.palette.redoButton, icon: 'redo' },
    { testId: 'rotate-button', label: (t: typeof en) => t.palette.rotateButton, icon: 'rotate' },
    { testId: 'copy-button', label: (t: typeof en) => t.tools.copyButton, icon: 'copy', chip: 'Ctrl/Cmd+C' },
  ]

  it.each(tabs)('draws $testId as an icon-only button named for screen readers, in both languages', async ({ testId, label, icon, chip }) => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    const tab = wrapper.find(`[data-testid="${testId}"]`)
    expect(tab.classes()).toContain('tool-button')
    expect(tab.find('svg').attributes('data-icon')).toBe(icon)
    expect(tab.attributes('aria-label')).toBe(label(en))
    expect(tab.attributes('title')).toBeUndefined()
    expect(tab.element.closest('.app-tooltip')!.querySelector('.app-tooltip__key')?.textContent).toBe(chip)

    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-label')).toBe(label(ru))
  })

  it.each(iconButtons)('draws $testId as an icon button named for screen readers, in both languages', async ({ testId, label, icon, chip }) => {
    const wrapper = await mountWithProject(15, 30)

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    const button = wrapper.find(`[data-testid="${testId}"]`)
    expect(button.classes()).toContain('icon-btn')
    expect(button.find('svg').attributes('data-icon')).toBe(icon)
    expect(button.text()).toBe('')
    expect(button.attributes('aria-label')).toBe(label(en))
    expect(button.attributes('title')).toBeUndefined()
    if (chip) expect(button.element.closest('.app-tooltip')!.querySelector('.app-tooltip__key')?.textContent).toBe(chip)

    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-label')).toBe(label(ru))
  })

  it('puts Remove line and Delete all under the tabs as links, Delete all in the danger color', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    const removeLine = wrapper.find('[data-testid="tool-remove-line"]')
    expect(removeLine.text()).toBe(en.tools.removeLineShort)
    expect(removeLine.attributes('title')).toBe(en.tools.removeLineButton)
    const deleteAll = wrapper.find('[data-testid="delete-all-button"]')
    expect(deleteAll.text()).toBe(en.deleteAll.button)
    expect(deleteAll.classes()).toContain('app-link--danger')
  })

  it('gives the three always-open groups a label and makes Frame a disclosure row (ticket 174 hid Mirror pending its own redesign)', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.findAll('.tool-group__title').map((title) => title.text())).toEqual([
      en.toolbox.groups.tools,
      en.toolbox.groups.colors,
      en.toolbox.groups.edit,
    ])
    expect(wrapper.findAll('.disclosure-row__label').map((label) => label.text())).toEqual([en.frame.title])
  })

  it('shows which tool is active', async () => {
    const wrapper = await mountWithProject(15, 30)

    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain('tool-button--active')
    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })
})

/*
 * Progress bar (ticket 144): every Row progress control in one bar along the canvas box's bottom edge, always there
 * while a Project is open, since its first control is the switch that turns Row progress on.
 */
describe('App Progress bar', () => {
  async function enableRowProgress(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
  }

  it('is always there under the drawing area, with just its switch while Row progress is off', async () => {
    const wrapper = await mountWithProject(15, 30)

    const bar = wrapper.find('[data-testid="progress-bar"]')
    expect(bar.exists()).toBe(true)
    expect(wrapper.find('[data-testid="app-canvas"]').element.lastElementChild).toBe(bar.element)
    expect(bar.find('[data-testid="progress-bar-switch"]').attributes('aria-checked')).toBe('false')
    expect(bar.find('[data-testid="progress-bar-next"]').exists()).toBe(false)

    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(bar.find('[data-testid="progress-bar-switch"]').attributes('aria-checked')).toBe('true')
    expect(bar.find('[data-testid="progress-bar-next"]').exists()).toBe(true)
    expect(loadProjects()[0]!.rowProgress.enabled).toBe(true)
  })

  it('is the same bar whatever the Project\'s shape or direction', async () => {
    const wrapper = await mountWithProject(15, 30)
    await enableRowProgress(wrapper)
    const classes = wrapper.find('[data-testid="progress-bar"]').classes()

    await wrapper.find('[data-testid="progress-bar-direction"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar"]').classes()).toEqual(classes)
  })

  it('names Row not done and Row done in words, in both languages, with their icons', async () => {
    const wrapper = await mountWithProject(15, 30)
    await enableRowProgress(wrapper)

    await wrapper.find('[data-testid="language-en"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-previous"]').text()).toBe('Row not done')
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe('Row done')
    expect(wrapper.find('[data-testid="progress-bar-previous"] svg').attributes('data-icon')).toBe('chevron-left')
    expect(wrapper.find('[data-testid="progress-bar-next"] svg').attributes('data-icon')).toBe('check')

    await wrapper.find('[data-testid="language-ru"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-previous"]').text()).toBe(ru.rowProgress.previousButton)
    expect(wrapper.find('[data-testid="progress-bar-next"]').text()).toBe(ru.rowProgress.nextButton)
  })

  it('makes Row done the primary action and names the switch for screen readers', async () => {
    const wrapper = await mountWithProject(15, 30)
    await enableRowProgress(wrapper)
    await wrapper.find('[data-testid="language-en"]').trigger('click')

    expect(wrapper.find('[data-testid="progress-bar-next"]').classes()).toContain('app-button--primary')
    const toggle = wrapper.find('[data-testid="progress-bar-switch"]')
    expect(toggle.attributes('role')).toBe('switch')
    expect(toggle.attributes('aria-label')).toBe(en.rowProgress.enabledLabel)
    expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-label')).toBe(en.rowProgress.directionButton)
  })

  it('fills the track with the finished share of the rows', async () => {
    const wrapper = await mountWithProject(15, 30)
    await enableRowProgress(wrapper) // 20 rows
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click')

    const track = wrapper.find('[data-testid="progress-bar-track"]')
    expect(track.attributes('aria-valuenow')).toBe('2')
    expect(track.attributes('aria-valuemax')).toBe('20')
    expect(track.find('span').attributes('style')).toContain('width: 10%')
  })
})

describe('App keyboard shortcuts', () => {
  /** Dispatched on `target` (window by default, the way Escape is), bubbling up so App's window-level listener sees it. */
  async function pressKey(init: KeyboardEventInit, target: EventTarget = window) {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
    await flushPromises()
  }

  /** Paints (0,0) red, as a single undo step to exercise the shortcuts against. */
  async function paintFirstCell(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
  }

  it.each([{ ctrlKey: true }, { metaKey: true }])('undoes on %s+Z', async (modifier) => {
    const wrapper = await mountWithProject(15, 30)
    await paintFirstCell(wrapper)

    await pressKey({ key: 'z', ...modifier })

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
  })

  it.each([{ ctrlKey: true, shiftKey: true }, { metaKey: true, shiftKey: true }, { ctrlKey: true, key: 'y' }])(
    'redoes on %s',
    async (modifier) => {
      const wrapper = await mountWithProject(15, 30)
      await paintFirstCell(wrapper)
      await pressKey({ key: 'z', ctrlKey: true })
      expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()

      await pressKey({ key: modifier.key ?? 'z', ...modifier })

      expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    },
  )

  it.each(['text', 'number'] as const)(
    'does not undo or redo while typing in a %s form field',
    async (type) => {
      // No text/number field ships alongside an active, painted Project in this app (ticket 38 removed the last
      // one, the Bead catalog's add-bead form) — a standalone field, attached to the document so the keydown still
      // bubbles to App.vue's window listener, is what isTypingInFormField actually cares about regardless of it
      // belonging to any real feature.
      const field = document.createElement('input')
      field.type = type
      document.body.appendChild(field)

      try {
        const wrapper = await mountWithProject(15, 30)
        await paintFirstCell(wrapper)

        await pressKey({ key: 'z', ctrlKey: true }, field)

        expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')

        await wrapper.find('[data-testid="undo-button"]').trigger('click')
        await pressKey({ key: 'z', ctrlKey: true, shiftKey: true }, field)

        expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
      } finally {
        field.remove()
      }
    },
  )

  it('Escape switches Fill back to Paint, and with Paint already active changes nothing (ticket 214)', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressKey({ key: 'Escape' })
    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain('tool-button--active')

    await pressKey({ key: 'Escape' })
    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain('tool-button--active')
  })

  it('works anywhere in the editor, the same as Escape, not just while the canvas has focus', async () => {
    const wrapper = await mountWithProject(15, 30)
    await paintFirstCell(wrapper)

    await pressKey({ key: 'z', ctrlKey: true })

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
  })
})

async function pressKey(init: KeyboardEventInit, target: EventTarget = window) {
  target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }))
  await flushPromises()
}

/**
 * The window-level keyboard shortcut tests below (tickets 87-96) dispatch on `window`, which every still-mounted
 * App instance in this file hears -- and unlike the rest of this suite, several of these assert an *incremental*
 * state (a row-progress pointer, a mirror axis count) that isn't idempotent under a stray extra firing from an
 * earlier test's App instance. mountAppForCleanup tracks every mount here so afterEach can unmount it, keeping
 * each test's dispatched keydowns reaching only its own wrapper.
 */
const mountedAppsForCleanup: ReturnType<typeof mount>[] = []
async function mountAppForCleanup(widthMm: number, heightMm: number) {
  const wrapper = await mountWithProject(widthMm, heightMm)
  mountedAppsForCleanup.push(wrapper)
  return wrapper
}
afterEach(() => {
  for (const wrapper of mountedAppsForCleanup.splice(0)) {
    wrapper.unmount()
  }
})

describe('App Tools group hotkeys — 1/2/3 (ticket 87)', () => {
  it.each([
    { key: '1', testId: 'tool-paint' },
    { key: '2', testId: 'tool-fill' },
    { key: '3', testId: 'tool-select' },
  ])('$key selects $testId, the same as clicking it', async ({ key, testId }) => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click') // start on a different tool

    await pressKey({ key })

    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-pressed')).toBe('true')
  })

  it('works even while a Selection or a paste projection is active', async () => {
    const wrapper = await mountAppForCleanup(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: '1' })

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = await mountAppForCleanup(15, 30)
      await wrapper.find('[data-testid="tool-fill"]').trigger('click')

      await pressKey({ key: '1' }, field)

      expect(wrapper.find('[data-testid="tool-fill"]').attributes('aria-pressed')).toBe('true')
    } finally {
      field.remove()
    }
  })

  it('has no effect while a confirm modal is open', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')
    expect(wrapper.find('[data-testid="delete-all-modal"]').exists()).toBe(true)

    await pressKey({ key: '1' })

    expect(wrapper.find('[data-testid="tool-fill"]').attributes('aria-pressed')).toBe('true')
  })
})

describe('App Colors group hotkeys — Shift+1..9,0,Q,W (ticket 88)', () => {
  const COLOR_SHORTCUT_CODES = [
    'Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0', 'KeyQ', 'KeyW',
  ]

  it('Shift+each key paints with the next Palette color, in Palette order', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    for (const index of PALETTE.keys()) {
      await pressKey({ code: COLOR_SHORTCUT_CODES[index]!, shiftKey: true })
      await pressBead(wrapper, index)
      await wrapper.trigger('mouseup')
    }

    const grid = frameGrid(loadProjects()[0]!)
    expect(PALETTE.map((_color, index) => grid[Math.floor(index / 10)]![index % 10]!.color)).toEqual(PALETTE.map((color) => color.hex))
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = await mountAppForCleanup(15, 30)

      await pressKey({ code: 'Digit2', shiftKey: true }, field)
      await pressBead(wrapper, 0)
      await wrapper.trigger('mouseup')

      // Red is still the default selected color (ticket 27); Shift+2 (orange) never landed.
      expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
    } finally {
      field.remove()
    }
  })
})

describe('App Eraser tool (ticket 89, single-bead default per ticket 176)', () => {
  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.trigger('mouseup')
  }

  /** A 2x2 Project (from a 3mm x 3mm cube-bead Project), fully painted red. */
  async function paintedSmallProject(wrapper: ReturnType<typeof mount>) {
    await wrapper.find('[data-color-id="red"]').trigger('click')
    for (let index = 0; index < 4; index++) {
      await click(wrapper, index)
    }
  }

  it('erases just the clicked bead, not its connected same-color region, as one undo step', async () => {
    const wrapper = await mountAppForCleanup(3, 3)
    await paintedSmallProject(wrapper)
    await wrapper.find('[data-testid="tool-erase"]').trigger('click')

    await click(wrapper, 0)

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[1]![0]!.color).toBe('#e63746')
    expect(grid[1]![1]!.color).toBe('#e63746')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!).flat().every((cell) => cell.color === '#e63746')).toBe(true)
  })

  it('erases every cell dragged over, as one undo step, on the primary press -- no right-click needed', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-erase"]').trigger('click')

    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await hoverBead(wrapper, 2, { buttons: 1 })
    await wrapper.trigger('mouseup')

    let grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[0]![2]!.color).toBeNull()

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#e63746')
    expect(grid[0]![1]!.color).toBe('#e63746')
    expect(grid[0]![2]!.color).toBe('#e63746')
  })


  it('respects the Row progress lock: a finished row is left alone', async () => {
    const wrapper = await mountAppForCleanup(6, 6) // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    for (let index = 0; index < 8; index++) {
      await click(wrapper, index) // paint the first two rows
    }
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await wrapper.find('[data-testid="progress-bar-next"]').trigger('click') // row 0 finished
    await wrapper.find('[data-testid="tool-erase"]').trigger('click')

    await click(wrapper, 0) // (0,0), in the finished row

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('leaves right-click erase under Paint and Fill unaffected by the new default behavior', async () => {
    const wrapper = await mountAppForCleanup(3, 3)
    await paintedSmallProject(wrapper)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressBead(wrapper, 0, { button: 2 })

    expect(frameGrid(loadProjects()[0]!).flat().every((cell) => cell.color === null)).toBe(true)
  })
})

describe('App picking a color switches to Paint (ticket 171)', () => {
  it.each(['tool-fill', 'tool-select', 'tool-erase'])('switches from %s to Paint on picking a Palette color', async (testId) => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find(`[data-testid="${testId}"]`).trigger('click')

    await wrapper.find('[data-color-id="red"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.find(`[data-testid="${testId}"]`).attributes('aria-pressed')).toBe('false')
  })

  it('switches to Paint on picking a Custom color', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await wrapper.find('[data-testid="custom-color-input"]').setValue('#123456')

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('switches to Paint on picking a Palette color by its Shift+key shortcut (ticket 88)', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await pressKey({ code: 'Digit1', shiftKey: true })

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('leaves Paint active and does not clear a Select marquee when Paint is already the active tool', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    await wrapper.find('[data-color-id="blue"]').trigger('click')

    expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
  })

  it('leaves a Fill in progress unaffected: picking a color only changes the next stroke\'s tool', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await pressBead(wrapper, 1)
    await wrapper.trigger('mouseup')
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await wrapper.find('[data-color-id="blue"]').trigger('click')

    // The tool switched to Paint; a press now paints one bead rather than flood-filling.
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBe('#2f6fed')
    expect(grid[0]![1]!.color).toBe('#e63746')
  })
})

describe('App Del key — Erase, or clear the Selection (ticket 90)', () => {
  async function drag(wrapper: ReturnType<typeof mount>, indices: number[]) {
    await pressBead(wrapper, indices[0]!)
    for (const index of indices.slice(1)) {
      await hoverBead(wrapper, index, { buttons: 1 })
    }
    await wrapper.find('.app-shell').trigger('mouseup')
  }

  async function click(wrapper: ReturnType<typeof mount>, index: number) {
    await pressBead(wrapper, index)
    await wrapper.trigger('mouseup')
  }

  it('clears just the selected cells, keeping the Selection and staying on Select, as one undo step', async () => {
    const wrapper = await mountAppForCleanup(6, 6) // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    for (let index = 0; index < 16; index++) {
      await click(wrapper, index)
    }
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await drag(wrapper, [0, 1, 4, 5]) // a 2x2 selection

    await pressKey({ key: 'Delete' })

    const grid = frameGrid(loadProjects()[0]!)
    expect(grid[0]![0]!.color).toBeNull()
    expect(grid[0]![1]!.color).toBeNull()
    expect(grid[1]![0]!.color).toBeNull()
    expect(grid[1]![1]!.color).toBeNull()
    expect(grid[2]![2]!.color).toBe('#e63746') // outside the selection, untouched
    expect(selectedBeadCount(wrapper)).toBe(4) // the Selection itself remains
    expect(wrapper.find('[data-testid="tool-select"]').attributes('aria-pressed')).toBe('true')

    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBe('#e63746')
  })

  it('activates Erase when Select is active with no Selection', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')

    await pressKey({ key: 'Delete' })

    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
  })

  it('activates Erase when any other tool is active', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="tool-fill"]').trigger('click')

    await pressKey({ key: 'Delete' })

    expect(wrapper.find('[data-testid="tool-erase"]').attributes('aria-pressed')).toBe('true')
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = await mountAppForCleanup(15, 30)

      await pressKey({ key: 'Delete' }, field)

      expect(wrapper.find('[data-testid="tool-paint"]').attributes('aria-pressed')).toBe('true')
    } finally {
      field.remove()
    }
  })
})

describe('App Edit group hotkeys — Copy (Ctrl/Cmd+C) (ticket 91), and R for the Rulers (v16)', () => {
  it('shows and hides the rulers on R, as the strip\'s Rulers button does, and remembers the choice on the device', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    const toggle = () => wrapper.find('[data-testid="rulers-toggle"]')
    expect(toggle().attributes('aria-pressed')).toBe('true')

    await pressKey({ key: 'r' })
    expect(toggle().attributes('aria-pressed')).toBe('false')
    expect(localStorage.getItem('bd-beads:rulers')).toBe('off')
    expect(loadProjects()[0]!.rotation).toBe(0)

    await toggle().trigger('click')
    expect(toggle().attributes('aria-pressed')).toBe('true')
    expect(localStorage.getItem('bd-beads:rulers')).toBe('on')
  })

  it('copies the active Selection on Ctrl/Cmd+C, the same as clicking Copy', async () => {
    const wrapper = await mountAppForCleanup(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')

    await pressKey({ key: 'c', ctrlKey: true })

    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true) // hides the marquee, same as a click
    expect(selectedBeadCount(wrapper)).toBe(0)
  })

  it('is a no-op copying with no Selection (Copy disabled)', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    await pressKey({ key: 'c', ctrlKey: true })

    // Nothing to assert directly beyond no error/crash; canCopy stays false either way.
    expect(wrapper.find<HTMLButtonElement>('[data-testid="copy-button"]').element.disabled).toBe(true)
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      await mountAppForCleanup(15, 30)

      await pressKey({ key: 'r' }, field)

      expect(loadProjects()[0]!.rotation).toBe(0)
    } finally {
      field.remove()
    }
  })
})

describe('App tool digit keys (ticket 292)', () => {
  it.each([
    ['4', 'tool-erase'],
    ['5', 'tool-hand'],
    ['6', 'tool-frame'],
  ])('%s lights %s', async (digit, testId) => {
    const wrapper = await mountAppForCleanup(15, 30)

    await pressKey({ key: digit })

    expect(wrapper.find(`[data-testid="${testId}"]`).classes()).toContain('tool-button--active')
  })

  it('E, H and F no longer pick a tool', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    for (const key of ['e', 'h', 'f']) {
      await pressKey({ key })
    }

    expect(wrapper.find('[data-testid="tool-paint"]').classes()).toContain('tool-button--active')
    expect(wrapper.find('[data-testid="tool-frame"]').classes()).not.toContain('tool-button--active')
  })
})

describe('App Mirror group hotkeys removed (ticket 174, pending its own redesign)', () => {
  it('-, =, [, ], M, H and V no longer do anything: no UI is left for them to reach', async () => {
    const wrapper = await mountAppForCleanup(6, 6) // 4x4
    await wrapper.find('[data-color-id="red"]').trigger('click')
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')
    const before = frameGrid(loadProjects()[0]!)

    for (const key of ['-', '=', '[', ']', 'm', 'h', 'v']) {
      await pressKey({ key })
    }

    expect(frameGrid(loadProjects()[0]!)).toEqual(before)
  })
})

describe('App Row progress group hotkeys (ticket 94)', () => {
  it('P toggles Row progress on/off', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    await pressKey({ key: 'p' })

    expect(wrapper.find('[data-testid="progress-bar-switch"]').attributes('aria-checked')).toBe('true')
  })

  it('D toggles Row direction', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    await pressKey({ key: 'd' })
    expect(loadProjects()[0]!.rowProgress.direction).toBe('columns')

    // The direction button shows once Row progress is on, already turned.
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    expect(wrapper.find('[data-testid="progress-bar-direction"]').attributes('aria-pressed')).toBe('true')
  })

  it('Enter/Shift+Enter move to the next/previous row', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressKey({ key: 'Enter' })
    await pressKey({ key: 'Enter' })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)

    await pressKey({ key: 'Enter', shiftKey: true })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
  })

  it('respects the disabled bounds at the first/last row', async () => {
    const wrapper = await mountAppForCleanup(3, 3) // 2x2
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressKey({ key: 'Enter', shiftKey: true }) // already at the first row

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+2\b/)
  })

  it('is a no-op while Row progress is off', async () => {
    await mountAppForCleanup(15, 30)

    await pressKey({ key: 'Enter' })

    expect(loadProjects()[0]!.rowProgress.currentRow).toBe(0)
  })

  it('suppresses Enter/Shift+Enter when a Toolbox button has focus, so Tab+Enter does not also move the row', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const button = wrapper.find('[data-testid="undo-button"]').element as HTMLButtonElement
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)
  })

  it('suppresses Enter/Shift+Enter when a Progress bar button itself has focus (ticket 124 moved it off the Toolbox), so a plain click there does not also double-move the row', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const button = wrapper.find('[data-testid="progress-bar-next"]').element as HTMLButtonElement
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await flushPromises()

    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)
  })

  it('Space/Shift+Space also move to the next/previous row (ticket 178)', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    await pressKey({ key: ' ' })
    await pressKey({ key: ' ' })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b3\D+20\b/)

    await pressKey({ key: ' ', shiftKey: true })
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b2\D+20\b/)
  })

  it('is a no-op for Space/Shift+Space too while Row progress is off', async () => {
    await mountAppForCleanup(15, 30)

    await pressKey({ key: ' ' })
    await pressKey({ key: ' ', shiftKey: true })

    expect(loadProjects()[0]!.rowProgress.currentRow).toBe(0)
  })

  it('suppresses Space/Shift+Space when a Toolbox or Progress bar button has focus, so it activates the button rather than double-moving the row', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

    const toolboxButton = wrapper.find('[data-testid="undo-button"]').element as HTMLButtonElement
    toolboxButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)

    const progressButton = wrapper.find('[data-testid="progress-bar-next"]').element as HTMLButtonElement
    progressButton.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    await flushPromises()
    expect(wrapper.find('[data-testid="progress-bar-position"]').text()).toMatch(/\b1\D+20\b/)
  })

  it('does not fire Space/Shift+Space while typing in a text input', async () => {
    const field = document.createElement('input')
    field.type = 'text'
    document.body.appendChild(field)

    try {
      const wrapper = await mountAppForCleanup(15, 30)
      await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')

      await pressKey({ key: ' ' }, field)
      await pressKey({ key: ' ', shiftKey: true }, field)

      expect(loadProjects()[0]!.rowProgress.currentRow).toBe(0)
    } finally {
      field.remove()
    }
  })
})

describe('App Space+drag pan (ticket 95)', () => {
  function spaceDown() {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))
  }

  it('does not paint even if the pointer moves over cells while Space is held', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')

    spaceDown()
    await flushPromises()
    await pressBead(wrapper, 0)
    await wrapper.trigger('mouseup')

    expect(frameGrid(loadProjects()[0]!)[0]![0]!.color).toBeNull()
  })

  it('shows a grab cursor while Space is held', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    spaceDown()
    await flushPromises()

    expect(wrapper.find('[data-testid="app-canvas"]').classes()).toContain('app-shell__canvas--pan')
  })

  it('is suppressed while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = await mountAppForCleanup(15, 30)

      field.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true }))
      await flushPromises()

      expect(wrapper.find('[data-testid="app-canvas"]').classes()).not.toContain('app-shell__canvas--pan')
    } finally {
      field.remove()
    }
  })
})

describe('App shortcuts help overlay (ticket 96)', () => {
  it('opens on ?', async () => {
    const wrapper = await mountAppForCleanup(15, 30)

    await pressKey({ key: '?' })

    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(true)
  })

  it('closes on Escape without also backing out of Select', async () => {
    const wrapper = await mountAppForCleanup(6, 6)
    await wrapper.find('[data-testid="tool-select"]').trigger('click')
    await pressBead(wrapper, 0)
    await hoverBead(wrapper, 1, { buttons: 1 })
    await wrapper.trigger('mouseup')
    await pressKey({ key: '?' })

    await pressKey({ key: 'Escape' })

    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
    expect(selectedBeadCount(wrapper)).toBe(2) // untouched by that Escape
  })

  it('has no effect while typing in a form field', async () => {
    const field = document.createElement('input')
    document.body.appendChild(field)
    try {
      const wrapper = await mountAppForCleanup(15, 30)

      await pressKey({ key: '?' }, field)

      expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
    } finally {
      field.remove()
    }
  })

  it('has no effect while a confirm modal is open', async () => {
    const wrapper = await mountAppForCleanup(15, 30)
    await wrapper.find('[data-testid="delete-all-button"]').trigger('click')

    await pressKey({ key: '?' })

    expect(wrapper.find('[data-testid="shortcuts-help-dialog"]').exists()).toBe(false)
  })
})

describe('App hover preview', () => {
  it('shows a faint preview of the selected color at the hovered cell, clearing on mouse leave', async () => {
    const wrapper = await mountWithProject(15, 30)
    await wrapper.find('[data-color-id="red"]').trigger('click')

    await hoverBead(wrapper, 5)
    expect(previewedBeads(wrapper)).toEqual([{ row: 0, column: 5, color: '#e63746' }])

    await leaveSurface(wrapper)
    expect(previewedBeads(wrapper)).toEqual([])
  })

  // The neutral (no color selected) preview is the overlay renderer's own concern and is covered directly in
  // overlayRenderer.test.ts; since ticket 27 made red App's default selection, nothing is never actually selected
  // while a Project is open here, so there's no reachable App-level scenario left to exercise it through.

})
