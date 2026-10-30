<script setup lang="ts">
import { computed, nextTick, provide, ref } from 'vue'
import type { BeadColors } from '../../composables/palette/useBeadColors'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import { controlAction } from '../../composables/shell/controlRegistry'
import { providePalette } from '../../composables/tools/usePalette'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import type { FoundColor, TargetColor } from '../../domain/convertColors'
import { fillBlanks } from '../../domain/fillBlanks'
import { familyColorId, isAddedColorId } from '../../domain/palette'
import { colorName } from '../../i18n/colorName'
import { pluralForm } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import { groupThousands } from '../../domain/formatNumber'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import BeadColorList from '../palette/BeadColorList.vue'
import CustomColorPanel from '../palette/CustomColorPanel.vue'
import CustomColorPicker from '../palette/CustomColorPicker.vue'
import PalettePicker from '../palette/PalettePicker.vue'
import { PICK_CLOSE } from '../shell/pickContext'

// One color Convert image found (FoundColorRow card): picture color → what it became, its bead count, and Remap and
// Empty. Remap opens the colour popover's body in the row (Keep exact in its head, the new Project's Palette, Custom
// color, Bead colors); a pick applies at once. Escape closes it and returns to Remap.
const props = defineProps<{
  color: FoundColor
  open: boolean
}>()

