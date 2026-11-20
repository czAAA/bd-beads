import { defineComponent, h } from 'vue'
import { describe, expect, it } from 'vitest'
import type {} from '@vitest/browser-playwright'
import { cdp } from 'vitest/browser'
import { createProject } from '../../domain/createProject'
import { mountAt } from '../../testUtils/browserFit'
import { expectTouchScreen } from '../../testUtils/hitAreas'
import { withLayers } from '../../testUtils/layerFields'
import FramePanel from './FramePanel.vue'

const project = withLayers(createProject({ technique: 'loom', beadId: 'toho-cube-1.5mm', name: 'Moth', size: { width: 12, height: 12, unit: 'beads' } }), {
  frame: { row: 2, column: 3, rows: 6, columns: 5, technique: 'loom' as const, beads: {} },
})
const EDGES = ['top', 'bottom', 'left', 'right'] as const

// On a touch screen each half of an edge's − | + takes the presses on its own drawing: `touch-target` wide, its hit area
// its own box, as tall as the row (ticket 0933). The taps are the browser's own touches (CDP) on this file's touch page:
// switching touch emulation on and off in the shared page left the files after it with no key chips on CI (ticket 1143).
describe('FramePanel edge steppers on a coarse pointer (ticket 0933)', () => {
  it('takes a tap at the centre and both quarters of each half, and at the top and bottom of its row, as that half’s step, for all four edges', async () => {
    expectTouchScreen()
    const steps: [string, number][] = []
    const wide = defineComponent({ setup: () => () => h('div', { style: { width: '360px', '--panel-item-height': 'var(--panel-row-touch)' } }, [h(FramePanel, { project, onStep: (edge: string, by: number) => steps.push([edge, by]) })]) })
    const { root } = await mountAt(wide, {}, { locale: 'en', width: 390 })
    const page = getComputedStyle(document.documentElement)
    const touchTarget = parseFloat(page.getPropertyValue('--touch-target')) * parseFloat(page.fontSize)
    const wrong: string[] = []
    for (const edge of EDGES) {
      for (const [half, by] of [['in', -1], ['out', 1]] as const) {
        const button = root.querySelector<HTMLElement>(`[data-testid="frame-edge-${edge}-${half}"]`)!
        // The export rows above the edges grow with each print switch: a tap lands only on screen.
        button.scrollIntoView({ block: 'center' })
        const drawn = button.getBoundingClientRect()
        if (drawn.width < touchTarget) wrong.push(`${edge} ${half} is ${drawn.width}px wide`)
        const row = root.querySelector<HTMLElement>(`[data-testid="frame-panel-cell-${edge}"]`)!.getBoundingClientRect()
        const middle = drawn.top + drawn.height / 2
        // Across the half at its middle, and down the row at its centre: the row's top and bottom are the half's too.
        const taps = [...[0.25, 0.5, 0.75].map((share) => [drawn.left + drawn.width * share, middle]), [drawn.left + drawn.width / 2, row.top + 1], [drawn.left + drawn.width / 2, row.bottom - 1]]
        for (const [tapX, tapY] of taps) {
          const [x, y] = [Math.round(tapX), Math.round(tapY)]
          steps.length = 0
          await cdp().send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
          await cdp().send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
          await expect.poll(() => steps.length).toBeGreaterThan(0)
          if (steps.some(([stepped, step]) => stepped !== edge || step !== by)) wrong.push(`a tap at ${x}, ${y} on ${edge} ${half} gave ${JSON.stringify(steps)}`)
        }
      }
    }
    expect(wrong).toEqual([])
  })
})
