// Node has no Path2D: a stand-in that holds nothing, so a drawing test that never looks at a path still runs.
// `recordingContext` puts one in its place that writes the calls down.
if (typeof Path2D === 'undefined') {
  Object.assign(globalThis, {
    Path2D: class {
      roundRect(): void {}
      addPath(): void {}
    },
  })
}
