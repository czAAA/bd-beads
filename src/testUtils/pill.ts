import type { mount } from '@vue/test-utils'
import type { Locale } from '../domain/locale'
import type { Tool } from '../domain/tool'
import { chooseLanguage } from './chooseLanguage'

type Wrapper = ReturnType<typeof mount>

type Sheet = 'strip-project' | 'strip-menu'

/** Opens Menu or Project (CanvasStrip card, ticket 443): the strip's button toggles, so an open panel
 * is left alone and the other is swapped in. */
export async function openPanel(wrapper: Wrapper, dock: Sheet): Promise<void> {
  const button = wrapper.get(`[data-testid="${dock}"]`)
  const panelOpen = wrapper.find('[data-testid="panel-body"]').exists()
  if (!panelOpen || button.attributes('aria-pressed') !== 'true') {
    await button.trigger('click')
  }
  // With an empty library Menu opens on New Project (spec 0478); callers of this want its list.
  const back = wrapper.find('[data-testid="panel-back"]')
  if (back.exists() && dock === 'strip-menu') await back.trigger('click')
}

/** Puts the open Menu or Project away with the strip button that lit it. */
export async function closePanel(wrapper: Wrapper): Promise<void> {
  const lit = wrapper.find('[data-testid="strip-menu"][aria-pressed="true"], [data-testid="strip-project"][aria-pressed="true"]')
  if (lit.exists()) await lit.trigger('click')
}

/** Picks a Tool with its Tool pill tile. */
export async function pickTool(wrapper: Wrapper, tool: Tool): Promise<void> {
  await wrapper.get(`[data-testid="pill-tool-${tool}"]`).trigger('click')
}

/** Selects everything inside the Frame with Ctrl+A, Select tool in hand (ticket 439: no standalone Select all
 * button). */
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

/** Raises the New Project form (the Menu panel's subpanel) via the project bar's button, or Menu's when a Project is open; no-op
 * if up. */
export async function openNewProject(wrapper: Wrapper): Promise<void> {
  if (wrapper.find('[data-testid="bead-select"]').exists()) {
    return
  }
  const row = wrapper.find('[data-testid="menu-new-project"]')
  if (row.exists()) {
    await row.trigger('click')
    return
  }
  const bar = wrapper.find('[data-testid="phone-bar-new-project"]')
  if (bar.exists()) {
    await bar.trigger('click')
    return
  }
  await openPanel(wrapper, 'strip-menu')
  await wrapper.get('[data-testid="menu-new-project"]').trigger('click')
}

/** Waits out the Selection bar's arming delay (ticket 499); the bar is disabled until then. */
export const armSelectionBar = () => new Promise((resolve) => setTimeout(resolve, 360))

/** Presses a Selection bar button once it is armed. */
export async function pressBar(wrapper: Wrapper, id: string): Promise<void> {
  await armSelectionBar()
  await wrapper.get(`[data-testid="context-bar-${id}"]`).trigger('click')
}

/** Copies the Selection with the Selection bar's Copy, which clears the Selection and arms paste mode (ticket 437). */
export async function copySelection(wrapper: Wrapper): Promise<void> {
  await pressBar(wrapper, 'copy')
}

/** Rotates the Selection with the Selection bar's Rotate. */
export async function rotate(wrapper: Wrapper): Promise<void> {
  await pressBar(wrapper, 'rotate')
}

/** Presses Clear this Project in the Project panel, which opens first; the confirmation it raises is the caller's. */
export async function deleteAll(wrapper: Wrapper): Promise<void> {
  if (!wrapper.find('[data-testid="project-clear"]').exists()) {
    await openPanel(wrapper, 'strip-project')
  }
  await wrapper.get('[data-testid="project-clear"]').trigger('click')
}

/** Picks a language in Menu (tickets 368, 443): the panel opens first, then the switcher. */
export async function chooseAppLanguage(wrapper: Wrapper, locale: Locale): Promise<void> {
  await openPanel(wrapper, 'strip-menu')
  await chooseLanguage(wrapper, locale)
}

/** Opens Saved Projects, the sheet Menu's item raises, unless it is already up. */
export async function openSavedProjects(wrapper: Wrapper): Promise<void> {
  if (wrapper.find('[data-testid="project-list"]').exists()) {
    return
  }
  await openPanel(wrapper, 'strip-menu')
  await wrapper.get('[data-testid="menu-saved-projects"]').trigger('click')
}

/** Whether a Tool's pill tile shows lit. */
export function toolState(wrapper: Wrapper, tool: Tool): { pressed: boolean; selected: boolean } {
  const tile = wrapper.get(`[data-testid="pill-tool-${tool}"]`)
  return { pressed: tile.attributes('aria-pressed') === 'true', selected: tile.classes().includes('icon-btn--selected') }
}

/** Reads one element of the Project panel (ProjectPanel card), closing it again so the next canvas press isn't
 * swallowed. */
export async function panelRead(wrapper: Wrapper, testId: string): Promise<{ exists: boolean; text: string }> {
  await openPanel(wrapper, 'strip-project')
  const element = wrapper.find(`[data-testid="${testId}"]`)
  const read = { exists: element.exists(), text: element.exists() ? element.text() : '' }
  await closePanel(wrapper)
  return read
}

/** Sets the colour popover's Custom color the way a person does: opens the picker, types the hex and presses Enter,
 * which takes it. */
export async function chooseCustomColor(wrapper: Wrapper, hex: string): Promise<void> {
  if (!wrapper.find('[data-testid="custom-color-button"]').exists()) {
    await openColorPopover(wrapper)
  }
  await wrapper.get('[data-testid="custom-color-button"]').trigger('click')
  const field = wrapper.get<HTMLInputElement>('[data-testid="custom-color-hex"]')
  await field.setValue(hex)
  await field.trigger('keydown', { key: 'Enter' })
}
