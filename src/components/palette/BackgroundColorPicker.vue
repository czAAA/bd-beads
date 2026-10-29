<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppSwatch from '../ui/AppSwatch.vue'
import CustomColorPanel from './CustomColorPanel.vue'
import CustomColorPicker from './CustomColorPicker.vue'

// A background color picker (ticket 0653; CanvasBackground and ColorPickers cards), Project's Canvas color first: a
// radio group of swatches applying at once, then the Palette's Custom color tile and picker, and the chosen one's name
// and hex. The host owns what is stored; this only shows it and says what was picked.
interface BackgroundSwatch {
  id: string
  color: string
  name: string
  /** Its accessible name, e.g. "Linen, 2 of 5". */
  label: string
}

const props = defineProps<{
  swatches: readonly BackgroundSwatch[]
  /** The radio group's name. */
  label: string
  /** The swatch shown, or none while the Custom color is. */
  selectedId?: string
  /** The last Custom color taken, kept on the tile even once a swatch is picked. */
  customColor?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  'select-custom': [hex: string]
}>()

const { t } = useI18n()
const groupEl = ref<HTMLElement>()
const panel = ref<InstanceType<typeof CustomColorPanel>>()
const customButton = ref<InstanceType<typeof CustomColorPicker>>()
const pickerOpen = ref(false)

const selectedIndex = computed(() => props.swatches.findIndex((swatch) => swatch.id === props.selectedId))
const customSelected = computed(() => selectedIndex.value < 0 && !!props.customColor)
/** Tab lands on the chosen swatch, or the first while the Custom color is shown. */
const tabStop = computed(() => Math.max(selectedIndex.value, 0))
const current = computed(() => {
  const swatch = props.swatches[selectedIndex.value]
  if (swatch) return { name: swatch.name, hex: swatch.color }
  return customSelected.value ? { name: t.value.palette.customColorLabel, hex: props.customColor! } : undefined
})

function choose(index: number) {
  pickerOpen.value = false
  emit('select', props.swatches[index].id)
}

/** The arrows move to the neighbouring swatch, wrapping round, and apply it at once. */
function onSwatchKeydown(event: KeyboardEvent, index: number) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  if (!step) return
  event.preventDefault()
  event.stopPropagation()
  const count = props.swatches.length
  const next = (index + step + count) % count
  choose(next)
  void nextTick(() => groupEl.value?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus())
}

function toggle() {
  if (pickerOpen.value) panel.value?.take()
  else pickerOpen.value = true
}

function take(hex: string) {
  pickerOpen.value = false
  emit('select-custom', hex)
}

async function cancel() {
  pickerOpen.value = false
  await nextTick()
  customButton.value?.focus()
}
</script>

<template>
  <div class="background-color-picker">
    <div class="background-color-picker__row">
      <div class="background-color-picker__swatches">
        <div ref="groupEl" class="background-color-picker__group" role="radiogroup" :aria-label="label">
          <AppSwatch
            v-for="(swatch, index) in swatches"
            :key="swatch.id"
            :color="swatch.color"
            :label="swatch.label"
            :selected="index === selectedIndex"
            role="radio"
            :tabindex="index === tabStop ? 0 : -1"
            :data-testid="`background-color-${swatch.id}`"
            data-background-swatch
            @select="choose(index)"
            @keydown="onSwatchKeydown($event, index)"
          >
            <AppIcon v-if="index === selectedIndex" class="background-color-picker__check" name="check" :size="16" />
          </AppSwatch>
        </div>
        <span class="background-color-picker__custom">
          <CustomColorPicker ref="customButton" :selected="customSelected" :expanded="pickerOpen" @toggle="toggle" />
        </span>
      </div>
      <span v-if="current" class="background-color-picker__name" data-testid="background-color-name">
        {{ current.name }}
        <span class="background-color-picker__hex">{{ current.hex }}</span>
      </span>
    </div>
    <CustomColorPanel
      v-if="pickerOpen"
      ref="panel"
      :color="customColor ?? current?.hex"
      swatch-selector="[data-background-swatch]"
      @take="take"
      @leave="pickerOpen = false"
      @cancel="cancel"
    />
  </div>
</template>

<style scoped>
.background-color-picker {
  --swatch-size: 26px;
  color: var(--ink);
}

.background-color-picker__row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.background-color-picker__swatches,
.background-color-picker__group {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.background-color-picker__swatches {
  /* Room for the 2px ring that sits 2px outside the chosen swatch. */
  padding: var(--space-4);
  margin: calc(-1 * var(--space-4));
}

.background-color-picker__group > *,
.background-color-picker__custom {
  flex: none;
}

.background-color-picker__custom {
  width: var(--swatch-size);
}

.background-color-picker__name {
  font: var(--type-control);
}

.background-color-picker__hex {
  margin-left: var(--space-4);
  font: var(--type-meta);
  color: var(--muted);
}
</style>
