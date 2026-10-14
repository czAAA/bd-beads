import type { mount } from '@vue/test-utils'
import type { Locale } from '../domain/locale'
import type { Tool } from '../domain/tool'
import { chooseLanguage } from './chooseLanguage'

type Wrapper = ReturnType<typeof mount>

type DockSheet = 'dock-tool' | 'dock-color' | 'dock-frame' | 'dock-project' | 'dock-menu'

/**
 * Opens one of the Dock's sheets (Dock card): its Dock button toggles, so a sheet that is already open is left alone and
 * a different open one is replaced by the press.
 */
export async function openSheet(wrapper: Wrapper, dock: DockSheet): Promise<void> {
  const button = wrapper.get(`[data-testid="${dock}"]`)
  const sheetOpen = wrapper.find('[data-testid="bottom-sheet"]').exists()
  if (!sheetOpen || !button.classes().includes('icon-btn--selected')) {
    await button.trigger('click')
  }
}

/** Picks a Tool through the Dock's Tool sheet (ToolTiles card), opening the sheet first when it is not showing. */
export async function pickTool(wrapper: Wrapper, tool: Tool | 'select-all'): Promise<void> {
  if (!wrapper.find(`[data-testid="sheet-tool-${tool}"]`).exists()) {
    await openSheet(wrapper, 'dock-tool')
  }
  await wrapper.get(`[data-testid="sheet-tool-${tool}"]`).trigger('click')
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
  await openSheet(wrapper, 'dock-project')
  await wrapper.get('[data-testid="phone-new-project-button"]').trigger('click')
}

/** Copies the Selection with the Selection bar's Copy, then arms Paste with its Paste (which discards the Selection). */
export async function copySelection(wrapper: Wrapper): Promise<void> {
  await wrapper.get('[data-testid="context-bar-copy"]').trigger('click')
  await wrapper.get('[data-testid="context-bar-paste"]').trigger('click')
}

/** Rotates the Selection with the Context bar's Rotate, or else the Frame with the Frame sheet's own (ADR 0046). */
export async function rotate(wrapper: Wrapper): Promise<void> {
  const bar = wrapper.find('[data-testid="context-bar-rotate"]')
  if (bar.exists()) {
    await bar.trigger('click')
    return
  }
  if (!wrapper.find('[data-testid="sheet-rotate"]').exists()) {
    await openSheet(wrapper, 'dock-frame')
  }
  await wrapper.get('[data-testid="sheet-rotate"]').trigger('click')
}

/** Presses Delete all in the Tool sheet, which opens first; the confirmation it raises is the caller's. */
export async function deleteAll(wrapper: Wrapper): Promise<void> {
  if (!wrapper.find('[data-testid="sheet-delete-all"]').exists()) {
    await openSheet(wrapper, 'dock-tool')
  }
  await wrapper.get('[data-testid="sheet-delete-all"]').trigger('click')
}

/** Picks a language from the Menu sheet's switcher (ticket 368): the sheet opens first, from the Dock or the project bar. */
export async function chooseAppLanguage(wrapper: Wrapper, locale: Locale): Promise<void> {
  if (!wrapper.find('[data-testid="language-switcher"]').exists()) {
    const bar = wrapper.find('[data-testid="phone-bar-menu"]')
    if (bar.exists()) {
      await bar.trigger('click')
    } else {
      await openSheet(wrapper, 'dock-menu')
    }
  }
  await chooseLanguage(wrapper, locale)
}

/** Opens Saved Projects, the sheet the Project sheet's icon raises (PhoneSheets card), unless it is already up. */
export async function openSavedProjects(wrapper: Wrapper): Promise<void> {
  if (wrapper.find('[data-testid="project-list"]').exists()) {
    return
  }
  await openSheet(wrapper, 'dock-project')
  await wrapper.get('[data-testid="phone-saved-projects-button"]').trigger('click')
}

/** Whether a Tool tile shows lit, read from the Tool sheet, which opens for it and closes again (a key waits while one is open). */
export async function toolState(wrapper: Wrapper, tool: Tool): Promise<{ pressed: boolean; selected: boolean }> {
  await openSheet(wrapper, 'dock-tool')
  const tile = wrapper.get(`[data-testid="sheet-tool-${tool}"]`)
  const state = { pressed: tile.attributes('aria-pressed') === 'true', selected: tile.classes().includes('icon-btn--selected') }
  await wrapper.get('[data-testid="sheet-close"]').trigger('click')
  return state
}

/**
 * Reads one element of the Project sheet (PhoneSheets card): the sheet opens for it and closes again, so a press on
 * the canvas that follows is not swallowed by it.
 */
export async function sheetRead(wrapper: Wrapper, testId: string): Promise<{ exists: boolean; text: string }> {
  await openSheet(wrapper, 'dock-project')
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
