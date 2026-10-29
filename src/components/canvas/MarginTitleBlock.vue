<script setup lang="ts">
import { computed } from 'vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { computeColorQuantities } from '../../domain/beadQuantities'
import { frameWeave } from '../../domain/layerWeave'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import { projectPalette } from '../../domain/palette'
import { MAX_PIECE_NAME } from '../../domain/pieceNames'
import type { Project } from '../../domain/project'
import { resolveProjectBead } from '../../domain/projectBead'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { describeWeave, TECHNIQUES, weaveSettings, type Technique } from '../../domain/weave'
import { listedColorName } from '../../i18n/colorName'
import { weaveSettingWords } from '../../i18n/settingWords'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import { letterInk } from '../../rendering/beadLook'
import EditableLine from '../project/EditableLine.vue'
import PanelPicker from '../shell/PanelPicker.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import IconButton from '../ui/IconButton.vue'
import MarginSettingCell from './MarginSettingCell.vue'
import { frameOf, lettersOn } from '../../domain/layerRecord'

// The margin sheet's title block (MarginSheet card, tickets 0657, 0658, 0698), in its bottom-right corner like a
// drawing's: the name, Technique, its settings and maker edited in place, the sizes, the lettered legend, Letters and
// fold; compact, one row of them. It only asks; the shell's flows do the work, as from the Frame and Project panels.
/** `brief` is the compact row without its legend, where the sheet is too narrow for that (ticket 0698). */
const props = withDefaults(defineProps<{ project: Project; form?: 'full' | 'compact' | 'brief' }>(), { form: 'full' })

const emit = defineEmits<{
  rename: [name: string]
  'set-technique': [technique: Technique]
  'set-setting': [id: string, value: number]
  'save-maker-name': [name: string]
  'set-letters': [on: boolean]
  fold: []
}>()

const { t, locale } = useI18n()
const deps = computed(() => controlDeps({ activeProject: () => props.project }))
const techniqueAction = controlAction('change-technique')
const foldAction = controlAction('fold-title-block')
const frame = computed(() => frameOf(props.project)!)

/** The Frame's Technique, the one its rows are woven in; locked with its reason once a pass is done. */
const technique = computed(() => frameWeave(props.project).technique)
const options = computed(() => TECHNIQUES.map((value) => ({ value, label: techniqueName(t.value, value) })))
const techniqueLocked = computed(() => !techniqueAction.enabled?.(deps.value))

/** A cell per setting the Frame's Technique describes (ticket 0698), its value and, locked with the Technique, its
 * reason: none named here, so a Technique given a setting shows it. */
const settings = computed(() => {
  const weave = frameWeave(props.project)
  const values = weaveSettings(weave)
  return describeWeave(weave).settings.map((setting) => ({
    setting,
    value: values[setting.id]!,
    disabledBody: techniqueLocked.value ? weaveSettingWords(t.value, setting).locked : undefined,
  }))
})
/** The full form's grid: the setting cells sit after the Technique in row 1, the legend widens under them in row 2. */
const grid = computed(() => {
  const count = settings.value.length
  const maker = 3 + count
  return {
    block: { gridTemplateColumns: `repeat(${5 + count}, max-content)` },
    maker: { gridColumn: `${maker} / ${maker + 2}` },
    legend: { gridColumn: `3 / ${maker + 1}` },
    letters: { gridColumn: `${maker + 1}` },
    fold: { gridColumn: `${maker + 2}` },
  }
})

/** "by" and what follows the maker, as the language orders them round the name ("by {maker}", "автор: {maker}"). */
const by = computed(() => {
  const [before = '', after = ''] = t.value.print.byMaker.split('{maker}')
  return { before: before.trim(), after: after.trim() }
})

