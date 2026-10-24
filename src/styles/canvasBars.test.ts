import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8')

describe('Canvas strip and Canvas footer height (ticket 544)', () => {
  const controls = read('src/styles/controls.css')

  it('derives both heights from their tallest item plus 1px above and below', () => {
    expect(controls).toMatch(/--strip-height: calc\(var\(--strip-item-height\) \+ 2 \* var\(--bar-pad\)\)/)
    expect(controls).toMatch(/--progress-height: calc\(var\(--footer-item-height\) \+ 2 \* var\(--bar-pad\)\)/)
    expect(controls).toMatch(/--bar-pad: 1px/)
  })

  it('has the phone footer be two rows and the strip follow the touch target', () => {
    expect(controls).toMatch(/--progress-height: calc\(var\(--control-height\) \+ var\(--footer-row-gap\) \+ var\(--footer-item-height\)/)
    expect(controls).toMatch(/pointer: coarse\)[^}]*\{\s*:root \{\s*--strip-item-height: var\(--touch-target\)/)
  })

  it.each([
    ['src/components/canvas/CanvasStrip.vue', /border-radius: var\(--canvas-box-radius\) var\(--canvas-box-radius\) 0 0/],
    ['src/components/canvas/ProgressBar.vue', /border-radius: 0 0 var\(--canvas-box-radius\) var\(--canvas-box-radius\)/],
    ['src/overview/OverviewPage.vue', /border-radius: 0 0 var\(--canvas-box-radius\) var\(--canvas-box-radius\)/],
  ])('rounds %s with the canvas box radius token', (file, corners) => {
    expect(read(file)).toMatch(corners)
  })

  it('makes the canvas box itself use the radius token', () => {
    expect(controls).toMatch(/--canvas-box-radius: var\(--radius-lg\)/)
    expect(read('src/components/canvas/CanvasPanel.vue')).toMatch(/border-radius: var\(--canvas-box-radius\)/)
  })
})
