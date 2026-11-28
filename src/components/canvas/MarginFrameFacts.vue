<script setup lang="ts">
import { computed, ref } from 'vue'
import { useFittingForm } from '../../composables/canvas/useFittingForm'
import { computeColorQuantities } from '../../domain/beadQuantities'
import { beadLabel } from '../../domain/beads'
import type { FrameId } from '../../domain/grid'
import { beadOfLayer, frameById, lettersOn } from '../../domain/layerRecord'
import { projectPalette } from '../../domain/palette'
import type { Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { listedColorName } from '../../i18n/colorName'
import { useI18n } from '../../i18n/useI18n'
import LetterDisc from '../palette/LetterDisc.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import MarginBeadCell from './MarginBeadCell.vue'
import type { FactsForm } from './marginForms'
import { rowWidth } from './rowFit'

// What weaving reads, on the margin sheet's one-line foot (MarginSheet card, Calmer sheet; ticket 1258): the size in
// beads then in cm as plain facts, the Bead's chip, the lettered legend and Letters with its switch. It only asks.
const props = defineProps<{
  project: Project
  frame: FrameId
  /** The forms the foot allows, best first. */
  forms: readonly FactsForm[]
  /** The foot's room for them, in the sheet's drafting px; Infinity beside Row progress, which was fitted to them. */
  room: number
}>()

const emit = defineEmits<{
  /** Asks to Replace Bead with this one, as the Frame popover's Bead pickers do (ticket 1015). */
  'replace-bead': [beadId: string]
  'set-letters': [on: boolean]
}>()

const { t, locale } = useI18n()
const layer = computed(() => frameById(props.project, props.frame))
/** The Frame's Bead, or none for one no longer known. */
const bead = computed(() => beadOfLayer(props.project, props.frame).bead)
const size = computed(() => (layer.value ? `${layer.value.columns} × ${layer.value.rows}` : ''))
const estimate = computed(() => {
  if (!layer.value || !bead.value) return ''
  const units = { mm: t.value.form.unitMm, cm: t.value.form.unitCm }
  return `≈ ${formatSizeMm(estimatedSizeMm(layer.value, bead.value, layer.value.technique), units, locale.value)}`
})

/** The legend shows at most this many colors, then "+n". */
const LEGEND_MAX = 8
/** One disc per Palette color in the Frame, in the Palette's order, with its Swatch letter. */
const legend = computed(() => {
  const palette = projectPalette(props.project)
  const slot = (hex: string) => {
    const index = palette.colors.findIndex((color) => color.hex === hex)
    return index < 0 ? palette.colors.length : index
  }
  const used = computeColorQuantities(props.project, palette, props.frame).sort((a, b) => slot(a.hex) - slot(b.hex))
  return used.map(({ colorId, hex }) => ({
    hex,
    letter: props.project.paletteLetters?.[hex],
    name: listedColorName(t.value, palette.byId(colorId), hex),
  }))
})
const shownLegend = computed(() => legend.value.slice(0, LEGEND_MAX))
const moreColors = computed(() => Math.max(0, legend.value.length - LEGEND_MAX))
const legendLabel = computed(() => legend.value.map((color) => `${color.letter} ${color.name}`.trim()).join(', '))

const rowEl = ref<HTMLElement>()

/** The least the Bead's label shows before the facts step down: its first word and an ellipsis (ticket 1213). */
function firstWordWidth(text: HTMLElement): number {
  const words = text.firstChild
  if (!words) return text.scrollWidth
  const range = document.createRange()
  range.setStart(words, 0)
  range.setEnd(words, (text.textContent?.split(' ')[0] ?? '').length)
  // A Range's box is in on-screen px; the text's own width over its box turns it into the sheet's drafting px.
  const zoom = text.getBoundingClientRect().width / (text.offsetWidth || 1) || 1
  const ellipsis = Number.parseFloat(getComputedStyle(text).fontSize) || 0
  return Math.min(text.scrollWidth, Math.ceil(range.getBoundingClientRect().width / zoom + ellipsis))
}

/** What the facts read, as one key: the foot fits them again when it changes. */
const words = computed(() => JSON.stringify([t.value.frame.lettersLabel, size.value, estimate.value, bead.value && beadLabel(bead.value), legend.value.length]))
const form = useFittingForm({
  forms: () => (layer.value ? props.forms : []),
  room: () => props.room,
  measure: () => rowWidth(rowEl.value, '.margin-bead', firstWordWidth),
  observed: () => [rowEl.value],
  labels: () => words.value,
})
const shows = computed(() => ({
  estimate: form.value === 'all',
  size: form.value === 'all' || form.value === 'noEstimate',
  bead: form.value === 'all' || form.value === 'noEstimate' || form.value === 'noSize',
  letters: form.value !== 'legend',
}))
defineExpose({ words })
</script>

<template>
  <div v-if="form" ref="rowEl" class="margin-facts" :style="Number.isFinite(room) ? { maxWidth: `${room}px` } : undefined" :data-form="form" data-testid="margin-facts">
    <span v-if="shows.size" class="margin-facts__size">
      <span data-testid="margin-size">{{ size }}</span>
      <template v-if="shows.estimate && estimate">
        <span aria-hidden="true">·</span>
        <span data-testid="margin-estimate">{{ estimate }}</span>
      </template>
    </span>
    <MarginBeadCell v-if="shows.bead && bead" :bead="bead" @pick="emit('replace-bead', $event)" />
    <span v-if="shownLegend.length" class="margin-facts__legend" role="img" :aria-label="legendLabel" data-testid="margin-legend">
      <LetterDisc v-for="color in shownLegend" :key="color.hex" class="margin-facts__disc" :hex="color.hex" :letter="color.letter" aria-hidden="true" />
      <span v-if="moreColors" class="margin-facts__more" aria-hidden="true" data-testid="margin-legend-more">+{{ moreColors }}</span>
    </span>
    <span v-if="shows.letters" class="margin-facts__letters">
      <span aria-hidden="true">{{ t.frame.lettersLabel }}</span>
      <AppSwitch :model-value="lettersOn(project, frame)" :label="t.frame.lettersLabel" data-testid="margin-letters" @update:model-value="emit('set-letters', $event)" />
    </span>
  </div>
</template>

<style scoped>
/* One line (MarginSheet card, Calmer sheet): read-only facts plain `muted` text, no fill and no rules. */
.margin-facts {
  display: flex;
  align-items: center;
  gap: var(--space-12);
  min-width: 0;
  white-space: nowrap;
}

.margin-facts__size,
.margin-facts__legend,
.margin-facts__letters {
  display: inline-flex;
  flex: none;
  align-items: center;
}

.margin-facts__size {
  gap: var(--space-4);
  font: var(--type-small);
  color: var(--muted);
}

.margin-facts__legend {
  gap: var(--space-4);
}

.margin-facts__more {
  font: var(--type-meta-small);
  color: var(--body);
}

.margin-facts__letters {
  gap: var(--space-8);
  font: var(--type-small);
  color: var(--body);
}
</style>
