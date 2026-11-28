<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useI18n } from '../../i18n/useI18n'
import type { FrameId } from '../../domain/grid'
import type { Background, Project } from '../../domain/project'
import MarginColorChoices from './MarginColorChoices.vue'

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
    <MarginColorChoices :project="project" :frame="frame" @set-background="emit('set-background', $event)" />
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
</style>
