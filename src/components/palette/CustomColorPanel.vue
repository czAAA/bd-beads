<script setup lang="ts">
import { computed, nextTick, onMounted, ref, useId } from 'vue'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { hexToHsv, hsToWheelPoint, hsvToHex, parseHexInput, wheelPointToHs, wrapHue, type Hsv } from '../../domain/hsv'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import TextField from '../ui/form/TextField.vue'

// The Custom color picker (ticket 449; ColorPickers card): wheel (hue = angle, saturation = distance), brightness
// slider, hex field and preview swatch; it only previews. A layer of the overlay registry (ADR 0061): a press outside,
// Escape and Enter take the color; a press on a Palette swatch picks that swatch and takes nothing.
const props = defineProps<{
  /** The color the picker opens on: the slot's Custom color, else the paint color, else a mid red. */
  color?: string
}>()

const emit = defineEmits<{
  /** The color was taken (a press outside, Escape or Enter): it becomes the paint color and joins the Palette. */
  take: [hex: string]
  /** The picker was left with nothing to take (opened and untouched). */
  leave: []
  /** Escape with nothing to take: back to the Custom button. */
  cancel: []
}>()

const MID_RED = '#e03c3c'
const HUE_STOPS = [0, 60, 120, 180, 240, 300, 360].map((h) => `${hsvToHex({ h, s: 1, v: 1 })} ${h}deg`).join(', ')
const WHITE = hsvToHex({ h: 0, s: 0, v: 1 })

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
const wheelEl = ref<HTMLElement>()
const sliderEl = ref<HTMLElement>()
const noteId = useId()

const hsv = ref<Hsv>(hexToHsv(props.color ?? '') ?? hexToHsv(MID_RED)!)
const hex = computed(() => hsvToHex(hsv.value))
const hexText = ref(hex.value)
const invalid = ref(false)
let touched = false

/** Every change a person makes goes through here, so a picker they never touched can be told from one they did. */
function setHsv(next: Hsv) {
  hsv.value = { h: wrapHue(next.h), s: Math.min(1, Math.max(0, next.s)), v: Math.min(1, Math.max(0, next.v)) }
  hexText.value = hex.value
  invalid.value = false
  touched = true
}

function onHexInput(text: string | number | undefined) {
  hexText.value = String(text ?? '')
  const parsed = parseHexInput(hexText.value)
  invalid.value = parsed === undefined
  if (parsed === undefined) return
  hsv.value = hexToHsv(parsed)!
  touched = true
}

function onHexBlur() {
  hexText.value = hex.value
  invalid.value = false
}

function take() {
  if (touched) emit('take', hex.value)
  else emit('leave')
}

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => (touched ? take() : emit('cancel')),
  onOutsidePress: take,
  // A Palette swatch is picked as usual (the host closes the picker); the custom color is not added.
  keepsPress: (event) => event.target instanceof Element && event.target.closest('[data-testid="palette-swatch"]') !== null,
  // The Custom button toggles the picker itself (a press on it while open takes the color, like leaving it).
  isOpener: (target) => target.closest('[data-testid="custom-color-button"]') !== null,
})
defineExpose({ take })

/** A drag begun on the wheel or slider keeps tracking outside it (pointer capture) and ends on release. */
function dragOn(el: () => HTMLElement | undefined, apply: (event: PointerEvent, rect: DOMRect) => void) {
  return {
    down(event: PointerEvent) {
      const target = el()
      if (!target) return
      target.setPointerCapture?.(event.pointerId)
      target.focus()
      apply(event, target.getBoundingClientRect())
    },
    move(event: PointerEvent) {
      const target = el()
      if (target && (target.hasPointerCapture?.(event.pointerId) ?? event.buttons > 0)) apply(event, target.getBoundingClientRect())
    },
    up(event: PointerEvent) {
      el()?.releasePointerCapture?.(event.pointerId)
    },
  }
}

const wheelDrag = dragOn(() => wheelEl.value, (event, rect) => {
  const radius = rect.width / 2
  const { h, s } = wheelPointToHs(event.clientX - (rect.left + radius), event.clientY - (rect.top + rect.height / 2), radius)
  setHsv({ ...hsv.value, h, s })
})

const sliderDrag = dragOn(() => sliderEl.value, (event, rect) => {
  setHsv({ ...hsv.value, v: rect.width > 0 ? (event.clientX - rect.left) / rect.width : hsv.value.v })
})

function step(event: KeyboardEvent) {
  return event.shiftKey ? 10 : 1
}

function takeOnEnter(event: KeyboardEvent) {
  if (event.key !== 'Enter') return false
  event.preventDefault()
  take()
  return true
}

function onWheelKey(event: KeyboardEvent) {
  if (takeOnEnter(event)) return
  const by = step(event)
  const { h, s } = hsv.value
  const moves: Record<string, Hsv> = {
    ArrowLeft: { ...hsv.value, h: h - by },
    ArrowRight: { ...hsv.value, h: h + by },
    ArrowUp: { ...hsv.value, s: s + by / 100 },
    ArrowDown: { ...hsv.value, s: s - by / 100 },
  }
  const next = moves[event.key]
  if (!next) return
  event.preventDefault()
  setHsv(next)
}

