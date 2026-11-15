import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import { userEvent } from 'vitest/browser'
import { controlAction } from '../../composables/shell/controlRegistry'
import { provideButtonNames } from '../../composables/ui/useButtonNames'
import { en } from '../../i18n/en'
import { mountAt } from '../../testUtils/browserFit'
import IconButton from './IconButton.vue'

// What the buttons do (ticket 0927): every button of the strip and the pill shows its Tooltip's name at once, the
// bubbles clear of each other, until the next press. Layout, so a real browser.
const IN_AREA = ['tool-paint', 'tool-fill', 'tool-select', 'mirror']

/** Four pill tiles side by side in a names area, one button outside it, and the shell's What the buttons do. */
function host() {
  let names!: ReturnType<typeof provideButtonNames>
  const component = defineComponent({
    setup() {
      names = provideButtonNames()
      const tile = (id: string) => h(IconButton, { action: controlAction(id), variant: 'pill', tooltip: { placement: 'top' }, 'data-testid': id })
      return () =>
        h('div', { style: { paddingTop: '200px' } }, [
          h('div', { 'data-button-names': '', style: { display: 'flex' } }, IN_AREA.map(tile)),
          h('div', { style: { marginTop: '120px' } }, [tile('tool-hand')]),
        ])
    },
  })
  return { component, names: () => names }
}

/** The bubbles on screen, by the text they show. */
function bubbles() {
  return [...document.querySelectorAll<HTMLElement>('[data-testid="tooltip"]')].filter((bubble) => bubble.checkVisibility())
}

/** The names of bubbles on screen that overlap another. */
function overlapping(): string[] {
  const shown = bubbles().map((bubble) => ({ name: bubble.textContent?.trim() ?? '', box: bubble.getBoundingClientRect() }))
  const apart = (a: DOMRect, b: DOMRect) => a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top
  return shown.filter((one) => shown.some((other) => other !== one && !apart(one.box, other.box))).map((one) => one.name)
}

describe('What the buttons do (ticket 0927)', () => {
  it('names every button in the strip and the pill at once, each clear of the others, and goes at the next press', async () => {
    const { component, names } = host()
    const mounted = await mountAt(component, {}, { locale: 'en', width: 390, text: false })

    names().show()
    await expect.poll(() => bubbles().length).toBe(IN_AREA.length)

    expect(bubbles().map((bubble) => bubble.textContent?.trim())).toEqual(IN_AREA.map((id) => controlAction(id).name(en)))
    await expect.poll(overlapping).toEqual([])

    await userEvent.click(document.body, { position: { x: 5, y: 5 } })
    await expect.poll(() => bubbles().length).toBe(0)
    expect(names().shown.value).toBe(false)
    mounted.unmount()
  })
})
