<script setup lang="ts">
import { computed, nextTick, ref, useId } from 'vue'
import { betaSubject, isBeta, type BetaFeature } from '../../domain/betaFeatures'
import { useBetaFeedback } from '../../composables/ui/betaFeedback'
import { cssZoomOf } from '../../composables/ui/cssZoom'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useI18n } from '../../i18n/useI18n'
import AppButton from './AppButton.vue'

// The Beta chip (BetaChip card, ticket 1198): a small accent-2 label after the name of a feature that works but is still
// being tested. Hover, keyboard focus or a tap opens a popover that says so and offers Send feedback; Escape closes it.
// It may sit inside a button or row, so it is a span with role button that keeps its clicks and keys to itself.
const props = defineProps<{
  feature: BetaFeature
  /** What Send feedback starts the message with, before "(beta)": the feature's name as the person sees it. */
  name: string
}>()

const { t } = useI18n()
const sendFeedback = useBetaFeedback()
const id = useId()
const shown = computed(() => isBeta(props.feature))
const open = ref(false)
/** Opened by a tap or Enter: a second one closes it, but the click that follows the hover or focus that opened it does not. */
const pinned = ref(false)
const wrapEl = ref<HTMLElement>()
const chipEl = ref<HTMLElement>()
const popoverEl = ref<HTMLElement>()
const position = ref({ left: 0, top: 0 })
const zoom = ref(1)
const GAP_PX = 6
const MARGIN_PX = 8
const CLOSE_DELAY_MS = 150
let closeTimer: ReturnType<typeof setTimeout> | undefined
const topLayer = typeof HTMLElement !== 'undefined' && 'showPopover' in HTMLElement.prototype

function setTopLayer(on: boolean) {
  const el = popoverEl.value
  if (!el || !topLayer) return
  try {
    if (on && !el.matches(':popover-open')) el.showPopover()
    else if (!on && el.matches(':popover-open')) el.hidePopover()
  } catch {
    // Already in the wanted state.
  }
}

/** Below the chip, or above where there is no room, kept inside the screen. */
async function place() {
  position.value = { left: 0, top: 0 }
  await nextTick()
  const pop = popoverEl.value?.getBoundingClientRect()
  const chip = chipEl.value?.getBoundingClientRect()
  if (!pop || !chip) return
  zoom.value = cssZoomOf(popoverEl.value)
  const below = chip.bottom + GAP_PX
  const top = below + pop.height + MARGIN_PX > window.innerHeight ? chip.top - GAP_PX - pop.height : below
  const left = Math.min(Math.max(MARGIN_PX, chip.left), window.innerWidth - MARGIN_PX - pop.width)
  position.value = { left, top: Math.max(MARGIN_PX, top) }
}

async function show() {
  clearTimeout(closeTimer)
  if (open.value) return
  open.value = true
  await nextTick()
  setTopLayer(true)
  await place()
}

function hide() {
  clearTimeout(closeTimer)
  if (!open.value) return
  open.value = false
  pinned.value = false
  setTopLayer(false)
}

/** Leaving the chip waits a moment, so the pointer can cross to the popover's button. */
function hideSoon() {
  clearTimeout(closeTimer)
  closeTimer = setTimeout(hide, CLOSE_DELAY_MS)
}

/** Focus a script gave it (a panel opening onto its first control) is not a keyboard user's: it opens nothing. */
function onFocusIn(event: FocusEvent) {
  const target = event.target as HTMLElement
  try {
    if (target === document.activeElement && !target.matches(':focus-visible')) return
  } catch {
    // No :focus-visible here: treat it as keyboard focus.
  }
  void show()
}

function onFocusOut(event: FocusEvent) {
  if (!wrapEl.value?.contains(event.relatedTarget as Node | null)) hide()
}

/** A tap opens it (a touch screen has no hover), a second closes it; the row or button around never hears it. */
function onClick(event: MouseEvent) {
  event.stopPropagation()
  event.preventDefault()
  toggle()
}

function toggle() {
  if (open.value && pinned.value) hide()
  else {
    pinned.value = true
    void show()
  }
}

function onKeydown(event: KeyboardEvent) {
  event.stopPropagation()
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    toggle()
  }
}

function onSend() {
  hide()
  sendFeedback?.(betaSubject(props.name))
}

useOverlayLayer({ isOpen: () => open.value, root: () => wrapEl.value, close: hide, outside: 'through' })
</script>

<template>
  <span
    v-if="shown"
    ref="wrapEl"
    class="beta-chip"
    @pointerenter="(event: PointerEvent) => event.pointerType === 'mouse' && show()"
    @pointerleave="hideSoon"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @click.stop
    @keydown.stop
  >
    <span
      ref="chipEl"
      class="beta-chip__label"
      role="button"
      tabindex="0"
      :aria-describedby="open ? id : undefined"
      :aria-expanded="open"
      data-testid="beta-chip"
      @click="onClick"
      @keydown="onKeydown"
    >{{ t.beta.chip }}</span>
    <span
      v-if="open"
      :id="id"
      ref="popoverEl"
      class="beta-chip__popover"
      :popover="topLayer ? 'manual' : undefined"
      role="group"
      :style="{ left: `${position.left / zoom}px`, top: `${position.top / zoom}px` }"
      data-testid="beta-popover"
    >
      <span class="beta-chip__text">{{ t.beta.popover }}</span>
      <AppButton v-if="sendFeedback" size="sm" data-testid="beta-send-feedback" @click="onSend">{{ t.beta.send }}</AppButton>
    </span>
  </span>
</template>

<style scoped>
.beta-chip {
  display: inline-flex;
  flex: none;
  margin-inline-start: var(--space-6);
  vertical-align: middle;
  white-space: nowrap;
}

/* Inside a button the label keeps the left and the chip sits centered in the free space after it, whatever the button's
   width or the language: auto margins on both sides. */
:global(.app-button) > .beta-chip {
  margin-inline: auto;
}

:global(.app-button:has(> .beta-chip)) {
  justify-content: flex-start;
}

.beta-chip__label {
  padding: 0 var(--space-6);
  font: var(--type-meta-tiny);
  color: var(--accent-2);
  cursor: default;
  background: var(--accent-2-soft);
  border: 1px solid var(--accent-2);
  border-radius: var(--radius-full);
}

.beta-chip__label:focus-visible {
  outline: 2px solid var(--focus-ring);
  outline-offset: 1px;
}

.beta-chip__popover {
  position: fixed;
  inset: auto;
  z-index: var(--z-tooltip);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  align-items: flex-start;
  width: max-content;
  max-width: min(var(--tooltip-max-width), calc(100vw - 2 * var(--space-8)));
  margin: 0;
  padding: var(--space-8) var(--space-12);
  overflow: visible;
  font: var(--type-small);
  line-height: var(--tooltip-line);
  color: var(--ink);
  white-space: normal;
  background: var(--tooltip-fill);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-sm);
  box-shadow: var(--elevation-3);
}
</style>
