import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { recordingContext } from '../testUtils/recordingContext'
import { drawFrameTurn, FRAME_TURN_MS } from './frameTurn'

const css = readFileSync(resolve(__dirname, '../../src/styles/design-values.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')

describe('Rotate Frame seen turning (ticket 1016)', () => {
  it('keeps its length equal to its CSS twin', () => {
    expect(FRAME_TURN_MS).toBe(parseFloat(/--frame-turn-duration:\s*([^;]+);/.exec(css)![1]!))
  })

  it('covers where the Frame lies now with its paper and turns the Frame as it was about its middle', () => {
    const { context, calls } = recordingContext()
    const image = {} as CanvasImageSource
    // A 40 by 20 Frame at (100, 50) turned to 20 by 40 about its middle (120, 60); the canvas starts 10px left of the
    // drawing area, at twice its density.
    const from = { x: 100, y: 50, width: 40, height: 20 }
    const to = { x: 110, y: 40, width: 20, height: 40 }
    drawFrameTurn(context as unknown as CanvasRenderingContext2D, { image, from, to, paper: '#fafafa', progress: 0.5, origin: { x: -10, y: 0 }, ratio: 2, bitmap: { width: 400, height: 300 } })
    const fill = calls.find((call) => call.name === 'fillRect')!
    expect([fill.fillStyle, fill.args]).toEqual(['#fafafa', [110, 40, 20, 40]])
    expect(calls.find((call) => call.name === 'translate')!.args).toEqual([120, 60])
    expect(calls.find((call) => call.name === 'rotate')!.args).toEqual([Math.PI / 4])
    expect(calls.find((call) => call.name === 'drawImage')!.args).toEqual([image, 220, 100, 80, 40, -20, -10, 40, 20])
  })
})
