<script setup lang="ts">
import { computed, getCurrentInstance, nextTick, onBeforeUnmount, ref, useId } from 'vue'
import { tooltipOwners } from './tooltipOwner'
import type { TooltipProps } from './tooltipProps'

/**
 * The design system's Tooltip (tickets 157, 327; Menu card): a light, slightly see-through bubble (`elevated` at 90%
 * over a backdrop blur, `ink` text, a `line-soft` edge, `elevation-3`; opaque in High contrast) that shows while its
 * trigger is hovered with a mouse or focused from the keyboard, and hides on leave, blur or Escape. A pen hovers like a
 * mouse (an Apple Pencil over an iPad). On a finger there is no hover, so a touch or pen press held for LONG_PRESS_MS
 * opens it instead, closing again on release (ticket 166; responsive.md "Input, not width": "tooltips become
 * long-press"). The trigger gets the tooltip's id through the `describedby` slot prop; an icon-only button whose own
 * name already says the same passes `announce: false`, so screen readers don't hear it twice.
 *
 * What it says (ADR 0035): the `name` in bold, an optional `hotkey` as a key chip beside it and an optional `body`
 * under them. A control shows a Tooltip exactly when it is given one. A disabled control (`aria-disabled`, so it stays
 * hoverable and focusable) gives a `disabledBody` that replaces the body, in `muted`, with no key chip.
 *
 * The bubble is never clipped (ticket 265): while open it sits in the browser's top layer (a manual popover), outside
 * every ancestor's `overflow`, positioned in screen coordinates from its trigger. It opens on the side that has room
 * (`placement` is the side it prefers), stays inside the screen on all four edges and wraps at a maximum width.
 */
const props = withDefaults(defineProps<TooltipProps>(), {
  body: undefined,
  placement: 'bottom',
  announce: true,
})

/** What the bubble's second line says: the reason when disabled, the body otherwise. */
const detail = computed(() => (props.disabled ? props.disabledBody : props.body))
const key = computed(() => (props.disabled ? undefined : props.hotkey))
const rich = computed(() => !!detail.value || !!key.value)

/** The bubble's clearance from the screen's edges (ticket 169). */
const VIEWPORT_MARGIN_PX = 8
/** The bubble's gap to its trigger (the design system's space-6). */
const TRIGGER_GAP_PX = 6

const LONG_PRESS_MS = 500

const id = useId()
/** For the hover text check (ticket 264): the components this Tooltip comes from. */
const owners = tooltipOwners(getCurrentInstance())
const open = ref(false)
const bubbleEl = ref<HTMLElement>()
const triggerEl = ref<HTMLElement>()
/** Whether this browser has popovers (a test DOM may not). */
const topLayer = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype
const position = ref({ left: 0, top: 0 })

/** Puts the bubble in the top layer, where no ancestor's `overflow` can cut it; a browser without popovers keeps it
 * where it is, positioned the same way. */
function setTopLayer(on: boolean) {
  const bubble = bubbleEl.value
  if (!bubble || !topLayer) return
  try {
    if (on && !bubble.matches(':popover-open')) bubble.showPopover()
    else if (!on && bubble.matches(':popover-open')) bubble.hidePopover()
  } catch {
    // Already in the wanted state.
  }
}

/** Centers the bubble on its trigger, on the preferred side or, where that has no room for it, the other, and keeps it
 * inside the screen: the bubble is `fixed`, so what it is measured against is the screen, not any column. */
