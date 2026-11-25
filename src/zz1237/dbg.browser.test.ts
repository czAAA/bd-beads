import { afterEach, describe, expect, it } from 'vitest'
import type {} from '@vitest/browser-playwright'
import { cdp, page } from 'vitest/browser'
import { defineComponent, h, ref } from 'vue'
import { RADIAL_REACH } from '../domain/radialToolbox'
import { mountAt } from '../testUtils/browserFit'
import { linesOf } from '../testUtils/demoDrawing'
import InsideEditor from '../homepage/inside/InsideEditor.vue'
import { DEMO_FRAME, DEMO_TOOLBOX_BEADS, onCanvas } from '../homepage/inside/demoProjects'
import { TOUR_SCRIPTS } from '../homepage/inside/tourScripts'

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


import { cellUnder, layerUnder, coversOf } from '../domain/sheets'
import { frameOf, canvasOf } from '../domain/layerRecord'
it('dbg', async () => {
  const { editor, root } = await demoBeforeTheRow(1)
  const hand = editor.hand(false, new AbortController().signal)
  const project = hand.canvas.activeProject.value!
  const f = frameOf(project) as any
  const { beads: _b, bead: _bd, ...fr } = f
  const { bead: _x, beads: _y, ...cv } = canvasOf(project) as any
  console.log('DBG frame', JSON.stringify(fr), 'canvas', JSON.stringify(cv), 'covers', JSON.stringify(coversOf(project).map((c) => c.frame)))
  console.log('DBG DEMO_FRAME', JSON.stringify(DEMO_FRAME))
  for (const [line, along] of [[0, 0], [3, 19], [6, 35], [3, 0], [0, 19]] as const) {
    const pos = onCanvas(DEMO_FRAME, line, along)
    const layer = layerUnder(project, pos)
    console.log('DBG pos', line, along, JSON.stringify(pos), layer, JSON.stringify(layer && cellUnder(project, layer as any, pos)), JSON.stringify(await hand.beadAt(pos)))
  }
  await page.screenshot({ path: 'src/zz1237/shot.png' })
  const probe = hand.canvas.surfaceProbe.value as any
  const id = (frameOf(project) as any).id
  for (const [row, column] of [[0, 0], [35, 0], [0, 6], [17, 3]]) console.log('DBG own', row, column, JSON.stringify(probe.beadOnScreen({ row, column, layer: id })))
  console.log('DBG labels', JSON.stringify(probe.rulerLayout.labels.filter((l: any) => l.kind === 'frame').slice(0, 20).map((l: any) => [l.axis, l.position, l.text, Math.round(l.x), Math.round(l.y)])))
  console.log('DBG root', JSON.stringify(root.getBoundingClientRect()))
})
