import type { DrawingContext } from '../rendering/beadLook'

/**
 * A stand-in for a canvas's 2D context that writes down every drawing call, with the fill color and opacity in force at
 * the time, so a test can say what was drawn without a real canvas (jsdom has none).
 */
export function recordingContext() {
  const calls: { name: string; args: unknown[]; fillStyle: unknown; globalAlpha: number }[] = []
  const state = { fillStyle: '#000000' as unknown, globalAlpha: 1 }
  const stack: (typeof state)[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args, fillStyle: state.fillStyle, globalAlpha: state.globalAlpha })
    }

  const context = {
    save: () => stack.push({ ...state }),
    restore: () => Object.assign(state, stack.pop()),
    setTransform: record('setTransform'),
    clearRect: record('clearRect'),
    fillRect: record('fillRect'),
    beginPath: record('beginPath'),
    rect: record('rect'),
    clip: record('clip'),
    moveTo: record('moveTo'),
    lineTo: record('lineTo'),
    arcTo: record('arcTo'),
    roundRect: record('roundRect'),
    drawImage: record('drawImage'),
    imageSmoothingEnabled: true,
    closePath: record('closePath'),
    fill: record('fill'),
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(value: unknown) {
      state.fillStyle = value
    },
    get globalAlpha() {
      return state.globalAlpha
    },
    set globalAlpha(value: number) {
      state.globalAlpha = value
    },
  } as unknown as DrawingContext

  return { context, calls, named: (name: string) => calls.filter((call) => call.name === name) }
}
