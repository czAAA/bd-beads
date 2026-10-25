import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/project'
import { CONTROLS, controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { FIT_LOCALES, mountAt } from '../../testUtils/browserFit'
import { measureOpenBubble } from '../../testUtils/hoverInPage'
import IconButton from './IconButton.vue'

// Every registry action's Tooltip stays on the screen and inside what clips it, at the screen's left and right edges,
// in every language (ticket 552; replaces the e2e hover text check over app screens).
const project = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!.id, size: { width: 15, height: 30, unit: 'mm' } })
// The narrowest screen is where a bubble has least room; the wide one adds nothing a Tooltip can fail on.
const WIDTH = 320
/** Clear of the screen's top and bottom, so a bubble's side (above or below) is the Tooltip's choice. */
const TRIGGER_TOP = '240px'
const OPEN_WITHIN_MS = 1000
/** Each edge is tried with one of the two ways a person opens a Tooltip with no touch: hovering at the left, focusing
 * at the right. A touch long press opens the same bubble and is
 * not tried here. */
const TRIES = [['left', 'hover'], ['right', 'focus']] as const

/** The registry reads these to decide if an action is on; every answer is "yes", so every Tooltip is the plain one. */
const deps = controlDeps(new Proxy({ activeProject: () => project }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => true) }) as never)

const harness = (id: string, side: (typeof TRIES)[number][0]) =>
  defineComponent({
    render: () =>
      h('div', { style: { position: 'fixed', top: TRIGGER_TOP, [side]: '0' } }, [
        h(IconButton, { action: controlAction(id), deps }),
      ]),
  })

/** Waits for the bubble to appear, then for its fade-in to end, and measures it. */
async function openAndMeasure(root: HTMLElement, open: (button: HTMLElement) => Promise<unknown> | void) {
  const button = root.querySelector('button')!
  button.closest('.app-tooltip')!.setAttribute('data-hover-probe', '0')
  await open(button)
  await vi.waitFor(() => { if (!measureOpenBubble(0)) throw new Error('not open yet') }, { timeout: OPEN_WITHIN_MS }).catch(() => undefined)
  await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  return measureOpenBubble(0)
}

describe('Tooltips of the registry actions', () => {
  for (const control of CONTROLS.filter((action) => action.icon)) {
    for (const locale of FIT_LOCALES) {
      it(`${control.id} stays on screen in ${locale} at ${WIDTH}px, hovered at the left edge and focused at the right`, async () => {
        for (const [side, how] of TRIES) {
          const mounted = await mountAt(harness(control.id, side), {}, { locale, width: WIDTH, text: false })
          const bubble = await openAndMeasure(mounted.root, how === 'hover' ? (button) => userEvent.hover(button) : (button) => button.focus())
          expect(bubble, `the Tooltip did not open by ${how} on the ${side}`).not.toBeNull()
          expect(bubble!.cuts, `${how} on the ${side}`).toEqual([])
          mounted.unmount()
        }
      })
    }
  }
})
