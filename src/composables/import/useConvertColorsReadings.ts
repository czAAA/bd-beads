import { computed } from 'vue'
import { useConvertImageWizardState } from './useConvertImageWizard'
import { useConvertColorsReach } from './useConvertColorsReach'
import { beadLabel } from '../../domain/beads'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'
import { plural, pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'

/** What the Colors slider and the line under it read (DS-2), for the column and the phone's Colors sheet (ticket 0911). */
export function useConvertColorsReadings() {
  const { t, locale } = useI18n()
  const wizard = useConvertImageWizardState()
  const words = computed(() => t.value.convertImage.wizard)

  /** The Colors slider's end (DS-2, ticket 0904): what is woven; a larger count is typed in the neighbours' card. */
  const COLORS_SLIDER_END = 40
  const colorsEnd = computed(() => Math.min(COLORS_SLIDER_END, wizard.colorsMax.value))
  /** The Colors slider's marks (DS-2), on the doubling scale. */
  const COLORS_MARKS = [5, 10, 20]
  const colorsMarks = computed(() =>
    COLORS_MARKS.filter((value) => value > MIN_IMAGE_COLORS && value < colorsEnd.value).map((value) => ({ value, label: String(value) })),
  )
  /** The most Finishes the line under Colors names; more are counted (DS-2). */
  const NAMED_FINISHES = 3
  /** Under Colors, where they are matched (DS-1): the Bead's palette, the Default Palette, or the picture's own. */
  const matchedLine = computed(() => {
    const source = wizard.source.value
    if (source === 'exact') return words.value.matchedExact
    if (source === 'default') return words.value.matchedDefault
    const bead = beadLabel(wizard.bead.value).toLocaleLowerCase(locale.value)
    const on = wizard.finishesApplied.value
    // With Finishes on (ticket 0901, DS-2): their names, or past three their count, so the line stays two lines at most.
    if (on.length > NAMED_FINISHES) return fillBlanks(pluralForm(locale.value, on.length, words.value.finish.matchedMany), { bead }, { count: on.length })
    if (on.length > 0) {
      const names = on.map((finish) => t.value.palette.beadColors.finishes[finish].toLocaleLowerCase(locale.value))
      return fillBlanks(words.value.finish.matched, { bead, finishes: names.join(words.value.finish.separator) })
    }
    return fillBlanks(words.value.matchedBead, { bead })
  })
  /** The Colors value: the count, or with fewer found than asked both numbers ("12 asked · 7 found", ticket 0928). */
  const colorsValue = computed(() => {
    const asked = wizard.maxColors.value
    const found = wizard.foundColorCount.value
    if (found >= asked) return plural(locale.value, asked, words.value.colorsCount)
    return fillBlanks(words.value.fewerFound.asked, { asked: groupThousands(asked, locale.value), found: groupThousands(found, locale.value) })
  })
  /** The last count that changes the beads (ticket 0928): the track is accent only up to it. */
  const colorsReach = useConvertColorsReach({ count: wizard.maxColors, found: wizard.foundColorCount, beadsAt: wizard.beadsAtColors, beadsShown: wizard.beadsShown })
  /** "40+" where the picture has more colors than the slider reaches, else "max 9" (DS-2). */
  const colorsMaxLabel = computed(() =>
    wizard.colorsMax.value > colorsEnd.value
      ? fillBlanks(words.value.neighbours.pastEnd, { value: colorsEnd.value })
      : fillBlanks(words.value.maxLabel, { value: groupThousands(wizard.colorsMax.value, locale.value) }),
  )

  return { colorsEnd, colorsMarks, matchedLine, colorsValue, colorsReach, colorsMaxLabel }
}
