import { defineComponent, h } from 'vue'
import { describe, expect, it, onTestFinished } from 'vitest'
import { page } from 'vitest/browser'
import { mountAt } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import AppModal from './AppModal.vue'
import ConfirmModal from './ConfirmModal.vue'

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

// A name with no spaces breaks inside the dialog instead of running out of it (Modal card, ticket 0988).
const LONG_NAME = 'MOTHWINGSWOVEN'.repeat(3).slice(0, 40)

describe('AppModal with a long name', () => {
  it('keeps a 40-character name with no space inside the dialog, title and body alike', async () => {
    const question = defineComponent({
      setup: () => () => h(AppModal, { title: `Delete “${LONG_NAME}”?` }, { default: () => h('p', `“${LONG_NAME}” and its Row progress go.`) }),
    })
    const mounted = await mountAt(question, {}, { locale: 'en', width: 1280 })
    const dialog = mounted.root.querySelector<HTMLElement>('.app-modal')!
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
  })
})

describe('ConfirmModal with a single row', () => {
  it('stands its three buttons in one row, the long message wrapping to them, and wraps them only on a narrow screen', async () => {
    const question = defineComponent({
      setup: () => () =>
        h(ConfirmModal, { title: 'Turn the Frame?', message: 'A long message. '.repeat(12), cancelLabel: 'Cancel', extraLabel: 'Rotate and reset progress', confirmLabel: 'Rotate and keep progress', singleRow: true }),
    })
    const mounted = await mountAt(question, {}, { locale: 'en', width: 1024 })
    const dialog = mounted.root.querySelector<HTMLElement>('.app-modal')!
    const rows = () => new Set([...dialog.querySelectorAll('button')].map((button) => Math.round(button.getBoundingClientRect().top))).size
    expect(rows()).toBe(1)
    expect(dialog.offsetWidth).toBeLessThan(700)

    await page.viewport(390, 700)
    await settleForMeasuring()
    expect(rows()).toBeGreaterThan(1)
    expect(dialog.scrollWidth).toBeLessThanOrEqual(dialog.clientWidth)
  })
})

describe('AppModal over an open popup', () => {
  it('covers a popover already in the top layer, and takes focus', async () => {
    const over = defineComponent({
      setup: () => () => h(AppModal, { title: 'Question' }, { actions: () => h('button', { type: 'button', 'data-autofocus': '' }, 'No') }),
    })
    const popup = Object.assign(document.createElement('div'), { popover: 'manual' })
    popup.style.cssText = 'position: fixed; inset: 0; margin: 0; width: auto; height: auto'
    document.body.append(popup)
    popup.showPopover()
    onTestFinished(() => popup.remove())
    const mounted = await mountAt(over, {}, { locale: 'en', width: 1280 })
    await settleForMeasuring()
    const scrim = mounted.root.querySelector<HTMLElement>('.app-modal-scrim')!
    expect(scrim.contains(document.elementFromPoint(2, 2))).toBe(true)
    expect(scrim.getBoundingClientRect().width).toBe(innerWidth)
    expect(scrim.getBoundingClientRect().height).toBe(innerHeight)
    expect(document.activeElement?.textContent).toBe('No')
  })
})
