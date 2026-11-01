import { describe, expect, it } from 'vitest'
import { maskFromModel, subjectModelInput } from './cutOutModel'

// The cut-out model's input and output (ticket 0767, ADR 0087): the picture stretched to the model's square, and its
// answer scaled back to the picture and thresholded into the subject mask.

describe('subjectModelInput', () => {
  it('stretches the picture to the square, planar, each channel value / 255 - 0.5', () => {
    // A 2 × 1 picture: white at the left, black at the right.
    const picture = { width: 2, height: 1, data: new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]) }
    const input = subjectModelInput(picture, 4)
    expect(input).toHaveLength(3 * 4 * 4)
    // Each channel's plane, row 0: the left quarter white, the right quarter black, blended between.
    for (const channel of [0, 1, 2]) {
      const row = Array.from(input.subarray(channel * 16, channel * 16 + 4))
      expect(row.map((value) => Math.round(value * 100) / 100)).toEqual([0.5, 0.25, -0.25, -0.5])
    }
    // Every row the same, as the picture has one.
    expect(Array.from(input.subarray(12, 16)).map((value) => Math.round(value * 100) / 100)).toEqual([0.5, 0.25, -0.25, -0.5])
  })
})

describe('maskFromModel', () => {
  it('keeps where the model says subject, scaled back to the picture', () => {
    // A 2 × 2 answer: the left column subject.
    const output = new Float32Array([0.9, 0.1, 0.9, 0.1])
    const mask = maskFromModel(output, 2, 4, 2)
    expect(mask.width).toBe(4)
    expect(mask.height).toBe(2)
    expect(Array.from(mask.subject)).toEqual([1, 1, 0, 0, 1, 1, 0, 0])
  })

  it('judges the answer between its own lowest and highest values, as the model is scaled', () => {
    // Nothing reaches 0.5, but the left is the highest the model said.
    const output = new Float32Array([0.3, 0.05, 0.3, 0.05])
    expect(Array.from(maskFromModel(output, 2, 2, 2).subject)).toEqual([1, 0, 1, 0])
  })

  it('keeps the whole picture when the answer is flat: no subject told apart', () => {
    const output = new Float32Array([0.2, 0.2, 0.2, 0.2])
    expect(Array.from(maskFromModel(output, 2, 3, 1).subject)).toEqual([1, 1, 1])
  })
})
