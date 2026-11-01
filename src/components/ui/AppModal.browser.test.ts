import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import AppModal from './AppModal.vue'

// A Modal is never taller than the screen, so its buttons can always be reached (ticket 0654): an iPad in landscape, with
// Safari's toolbars, is short.
const SIZES = ['confirm', 'panel', 'narrow'] as const
/** Short screens: a 13" iPad in landscape under Safari's toolbars, a laptop window, a phone on its side. */
const SCREENS = [
  [1366, 760],
  [1280, 600],
  [844, 390],
] as const

function tallModal(size: (typeof SIZES)[number]) {
  return defineComponent({
    setup: () => () =>
      h(AppModal, { title: 'Tall', size }, { default: () => h('div', { style: { height: '2000px' } }, 'Body'), actions: () => h('button', { type: 'button', 'data-testid': 'last-action' }, 'Create') }),
  })
}

const inView = (box: DOMRect) => box.top >= 0 && box.bottom <= innerHeight

describe('AppModal on a short screen', () => {
  for (const size of SIZES) {
    it(`keeps the ${size} Modal on screen with its buttons in reach`, async () => {
      const mounted = await mountAt(tallModal(size), {}, { locale: 'en', width: SCREENS[0][0] })
      for (const [width, height] of SCREENS) {
        await page.viewport(width, height)
        await settleForMeasuring()
        const dialog = mounted.root.querySelector<HTMLElement>('.app-modal')!
        expect({ width, height, dialogInView: inView(dialog.getBoundingClientRect()) }).toEqual({ width, height, dialogInView: true })
        dialog.scrollTop = dialog.scrollHeight
        const action = mounted.root.querySelector<HTMLElement>('[data-testid="last-action"]')!
        expect({ width, height, actionInView: inView(action.getBoundingClientRect()) }).toEqual({ width, height, actionInView: true })
      }
    })
  }
})
