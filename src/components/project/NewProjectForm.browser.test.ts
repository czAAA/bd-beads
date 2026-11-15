import { defineComponent, h, provide } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { mountAt } from '../../testUtils/browserFit'
import { PANEL_CONTEXT } from '../shell/panelContext'
import NewProjectForm from './NewProjectForm.vue'

// The form's three ways out are one size (ticket 0679): Convert image has a Tooltip, so AppButton wraps it, and the
// form's rules must still reach the button inside.
describe('NewProjectForm buttons', () => {
  it('draws Create Project, Convert image and Pick a starter at one width and height', async () => {
    const { root } = await mountAt(NewProjectForm, { namePlaceholder: 'Project 1' }, { locale: 'en', width: 360 })
    const size = (testid: string) => {
      const box = root.querySelector(`[data-testid="${testid}"]`)!.getBoundingClientRect()
      return { width: box.width, height: box.height }
    }
    const create = size('create-project')
    expect({ convert: size('convert-image'), starter: size('pick-starter') }).toEqual({ convert: create, starter: create })
  })
})

/** A finger's tap on `target`: the press, the release and the click it makes, each where the browser sends it. */
function tap(target: Element) {
  const at = { bubbles: true, cancelable: true, composed: true, pointerType: 'touch', isPrimary: true }
  target.dispatchEvent(new PointerEvent('pointerdown', at))
  target.dispatchEvent(new PointerEvent('pointerup', at))
  target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true }))
}

// A tap outside an open Info Tooltip closes it and still does what it was aimed at (ticket 0955, UX-077).
describe('NewProjectForm with an Info Tooltip open', () => {
  it('opens the Starter gallery on one tap on Pick a starter, and the Tooltip closes', async () => {
    const openSub = vi.fn()
    const inPanel = defineComponent({
      setup() {
        provide(PANEL_CONTEXT, { close: vi.fn(), openSub })
        return () => h(NewProjectForm, { namePlaceholder: 'Project 1' })
      },
    })
    const { root } = await mountAt(inPanel, {}, { locale: 'en', width: 360 })
    const get = (selector: string) => root.querySelector<HTMLElement>(selector)!
    get('[data-testid="new-project-technique"] button[aria-haspopup]').click()
    await vi.waitFor(() => expect(document.querySelector('[role="menuitemradio"][data-value="peyote"]')).not.toBeNull())
    document.querySelector<HTMLElement>('[role="menuitemradio"][data-value="peyote"]')!.click()
    await vi.waitFor(() => expect(root.querySelector('[data-testid="new-project-peyote-drop-info"]')).not.toBeNull())
    const info = get('[data-testid="new-project-peyote-drop-info"]')
    const bubble = () => info.closest('.app-tooltip')!.querySelector<HTMLElement>('[role="tooltip"]')!
    tap(info)
    await vi.waitFor(() => expect(bubble().checkVisibility()).toBe(true))

    const starter = get('[data-testid="pick-starter"]')
    const box = starter.getBoundingClientRect()
    // The open note doesn't cover the button: a finger there lands on it.
    expect(starter.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true)
    tap(starter)

    expect(openSub).toHaveBeenCalledTimes(1)
    await vi.waitFor(() => expect(bubble().checkVisibility()).toBe(false))
  })
})
