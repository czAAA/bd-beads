<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import { useShellScope } from '../../composables/ui/shellScope'
import { toastsBelowPanel } from '../../composables/ui/toastPlacement'
import { useElementSize } from '../../composables/ui/useElementSize'
import type { Toast } from '../../composables/ui/useToasts'
import AppMessage from './AppMessage.vue'

/** Where toasts show (ticket 76): top-right of the canvas box on the toast layer (above sheets, below modals);
 * results go after 5s unless hovered or focused, errors stay. */
const props = defineProps<{
  toasts: Toast[]
  /** A strip panel is open (ticket 0859): one over the toasts' corner, the Export panel above all, puts them 8px
   * under it, so the saved-file toast never covers the row just pressed. */
  clearOfPanel?: boolean
}>()
const emit = defineEmits<{ dismiss: [id: string] }>()

const TOAST_MS = 5000

const scope = useShellScope()
// The TransitionGroup's own element is its `$el`.
const region = ref<ComponentPublicInstance>()
const panelEl = ref<HTMLElement>()
// The panel's height changes as its rows do (an export's loading line): the toasts follow it.
const panelSize = useElementSize(panelEl, { box: 'border-box' })
const below = ref<number>()

/** Finds the open panel, if one may cover the toasts, and how far down they start to keep clear of it. */
function place() {
  const el = region.value?.$el as HTMLElement | undefined
  // The box its `top` counts from (jsdom, which lays nothing out, has none: its parent there).
  const room = el?.offsetParent ?? el?.parentElement
  panelEl.value = props.clearOfPanel ? ((scope.root() ?? document).querySelector<HTMLElement>('.app-panel--dropdown') ?? undefined) : undefined
  below.value =
    el && room && panelEl.value && props.toasts.length
      ? toastsBelowPanel(panelEl.value.getBoundingClientRect(), el.getBoundingClientRect(), room.getBoundingClientRect())
      : undefined
}
watch([() => props.toasts, () => props.clearOfPanel, panelSize.height], place, { flush: 'post' })

const belowStyle = computed(() => (below.value === undefined ? undefined : { '--toasts-below': `${below.value}px` }))
</script>

<template>
  <TransitionGroup
    ref="region"
    tag="div"
    name="toast"
    class="toast-region"
    :class="{ 'toast-region--below-panel': below !== undefined }"
    :style="belowStyle"
    data-testid="toast-region"
  >
    <AppMessage
      v-for="toast in toasts"
      :key="toast.stamp"
      :tone="toast.tone"
      placement="toast"
      :timeout="toast.tone === 'danger' || toast.persistent ? undefined : TOAST_MS"
      :data-testid="toast.id"
      @close="emit('dismiss', toast.id)"
    >
      {{ toast.text }}
      <template v-if="toast.action" #actions>
        <button
          type="button"
          class="ui-control toast-region__action"
          data-testid="toast-action"
          @click="toast.action.run(); emit('dismiss', toast.id)"
        >
          {{ toast.action.label }}
        </button>
      </template>
    </AppMessage>
  </TransitionGroup>
</template>

<style scoped>
.toast-region {
  position: absolute;
  right: var(--space-16);
  top: calc(var(--strip-height) + var(--space-16));
  z-index: var(--z-toast);
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: var(--space-8);
  pointer-events: none;
}

.toast-region > * {
  pointer-events: auto;
}

/* Under an open panel over the toasts' corner (ticket 0859), on every screen size. */
.toast-region.toast-region--below-panel {
  top: calc(var(--toasts-below) + var(--space-8));
}

/* The text-button action (Message card, `bb-link`): underlined link text. */
.toast-region__action {
  padding: 0;
  border: 0;
  background: none;
  font: var(--type-control);
  color: var(--ink);
  text-decoration: underline;
  cursor: pointer;
}

/* Arriving 200ms, leaving 150ms, dropping in 8px (Motion card); reduced motion fades without the drop. */
.toast-enter-active {
  transition:
    opacity var(--duration-base) var(--ease-out),
    transform var(--duration-base) var(--ease-out);
}

.toast-leave-active {
  transition:
    opacity calc(var(--duration-base) * 0.75) var(--ease-in),
    transform calc(var(--duration-base) * 0.75) var(--ease-in);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(calc(-1 * var(--space-8)));
}

@media (prefers-reduced-motion: reduce) {
  .toast-enter-from,
  .toast-leave-to {
    transform: none;
  }
}
</style>
