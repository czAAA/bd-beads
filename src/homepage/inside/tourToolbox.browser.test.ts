import { afterEach, describe, expect, it } from 'vitest'
import type {} from '@vitest/browser-playwright'
import { cdp, page } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { RADIAL_REACH } from '../../domain/radialToolbox'
import { mountAt } from '../../testUtils/browserFit'
import { linesOf } from '../../testUtils/demoDrawing'
import InsideEditor from './InsideEditor.vue'
import { DEMO_FRAME, DEMO_TOOLBOX_BEADS, onCanvas } from './demoProjects'
import { TOUR_SCRIPTS } from './tourScripts'

// Tools at the pointer played with motion (ticket 1114), the demo's box away from the window's corner as it stands on
// the Homepage: the hold's hairline and the Radial toolbox come where the ghost pressed, inside the box.

/** The row plays with motion: these tests otherwise run under reduced motion, which draws no hairline. */
async function withMotion(on: boolean): Promise<void> {
  await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: on ? 'no-preference' : 'reduce' }] })
}

afterEach(() => withMotion(false))

/** The slack of a measure, in px. */
const SLACK = 1.5
/** How many frames a bead keeps its place before the demo's view counts as set. */
const STEADY_FRAMES = 20

/** The demo editor in a box off the window's corner, drawn at `zoom`, with the rows before Tools at the pointer applied. */
async function demoBeforeTheRow(zoom: number) {
  const editor = ref<InstanceType<typeof InsideEditor>>()
  const box = { display: 'grid', width: `${1000 / zoom}px`, height: `${640 / zoom}px` }
  const Box = defineComponent(() => () => h('div', { style: { padding: '90px 0 0 140px', zoom } }, [h('div', { style: box }, [h(InsideEditor, { ref: editor })])]))
  const mounted = await mountAt(Box, {}, { locale: 'en', width: 1440, text: false })
  await page.viewport(1440, 900)
  await editor.value!.fresh()
  const hand = editor.value!.hand(true, new AbortController().signal)
  for (const row of ['canvas', 'techniques', 'editing'] as const) await TOUR_SCRIPTS[row](hand)
  // The first demo of a page may still be laying itself out: its view is set again, and waited for.
  await editor.value!.refit()
  const [line, along] = DEMO_TOOLBOX_BEADS[0]!
  let last = ''
  for (let steady = 0; steady < STEADY_FRAMES; ) {
    const at = await hand.beadAt(onCanvas(DEMO_FRAME, line, along))
    const now = `${Math.round(at.x)},${Math.round(at.y)}`
    steady = now === last ? steady + 1 : 0
    last = now
    await new Promise((resolve) => requestAnimationFrame(resolve))
  }
  return { editor: editor.value!, root: mounted.root.querySelector<HTMLElement>('[data-testid="inside-editor"]')! }
}

/** Where an element's middle is on screen. */
function middleOf(element: Element): { x: number; y: number } {
  const box = element.getBoundingClientRect()
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 }
}

const near = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y) <= SLACK

describe("What's inside's Tools at the pointer row, played (ticket 1114)", () => {
  for (const zoom of [1, 1.5]) {
    it(`at zoom ${zoom}: the hairline, then the ring round the held bead; the ring again round the clicked one; both inside the demo's box`, async () => {
      await withMotion(true)
      const { editor, root } = await demoBeforeTheRow(zoom)
      const hand = editor.hand(false, new AbortController().signal)
      const before = linesOf(hand.canvas.activeProject.value!)
      const [held, , clicked] = await Promise.all(DEMO_TOOLBOX_BEADS.map(([line, along]) => hand.beadAt(onCanvas(DEMO_FRAME, line, along))))

      /** Where the hairline and the open ring stood, how wide the ring was, the names it showed, whether a bead was painted. */
      const seen = { hairlines: [] as { x: number; y: number }[], rings: [] as { x: number; y: number }[], names: new Set<string>(), outside: 0, across: 0, changed: false }
      let playing = true
      const played = TOUR_SCRIPTS.toolsAtPointer(hand).finally(() => (playing = false))
      while (playing) {
        const hairline = root.querySelector('[data-testid="hold-hairline"]')
        if (hairline) seen.hairlines.push(middleOf(hairline))
        const ring = root.querySelector<HTMLElement>('[data-testid="radial-toolbox"]')
        if (ring && hand.canvas.radialToolbox.open.value && ring.style.display !== 'none') {
          seen.rings.push(middleOf(ring))
          const [edge, room] = [ring.getBoundingClientRect(), root.getBoundingClientRect()]
          seen.across = Math.max(seen.across, edge.width)
          if (edge.left < room.left - SLACK || edge.top < room.top - SLACK || edge.right > room.right + SLACK || edge.bottom > room.bottom + SLACK) seen.outside += 1
          const name = root.querySelector('[data-testid="radial-name"]')?.textContent?.trim()
          if (name) seen.names.add(name.replace(/\s*#.*/, ''))
        }
        seen.changed ||= linesOf(hand.canvas.activeProject.value!).join() !== before.join()
        await new Promise((resolve) => requestAnimationFrame(resolve))
      }
      await played

      expect(seen.hairlines.length, 'the hold draws its hairline').toBeGreaterThan(3)
      expect(seen.hairlines.filter((at) => !near(at, held!)), 'the hairline is round the held bead').toEqual([])
      const [first, last] = [seen.rings[0]!, seen.rings.at(-1)!]
      expect(near(first, held!), `the ring opens round the held bead: ${JSON.stringify([first, held])}`).toBe(true)
      expect(near(last, clicked!), `and again round the clicked one: ${JSON.stringify([last, clicked])}`).toBe(true)
      expect(seen.outside, "the ring stays inside the demo's box").toBe(0)
      // The design system's px is 1/16 rem, drawn larger again by the demo's zoom.
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16
      expect(seen.across, "the ring is drawn at the demo's zoom").toBeCloseTo(2 * RADIAL_REACH * rem * zoom, 0)
      expect([...seen.names], 'the slide names the color it is on').toEqual(['Recent 3'])
      expect(seen.changed, 'its beads were painted').toBe(true)
      expect(linesOf(hand.canvas.activeProject.value!), 'and undone from the ring').toEqual(before)
      expect(hand.canvas.radialToolbox.open.value).toBe(false)
    }, 120_000)
  }
})
