import type { mount } from '@vue/test-utils'
import type { Locale } from '../domain/locale'
import type { Tool } from '../domain/tool'
import { chooseLanguage } from './chooseLanguage'

type Wrapper = ReturnType<typeof mount>

type DockSheet = 'dock-color' | 'strip-project' | 'strip-menu'

/**
 * Opens one of the sheets (Dock, CanvasStrip cards): the Dock's Colour button or the strip's Menu or Project button
 * toggles, so a sheet that is already open is left alone and a different open one is replaced by the press.
 */
export async function openSheet(wrapper: Wrapper, dock: DockSheet): Promise<void> {
  const button = wrapper.get(`[data-testid="${dock}"]`)
  const sheetOpen = wrapper.find('[data-testid="bottom-sheet"]').exists()
  if (!sheetOpen || button.attributes('aria-pressed') !== 'true') {
    await button.trigger('click')
  }
}

/**
 * Picks a Tool with its Dock tile, or presses the Context bar's Select all (ticket 431: neither is behind a sheet).
 * Select all shows only with the Select tool, so that is picked first when its button is not up.
 */
export async function pickTool(wrapper: Wrapper, tool: Tool | 'select-all'): Promise<void> {
  if (tool === 'select-all' && !wrapper.find('[data-testid="context-bar-select-all"]').exists()) {
    await pickTool(wrapper, 'select')
  }
  const testid = tool === 'select-all' ? 'context-bar-select-all' : `dock-tool-${tool}`
  await wrapper.get(`[data-testid="${testid}"]`).trigger('click')
}

/** Picks a palette color through the Dock's Color sheet (PalettePicker card), opening the sheet first when it is not showing. */
export async function pickColor(wrapper: Wrapper, colorId: string): Promise<void> {
  const swatch = () => wrapper.find(`[data-color-id="${colorId}"]`)
  if (!swatch().exists()) {
    await openSheet(wrapper, 'dock-color')
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

/** Copies the Selection with the Selection bar's Copy, then arms Paste with its Paste (which discards the Selection). */
export async function copySelection(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="context-bar-copy"]').trigger('click')
  await wrapper.get('[data-testid="context-bar-paste"]').trigger('click')
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

/** Whether a Tool's Dock tile shows lit. */
export function toolState(wrapper: Wrapper, tool: Tool): { pressed: boolean; selected: boolean } {
  const tile = wrapper.get(`[data-testid="dock-tool-${tool}"]`)
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

/** Sets the Color sheet's Custom color the way the native picker does: an `input` event carrying the hex. */
export async function chooseCustomColor(wrapper: Wrapper, hex: string): Promise<void> {
  if (!wrapper.find('[data-testid="custom-color-input"]').exists()) {
    await openSheet(wrapper, 'dock-color')
  }
  const input = wrapper.get<HTMLInputElement>('[data-testid="custom-color-input"]')
  input.element.value = hex
  await input.trigger('input')
}
