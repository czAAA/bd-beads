import type { DrawingContext } from '../rendering/beadLook'

/** A 2D context stand-in that writes down every drawing call with the fill and stroke colors and opacity in force (jsdom has
 * none). */
export function recordingContext() {
  const calls: { name: string; args: unknown[]; fillStyle: unknown; strokeStyle: unknown; globalAlpha: number }[] = []
  const state = { fillStyle: '#000000' as unknown, strokeStyle: '#000000' as unknown, globalAlpha: 1 }
  const stack: (typeof state)[] = []
  const record =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push({ name, args, fillStyle: state.fillStyle, strokeStyle: state.strokeStyle, globalAlpha: state.globalAlpha })
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
    arc: record('arc'),
    fillText: record('fillText'),
    translate: record('translate'),
    rotate: record('rotate'),
    stroke: record('stroke'),
    setLineDash: record('setLineDash'),
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    roundRect: record('roundRect'),
    drawImage: record('drawImage'),
    createPattern: (...args: unknown[]) => {
      const pattern = { setTransform: () => {} }
      record('createPattern')(...args)
      return pattern
    },
    imageSmoothingEnabled: true,
    closePath: record('closePath'),
    fill: record('fill'),
    get fillStyle() {
      return state.fillStyle
    },
    set fillStyle(value: unknown) {
      state.fillStyle = value
    },
    get strokeStyle() {
      return state.strokeStyle
    },
    set strokeStyle(value: unknown) {
      state.strokeStyle = value
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
