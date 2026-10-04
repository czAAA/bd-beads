<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

/**
 * The design system's Tooltip (ticket 157; Modal card): a short `ink` label that shows while its trigger is hovered
 * with a mouse or focused from the keyboard, and hides on leave, blur or Escape. On a coarse pointer there is no
 * hover, so a touch or pen press held for LONG_PRESS_MS opens it instead, closing again on release (ticket 166;
 * responsive.md "Input, not width": "tooltips become long-press"). The trigger gets the tooltip's id through the
 * `describedby` slot prop; an icon-only button whose own name already says the same passes `announce: false`, so
 * screen readers don't hear it twice.
 *
 * A Toolbox button's Tooltip (ticket 251) is richer: the name in bold, the `shortcut` as a key chip beside it and, only
 * where the control needs one, a `description` line below. A `disabled` trigger shows none (forms-and-states).
 */
const props = withDefaults(
  defineProps<{
    text: string
    placement?: 'top' | 'bottom'
    announce?: boolean
    shortcut?: string
    description?: string
    disabled?: boolean
  }>(),
  { placement: 'bottom', announce: true, shortcut: undefined, description: undefined, disabled: false },
)

const rich = computed(() => !!props.shortcut || !!props.description)

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
  if (props.disabled) return
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

/** Whether focus arrived the way a keyboard user's does. Focus a script gives a control after a click or tap (a drawer
 * or sheet opening onto its first control) isn't focus-visible, and shouldn't pop a tooltip nobody asked for. */
function focusIsVisible(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement) || target !== document.activeElement) return true
  try {
    return target.matches(':focus-visible')
  } catch {
    return true
  }
}

function onFocusIn(event: FocusEvent) {
  if (!pressing && focusIsVisible(event.target)) show()
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

watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) hide()
  },
)

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
        <template v-if="rich">
          <span class="app-tooltip__head">
            <strong class="app-tooltip__name">{{ text }}</strong>
            <kbd v-if="shortcut" class="app-tooltip__key">{{ shortcut }}</kbd>
          </span>
          <span v-if="description" class="app-tooltip__description">{{ description }}</span>
        </template>
        <template v-else>{{ text }}</template>
      </span>
    </Transition>
  </span>
</template>

<style scoped>
/* The rich Tooltip (ticket 251): name and key chip on one line, the description under them, on the same `ink` bubble. */
.app-tooltip__bubble:has(.app-tooltip__head) {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  max-width: min(15rem, calc(100vw - 2 * var(--space-8)));
}

.app-tooltip__head {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.app-tooltip__name {
  font-weight: 700;
}

.app-tooltip__key {
  padding: 0 var(--space-4);
  font: var(--type-meta-tiny);
  line-height: 1rem;
  color: var(--canvas);
  border: 1px solid var(--canvas);
  border-radius: var(--radius-xs);
  opacity: 0.85;
}

.app-tooltip__description {
  font-weight: 500;
  opacity: 0.85;
}

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
  width: max-content;
  /* A long tip wraps rather than outgrowing the screen, where the clamp couldn't bring it back (ticket 246). */
  max-width: calc(100vw - 2 * var(--space-8));
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