const emit = defineEmits<{ 'toggle-remap': [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const actions = { remap: controlAction('remap-color'), empty: controlAction('empty-color') }
const rowEl = ref<HTMLElement>()
const remapButton = ref<InstanceType<typeof IconButton>>()

const familyName = (family: string) => colorName(t.value, { id: familyColorId(family), hex: '' })

/** The two lines a color reads as (FoundColorRow card): its code or name over where it is from. */
function linesOf(target: TargetColor): { name: string; source: string; mono: boolean } {
  if (target.code) {
    const source = target.family && target.finish ? `${familyName(target.family)} · ${t.value.palette.beadColors.finishes[target.finish]}` : words.value.beadColors
    return { name: target.code, source, mono: false }
  }
  if (target.colorId && !isAddedColorId(target.colorId)) {
    return { name: colorName(t.value, { id: target.colorId, hex: target.hex }), source: words.value.defaultPalette, mono: false }
  }
  return { name: target.hex, source: t.value.palette.customColorLabel, mono: true }
}

const state = computed(() => props.color.choice?.kind)
const lines = computed(() => {
  const result = props.color.result
  if (!result) return { name: words.value.empty, source: words.value.noBead, mono: false }
  const own = linesOf(result)
  if (state.value === 'exact') return { ...own, source: `${words.value.keptExact} · ${own.source}` }
  if (state.value === 'remap') return { ...own, source: `${words.value.remapped} · ${own.source}` }
  return own
})

const rowName = computed(() =>
  fillBlanks(pluralForm(locale.value, props.color.count, words.value.rowName), { hex: props.color.pictureHex, name: lines.value.name }, { count: groupThousands(props.color.count, locale.value) }),
)

const remapOn = computed(() => state.value === 'remap' || state.value === 'exact')

/** Remap pressed while on puts the row back to its match; off, it opens the picker in the row. */
function onRemap() {
  if (remapOn.value && !props.open) wizard.setChoice(props.color.pictureHex, undefined)
  else emit('toggle-remap')
}

function choose(target: TargetColor) {
  wizard.setChoice(props.color.pictureHex, { kind: 'remap', target })
}

/** A swatch of the new Palette picked: the found color remapped (or merged with another that uses it). */
function pickSwatch(colorId: string) {
  const swatch = wizard.remapPalette.value.byId(colorId)
  if (!swatch) return
  choose({ hex: swatch.hex, ...(swatch.code ? { code: swatch.code } : {}), ...(!isAddedColorId(swatch.id) ? { colorId: swatch.id } : {}) })
}

function keepExact() {
  wizard.setChoice(props.color.pictureHex, state.value === 'exact' ? undefined : { kind: 'exact' })
}

const selectedColorId = computed(() => {
  const hex = props.color.result?.hex
  return hex ? wizard.remapPalette.value.byHex(hex)?.id : undefined
})

const customOpen = ref(false)
const catalogOpen = ref(false)
const customPanel = ref<InstanceType<typeof CustomColorPanel>>()

function toggleCustom() {
  catalogOpen.value = false
  if (customOpen.value) customPanel.value?.take()
  else customOpen.value = true
}

/** The Bead colors list, as the popover's own: picking a code remaps to it, and the code joins the grid. */
const beadColors: BeadColors = {
  available: computed(() => wizard.hasCatalog.value),
  state: wizard.catalogState,
  swatches: wizard.remapSwatches,
  bead: wizard.bead,
  catalog: wizard.catalog,
  load: async () => {},
  add: (hex: string, code?: string) => {
    const swatch = wizard.remapSwatches.value.find((entry) => entry.code === code)
    choose({ hex, ...(code ? { code } : {}), ...(swatch ? { family: swatch.family, finish: swatch.finish } : {}) })
    return 'added'
  },
}

async function close() {
  customOpen.value = false
  catalogOpen.value = false
  emit('toggle-remap')
  await nextTick()
  ;(remapButton.value?.$el as HTMLElement | undefined)?.querySelector('button')?.focus()
}

// The picker is a layer of its own, so Escape closes it first and returns to Remap. It opens in the row, not over the
// page, so a press elsewhere goes through and leaves it open.
provide(PICK_CLOSE, () => {})
providePalette(wizard.remapPalette)
useOverlayLayer({ isOpen: () => props.open, root: () => rowEl.value, close: () => void close(), keepsPress: () => true })
</script>

<template>
  <li ref="rowEl" class="found-color" :class="{ 'found-color--open': open }" data-testid="found-color" :data-picture-hex="color.pictureHex">
    <div class="found-color__row" role="group" :aria-label="rowName">
      <span class="found-color__swatch" :style="{ backgroundColor: color.pictureHex }" aria-hidden="true" />
      <AppIcon class="found-color__arrow" name="arrow-down" :size="12" aria-hidden="true" />
      <span
        class="found-color__swatch"
        :class="{ 'found-color__swatch--empty': !color.result, 'found-color__swatch--approximate': !!color.result?.code }"
        :style="color.result ? { backgroundColor: color.result.hex } : undefined"
        aria-hidden="true"
      />
      <span class="found-color__lines">
        <span class="found-color__name" :class="{ 'found-color__name--mono': lines.mono }" data-testid="found-color-name">{{ lines.name }}</span>
        <span class="found-color__source" data-testid="found-color-source">{{ lines.source }}</span>
      </span>
      <span class="found-color__count">{{ groupThousands(color.count, locale) }}</span>
      <IconButton
        ref="remapButton"
        variant="plain"
        :action="actions.remap"
        :pressed="remapOn"
        :aria-expanded="open"
        :class="{ 'found-color__action--on': remapOn }"
        data-testid="found-color-remap"
        @click="onRemap"
      />
      <IconButton
        variant="plain"
        :action="actions.empty"
        :pressed="state === 'empty'"
        :class="{ 'found-color__action--on': state === 'empty' }"
        data-testid="found-color-empty"
        @click="wizard.toggleEmpty(color.pictureHex)"
      />
    </div>

    <div v-if="open" class="found-color__picker" data-testid="found-color-picker">
      <div class="found-color__head">
        <span class="found-color__swatch" :style="{ backgroundColor: color.pictureHex }" aria-hidden="true" />
        <span class="found-color__lines">
          <span class="found-color__name">{{ words.pictureColor }}</span>
          <span class="found-color__source found-color__name--mono">{{ color.pictureHex }}</span>
        </span>
        <AppButton variant="in-box" size="sm" :selected="state === 'exact'" :aria-pressed="state === 'exact'" data-testid="found-color-keep-exact" @click="keepExact">
          {{ words.keepExact }}
        </AppButton>
      </div>
      <span class="found-color__label">{{ words.newPalette }}</span>
      <PalettePicker :selected-color-id="selectedColorId" @select="pickSwatch">
        <CustomColorPicker :selected="false" :expanded="customOpen" @toggle="toggleCustom" />
      </PalettePicker>
      <AppButton
        v-if="wizard.hasCatalog.value"
        variant="in-box"
        size="sm"
        class="found-color__catalog"
        :trailing-icon="catalogOpen ? 'chevron-up' : 'chevron-down'"
        :aria-expanded="catalogOpen"
        data-testid="found-color-bead-colors"
        @click="catalogOpen = !catalogOpen; customOpen = false"
      >
        {{ t.palette.beadColors.open }}
      </AppButton>
      <BeadColorList v-if="catalogOpen" :colors="beadColors" />
      <CustomColorPanel
        v-if="customOpen"
        ref="customPanel"
        :color="color.result?.hex ?? color.pictureHex"
        @take="(hex) => { choose({ hex }); customOpen = false }"
        @leave="customOpen = false"
        @cancel="customOpen = false"
      />
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

.found-color__row,
.found-color__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-height: var(--panel-row-two-line);
  padding: 0 var(--space-4) 0 var(--space-6);
}

@media (pointer: coarse) {
  .found-color__row {
    min-height: var(--panel-row-two-line-touch);
  }
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

.found-color__name--mono {
  font-family: var(--font-mono);
}

.found-color__source {
  font: var(--type-meta-small);
  color: var(--muted);
}

.found-color__count {
  flex: none;
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
  gap: var(--space-8);
  padding: var(--space-4) var(--space-10) var(--space-12);
}

.found-color__head {
  padding: 0;
}

.found-color__label {
  font: var(--type-label);
  color: var(--muted);
}

.found-color__catalog {
  align-self: flex-start;
}
</style>
