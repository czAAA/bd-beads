import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { mountAt } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import ToolPill from './ToolPill.vue'

// Opened from the keyboard, the Colors popover puts focus on the chosen swatch (ticket 0961, UX-049; KeyboardFocus
// card). In a real browser, as a popover hidden until it is placed cannot take focus, which jsdom does not know; the
// arrows, Escape and a choice are ColorPopover.test.ts's.

/** The Tool pill in an app shell (where its popover is teleported), opening its popover as the app does. */
const PillInShell = defineComponent({
  setup() {
    const popoverOpen = ref(false)
    return () =>
      h('div', { class: 'app-shell' }, [
        h(ToolPill, {
          activeTool: 'paint',
          position: 'bottom',
          recentsInPill: [],
          hasClipboard: false,
          colorHex: '#e63746',
          colorName: 'Red',
          selectedColorId: 'blue',
          popoverOpen: popoverOpen.value,
          'onUpdate:popoverOpen': (open: boolean) => (popoverOpen.value = open),
        }),
      ])
  },
})

const swatches = () => [...document.querySelectorAll<HTMLElement>('[data-testid="color-popover"] [data-testid="palette-swatch"]')]

async function openByKey(key: '{Enter}' | ' ') {
  const { root } = await mountAt(PillInShell, {}, { locale: 'en', width: 1280 })
  root.querySelector<HTMLElement>('[data-testid="pill-color"]')!.focus()
  await userEvent.keyboard(key)
  await settleForMeasuring()
}

describe('the Colors popover by keyboard (ticket 0961)', () => {
  it.each([
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ] as const)('opened with %s, puts focus on the chosen swatch', async (_, key) => {
    await openByKey(key)
    expect(document.activeElement).toBe(swatches().find((swatch) => swatch.dataset.colorId === 'blue'))
  })
})
