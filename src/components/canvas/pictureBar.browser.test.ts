import { describe, expect, it } from 'vitest'
import { computed, defineComponent, h } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural, pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { FIT_LOCALES, fitProblems, mountAt, problemsAcrossWidths, tooltipProblems, waysIn } from '../../testUtils/browserFit'
import { settleForMeasuring } from '../../testUtils/textFitInPage'
import ToastRegion from '../ui/ToastRegion.vue'
import ConvertToBeadsPopover from './ConvertToBeadsPopover.vue'
import ReferencePictureBar from './ReferencePictureBar.vue'
import ReferencePreviews from './ReferencePreviews.vue'

// The reference image's picture bar, its Convert to beads popover and its toast (ReferenceImage card, ticket 0883) keep
// their text in their boxes in every language at the desktop widths: the phone is still to be designed.
const DESKTOP_WIDTHS = [1280, 1024] as const

const view = { gridToPoint: (x: number, y: number) => ({ x: x * 2 + 10, y: y * 2 + 20 }), viewport: { width: 1000, height: 760 } }
const place = { x: 200, y: 200, width: 200, angle: 0 }
const picture = { left: 210, top: 320, width: 400, height: 260 }

/** The bar and the popover over a drawing area, as the canvas lays them: in a box they are placed in. */
const Area = defineComponent({
  setup() {
    const { t, locale } = useI18n()
    const words = computed(() => t.value.referenceImage)
    return () =>
      h('div', { style: { position: 'relative', width: '1000px', height: '760px' } }, [
        h(ReferencePreviews, {
          frame: { line: picture, sheet: { left: 130, top: 240, width: 560, height: 420 }, tag: fillBlanks(words.value.frameAround.tag, { size: '126×118' }) },
          convert: { box: picture, label: words.value.convert.preview },
        }),
        h(ReferencePictureBar, {
          place,
          picture,
          barHeight: 40,
          view,
          bead: 20,
          opacity: 50,
          frameBody: fillBlanks(words.value.frameAround.body, { size: '26×18' }),
          convertBody: fillBlanks(words.value.convert.body, { size: '26×18' }),
          // Unpressed, so its Tooltip, held back while the popover is open, is measured too.
          converting: false,
        }),
        h(ConvertToBeadsPopover, {
          picture,
          barTop: 266,
          viewport: view.viewport,
          size: { grid: '126×118', measure: '18.9 × 17.7 cm' },
          source: 'exact',
          beadName: 'TOHO Cube 1.5mm',
          colors: 128,
          colorsMax: 256,
          swatches: ['#e63946', '#f1c40f', '#1d3557'],
          hideAfter: true,
          convertLabel: plural(locale.value, 14868, words.value.convert.button),
          replacedLabel: plural(locale.value, 1204, words.value.convert.replaces),
          ready: true,
        }),
      ])
  },
})

/** The toast Convert makes, the picture hidden after. */
const Toast = defineComponent({
  setup() {
    const { t, locale } = useI18n()
    const text = computed(() => {
      const words = t.value.referenceImage.convert
      return `${fillBlanks(pluralForm(locale.value, 128, words.made), { n: '14 868', colors: 128 })} ${words.hidden}`
    })
    return () => h(ToastRegion, { toasts: [{ id: 'convert-to-beads', text: text.value, tone: 'success', action: { label: t.value.palette.undoButton, run: () => {} }, stamp: 1 }] })
  },
})

describe.each([
  ['Picture bar opened, previews and Convert to beads popover', Area, (root: HTMLElement) => root.querySelector<HTMLElement>('[data-testid="picture-bar-more"]')?.click()],
  ['Convert to beads toast', Toast, undefined],
] as const)('%s text fit', (name, component, act) => {
  for (const locale of FIT_LOCALES) {
    it(`fits its box in ${locale} at ${DESKTOP_WIDTHS.join(', ')}px`, async () => {
      const mounted = await mountAt(component, {}, { locale, width: DESKTOP_WIDTHS[0] })
      act?.(mounted.root)
      await settleForMeasuring()
      const found = await problemsAcrossWidths(DESKTOP_WIDTHS, async (width) => [
        ...(width === DESKTOP_WIDTHS[1] ? (await tooltipProblems(mounted.root, waysIn(locale))).map((problem) => `hover text: ${problem}`) : []),
        ...(await fitProblems(name, locale, width)),
      ])
      expect(found).toEqual({})
    })
  }
})
