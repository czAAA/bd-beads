import type { VueWrapper } from '@vue/test-utils'

/** Picks a value in a PanelPicker (ticket 0553): opens its menu from the button, then presses the item. */
export async function choosePanelOption(wrapper: Pick<VueWrapper, 'find'>, testid: string, value: string): Promise<void> {
  await wrapper.find(`[data-testid="${testid}"] button[aria-haspopup]`).trigger('click')
  await wrapper.find(`[data-testid="${testid}"] [role="menuitemradio"][data-value="${value}"]`).trigger('click')
}

/** The value a PanelPicker shows, from its button's name ("Tools position: Left" gives "Left", "Language: EN,
 * English" gives "English": the code it shows comes first, ticket 0856). */
export function panelOptionShown(wrapper: Pick<VueWrapper, 'find'>, testid: string): string {
  const button = wrapper.find(`[data-testid="${testid}"] button[aria-haspopup]`)
  const value = (button.attributes('aria-label') ?? '').split(': ').slice(1).join(': ')
  const code = `${button.find('.panel-picker__value').exists() ? button.find('.panel-picker__value').text() : ''}, `
  return value.startsWith(code) ? value.slice(code.length) : value
}