function onSliderKey(event: KeyboardEvent) {
  if (takeOnEnter(event)) return
  const by = step(event) / 100
  const direction = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[event.key]
  if (!direction) return
  event.preventDefault()
  setHsv({ ...hsv.value, v: hsv.value.v + direction * by })
}

const wheelStyle = computed(() => ({
  background: `radial-gradient(circle closest-side, ${WHITE}, transparent), conic-gradient(from 0deg, ${HUE_STOPS})`,
}))
const dimStyle = computed(() => ({ background: `rgb(0 0 0 / ${1 - hsv.value.v})` }))
const wheelThumb = computed(() => {
  const { dx, dy } = hsToWheelPoint(hsv.value.h, hsv.value.s, 50)
  return { left: `${50 + dx}%`, top: `${50 + dy}%`, background: hex.value }
})
const sliderStyle = computed(() => ({
  background: `linear-gradient(to right, ${hsvToHex({ ...hsv.value, v: 0 })}, ${hsvToHex({ ...hsv.value, v: 1 })})`,
}))
const sliderThumb = computed(() => ({ left: `${hsv.value.v * 100}%`, background: hex.value }))
const wheelValue = computed(() =>
  t.value.palette.wheelValue.replace('{hue}', String(Math.round(hsv.value.h))).replace('{saturation}', String(Math.round(hsv.value.s * 100))),
)

onMounted(async () => {
  await nextTick()
  wheelEl.value?.focus()
})
</script>

<template>
  <div ref="rootEl" class="custom-color-panel" data-testid="custom-color-panel">
    <div
      ref="wheelEl"
      class="custom-color-panel__wheel"
      :style="wheelStyle"
      role="slider"
      tabindex="0"
      aria-valuemin="0"
      aria-valuemax="360"
      :aria-valuenow="Math.round(hsv.h)"
      :aria-valuetext="wheelValue"
      :aria-label="t.palette.wheelLabel"
      data-testid="custom-color-wheel"
      @pointerdown.prevent="wheelDrag.down"
      @pointermove="wheelDrag.move"
      @pointerup="wheelDrag.up"
      @pointercancel="wheelDrag.up"
      @keydown="onWheelKey"
    >
      <span class="custom-color-panel__dim" :style="dimStyle" />
      <span class="custom-color-panel__thumb" :style="wheelThumb" />
    </div>
    <div
      ref="sliderEl"
      class="custom-color-panel__slider"
      :style="sliderStyle"
      role="slider"
      tabindex="0"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-valuenow="Math.round(hsv.v * 100)"
      :aria-valuetext="`${Math.round(hsv.v * 100)}%`"
      :aria-label="t.palette.brightnessLabel"
      data-testid="custom-color-brightness"
      @pointerdown.prevent="sliderDrag.down"
      @pointermove="sliderDrag.move"
      @pointerup="sliderDrag.up"
      @pointercancel="sliderDrag.up"
      @keydown="onSliderKey"
    >
      <span class="custom-color-panel__thumb" :style="sliderThumb" />
    </div>
    <div class="custom-color-panel__row">
      <span class="custom-color-panel__preview" :style="{ background: hex }" role="img" :aria-label="`${t.palette.previewLabel} ${hex}`" data-testid="custom-color-preview" />
      <TextField
        class="custom-color-panel__hex"
        :model-value="hexText"
        :invalid="invalid"
        :aria-label="t.palette.hexLabel"
        :aria-describedby="invalid ? noteId : undefined"
        autocomplete="off"
        spellcheck="false"
        data-testid="custom-color-hex"
        @update:model-value="onHexInput"
        @keydown="takeOnEnter"
        @blur="onHexBlur"
      />
    </div>
    <AppNote v-if="invalid" :id="noteId" role="alert" data-testid="custom-color-hex-note">{{ t.palette.hexInvalid }}</AppNote>
  </div>
</template>

<style scoped>
.custom-color-panel {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  margin-top: var(--space-12);
}

/* Hue is the angle and saturation the distance; the dim layer is the brightness. Its colors are the color model's,
 * not the theme's. */
.custom-color-panel__wheel {
  position: relative;
  align-self: center;
  box-sizing: border-box;
  width: var(--color-wheel-size);
  height: var(--color-wheel-size);
  border: 1px solid var(--line-strong);
  border-radius: 50%;
  cursor: crosshair;
  touch-action: none;
}

.custom-color-panel__dim {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  pointer-events: none;
}

.custom-color-panel__slider {
  position: relative;
  box-sizing: border-box;
  height: var(--color-slider-height);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-sm);
  cursor: pointer;
  touch-action: none;
}

.custom-color-panel__thumb {
  position: absolute;
  top: 50%;
  box-sizing: border-box;
  width: var(--color-thumb-size);
  height: var(--color-thumb-size);
  border: 2px solid var(--panel);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--ring);
  transform: translate(-50%, -50%);
  pointer-events: none;
}

.custom-color-panel__wheel:focus-visible,
.custom-color-panel__slider:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.custom-color-panel__row {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.custom-color-panel__preview {
  flex: none;
  box-sizing: border-box;
  width: var(--field-height);
  height: var(--field-height);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
}

.custom-color-panel__hex {
  flex: 1 1 auto;
  min-width: 0;
}
</style>