async function place() {
  position.value = { left: 0, top: 0 }
  await nextTick()
  const bubble = bubbleEl.value?.getBoundingClientRect()
  const trigger = triggerEl.value?.getBoundingClientRect()
  if (!bubble || !trigger) return
  const room = {
    bottom: window.innerHeight - VIEWPORT_MARGIN_PX - (trigger.bottom + TRIGGER_GAP_PX),
    top: trigger.top - TRIGGER_GAP_PX - VIEWPORT_MARGIN_PX,
  }
  const other = props.placement === 'top' ? 'bottom' : 'top'
  const side = room[props.placement] >= bubble.height || room[props.placement] >= room[other] ? props.placement : other
  const top = side === 'bottom' ? trigger.bottom + TRIGGER_GAP_PX : trigger.top - TRIGGER_GAP_PX - bubble.height
  const left = trigger.left + trigger.width / 2 - bubble.width / 2
  const fit = (value: number, size: number, screen: number) => Math.max(VIEWPORT_MARGIN_PX, Math.min(value, screen - VIEWPORT_MARGIN_PX - size))
  position.value = { left: fit(left, bubble.width, window.innerWidth), top: fit(top, bubble.height, window.innerHeight) }
}

async function openBubble() {
  await nextTick()
  setTopLayer(true)
  await place()
}

/** A scroll anywhere (the column, the canvas) or a resize moves the trigger from under the bubble. */
function follow(on: boolean) {
  const method = on ? 'addEventListener' : 'removeEventListener'
  window[method]('scroll', place, true)
  window[method]('resize', place)
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
  if (open.value) return
  open.value = true
  follow(true)
  void openBubble()
}

function onPointerEnter(event: PointerEvent) {
  // A mouse, trackpad or hovering pen (Apple Pencil over an iPad): all of them hover. A finger has no hover, and a
  // tooltip would cover what it touches. A pen that can't hover (an older iPad) enters at contact, with its tip down
  // (`buttons` is 1): that is a press, which the long-press handles, not a hover.
  if (event.pointerType === 'touch') return
  if (event.pointerType === 'pen' && event.buttons !== 0) return
  show()
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
  if (!open.value) return
  open.value = false
  follow(false)
  setTopLayer(false)
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
    ref="triggerEl"
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
        :style="{ left: `${position.left}px`, top: `${position.top}px` }"
        :popover="topLayer ? 'manual' : undefined"
        role="tooltip"
        :aria-hidden="announce ? undefined : 'true'"
        data-testid="tooltip"
        :data-owner="owners"
      >
        <template v-if="rich">
          <span class="app-tooltip__head">
            <strong class="app-tooltip__name">{{ name }}</strong>
            <kbd v-if="key" class="app-tooltip__key">{{ key }}</kbd>
          </span>
          <span v-if="detail" class="app-tooltip__body" :class="{ 'app-tooltip__body--disabled': disabled }">{{ detail }}</span>
        </template>
        <template v-else>{{ name }}</template>
      </span>
    </Transition>
  </span>
</template>

<style scoped>
/* The rich Tooltip (ticket 251): name and key chip on one line, the body under them. */
.app-tooltip__bubble:has(.app-tooltip__head) {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
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
  color: var(--tooltip-muted);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-xs);
}

.app-tooltip__body {
  font-weight: 500;
}

.app-tooltip__body--disabled {
  color: var(--tooltip-muted);
}

/* Tooltips fade in at the fast duration (Motion card). */
.app-tooltip-enter-active {
  transition: opacity var(--duration-fast) var(--ease-out);
}

.app-tooltip-enter-from {
  opacity: 0;
}

.app-tooltip {
  display: inline-flex;
}

.app-tooltip__bubble {
  /* In the top layer (a manual popover) and placed in screen coordinates by the script; the rest undoes the popover's
     own box (centered, bordered, scrolling). */
  position: fixed;
  inset: auto;
  z-index: var(--z-tooltip);
  box-sizing: border-box;
  width: max-content;
  /* A long tip wraps at the wide-tooltip measure, or at the screen's width where that is narrower (tickets 246, 265). */
  max-width: min(15rem, calc(100vw - 2 * var(--space-8)));
  margin: 0;
  padding: var(--space-6) var(--space-8);
  overflow: visible;
  font: var(--type-small);
  line-height: 1rem;
  color: var(--ink);
  pointer-events: none;
  background: var(--tooltip-fill);
  backdrop-filter: blur(var(--tooltip-blur));
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
}
</style>
