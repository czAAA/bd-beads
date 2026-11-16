import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useConvertImageWizardState } from './useConvertImageWizard'
import { useConvertSizeReadings } from './useConvertSizeReadings'
import { beadLabel } from '../../domain/beads'
import { estimatedGrams, formatGrams } from '../../domain/beadQuantities'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { plural, pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'

/** The result the foot and the phone's dock show, and whether Create Project is on (DS-1, DS-4; tickets 0897, 0911). */
export function useConvertFootLines() {
  const { t, locale } = useI18n()
  const wizard = useConvertImageWizardState()
  const words = computed(() => t.value.convertImage.wizard)
  const result = useConvertSizeReadings(wizard).result
  /** A picture is read and none is being read: the button is on. */
  const ready = computed(() => wizard.hasPicture.value && !wizard.reading.value)

  /** The beads the Project will hold and, where the Bead has a weight, about how much they weigh (BeadsNeeded card). */
  const beadsNeeded = computed(() => {
    const count = groupThousands(wizard.beadCount.value, locale.value)
    const grams = estimatedGrams(wizard.beadCount.value, wizard.bead.value)
    if (grams === undefined) return fillBlanks(words.value.resultBeadsNeededCount, { count })
    return fillBlanks(words.value.resultBeadsNeeded, { count, grams: formatGrams(grams, t.value.quantities.gramsUnit, locale.value) })
  })

  /** Where fewer colors come out than asked and no list or Finish is the reason, the colors matched to that the picture
   * has no more to give in (ticket 0928): the Bead, the Default Palette or My beads; none for Exact, whose colors are the
   * picture's own. */
  const givenIn = computed(() => {
    const source = wizard.source.value
    if (source === 'bead-colors') return beadLabel(wizard.bead.value)
    if (source === 'default') return words.value.defaultPalette
    if (source === 'my-beads') return words.value.myBeads.name
    return undefined
  })

  /** The result: the size, the colors (a kept part's, with the whole it was kept from), the beads needed. */
  const lines = computed(() => {
    const shown = result.value?.kept ?? result.value
    if (!ready.value || !shown) return undefined
    // Too few codes in the Finishes on (ticket 0901), or a My beads list shorter than the count asked (ticket 0902), says
    // why fewer come out; with neither, that the picture has no more to give (ticket 0928).
    const used = wizard.usedColorCount.value
    const finish = words.value.finish
    const count = plural(locale.value, used, words.value.colorsCount)
    const colors = wizard.finishesShort.value
      ? fillBlanks(finish.colorsShort, { colors: count, codes: plural(locale.value, wizard.codesLeft.value, finish.codesLeft) })
      : wizard.myBeadsShort.value
      ? fillBlanks(pluralForm(locale.value, used, words.value.myBeads.fewerColors), { codes: groupThousands(wizard.myBeadsTargets.value.length, locale.value) }, { count: groupThousands(used, locale.value) })
      : wizard.foundColorCount.value < wizard.maxColors.value && givenIn.value
      ? fillBlanks(words.value.fewerFound.allGiven, { colors: count, bead: givenIn.value })
      : count
    const kept = result.value?.kept && fillBlanks(words.value.resultKeptFrom, { columns: wizard.dimensions.value.columns, rows: wizard.dimensions.value.rows })
    return {
      grid: shown.grid,
      measured: shown.measured,
      colors: kept ? `${colors} · ${kept}` : colors,
      beads: beadsNeeded.value,
      goesWhere: wizard.addsToCanvas ? words.value.resultGoesWhere : undefined,
    }
  })

  /** What a screen reader hears: the result once a change has settled, not every step of a slider's move. */
  const ANNOUNCE_AFTER_MS = 600
  const heard = ref('')
  let timer: ReturnType<typeof setTimeout> | undefined
  const said = computed(() => {
    const shown = lines.value
    return shown ? [`${shown.grid} · ${shown.measured}`, shown.colors, shown.beads, shown.goesWhere].filter(Boolean).join('. ') : ''
  })
  watch(
    said,
    (next) => {
      clearTimeout(timer)
      timer = setTimeout(() => (heard.value = next), ANNOUNCE_AFTER_MS)
    },
    { immediate: true },
  )
  onBeforeUnmount(() => clearTimeout(timer))

  const buttonLabel = computed(() => (wizard.addsToCanvas ? t.value.convertImage.addToCanvas : t.value.convertImage.createButton))

  return { lines, heard, ready, buttonLabel }
}
