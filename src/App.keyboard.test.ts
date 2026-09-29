import { beforeEach, describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import App from './App.vue'
import { loadPatterns } from './services/libraryStore'
import { en } from './i18n/en'

/*
 * Painting with the keyboard, landmarks and announcements (ticket 159; `accessibility.md`, BeadCursor and ScreenReaders
 * cards).
 */

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('bd-beads:locale', 'en')
})

async function openPattern(columns = 6, rows = 4) {
  const wrapper = mount(App, { attachTo: document.body })
  await wrapper.find('[data-testid="bead-select"]').setValue('toho-cube-1.5mm')
  await wrapper.find('[data-testid="width-input"]').setValue(String(columns))
  await wrapper.find('[data-testid="height-input"]').setValue(String(rows))
  await wrapper.find('form').trigger('submit')
  return wrapper
}

const surface = (wrapper: ReturnType<typeof mount>) => wrapper.find('[data-testid="pattern-surface"]')
const heard = async (wrapper: ReturnType<typeof mount>) => {
  await nextTick()
  await nextTick()
  return wrapper.find('[data-testid="announcer"]').text()
}
const colorAt = (row: number, column: number) => loadPatterns()[0]!.grid[row]![column]!.color

async function focusPattern(wrapper: ReturnType<typeof mount>) {
  ;(surface(wrapper).element as HTMLElement).focus()
  await nextTick()
}

async function key(wrapper: ReturnType<typeof mount>, name: string, options: KeyboardEventInit = {}) {
  await surface(wrapper).trigger('keydown', { key: name, ...options })
}

describe('the Pattern from the keyboard (ticket 159)', () => {
  it('is one Tab stop, an image named for what it shows', async () => {
    const wrapper = await openPattern()

    expect(surface(wrapper).attributes('tabindex')).toBe('0')
    expect(surface(wrapper).attributes('role')).toBe('img')
    expect(surface(wrapper).attributes('aria-label')).toMatch(/, 6 by 4 beads, 0 colors$/)
  })

  it('says where the bead cursor is when focus arrives, and as it moves', async () => {
    const wrapper = await openPattern()
    await focusPattern(wrapper)
    expect(await heard(wrapper)).toBe('Row 1, column 1, empty')
    expect(wrapper.find('[data-testid="canvas-strip-hint"]').text()).toBe(en.a11y.keyboardHint)

    await key(wrapper, 'ArrowRight')
    await key(wrapper, 'ArrowDown')
    expect(await heard(wrapper)).toBe('Row 2, column 2, empty')
  })

  it('jumps with Home, End and Page Up / Down, and never leaves the Pattern', async () => {
    const wrapper = await openPattern(6, 25)
    await focusPattern(wrapper)

    await key(wrapper, 'End')
    expect(await heard(wrapper)).toBe('Row 1, column 6, empty')
    await key(wrapper, 'PageDown')
    await key(wrapper, 'PageDown')
    await key(wrapper, 'PageDown')
    expect(await heard(wrapper)).toBe('Row 25, column 6, empty')
    await key(wrapper, 'Home')
    await key(wrapper, 'ArrowLeft')
    expect(await heard(wrapper)).toBe('Row 25, column 1, empty')
  })

  it('paints with Space, as one undo step, and says so', async () => {
    const wrapper = await openPattern()
    await wrapper.find('[data-color-id="blue"]').trigger('click')
    await focusPattern(wrapper)
    await key(wrapper, 'ArrowRight')

    await key(wrapper, ' ')

    expect(colorAt(0, 1)).toBe('#2f6fed')
    expect(await heard(wrapper)).toBe('Painted Blue')
    await wrapper.find('[data-testid="undo-button"]').trigger('click')
    expect(colorAt(0, 1)).toBeNull()
  })

  it('uses Enter the same way, and keeps Enter from marking a row done while on the Pattern', async () => {
    const wrapper = await openPattern()
    await wrapper.find('[data-testid="progress-bar-switch"]').trigger('click')
    await focusPattern(wrapper)

    await key(wrapper, 'Enter')

    expect(colorAt(0, 0)).not.toBeNull()
    expect(loadPatterns()[0]!.rowProgress.currentRow).toBe(0)
  })

  it('extends a Selection with Shift + arrows', async () => {
    const wrapper = await openPattern()
    await focusPattern(wrapper)

    await key(wrapper, 'ArrowRight', { shiftKey: true })
    await key(wrapper, 'ArrowDown', { shiftKey: true })
    await surface(wrapper).trigger('keyup', { key: 'Shift' })

    expect(wrapper.find('[data-testid="copy-button"]').attributes('disabled')).toBeUndefined()
  })

  it('leaves the Pattern on Escape, taking the cursor with it', async () => {
    const wrapper = await openPattern()
    await focusPattern(wrapper)
    await key(wrapper, 'Escape')

    expect(wrapper.find('[data-testid="canvas-strip-hint"]').exists()).toBe(false)
  })

  it('marks the cursor\'s row and column on the rulers', async () => {
    const wrapper = await openPattern()
    await focusPattern(wrapper)
    await key(wrapper, 'ArrowDown')

    expect(wrapper.find('[data-testid="canvas-strip-hint"]').exists()).toBe(true)
    expect(document.activeElement).toBe(surface(wrapper).element)
    const marked = wrapper.findAll('.pattern-ruler__label--cursor').map((label) => label.text())
    expect(marked).toEqual(expect.arrayContaining(['1', '2']))
  })
})

describe('landmarks and the skip link (ticket 159)', () => {
  it('has header, the Tools aside and main, and Skip to Pattern first, which moves focus onto the Pattern', async () => {
    const wrapper = await openPattern()

    expect(wrapper.find('header').exists()).toBe(true)
    expect(wrapper.find('aside').attributes('aria-label')).toBe(en.a11y.toolsLandmark)
    expect(wrapper.find('main').find('[data-testid="pattern-surface"]').exists()).toBe(true)

    const skip = wrapper.find('[data-testid="skip-to-pattern"]')
    expect(wrapper.element.firstElementChild).toBe(skip.element)
    await skip.trigger('click')
    expect(document.activeElement).toBe(surface(wrapper).element)
  })
})

describe('one Tab stop per group (ticket 159)', () => {
  it('makes the active tool tab the tool tabs\' only stop, and moves focus with the arrows without choosing', async () => {
    const wrapper = await openPattern()
    const tabs = wrapper.findAll('.tool-tab')

    expect(tabs.map((tab) => tab.attributes('tabindex'))).toEqual(['0', '-1', '-1', '-1'])
    ;(tabs[0]!.element as HTMLElement).focus()
    await tabs[0]!.trigger('keydown', { key: 'ArrowRight' })

    expect(document.activeElement).toBe(tabs[1]!.element)
    expect(tabs[0]!.attributes('aria-pressed')).toBe('true')
  })

  it('makes the selected swatch the Palette\'s only stop', async () => {
    const wrapper = await openPattern()
    const stops = wrapper.findAll('[data-testid="palette-swatch"]').filter((swatch) => swatch.attributes('tabindex') === '0')

    expect(stops).toHaveLength(1)
    expect(stops[0]!.attributes('aria-pressed')).toBe('true')
  })
})
