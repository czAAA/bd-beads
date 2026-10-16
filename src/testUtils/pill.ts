import type { mount } from '@vue/test-utils'
import type { Locale } from '../domain/locale'
import type { Tool } from '../domain/tool'
import { chooseLanguage } from './chooseLanguage'

type Wrapper = ReturnType<typeof mount>

type Sheet = 'strip-project' | 'strip-menu'

/**
 * Opens one of the sheets (CanvasStrip card): the strip's Menu or Project button toggles, so a sheet that is already
 * open is left alone and a different open one is replaced by the press.
 */
export async function openSheet(wrapper: Wrapper, dock: Sheet): Promise<void> {
  const button = wrapper.get(`[data-testid="${dock}"]`)
  const sheetOpen = wrapper.find('[data-testid="bottom-sheet"]').exists()
  if (!sheetOpen || button.attributes('aria-pressed') !== 'true') {
    await button.trigger('click')
  }
}

/** Picks a Tool with its Tool pill tile. */
export async function pickTool(wrapper: Wrapper, tool: Tool): Promise<void> {
  await wrapper.get(`[data-testid="pill-tool-${tool}"]`).trigger('click')
}

/**
 * Selects everything inside the Frame with Ctrl+A, with the Select tool in hand (ticket 439: the standalone Select all
 * button is gone, and the Selection bar offers it only once a Selection exists).
 */
export async function selectAll(wrapper: Wrapper): Promise<void> {
  await pickTool(wrapper, 'select')
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }))
  await wrapper.vm.$nextTick()
}

/** Opens the colour popover from the pill's colour tile, unless it is already up. */
export async function openColorPopover(wrapper: Wrapper): Promise<void> {
  if (!wrapper.find('[data-testid="color-popover"]').exists()) {
    await wrapper.get('[data-testid="pill-color"]').trigger('click')
  }
}

/** Picks a palette color through the colour popover (PalettePicker card), opening it first when it is not showing. */
export async function pickColor(wrapper: Wrapper, colorId: string): Promise<void> {
  const swatch = () => wrapper.find(`[data-color-id="${colorId}"]`)
  if (!swatch().exists()) {
    await openColorPopover(wrapper)
  }
  await swatch().trigger('click')
}

/**
 * Raises the New Project form (a modal sheet): the project bar's button with no Project open, otherwise the Project sheet's.
 * Does nothing when the form is already up.
 */
export async function openNewProject(wrapper: Wrapper): Promise<void> {
  if (wrapper.find('[data-testid="bead-select"]').exists()) {
    return
  }
  const bar = wrapper.find('[data-testid="phone-bar-new-project"]')
  if (bar.exists()) {
    await bar.trigger('click')
    return
  }
  await openSheet(wrapper, 'strip-project')
  await wrapper.get('[data-testid="phone-new-project-button"]').trigger('click')
}

/** Copies the Selection with the Selection bar's Copy, which clears the Selection and arms paste mode (ticket 437). */
export async function copySelection(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="context-bar-copy"]').trigger('click')
}

/** Rotates the Selection with the Selection bar's Rotate. */
export async function rotate(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="context-bar-rotate"]').trigger('click')
}

/** Presses Delete all at the bottom of the Project sheet, which opens first; the confirmation it raises is the caller's. */
export async function deleteAll(wrapper: Wrapper): Promise<void> {
  if (!wrapper.find('[data-testid="sheet-delete-all"]').exists()) {
    await openSheet(wrapper, 'strip-project')
  }
  await wrapper.get('[data-testid="sheet-delete-all"]').trigger('click')
}

/** Picks a language from the Menu sheet's switcher (ticket 368): the sheet opens first, from the strip's Menu button. */
export async function chooseAppLanguage(wrapper: Wrapper, locale: Locale): Promise<void> {
  if (!wrapper.find('[data-testid="language-switcher"]').exists()) {
    await openSheet(wrapper, 'strip-menu')
  }
  await chooseLanguage(wrapper, locale)
}

/** Opens Saved Projects, the sheet the Project sheet's icon raises (PhoneSheets card), unless it is already up. */
export async function openSavedProjects(wrapper: Wrapper): Promise<void> {
  if (wrapper.find('[data-testid="project-list"]').exists()) {
    return
  }
  await openSheet(wrapper, 'strip-project')
  await wrapper.get('[data-testid="phone-saved-projects-button"]').trigger('click')
}

/** Whether a Tool's pill tile shows lit. */
export function toolState(wrapper: Wrapper, tool: Tool): { pressed: boolean; selected: boolean } {
  const tile = wrapper.get(`[data-testid="pill-tool-${tool}"]`)
  return { pressed: tile.attributes('aria-pressed') === 'true', selected: tile.classes().includes('icon-btn--selected') }
}

/**
 * Reads one element of the Project sheet (PhoneSheets card): the sheet opens for it and closes again, so a press on
 * the canvas that follows is not swallowed by it.
 */
export async function sheetRead(wrapper: Wrapper, testId: string): Promise<{ exists: boolean; text: string }> {
  await openSheet(wrapper, 'strip-project')
  const element = wrapper.find(`[data-testid="${testId}"]`)
  const read = { exists: element.exists(), text: element.exists() ? element.text() : '' }
  await wrapper.get('[data-testid="sheet-close"]').trigger('click')
  return read
}

/** Sets the colour popover's Custom color the way the native picker does: an `input` event carrying the hex. */
export async function chooseCustomColor(wrapper: Wrapper, hex: string): Promise<void> {
  if (!wrapper.find('[data-testid="custom-color-input"]').exists()) {
    await openColorPopover(wrapper)
  }
  const input = wrapper.get<HTMLInputElement>('[data-testid="custom-color-input"]')
  input.element.value = hex
  await input.trigger('input')
}
