<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useId } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { popoverPlacement, type PillColorMode, type PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import IconButton from '../ui/IconButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import { SHEET_CLOSE } from '../shell/sheetContext'
import ToolColorControls from './ToolColorControls.vue'

/**
 * The colour popover (ticket 439, ADR 0059; ToolPill card): the Colour sheet's replacement on every device. A head with
 * the chosen colour, "In the pill" (One color | Recent colors, kept on the device), the recent chips, then the Palette
 * with Pick color from canvas, Custom color and Image colors. It sits beside the pill toward the canvas, centred on the
 * colour tile that opened it and clamped inside the screen. Picking a colour, Close, Escape or a press outside close it,
 * and a press outside only closes.
 */
const props = defineProps<{
  /** The colour tile that opened it, and the pill it is part of: where the popover is placed. */
  tile: HTMLElement | undefined
  pill: HTMLElement | undefined
  position: PillPosition
  colorHex?: string
  colorName?: string
  selectedColorId?: string
  customColor?: string
  selectedImageColor?: string
  imageColors?: readonly string[]
  recents: readonly string[]
}>()

const mode = defineModel<PillColorMode>('mode', { required: true })
const emit = defineEmits<{
  close: []
  'pick-recent': [hex: string]
  'select-color': [colorId: string]
  'select-custom-color': [hex: string]
  'select-image-color': [hex: string]
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
const labelId = useId()
const style = ref<Record<string, string>>({ visibility: 'hidden' })
const closeAction = controlAction('close')

provide(SHEET_CLOSE, () => emit('close'))
useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => emit('close'),
  isOpener: (target) => props.tile?.contains(target) ?? false,
})

const modeOptions = computed(() => [
  { value: 'one' as const, label: t.value.toolPill.one },
  { value: 'recent' as const, label: t.value.toolPill.recentColors },
])

/** The place beside the pill, in screen pixels: measured once the popover has its real size, and again when the window changes. */
function place() {
  const root = rootEl.value
  const tile = props.tile?.getBoundingClientRect()
  const pill = props.pill?.getBoundingClientRect()
  if (!root || !tile || !pill) return
  const css = getComputedStyle(document.documentElement)
  const px = (name: string) => parseFloat(css.getPropertyValue(name)) * (css.getPropertyValue(name).endsWith('rem') ? parseFloat(css.fontSize) : 1)
  const { left, top } = popoverPlacement(
    tile,
    pill,
    { width: root.offsetWidth, height: root.offsetHeight },
    props.position,
    { width: window.innerWidth, height: window.innerHeight },
    px('--pill-gap'),
    px('--screen-edge'),
  )
  style.value = { left: `${left}px`, top: `${top}px` }
}

onMounted(async () => {
  await nextTick()
  place()
  window.addEventListener('resize', place)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', place)
})
</script>

<template>
  <div ref="rootEl" class="color-popover" :style="style" role="dialog" :aria-label="t.toolPill.popover" data-testid="color-popover">
    <div class="color-popover__head">
      <span class="color-popover__chosen" :style="{ backgroundColor: colorHex ?? 'transparent' }" />
      <span class="color-popover__name" data-testid="color-popover-name">{{ colorName }}</span>
      <span v-if="colorHex" class="color-popover__hex">{{ colorHex }}</span>
      <IconButton class="color-popover__close" variant="plain" :action="closeAction" :label="t.toolPill.close" :icon-size="16" data-testid="color-popover-close" @click="emit('close')" />
    </div>

    <div class="color-popover__section">
      <span :id="labelId" class="color-popover__label">{{ t.toolPill.inPill }}</span>
      <SegmentedControl v-model="mode" :options="modeOptions" :labelledby="labelId" small data-testid="color-popover-mode" />
    </div>

    <div v-if="recents.length" class="color-popover__section">
      <span class="color-popover__label">{{ t.toolPill.recent }}</span>
      <div class="color-popover__recents" data-testid="color-popover-recents">
        <button
          v-for="hex in recents"
          :key="hex"
          type="button"
          class="ui-control color-popover__chip"
          :aria-label="t.toolPill.useColor.replace('{color}', hex)"
          :style="{ backgroundColor: hex }"
          @click="emit('pick-recent', hex); emit('close')"
        />
      </div>
    </div>

    <div class="color-popover__section">
      <span class="color-popover__label">{{ t.toolPill.palette }}</span>
      <ToolColorControls
        :selected-color-id="selectedColorId"
        :custom-color="customColor"
        :selected-image-color="selectedImageColor"
        :image-colors="imageColors"
        @select-color="(id) => emit('select-color', id)"
        @select-custom-color="(hex) => emit('select-custom-color', hex)"
        @select-image-color="(hex) => emit('select-image-color', hex)"
      />
    </div>
  </div>
</template>

<style scoped>
/* 288px, --pill-popover-radius corners, overlay fill and line, elevation-3, padding 12px 14px 14px, 12px between sections (ToolPill card). */
.color-popover {
  position: fixed;
  z-index: var(--z-popover);
  /* It lives in the pill's layer, which takes no pointer events so the canvas under it stays usable; the popover takes its own. */
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
  box-sizing: border-box;
  width: var(--popover-width);
  max-height: calc(100dvh - 2 * var(--screen-edge));
  padding: var(--space-12) var(--space-14) var(--space-14);
  overflow-y: auto;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--pill-popover-radius);
  box-shadow: var(--elevation-3);
  animation: color-popover-in var(--duration-slow) var(--ease-out);
}

@keyframes color-popover-in {
  from {
    opacity: 0;
    transform: scale(0.94);
  }
}

.color-popover__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  min-width: 0;
}

.color-popover__chosen {
  flex: none;
  width: var(--space-20);
  height: var(--space-20);
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}

.color-popover__name {
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.color-popover__hex {
  flex: none;
  font: var(--type-meta-small);
  color: var(--muted);
}

.color-popover__close {
  flex: none;
  margin-left: auto;
}

.color-popover__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.color-popover__label {
  font: var(--type-meta-small);
  color: var(--muted);
}

.color-popover__recents {
  display: flex;
  gap: var(--space-6);
}

.color-popover__chip {
  flex: 1 1 0;
  height: var(--space-32);
  min-width: 0;
  padding: 0;
  border: 0;
  border-radius: var(--radius-sm);
  box-shadow: inset 0 0 0 1px var(--swatch-edge);
}
</style>
