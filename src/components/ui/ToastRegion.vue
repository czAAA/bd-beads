<script setup lang="ts">
import { computed, ref, watch, type ComponentPublicInstance } from 'vue'
import { ownLength } from '../../composables/ui/cssZoom'
import { useShellScope } from '../../composables/ui/shellScope'
import { toastsBelowPanel } from '../../composables/ui/toastPlacement'
import { useElementSize } from '../../composables/ui/useElementSize'
import type { Toast, ToastAction } from '../../composables/ui/useToasts'
import AppIcon from './AppIcon.vue'
import AppMessage from './AppMessage.vue'
import ToastUpdate from './ToastUpdate.vue'
import ToastUpdateList from './ToastUpdateList.vue'

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
  const onScreen =
    el && room && panelEl.value && props.toasts.length
      ? toastsBelowPanel(panelEl.value.getBoundingClientRect(), el.getBoundingClientRect(), room.getBoundingClientRect())
      : undefined
  // Measured on screen, set in the region's own px, which CSS zoom draws larger (ticket 1071).
  below.value = onScreen === undefined ? undefined : ownLength(el, onScreen)
}
watch([() => props.toasts, () => props.clearOfPanel, panelSize.height], place, { flush: 'post' })

/** A pressed action runs and closes the toast; a link then leaves for its page. */
function press(toast: Toast, action: ToastAction) {
  action.run()
  emit('dismiss', toast.id)
}

// "Update ready" with counts (ticket 1091): its What's new opens the list of what waits instead of leaving. A toast is
// open by its stamp, so a newer Build's toast, which takes the waiting one's place, shows closed.
const openStamp = ref<number>()
const listOpen = (toast: Toast) => openStamp.value === toast.stamp
function toggleList(toast: Toast) {
  openStamp.value = listOpen(toast) ? undefined : toast.stamp
}

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
      :class="{ 'toast-region__toast--open': listOpen(toast) }"
      :data-testid="toast.id"
      @close="emit('dismiss', toast.id)"
    >
      <ToastUpdate v-if="toast.update" :name="toast.text" :update="toast.update" />
      <template v-else>{{ toast.text }}</template>
      <!-- Two actions stand on their own line under the text (ticket 0935): beside it they would leave it no room. -->
      <span v-if="toast.action && toast.secondAction" class="toast-region__actions">
        <template v-for="(action, index) in [toast.action, toast.secondAction]" :key="index">
          <!-- The second action opens the list of what waits (ticket 1091): it stays beside Reload and leaves for nowhere. -->
          <button
            v-if="index && toast.update?.list"
            type="button"
            class="ui-control toast-region__action toast-region__toggle"
            :class="{ 'toast-region__toggle--open': listOpen(toast) }"
            :aria-expanded="listOpen(toast)"
            data-testid="toast-second-action"
            @click="toggleList(toast)"
          >
            {{ action.label }}<AppIcon class="toast-region__chevron" name="chevron-down" :size="16" />
          </button>
          <component
            :is="action.href ? 'a' : 'button'"
            v-else
            v-bind="action.href ? { href: action.href } : { type: 'button' }"
            class="ui-control toast-region__action"
            :data-testid="index ? 'toast-second-action' : 'toast-action'"
            @click="press(toast, action)"
          >
            {{ action.label }}
          </component>
        </template>
      </span>
      <ToastUpdateList
        v-if="toast.update?.list && toast.secondAction && listOpen(toast)"
        :list="toast.update.list"
        :more="toast.update.more"
        :href="toast.secondAction.href"
        @leave="press(toast, toast.secondAction)"
      />
      <template v-if="toast.action && !toast.secondAction" #actions>
        <component
          :is="toast.action.href ? 'a' : 'button'"
          v-bind="toast.action.href ? { href: toast.action.href } : { type: 'button' }"
          class="ui-control toast-region__action"
          data-testid="toast-action"
          @click="press(toast, toast.action)"
        >
          {{ toast.action.label }}
        </component>
      </template>
    </AppMessage>
  </TransitionGroup>
</template>

<style scoped>
.toast-region {
  position: absolute;
  right: var(--space-16);
  top: calc(var(--strip-height) + var(--space-16));
  /* The toasts' room ends 16px above the box's foot: an open list scrolls inside it (ticket 1091). */
  bottom: var(--space-16);
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

/* Two actions, on their own line under the text (ticket 0935), as a notice's in-box ones are. */
.toast-region__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8) var(--space-16);
  margin-top: var(--space-8);
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

/* What's new opening the list (ticket 1091): the word and a chevron in `muted`, turned up while the list is open. */
.toast-region__toggle {
  display: inline-flex;
  align-items: center;
  gap: var(--space-4);
}

.toast-region__chevron {
  color: var(--muted);
}

.toast-region__toggle--open .toast-region__chevron {
  transform: rotate(180deg);
}

/* Open, the toast may shrink to the room left, and its words stand in a column whose list scrolls (ticket 1091): the
 * name, counts, actions and the link under the list stay in view. */
.toast-region__toast--open {
  min-height: 0;
}

.toast-region__toast--open :deep(.app-message__text) {
  display: flex;
  flex-direction: column;
  align-self: stretch;
  min-height: 0;
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
