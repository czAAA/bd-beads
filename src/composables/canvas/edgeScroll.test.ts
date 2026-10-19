import { describe, expect, it } from 'vitest'
import { edgeScrollStep } from './edgeScroll'

const size = { width: 400, height: 300 }

describe('edgeScrollStep', () => {
  it('does not scroll while the pointer is away from the edges', () => {
    expect(edgeScrollStep({ x: 200, y: 150 }, size)).toEqual({ dx: 0, dy: 0 })
    expect(edgeScrollStep({ x: 16, y: 284 }, size)).toEqual({ dx: 0, dy: 0 })
  })

  it('scrolls toward the edge the pointer touches', () => {
    expect(edgeScrollStep({ x: 399, y: 150 }, size).dx).toBeGreaterThan(0)
    expect(edgeScrollStep({ x: 1, y: 150 }, size).dx).toBeLessThan(0)
    expect(edgeScrollStep({ x: 200, y: 299 }, size).dy).toBeGreaterThan(0)
    expect(edgeScrollStep({ x: 200, y: 1 }, size).dy).toBeLessThan(0)
  })

  it('goes faster the further past the edge, up to a cap', () => {
    const touching = edgeScrollStep({ x: 400, y: 150 }, size).dx
    const past = edgeScrollStep({ x: 440, y: 150 }, size).dx
    expect(past).toBeGreaterThan(touching)
    expect(edgeScrollStep({ x: 4000, y: 150 }, size).dx).toBe(past)
  })

  it('scrolls both ways in a corner', () => {
    const step = edgeScrollStep({ x: 0, y: 300 }, size)
    expect(step.dx).toBeLessThan(0)
    expect(step.dy).toBeGreaterThan(0)
  })
})
