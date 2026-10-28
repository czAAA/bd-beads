import { defineComponent, h } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import { userEvent } from 'vitest/browser'
import { BEAD_CATALOG } from '../../domain/beads'
import { createProject } from '../../domain/createProject'
import { CONTROLS, controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import type { Translations } from '../../i18n/translations'
import { FIT_LOCALES, longPress, mountAt, TOOLTIP_WIDTH, type FitLocale } from '../../testUtils/browserFit'
import { measureOpenBubble } from '../../testUtils/hoverInPage'
import { measureInUiFont, textIn } from '../../testUtils/longestText'
import { actionKey } from './controlAction'
import IconButton from './IconButton.vue'

// The registry actions' Tooltips stay on screen at its left and right edges, in English and "longest" (tickets 552, 0607):
// one capped-width component, so each shape of bubble is tried on the action whose text is widest, and each way of
// opening once (docs/testing.md, Tooltips).
const project = createProject({ technique: 'loom', beadId: BEAD_CATALOG.find((bead) => bead.id === 'toho/cube/1.5mm')!.id, size: { width: 15, height: 30, unit: 'mm' } })
/** Row progress begun on a Frame, which holds the Frame still: the reason many actions give for being off. */
const locked = { ...project, frame: { row: 0, column: 0, rows: 6, columns: 5, technique: 'loom' as const, beads: {} }, rowProgress: { ...project.rowProgress, currentRow: 1 } }
// The narrowest screen is where a bubble has least room; the wide one adds nothing a Tooltip can fail on.
const WIDTH = TOOLTIP_WIDTH
/** Clear of the screen's top and bottom, so a bubble's side (above or below) is the Tooltip's choice. */
const TRIGGER_TOP = '240px'
const OPEN_WITHIN_MS = 1000
const EDGES = ['left', 'right'] as const
type Edge = (typeof EDGES)[number]

/** One Tooltip a registry action shows: on, with its name, key chip and body, or off, with its name and the reason. */
interface Tip {
  id: string
  name: string
  key?: string
  /** The body, or the reason when off. */
  detail?: string
  off: boolean
}

/** The registry reads these to decide if an action is on and why not: every answer `answer`, about `activeProject`. */
const depsWith = (activeProject: typeof project, answer: boolean) =>
  controlDeps(new Proxy({ activeProject: () => activeProject }, { get: (target, key) => (key in target ? target[key as keyof typeof target] : () => answer) }) as never)
/** Between them, every reason an action gives: a held Frame with a selection, and no Frame with nothing at all. */
const REASON_STATES = [depsWith(locked, true), depsWith(project, false)]

/** Every Tooltip of every registry action with an icon, in `t`. */
const registryTips = (t: Translations): Tip[] =>
  CONTROLS.filter((action) => action.icon).flatMap((action) => {
    const name = action.name(t)
    const reasons = action.disabledBody ? new Set(REASON_STATES.map((deps) => action.disabledBody(t, deps))) : []
    return [{ id: action.id, name, key: actionKey(action), detail: action.body?.(t), off: false }, ...[...reasons].map((reason) => ({ id: action.id, name, detail: reason, off: true }))]
  })

/** A shape of Tooltip: which tips have it, and the side it is asked to open on. */
interface Variant {
  name: string
  has: (tip: Tip) => boolean
  placement: 'top' | 'bottom'
}
const VARIANTS: Variant[] = [
  { name: 'its name alone, below', has: (tip) => !tip.off && !tip.key && !tip.detail, placement: 'bottom' },
  { name: 'its name and key chip, below', has: (tip) => !tip.off && !!tip.key && !tip.detail, placement: 'bottom' },
  { name: 'a body line, below', has: (tip) => !tip.off && !!tip.detail, placement: 'bottom' },
  { name: 'the reason it is off, below', has: (tip) => tip.off, placement: 'bottom' },
  { name: 'all it says, above', has: () => true, placement: 'top' },
]

/** The tip of `variant` whose widest line is widest in `locale`, chosen now, so the choice follows the copy. */
async function widestTip(locale: FitLocale, variant: Variant): Promise<Tip> {
  const tips = registryTips(await textIn(locale)).filter(variant.has)
  expect(tips.length, `no registry action's Tooltip shows ${variant.name}`).toBeGreaterThan(0)
  const measure = await measureInUiFont(tips.flatMap((tip) => [tip.name, tip.key ?? '', tip.detail ?? '']))
  const width = (tip: Tip) => Math.max(measure(tip.name) + (tip.key ? measure(tip.key) : 0), ...(tip.detail?.split('\n').map(measure) ?? []))
  return tips.reduce((best, tip) => (width(tip) > width(best) ? tip : best))
}

const harness = (tip: Tip, edge: Edge, placement: Variant['placement']) =>
  defineComponent({
    render: () =>
      h('div', { style: { position: 'fixed', top: TRIGGER_TOP, [edge]: '0' } }, [
        h(IconButton, { action: controlAction(tip.id), disabled: tip.off, disabledBody: tip.off ? tip.detail : undefined, tooltip: { placement } }),
      ]),
  })

/** Mounts `tip`'s button at `edge`, opens its Tooltip by `open`, waits for the bubble and its fade-in, and measures it. */
async function openAndMeasure(tip: Tip, edge: Edge, placement: Variant['placement'], locale: FitLocale, open: (button: HTMLElement) => Promise<unknown> | void) {
  const { root } = await mountAt(harness(tip, edge, placement), {}, { locale, width: WIDTH, text: false })
  const button = root.querySelector('button')!
  button.closest('.app-tooltip')!.setAttribute('data-hover-probe', '0')
  await open(button)
  await vi.waitFor(() => { if (!measureOpenBubble(0)) throw new Error('not open yet') }, { timeout: OPEN_WITHIN_MS }).catch(() => undefined)
  // A bubble is placed a tick after it shows.
  await new Promise((resolve) => requestAnimationFrame(resolve))
  await Promise.all(document.getAnimations().map((animation) => animation.finished.catch(() => undefined)))
  const bubble = measureOpenBubble(0)
  const box = root.querySelector('[data-testid="tooltip"]')!.getBoundingClientRect()
  const trigger = button.getBoundingClientRect()
  return bubble && { ...bubble, side: box.bottom <= trigger.top ? 'top' : box.top >= trigger.bottom ? 'bottom' : 'over' }
}

const words = (text: string) => text.replace(/\s+/g, ' ').trim()

describe('Tooltips of the registry actions', () => {
  for (const locale of FIT_LOCALES) {
    for (const variant of VARIANTS) {
      for (const edge of EDGES) {
        it(`the widest showing ${variant.name} stays on screen in ${locale} at the ${edge} edge at ${WIDTH}px`, async () => {
          const tip = await widestTip(locale, variant)
          const bubble = await openAndMeasure(tip, edge, variant.placement, locale, (button) => button.focus())
          expect(bubble, `${tip.id}'s Tooltip did not open`).not.toBeNull()
          for (const part of [tip.name, tip.key, tip.detail]) if (part) expect(bubble!.text, `${tip.id}'s Tooltip`).toContain(words(part))
          expect(bubble!.side, `${tip.id}'s Tooltip`).toBe(variant.placement)
          expect(bubble!.cuts, `${tip.id}'s Tooltip "${bubble!.text}"`).toEqual([])
        })
      }
    }
  }

  const opens: [how: string, edge: Edge, open: (button: HTMLElement) => Promise<unknown> | void][] = [
    ['hover', 'left', (button) => userEvent.hover(button)],
    ['keyboard focus', 'right', (button) => button.focus()],
    ['a touch long press', 'left', (button) => longPress(button.closest('.app-tooltip') as HTMLElement)],
  ]
  for (const [how, edge, open] of opens) {
    it(`opens by ${how}`, async () => {
      const tip = registryTips(await textIn('en'))[0]!
      const bubble = await openAndMeasure(tip, edge, 'bottom', 'en', open)
      expect(bubble, `${tip.id}'s Tooltip did not open by ${how}`).not.toBeNull()
    })
  }
})
