import { relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { styleFiles, stylesOf } from '../testUtils/styleSources'

/** Page zoom is locked (ADR 0034) and `touch-action` is one of its layers: every element pans and nothing more
 * (`style.css`). Any other value, `manipulation` or `auto` among them, lets a pinch that starts there zoom the page
 * on iOS (ticket 1166). Read from the stylesheets and style blocks; a style set in a template or by script is not. */

const src = resolve(__dirname, '..')

/** The values that leave the page no zoom: nothing, or panning alone. */
const PANS_ONLY = /^(none|pan-(x|y|left|right|up|down))$/

/** Every `touch-action` in `css` that lets the page zoom, as `selector: declaration`. */
function zoomingTouchActions(css: string): string[] {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].flatMap(([, selector, body]) =>
    [...body.matchAll(/(?<![\w-])touch-action\s*:\s*([^;}]+)/g)]
      .filter(([, value]) => !value.replace(/!important/, '').trim().split(/\s+/).every((part) => PANS_ONLY.test(part)))
      .map(([declaration]) => `${selector.trim()}: ${declaration.trim()}`),
  )
}

describe('no style lets the page pinch-zoom (ADR 0034, ticket 1166)', () => {
  it('passes none and panning, in either order', () => {
    const ok = 'a { touch-action: none; } b { touch-action: pan-x pan-y } c { touch-action: pan-y pan-x !important; } d { touch-action: pan-x; }'
    expect(zoomingTouchActions(ok)).toEqual([])
  })

  it('fails manipulation, auto and pinch-zoom, naming the rule', () => {
    const bad = 'a { touch-action: manipulation; }\n.b :deep(.c) { color: red; touch-action: auto }\nd { touch-action: pan-x pinch-zoom; }'
    expect(zoomingTouchActions(bad)).toEqual(['a: touch-action: manipulation', '.b :deep(.c): touch-action: auto', 'd: touch-action: pan-x pinch-zoom'])
  })

  it('holds for every stylesheet and component in the app', () => {
    const offenders = styleFiles(src).flatMap((path) => zoomingTouchActions(stylesOf(path)).map((found) => `${relative(src, path)} ${found}`))
    expect(offenders).toEqual([])
  })
})
