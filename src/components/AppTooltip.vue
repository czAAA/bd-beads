<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId } from 'vue'

/**
 * The design system's Tooltip (ticket 157; Modal card): a short `ink` label that shows while its trigger is hovered
 * with a mouse or focused from the keyboard, and hides on leave, blur or Escape. On a coarse pointer there is no
 * hover, so a touch or pen press held for LONG_PRESS_MS opens it instead, closing again on release (ticket 166;
 * responsive.md "Input, not width": "tooltips become long-press"). The trigger gets the tooltip's id through the
 * `describedby` slot prop; an icon-only button whose own name already says the same passes `announce: false`, so
 * screen readers don't hear it twice.
 */
withDefaults(defineProps<{ text: string; placement?: 'top' | 'bottom'; announce?: boolean }>(), {
  placement: 'bottom',
  announce: true,
})

/** Keeps the bubble's centered position but nudged clear of the viewport's edges (ticket 169): a trigger near the
 * screen's side, like the header's last icon, would otherwise center a wide bubble half off-screen. */
const VIEWPORT_MARGIN_PX = 8

const LONG_PRESS_MS = 500

const id = useId()
const open = ref(false)
const bubbleEl = ref<HTMLElement>()
const shiftPx = ref(0)

async function clampToViewport() {
  shiftPx.value = 0
  await nextTick()
  const rect = bubbleEl.value?.getBoundingClientRect()
  if (!rect) return
  const overflowRight = rect.right - (window.innerWidth - VIEWPORT_MARGIN_PX)
  const overflowLeft = VIEWPORT_MARGIN_PX - rect.left
  if (overflowRight > 0) shiftPx.value = -overflowRight
  else if (overflowLeft > 0) shiftPx.value = overflowLeft
}

/** Set by a press inside the trigger, so the focus that press gives it doesn't pop a tooltip over what was pressed. */
let pressing = false
let longPressTimer: ReturnType<typeof setTimeout> | undefined

function clearLongPress() {
  if (longPressTimer === undefined) return
  clearTimeout(longPressTimer)
  longPressTimer = undefined
}

function show() {
  open.value = true
  void clampToViewport()
}

function onPointerEnter(event: PointerEvent) {
  // A mouse or trackpad only: a finger or pen has no hover, and a tooltip would cover what it touches.
  if (event.pointerType !== 'touch' && event.pointerType !== 'pen') show()
}

function onPointerDown(event: PointerEvent) {
  pressing = true
  if (event.pointerType === 'touch' || event.pointerType === 'pen') {
    clearLongPress()
    longPressTimer = setTimeout(() => {
      longPressTimer = undefined
      show()
    }, LONG_PRESS_MS)
  }
}

function onFocusIn() {
  if (!pressing) show()
}

function hide() {
  clearLongPress()
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
    @pointerup="hide"
    @pointercancel="hide"
    @focusout="onFocusOut"
    @keydown="onKeydown"
  >
    <slot :describedby="announce ? id : undefined" />
    <Transition name="app-tooltip">
      <span
        v-show="open"
        :id="id"
        ref="bubbleEl"
        class="app-tooltip__bubble"
        :class="`app-tooltip__bubble--${placement}`"
        :style="{ transform: `translateX(calc(-50% + ${shiftPx}px))` }"
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
}

.app-tooltip__bubble--bottom {
  top: calc(100% + var(--space-6));
}

.app-tooltip__bubble--top {
  bottom: calc(100% + var(--space-6));
}
</style>
