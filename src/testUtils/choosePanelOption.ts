import type { VueWrapper } from '@vue/test-utils'

/** Picks a value in a PanelPicker (ticket 0553): opens its menu from the button, then presses the item. */
export async function choosePanelOption(wrapper: Pick<VueWrapper, 'find'>, testid: string, value: string): Promise<void> {
  await wrapper.find(`[data-testid="${testid}"] button[aria-haspopup]`).trigger('click')
  await wrapper.find(`[data-testid="${testid}"] [role="menuitemradio"][data-value="${value}"]`).trigger('click')
}

/** The value a PanelPicker shows, from its button's name ("Tools position: Left" gives "Left"). */
export function panelOptionShown(wrapper: Pick<VueWrapper, 'find'>, testid: string): string {
  const name = wrapper.find(`[data-testid="${testid}"] button[aria-haspopup]`).attributes('aria-label') ?? ''
  return name.slice(name.indexOf(': ') + 2)
}