const size = computed(() => `${frame.value.columns} × ${frame.value.rows}`)
const estimate = computed(() => {
  const bead = resolveProjectBead(props.project)
  return bead ? `≈ ${formatSizeMm(estimatedSizeMm(frame.value, bead), { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)}` : ''
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
  const used = computeColorQuantities(props.project, palette).sort((a, b) => slot(a.hex) - slot(b.hex))
  return used.map(({ colorId, hex }) => ({
    hex,
    letter: props.project.paletteLetters?.[hex] ?? '?',
    ink: letterInk(hex),
    name: listedColorName(t.value, palette.byId(colorId), hex),
  }))
})
const shownLegend = computed(() => legend.value.slice(0, LEGEND_MAX))
const moreColors = computed(() => Math.max(0, legend.value.length - LEGEND_MAX))
const legendLabel = computed(() => legend.value.map((color) => `${color.letter} ${color.name}`.trim()).join(', '))
</script>

<template>
  <div class="margin-title" :class="form === 'full' ? 'margin-title--full' : 'margin-title--compact'" :data-form="form" :style="form === 'full' ? grid.block : undefined" data-testid="margin-title-block">
    <template v-if="form === 'full'">
      <div class="margin-title__cell margin-title__top margin-title__name">
        <EditableLine
          bare
          :label="t.panels.project.nameLabel"
          :value="frame.name ?? ''"
          :edit-label="t.frame.nameEdit"
          :edit-tooltip="t.frame.nameTooltip"
          :empty-text="t.frame.nameEmpty"
          :maxlength="MAX_PIECE_NAME"
          :normalize="(raw) => raw.trim()"
          testid="margin-frame-name"
          @save="emit('rename', $event)"
        />
      </div>
      <div class="margin-title__cell margin-title__top margin-title__value">
        <span class="margin-title__text" data-testid="margin-technique">{{ techniqueName(t, technique) }}</span>
        <PanelPicker
          bare
          icon-only="pencil"
          :model-value="technique"
          :label="t.frame.margin.changeTechnique"
          :options="options"
          :disabled="techniqueLocked"
          :disabled-body="techniqueLocked ? techniqueAction.disabledBody?.(t, deps) : undefined"
          data-testid="margin-technique-picker"
          @update:model-value="emit('set-technique', $event)"
        />
      </div>
      <div v-for="{ setting, value, disabledBody } in settings" :key="setting.id" class="margin-title__cell margin-title__top margin-title__value">
        <MarginSettingCell :setting="setting" :value="value" editable :disabled-body="disabledBody" @set="emit('set-setting', setting.id, $event)" />
      </div>
      <div class="margin-title__cell margin-title__top margin-title__value margin-title__maker" :style="grid.maker">
        <span v-if="by.before" class="margin-title__meta">{{ by.before }}</span>
        <EditableLine
          bare
          :label="t.panels.project.makerLabel"
          :value="project.makerName ?? ''"
          :edit-label="t.panels.project.changeMaker"
          :empty-text="t.saveBox.yourName"
          :placeholder="t.saveBox.yourName"
          :maxlength="MAX_MAKER_NAME"
          :normalize="(raw) => raw.trim()"
          testid="margin-maker"
          @save="emit('save-maker-name', $event)"
        />
        <span v-if="by.after" class="margin-title__meta">{{ by.after }}</span>
      </div>
    </template>
    <!-- Compact, the name and the Technique are read only: the Frame panel and the full form edit them. -->
    <template v-else>
      <div class="margin-title__cell margin-title__name" data-testid="margin-frame-name">
        <span class="margin-title__ellipsis" :class="{ 'margin-title__empty': !frame.name }">{{ frame.name || t.frame.nameEmpty }}</span>
      </div>
      <div class="margin-title__cell margin-title__value" data-testid="margin-technique">{{ techniqueName(t, technique) }}</div>
      <div v-for="{ setting, value } in settings" :key="setting.id" class="margin-title__cell margin-title__value">
        <MarginSettingCell :setting="setting" :value="value" :editable="false" />
      </div>
    </template>
    <div class="margin-title__cell margin-title__meta" data-testid="margin-size">{{ size }}</div>
    <div class="margin-title__cell margin-title__meta" data-testid="margin-estimate">{{ estimate }}</div>
    <div v-if="form !== 'brief'" class="margin-title__cell margin-title__legend" :style="form === 'full' ? grid.legend : undefined" role="img" :aria-label="legendLabel" data-testid="margin-legend">
      <span v-for="color in shownLegend" :key="color.hex" class="margin-title__disc" :style="{ background: color.hex, color: color.ink }" aria-hidden="true">{{ color.letter }}</span>
      <span v-if="moreColors" class="margin-title__meta" aria-hidden="true" data-testid="margin-legend-more">+{{ moreColors }}</span>
    </div>
    <div class="margin-title__cell margin-title__letters" :style="form === 'full' ? grid.letters : undefined">
      <span class="margin-title__text" aria-hidden="true">{{ t.frame.lettersLabel }}</span>
      <AppSwitch :model-value="lettersOn(project)" :label="t.frame.lettersLabel" data-testid="margin-letters" @update:model-value="emit('set-letters', $event)" />
    </div>
    <div class="margin-title__cell margin-title__fold" :style="form === 'full' ? grid.fold : undefined">
      <IconButton variant="plain" :icon-size="12" :action="foldAction" data-testid="margin-title-fold" @click="emit('fold')" />
    </div>
  </div>
