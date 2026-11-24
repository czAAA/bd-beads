import { vi } from 'vitest'
import { FRAME_ID } from './testUtils/frameId'

// A Project made in a test lays its Canvas and its first Frame under the same two ids every time (ticket 1217), so a
// test that reads a Frame's id off a Project it builds twice, or names it by `FRAME_ID`, reaches the same Frame.
vi.mock('./domain/layerRecord', async (importOriginal) => {
  const original = await importOriginal<typeof import('./domain/layerRecord')>()
  let nextIsFrame = false
  return {
    ...original,
    newLayerId: () => {
      nextIsFrame = !nextIsFrame
      return nextIsFrame ? 'test-canvas' : FRAME_ID
    },
  }
})

// Node has no Path2D: a stand-in that holds nothing, so a drawing test that never looks at a path still runs.
// `recordingContext` puts one in its place that writes the calls down.
if (typeof Path2D === 'undefined') {
  Object.assign(globalThis, {
    Path2D: class {
      roundRect(): void {}
      moveTo(): void {}
      arcTo(): void {}
      closePath(): void {}
      addPath(): void {}
    },
  })
}
