<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useI18n } from '../../i18n/useI18n'
import type { Project } from '../../domain/project'
import MarginColorPicker from './MarginColorPicker.vue'

// The margin sheet's Margin color popover (MarginSheet card, ticket 0657): the Frame panel's margin color picker, hung
// 4px under the sheet's Margin color button with right edges aligned. Escape or a press outside closes it; picking
// applies at once and leaves it open, as in the panel.
const props = defineProps<{
  /** The Margin color button it hangs from: its own press toggles the popover. */
  anchor: HTMLElement | undefined
  /** The Project whose Canvas's Background the margin's Auto follows (ticket 0666). */
  project: Project
}>()
const emit = defineEmits<{ close: [] }>()

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
  <div ref="rootEl" class="margin-color-popover" :style="anchored.style.value" role="dialog" :aria-label="t.frame.margin.colorLabel" data-testid="margin-color-popover">
    <span class="margin-color-popover__label">{{ t.frame.margin.colorLabel }}</span>
    <MarginColorPicker :project="project" />
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

.margin-color-popover__label {
  font: var(--type-label);
  color: var(--muted);
  text-transform: lowercase;
}
</style>
