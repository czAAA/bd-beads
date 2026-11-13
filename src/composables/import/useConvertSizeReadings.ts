import { computed } from 'vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { useI18n } from '../../i18n/useI18n'
import type { ConvertImageWizard } from './useConvertImageWizard'
import { useConvertResult } from './useConvertResult'

/** What the Width and Height sliders read in the chosen unit (ConvertImage card, ValueSlider card): the head's value with
 * the other unit after it, the value as heard, the ends ("8", "max 300") and the labelled marks. Width stands in the column and Height in
 * the Size popover since ticket 0896, so both read from here. */
export function useConvertSizeReadings(wizard: ConvertImageWizard) {
  const { t } = useI18n()
  const result = useConvertResult(wizard)
  const words = computed(() => t.value.convertImage.wizard)
  const sizing = computed(() => wizard.sizing.value)
  const inBeads = (beads: number) => fillBlanks(words.value.widthBeads, { n: beads })
  const inMm = (mm: number) => fillBlanks(words.value.widthMm, { n: mm })
  const beadsFirst = () => wizard.sizeUnit.value === 'beads'

  function readings(beads: number, range: { min: number; max: number }, mmOf: (beads: number) => number) {
    const inUnit = (at: number) => (beadsFirst() ? inBeads(at) : inMm(mmOf(at)))
    const other = (at: number) => (beadsFirst() ? inMm(mmOf(at)) : inBeads(at))
    return {
      value: inUnit(beads),
      secondary: other(beads),
      valuetext: [inUnit(beads), other(beads), ...(sizing.value.mark && result.value ? [result.value.ratio] : [])].join(', '),
      minLabel: beadsFirst() ? String(range.min) : String(mmOf(range.min)),
      maxLabel: fillBlanks(words.value.maxLabel, { value: beadsFirst() ? String(range.max) : inMm(mmOf(range.max)) }),
    }
  }

  /** The marks with the size they stand for in the chosen unit ("8 beads", "40 mm"); the one at an end has the end's label only. */
  function markList(list: readonly number[], range: { min: number; max: number }, mmOf: (beads: number) => number) {
    return list.map((at) => ({
      value: at,
      label: at === range.min || at === range.max ? undefined : beadsFirst() ? inBeads(at) : inMm(mmOf(at)),
    }))
  }

  return {
    result,
    width: computed(() => readings(sizing.value.width, sizing.value.range, wizard.widthMmOf)),
    height: computed(() => readings(sizing.value.height, sizing.value.heightRange, wizard.heightMmOf)),
    widthMarks: computed(() => markList(sizing.value.marks.map((mark) => mark.width), sizing.value.range, wizard.widthMmOf)),
    heightMarks: computed(() => markList(sizing.value.heightMarks.map((mark) => mark.height), sizing.value.heightRange, wizard.heightMmOf)),
  }
}
