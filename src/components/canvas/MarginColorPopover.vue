<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useI18n } from '../../i18n/useI18n'
import type { FrameId } from '../../domain/grid'
import type { Background, Project } from '../../domain/project'
import { useCanvasBackground } from '../../theme/useCanvasBackground'
import BackgroundSection from '../project/BackgroundSection.vue'
import AppSwitch from '../ui/AppSwitch.vue'
import MarginColorPicker from './MarginColorPicker.vue'

// The margin sheet's Margin color popover (MarginSheet card, tickets 0657, 1222): the margin color's picker, hung 4px under
// its button, then the Frame's Background and the switch that shows or hides the title block (the Frame panel had both).
// Escape or a press outside closes it; picking applies at once and leaves it open.
const props = defineProps<{
  /** The Margin color button it hangs from: its own press toggles the popover. */
  anchor: HTMLElement | undefined
  /** The Project whose Canvas's Background the margin's Auto follows (ticket 0666). */
  project: Project
  /** The Frame whose sheet it is: its Background is the second row. */
  frame: FrameId
}>()
const emit = defineEmits<{ close: []; 'set-background': [background: Background] }>()
const backgrounds = useCanvasBackground(() => props.project)
const margin = backgrounds.margin

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
const anchored = useAnchoredPosition(anchorEl, rootEl, () => 'end')

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => {
    emit('close')
    props.anchor?.focus({ preventScroll: true })
  },
  onOutsidePress: () => emit('close'),
  isOpener: (target) => props.anchor?.contains(target) ?? false,
})

onMounted(async () => {
  anchorEl.value = props.anchor
  await nextTick()
  anchored.follow()
  rootEl.value?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]')?.focus({ preventScroll: true })
})
</script>

<template>
  <div ref="rootEl" class="margin-color-popover anchored-popup" popover="manual" :style="anchored.style.value" role="dialog" :aria-label="t.frame.margin.colorLabel" data-testid="margin-color-popover">
    <span class="margin-color-popover__label">{{ t.frame.margin.colorLabel }}</span>
    <MarginColorPicker :project="project" />
    <span class="margin-color-popover__label">{{ t.layerSettings.background }}</span>
    <BackgroundSection :background="backgrounds.shownOf(frame).background" :layer="frame" @pick="emit('set-background', $event)" />
    <div class="margin-color-popover__switch">
      <span class="margin-color-popover__switch-label">{{ t.frame.margin.titleBlock }}</span>
      <AppSwitch :model-value="margin.titleBlock.value" :label="t.frame.margin.titleBlock" data-testid="margin-title-block-switch" @update:model-value="margin.setTitleBlock" />
    </div>
    <p class="margin-color-popover__line" data-testid="margin-line">{{ t.frame.margin.line }}</p>
  </div>
</template>

<style scoped>
/* The shared popover look: 12px padding, the overlay fill and line, elevation 3 (MarginSheet card). */
.margin-color-popover {
  --swatch-gap: var(--overlay-fill);
  position: fixed;
  z-index: var(--z-popover);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  padding: var(--space-12);
  pointer-events: auto;
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  border-radius: var(--radius-md);
  box-shadow: var(--elevation-3);
}

.margin-color-popover__line {
  max-width: 18rem;
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.margin-color-popover__switch {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  padding-top: var(--space-4);
}

.margin-color-popover__switch-label {
  font: var(--type-control);
  color: var(--ink);
}

.margin-color-popover__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}
</style>
