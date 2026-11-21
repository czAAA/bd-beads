import { describe, expect, it } from 'vitest'
import { SCREENSHOT_STEPS, shrinkToFit } from './shrinkScreenshot'

const steps = { ...SCREENSHOT_STEPS, cap: 1000 }

/** A fake encoder: its size is pixels × quality ÷ `divisor`; it logs every try. */
function fake(divisor: number) {
  const tries: Array<[number, number, number]> = []
  return {
    tries,
    encode: async (width: number, height: number, quality: number) => {
      tries.push([width, height, quality])
      return { size: (width * height * quality) / divisor }
    },
  }
}

describe('shrinkToFit', () => {
  it('starts at 1600 px on the longest side and the best quality, and stops at the first fit', async () => {
    const encoder = fake(1_000_000_000)
    const result = await shrinkToFit({ width: 4000, height: 3000 }, encoder.encode, steps)
    expect(encoder.tries).toEqual([[1600, 1200, 0.85]])
    expect(result).toMatchObject({ width: 1600, height: 1200 })
  })

  it('steps the quality down before it shrinks the picture', async () => {
    // The divisor makes 0.85 and 0.75 over the cap and 0.65 under it.
    const encoder = fake((1600 * 1200 * 0.7) / 1000)
    const result = await shrinkToFit({ width: 3200, height: 2400 }, encoder.encode, steps)
    expect(encoder.tries.map(([, , quality]) => quality)).toEqual([0.85, 0.75, 0.65])
    expect(result?.width).toBe(1600)
  })

  it('shrinks the size by steps once every quality is over, down to 800 px, then gives up', async () => {
    const encoder = fake(1)
    expect(await shrinkToFit({ width: 3200, height: 2400 }, encoder.encode, steps)).toBeNull()
    const sizes = [...new Set(encoder.tries.map(([width]) => width))]
    expect(sizes).toEqual([1600, 1280, 1024, 819, 800])
    expect(encoder.tries.filter(([width]) => width === 800).map(([, , quality]) => quality)).toEqual([0.85, 0.75, 0.65, 0.55, 0.5])
  })

  it('keeps a small picture at its own size, never scaling up', async () => {
    const encoder = fake(1)
    await shrinkToFit({ width: 600, height: 400 }, encoder.encode, steps)
    expect(new Set(encoder.tries.map(([width]) => width))).toEqual(new Set([600]))
  })

  it('uses the longest side for a tall picture', async () => {
    const encoder = fake(1_000_000_000)
    await shrinkToFit({ width: 1000, height: 4000 }, encoder.encode, steps)
    expect(encoder.tries[0]).toEqual([400, 1600, 0.85])
  })

  it('accepts a result exactly at the cap, and skips a try the encoder cannot make', async () => {
    let call = 0
    const result = await shrinkToFit(
      { width: 100, height: 100 },
      async () => (++call === 1 ? null : { size: 1000 }),
      steps,
    )
    expect(call).toBe(2)
    expect(result?.encoded.size).toBe(1000)
  })
})
