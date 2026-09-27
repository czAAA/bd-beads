<script setup lang="ts">
import { onBeforeUnmount, ref, useId } from 'vue'

/**
 * The design system's Tooltip (ticket 157; Modal card): a short `ink` label that shows while its trigger is hovered
 * with a mouse or focused from the keyboard, and hides on leave, blur or Escape. The trigger gets the tooltip's id
 * through the `describedby` slot prop; an icon-only button whose own name already says the same passes `announce:
 * false`, so screen readers don't hear it twice.
 */
withDefaults(defineProps<{ text: string; placement?: 'top' | 'bottom'; announce?: boolean }>(), {
  placement: 'bottom',
  announce: true,
})

const id = useId()
const open = ref(false)

/** Set by a press inside the trigger, so the focus that press gives it doesn't pop a tooltip over what was pressed. */
let pressing = false

function onPointerEnter(event: PointerEvent) {
  // A mouse or trackpad only: a finger or pen has no hover, and a tooltip would cover what it touches.
  if (event.pointerType !== 'touch' && event.pointerType !== 'pen') open.value = true
}

function onPointerDown() {
  pressing = true
}

function onFocusIn() {
  if (!pressing) open.value = true
}

function hide() {
  open.value = false
}

function onFocusOut() {
  pressing = false
  hide()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && open.value) hide()
}

onBeforeUnmount(hide)

</script>

<template>
  <span
    class="app-tooltip"
    @pointerenter="onPointerEnter"
    @pointerleave="hide"
    @focusin="onFocusIn"
    @pointerdown="onPointerDown"
    @focusout="onFocusOut"
    @keydown="onKeydown"
  >
    <slot :describedby="announce ? id : undefined" />
    <Transition name="app-tooltip">
      <span
        v-show="open"
        :id="id"
        class="app-tooltip__bubble"
        :class="`app-tooltip__bubble--${placement}`"
        role="tooltip"
        :aria-hidden="announce ? undefined : 'true'"
        data-testid="tooltip"
      >
        {{ text }}
      </span>
    </Transition>
  </span>
</template>

<style scoped>
/* Tooltips fade in at the fast duration (Motion card). */
.app-tooltip-enter-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.app-tooltip-enter-from {
  opacity: 0;
}

.app-tooltip {
  position: relative;
  display: inline-flex;
}

.app-tooltip__bubble {
  position: absolute;
  left: 50%;
  z-index: var(--z-tooltip);
  padding: var(--space-6) var(--space-8);
  font: var(--type-small);
  line-height: 1rem;
  color: var(--canvas);
  white-space: nowrap;
  pointer-events: none;
  background: var(--ink);
  border-radius: var(--radius-sm);
  transform: translateX(-50%);
}

.app-tooltip__bubble--bottom {
  top: calc(100% + var(--space-6));
}

.app-tooltip__bubble--top {
  bottom: calc(100% + var(--space-6));
}
</style>
