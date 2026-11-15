// Node has no Path2D, which the Lifted piece's shapes are (ticket 1006): a stand-in that holds nothing, so a drawing
// test that never looks at the piece still runs. `recordingContext` puts one in its place that writes the calls down.
if (typeof Path2D === 'undefined') {
  Object.assign(globalThis, {
    Path2D: class {
      roundRect(): void {}
      addPath(): void {}
    },
  })
}