</template>

<style scoped>
/* Two rows of 23px with 1px rules between the cells, on `margin-title`, its bottom-right corner rounded with the inner
 * border (MarginSheet card). Row 1: the name, the Technique, "by" the maker over two cells; row 2: the sizes, the
 * legend, Letters; the fold button over both. Compact: one 22px row (ticket 0658). */
.margin-title {
  display: grid;
  grid-template-rows: repeat(2, var(--margin-title-row));
  box-sizing: border-box;
  color: var(--ink);
  background: var(--margin-title);
  border: 1px solid var(--margin-line);
  border-radius: 0 0 var(--radius-sm) 0;
}

.margin-title--compact {
  grid-auto-columns: max-content;
  grid-auto-flow: column;
  grid-template-rows: var(--margin-done-compact);
}

.margin-title__cell {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  padding: 0 var(--space-6) 0 var(--space-8);
  white-space: nowrap;
  border-right: 1px solid var(--margin-line);
  border-bottom: 1px solid var(--margin-line);
}

/* The fold button has the block's own edge; the second row, and the compact one, have no rule below. */
.margin-title__fold {
  grid-row: 1 / 3;
  justify-content: center;
  padding: 0 var(--space-2);
  border-right: 0;
}

.margin-title--compact .margin-title__fold {
  grid-row: 1;
}

.margin-title__cell:not(.margin-title__top) {
  border-bottom: 0;
}

.margin-title__cell:not(.margin-title__name) {
  min-width: max-content;
}

/* A long name ends in an ellipsis rather than pushing the block off the sheet (one line, MarginSheet card). */
.margin-title__name {
  max-width: var(--margin-edit-width);
}

.margin-title__name {
  font: var(--margin-title-name);
}

/* Compact, the name is 11px, as on its tab (MarginSheet card, Zoom forms). */
.margin-title--compact .margin-title__name {
  font: var(--margin-tab-name);
}

.margin-title__ellipsis {
  overflow: hidden;
  text-overflow: ellipsis;
}

.margin-title__empty {
  color: var(--muted);
}

/* The fold button: 18px, a 12px icon, no fill, hover `ink` at 10%. */
.margin-title__fold :deep(.icon-btn) {
  width: var(--margin-pencil);
  height: var(--margin-pencil);
  border-radius: var(--radius-sm);
}

.margin-title__fold :deep(.icon-btn:hover) {
  background: color-mix(in srgb, var(--ink) 10%, transparent);
}

.margin-title__value,
.margin-title__text {
  font: var(--type-small);
}

.margin-title__meta {
  font: var(--type-meta-small);
  color: var(--body);
}

/* The Technique picker as a pencil: no row height of its own. */
.margin-title :deep(.panel-picker) {
  min-height: 0;
  padding: 0;
}

.margin-title__legend {
  gap: var(--space-4);
}

/* A 14px disc in the color, its Swatch letter white on a dark bead and `ink` on a light one (Inter 600 8). */
.margin-title__disc {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--margin-legend-disc);
  height: var(--margin-legend-disc);
  font: var(--margin-legend-letter);
  border-radius: var(--radius-full);
  box-shadow: 0 0 0 1px var(--swatch-edge);
}

.margin-title__letters {
  justify-content: space-between;
  gap: var(--space-8);
}
</style>
