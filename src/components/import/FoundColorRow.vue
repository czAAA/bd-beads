<script setup lang="ts">
import { computed, nextTick, provide, ref } from 'vue'
import { provideBeadColors } from '../../composables/palette/useBeadColors'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { providePalette } from '../../composables/tools/usePalette'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import type { FoundColor, TargetColor } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { isAddedColorId } from '../../domain/palette'
import { colorLabel, type LabelledColor } from '../../i18n/colorLabel'
import { pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { groupThousands } from '../../domain/formatNumber'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import ColorLabel from '../palette/ColorLabel.vue'
import { PICK_CLOSE } from '../shell/pickContext'
import ColorPopoverBody from '../tools/ColorPopoverBody.vue'
import { labelledColorOf, paletteTarget, pickerBeadColors } from './convertPicker'

// One color Convert image found (FoundColorRow card): picture color → what it became, its bead count, Change and Empty.
// Change (the palette icon) opens the Tool pill's colour popover body (ColorPopoverBody) in the row, with Keep exact in
// its head; a pick applies at once and leaves it open. Its Close, Escape or Change again closes it and returns to Change.
const props = defineProps<{
  color: FoundColor
  open: boolean
}>()

const emit = defineEmits<{ 'toggle-remap': [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const actions = { change: controlAction('remap-color'), empty: controlAction('empty-color') }
const rowEl = ref<HTMLElement>()
const changeButton = ref<InstanceType<typeof IconButton>>()

/** The two lines a color reads as (FoundColorRow card): its label (code and name, or hex; ticket 0760) over where it is from. */
function linesOf(target: TargetColor): { color: LabelledColor; source: string } {
  const color = labelledColorOf(target)
  if (target.code) return { color, source: words.value.beadColors }
  if (target.colorId && !isAddedColorId(target.colorId)) return { color, source: words.value.defaultPalette }
  return { color, source: t.value.palette.customColorLabel }
}

const state = computed(() => props.color.choice?.kind)
const lines = computed<{ color?: LabelledColor; source: string }>(() => {
  const result = props.color.result
  if (!result) return { source: words.value.noBead }
  const own = linesOf(result)
  if (state.value === 'exact') return { ...own, source: `${words.value.keptExact} · ${own.source}` }
  if (state.value === 'remap') return { ...own, source: `${words.value.remapped} · ${own.source}` }
  return own
})

const nameText = computed(() => (lines.value.color ? colorLabel(t.value, lines.value.color, wizard.catalog.value).text : words.value.empty))

const rowName = computed(() =>
  fillBlanks(pluralForm(locale.value, props.color.count, words.value.rowName), { hex: props.color.pictureHex, name: nameText.value }, { count: groupThousands(props.color.count, locale.value) }),
)

const remapOn = computed(() => state.value === 'remap' || state.value === 'exact')

/** Change pressed while on puts the row back to its match; off, it opens the picker in the row. */
function onRemap() {
  if (remapOn.value && !props.open) wizard.setChoice(props.color.pictureHex, undefined)
  else emit('toggle-remap')
}

function choose(target: TargetColor) {
  wizard.setChoice(props.color.pictureHex, { kind: 'remap', target })
}

/** A swatch of the new Palette picked: the found color remapped (or merged with another that uses it). */
function pickSwatch(colorId: string) {
  const target = paletteTarget(wizard, colorId)
  if (target) choose(target)
}

function keepExact() {
  wizard.setChoice(props.color.pictureHex, state.value === 'exact' ? undefined : { kind: 'exact' })
}

const selectedColorId = computed(() => {
  const hex = props.color.result?.hex
  return hex ? wizard.remapPalette.value.byHex(hex)?.id : undefined
})

/** The found color's hex, which the picker marks as the Custom color's when no Palette swatch holds it. */
const customColor = computed(() => props.color.result?.hex)

async function close() {
  if (!props.open) return
  emit('toggle-remap')
  await nextTick()
  ;(changeButton.value?.$el as HTMLElement | undefined)?.querySelector('button')?.focus()
}

// The picker is a layer of its own, so Escape closes it first and returns to Change. It opens in the row, not over the
// page, so a press elsewhere goes through and leaves it open.
provide(PICK_CLOSE, () => {})
providePalette(wizard.remapPalette)
// The Bead colors list, as the popover's own: picking a code remaps to it, and the code joins the grid.
provideBeadColors(pickerBeadColors(wizard, choose))
useOverlayLayer({ isOpen: () => props.open, root: () => rowEl.value, close: () => void close(), keepsPress: () => true })
</script>

<template>
  <li ref="rowEl" class="found-color" :class="{ 'found-color--open': open }" data-testid="found-color" :data-picture-hex="color.pictureHex">
    <div class="found-color__row" role="group" :aria-label="rowName">
      <span class="found-color__from" aria-hidden="true">
        <span class="found-color__swatch" :style="{ backgroundColor: color.pictureHex }" />
        <AppIcon class="found-color__arrow" name="arrow-down" :size="12" />
      </span>
      <span class="found-color__becomes">
        <span
          class="found-color__swatch"
          :class="{ 'found-color__swatch--empty': !color.result, 'found-color__swatch--approximate': !!color.result?.code }"
          :style="color.result ? { backgroundColor: color.result.hex } : undefined"
          aria-hidden="true"
        />
        <span class="found-color__lines">
          <ColorLabel v-if="lines.color" class="found-color__name" :color="lines.color" :catalog="wizard.catalog.value" data-testid="found-color-name" />
          <span v-else class="found-color__name" data-testid="found-color-name">{{ words.empty }}</span>
          <span class="found-color__source" data-testid="found-color-source">{{ lines.source }}</span>
        </span>
      </span>
      <span class="found-color__count">{{ groupThousands(color.count, locale) }}</span>
      <span class="found-color__action">
        <IconButton
          ref="changeButton"
          variant="plain"
          :action="actions.change"
          :pressed="remapOn"
          :aria-expanded="open"
          :class="{ 'found-color__action--on': remapOn }"
          data-testid="found-color-remap"
          @click="onRemap"
        />
      </span>
      <span class="found-color__action">
        <IconButton
          variant="plain"
          :action="actions.empty"
          :pressed="state === 'empty'"
          :class="{ 'found-color__action--on': state === 'empty' }"
          data-testid="found-color-empty"
          @click="wizard.toggleEmpty(color.pictureHex)"
        />
      </span>
    </div>

    <div v-if="open" class="found-color__picker" data-testid="found-color-picker">
      <ColorPopoverBody
        :color-hex="color.result?.hex"
        :color-name="nameText"
        :selected-color-id="selectedColorId"
        :custom-color="customColor"
        :palette-label="words.newPalette"
        :editable="false"
        @close="close"
        @select-color="pickSwatch"
        @select-custom-color="(hex) => choose({ hex })"
      >
        <template #head>
          <AppButton variant="in-box" size="sm" :selected="state === 'exact'" :aria-pressed="state === 'exact'" data-testid="found-color-keep-exact" @click="keepExact">
            {{ words.keepExact }}
          </AppButton>
        </template>
      </ColorPopoverBody>
    </div>
  </li>
</template>

<style scoped>
.found-color {
  list-style: none;
  border-top: 1px solid var(--line-soft);
}

.found-color--open {
  background: var(--surface);
  border-radius: var(--radius-md);
}

:root[data-theme='dark'] .found-color--open {
  background: var(--elevated);
}

:root[data-theme='contrast'] .found-color--open {
  border: 2px solid var(--line);
}

/* The columns are the heading row's too (FoundColorsHeader): from picture, becomes, beads, Change, Empty. */
.found-color__row {
  display: grid;
  grid-template-columns: var(--found-columns);
  column-gap: var(--space-8);
  align-items: center;
  min-height: var(--panel-row-two-line);
  padding: 0 var(--space-4) 0 var(--space-6);
}

@media (pointer: coarse) {
  .found-color__row {
    min-height: var(--panel-row-two-line-touch);
  }
}

.found-color__action {
  display: flex;
  justify-content: center;
}

.found-color__from,
.found-color__becomes {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.found-color__swatch {
  flex: none;
  box-sizing: border-box;
  width: var(--found-swatch);
  height: var(--found-swatch);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.found-color__swatch--approximate {
  outline: 1px dashed var(--field-line);
  outline-offset: 1px;
}

.found-color__swatch--empty {
  background: var(--bead-empty);
  border: 1px dashed var(--field-line);
  box-shadow: none;
}

.found-color__arrow {
  flex: none;
  color: var(--muted);
  transform: rotate(-90deg);
}

.found-color__lines {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
}

.found-color__name,
.found-color__source {
  overflow-wrap: anywhere;
}

.found-color__name {
  font: var(--type-control);
  color: var(--ink);
}

.found-color__source {
  font: var(--type-meta-small);
  color: var(--muted);
}

.found-color__count {
  font: var(--type-meta);
  color: var(--ink);
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.found-color__row :deep(.found-color__action--on) {
  color: var(--canvas);
  background: var(--ink);
}

.found-color__picker {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  padding: var(--space-4) var(--space-10) var(--space-12);
}
</style>
