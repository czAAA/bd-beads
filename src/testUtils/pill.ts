import type { mount } from '@vue/test-utils'
import type { Locale } from '../domain/locale'
import type { Tool } from '../domain/tool'
import { chooseLanguage } from './chooseLanguage'

type Wrapper = ReturnType<typeof mount>

type Sheet = 'strip-project' | 'strip-menu'

/**
 * Opens Menu or Project (CanvasStrip and TopSheet cards, ticket 443): the strip's button toggles, so a panel that is already
 * open is left alone and the other one open is swapped for it by the press. Under 1024px, as every test starts, it is the Top sheet.
 */
export async function openSheet(wrapper: Wrapper, dock: Sheet): Promise<void> {
  const button = wrapper.get(`[data-testid="${dock}"]`)
  const panelOpen = wrapper.find('[data-testid="panel-body"]').exists()
  if (!panelOpen || button.attributes('aria-pressed') !== 'true') {
    await button.trigger('click')
  }
}

/** Puts the open Menu or Project away with the strip button that lit it. */
export async function closeSheet(wrapper: Wrapper): Promise<void> {
  const lit = wrapper.find('[data-testid="strip-menu"][aria-pressed="true"], [data-testid="strip-project"][aria-pressed="true"]')
  if (lit.exists()) await lit.trigger('click')
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
 * Raises the New Project form (a modal sheet): the project bar's button with no Project open, otherwise Menu's.
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
  await openSheet(wrapper, 'strip-menu')
  await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
}

/** Copies the Selection with the Selection bar's Copy, which clears the Selection and arms paste mode (ticket 437). */
export async function copySelection(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="context-bar-copy"]').trigger('click')
}

/** Rotates the Selection with the Selection bar's Rotate. */
export async function rotate(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="context-bar-rotate"]').trigger('click')
}

/** Presses Delete all, last in Menu's Projects section, which opens first; the confirmation it raises is the caller's. */
export async function deleteAll(wrapper: Wrapper): Promise<void> {
  if (!wrapper.find('[data-testid="menu-delete-all"]').exists()) {
    await openSheet(wrapper, 'strip-menu')
  }
  await wrapper.get('[data-testid="menu-delete-all"]').trigger('click')
}

/** Picks a language in Menu (tickets 368, 443): the panel opens first; the Top sheet lists every language, the dropdown has the switcher. */
export async function chooseAppLanguage(wrapper: Wrapper, locale: Locale): Promise<void> {
  await openSheet(wrapper, 'strip-menu')
  if (wrapper.find('[data-testid="language-switcher"]').exists()) await chooseLanguage(wrapper, locale)
  else await wrapper.get(`[data-testid="language-${locale}"]`).trigger('click')
}

/** Opens Saved Projects, the sheet Menu's item raises, unless it is already up. */
export async function openSavedProjects(wrapper: Wrapper): Promise<void> {
  if (wrapper.find('[data-testid="project-list"]').exists()) {
    return
  }
  await openSheet(wrapper, 'strip-menu')
  await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
}

/** Whether a Tool's pill tile shows lit. */
export function toolState(wrapper: Wrapper, tool: Tool): { pressed: boolean; selected: boolean } {
  const tile = wrapper.get(`[data-testid="pill-tool-${tool}"]`)
  return { pressed: tile.attributes('aria-pressed') === 'true', selected: tile.classes().includes('icon-btn--selected') }
}

/**
 * Reads one element of the Project panel (ProjectPanel card): the panel opens for it and closes again, so a press on
 * the canvas that follows is not swallowed by it.
 */
export async function sheetRead(wrapper: Wrapper, testId: string): Promise<{ exists: boolean; text: string }> {
  await openSheet(wrapper, 'strip-project')
  const element = wrapper.find(`[data-testid="${testId}"]`)
  const read = { exists: element.exists(), text: element.exists() ? element.text() : '' }
  await closeSheet(wrapper)
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
