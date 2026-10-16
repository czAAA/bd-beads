<script setup lang="ts">
import { inTourCard } from '../../composables/ui/tourDom'
import { nextTick, onBeforeUnmount, onMounted, provide, ref, useId } from 'vue'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { swallowNextClick } from '../../composables/ui/swallowNextClick'
import IconButton from '../ui/IconButton.vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { usePressClosed } from '../../composables/shell/usePressClosed'
import { SHEET_CLOSE } from './sheetContext'

/**
 * The design system's ToolSheet (ticket 79; ToolSheet card): the phone Dock's bottom sheets. Light (the default --
 * Tool, Colour, Edit, Mirror, Size): `panel`, 18px top corners, a grab handle, title and close, no scrim, only as
 * tall as its content so the Project stays in view. `modal` (the Project sheet): taller, with a scrim. Both close on a
 * press anywhere outside them, which only closes (ticket 402).
 *
 * Mounted with `v-if`, like AppModal: while open, focus stays inside (Tab wraps, Escape and the close button hand it
 * back to whatever opened it). Slides up with `transform` (ADR 0018: the drawing surface behind it never resizes).
 * Swipe-to-dismiss: the handle closes the sheet on a tap or a drag down (ticket 402).
 */
withDefaults(defineProps<{ title: string; modal?: boolean }>(), { modal: false })
const emit = defineEmits<{ close: [] }>()
const closeAction = controlAction('close')

/** Pick controls inside (tool tiles, Palette swatches, the Custom and Image colors) close the sheet through this once they have picked. */
provide(SHEET_CLOSE, () => emit('close'))

const titleId = useId()
const sheetEl = ref<HTMLElement>()
const bodyEl = ref<HTMLElement>()
let opener: HTMLElement | null = null
const pressClosed = usePressClosed()

useEscapeLayer(() => true, () => emit('close'))

const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(sheetEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

/** Same, but for where opening focus lands: `data-skip-autofocus` (ticket 188) opts a control with a focus side
 * effect (SizeControls' info button opens its tooltip on focus) out of being that landing spot, while Tab still
 * reaches it normally through `focusables()`. */
function initialFocusable(within: HTMLElement | undefined = sheetEl.value): HTMLElement | undefined {
  return [...(within?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])].find((el) => !el.hasAttribute('data-skip-autofocus'))
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  const list = focusables()
  const first = list[0]
  const last = list.at(-1)
  if (!first || !last) {
    event.preventDefault()
    return
  }
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === sheetEl.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

function onFocusIn(event: FocusEvent) {
  const target = event.target as Node | null
  if (!target || inTourCard(target) || sheetEl.value?.contains(target)) return
  // A focus that lands inside another open sheet (stacked, like Saved Projects over the Project sheet) is not
  // "outside": that sheet's own trap owns it, and every trap pulling it back would recurse until the stack overflows.
  if (target instanceof Element && target.closest('.bottom-sheet')) return
  // Likewise a modal raised from inside the sheet (the name on exports, a confirmation): it traps its own focus.
  if (target instanceof Element && target.closest('.app-modal')) return
  ;(initialFocusable() ?? focusables()[0] ?? sheetEl.value)?.focus()
}

/**
 * A sheet, light or modal, closes on a press anywhere outside it, and only closes: the press and its click are
 * swallowed so nothing under them acts (no stroke, fill or Frame start; a strip button doesn't re-open the sheet it
 * just closed). A press inside another dialog (a stacked sheet, a confirmation) is not "outside", and only the
 * topmost sheet reacts.
 */
function onPointerDownOutside(event: PointerEvent) {
  const sheet = sheetEl.value
  const target = event.target
  if (!sheet || !(target instanceof Node) || sheet.contains(target) || inTourCard(target)) return
  if (target instanceof Element && target.closest('[role="dialog"], [role="alertdialog"]')) return
  if ([...document.querySelectorAll('.bottom-sheet')].at(-1) !== sheet) return
  event.stopPropagation()
  event.preventDefault()
  swallowNextClick()
  pressClosed.markPressClosed()
  emit('close')
}

/** The handle: a tap closes the sheet, a drag down follows the finger and closes past the threshold, else springs back. */
const DRAG_CLOSE_PX = 80
let dragStartY: number | null = null
let dragOffset = 0

function onHandleDown(event: PointerEvent) {
  dragStartY = event.clientY
  dragOffset = 0
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}

function onHandleMove(event: PointerEvent) {
  if (dragStartY === null || !sheetEl.value) return
  dragOffset = Math.max(0, event.clientY - dragStartY)
  sheetEl.value.style.transform = `translateY(${dragOffset}px)`
}

function onHandleUp() {
  if (dragStartY === null) return
  const offset = dragOffset
  dragStartY = null
  dragOffset = 0
  if (sheetEl.value) sheetEl.value.style.transform = ''
  // Under a few pixels is a tap, not a drag.
  if (offset < 4 || offset >= DRAG_CLOSE_PX) emit('close')
}

onMounted(() => {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  // The close button sits before the body in DOM order (so it can stay pinned top-right); focus starts on the
  // sheet's own content instead, the same way AppModal's own initial focus skips past its header.
  void nextTick(() => (initialFocusable(bodyEl.value) ?? initialFocusable() ?? focusables()[0] ?? sheetEl.value)?.focus())
  document.addEventListener('focusin', onFocusIn)
  document.addEventListener('pointerdown', onPointerDownOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener('focusin', onFocusIn)
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
  if (pressClosed.wasPressClosed()) return
  const target = opener
  if (target?.isConnected) {
    target.focus()
  } else {
    void nextTick(() => target?.isConnected && target.focus())
  }
})
</script>

<template>
  <div v-if="modal" class="bottom-sheet-scrim" data-testid="sheet-scrim" />
  <div
    ref="sheetEl"
    class="bottom-sheet"
    :class="{ 'bottom-sheet--modal': modal }"
    role="dialog"
    aria-modal="true"
    :aria-labelledby="titleId"
    tabindex="-1"
    data-testid="bottom-sheet"
    @keydown="onKeydown"
  >
    <div
      class="bottom-sheet__grab"
      data-testid="sheet-handle"
      aria-hidden="true"
      @pointerdown="onHandleDown"
      @pointermove="onHandleMove"
      @pointerup="onHandleUp"
      @pointercancel="onHandleUp"
    >
      <div class="bottom-sheet__handle" />
    </div>
    <div class="bottom-sheet__head">
      <h2 :id="titleId" class="bottom-sheet__title">{{ title }}</h2>
      <div class="bottom-sheet__head-actions">
        <slot name="actions" />
        <IconButton variant="plain" shape="round" :icon-size="16" :action="closeAction" data-testid="sheet-close" @click="emit('close')" />
      </div>
    </div>
    <div ref="bodyEl" class="bottom-sheet__body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.bottom-sheet-scrim {
  position: fixed;
  inset: 0;
  z-index: calc(var(--z-sheet) - 1);
  background: var(--scrim);
  animation: bottom-sheet-fade var(--duration-base) var(--ease-out);
  pointer-events: none;
}

.bottom-sheet {
  position: fixed;
  right: 0;
  bottom: 0;
  left: 0;
  z-index: var(--z-sheet);
  box-sizing: border-box;
  max-height: 80dvh;
  padding: var(--space-8) var(--space-20) calc(var(--space-20) + env(safe-area-inset-bottom));
  overflow-y: auto;
  overscroll-behavior: none;
  background: var(--panel);
  border-top: 1px solid var(--panel-line);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--elevation-3);
  animation: bottom-sheet-arrive var(--duration-base) var(--ease-out);
}

.bottom-sheet--modal {
  max-height: 90dvh;
  background: var(--overlay-fill);
}

.bottom-sheet:focus {
  outline: none;
}

:root[data-theme='dark'] .bottom-sheet {
  border-color: var(--line-strong);
}

:root[data-theme='contrast'] .bottom-sheet {
  border-width: 2px;
  box-shadow: none;
}

/* A full-width, finger-sized strip around the bar: the bar alone is 4px tall. */
.bottom-sheet__grab {
  margin: calc(-1 * var(--space-8)) calc(-1 * var(--space-20)) 0;
  padding: var(--space-8) 0 var(--space-12);
  touch-action: none;
  cursor: grab;
}

.bottom-sheet__handle {
  width: 2.25rem;
  height: 4px;
  margin: 0 auto;
  background: var(--line-strong);
  border-radius: var(--radius-full);
}

.bottom-sheet__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-16);
  margin-bottom: var(--space-12);
}

.bottom-sheet__head-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-4);
}

.bottom-sheet__title {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

@keyframes bottom-sheet-fade {
  from {
    opacity: 0;
  }
}

@keyframes bottom-sheet-arrive {
  from {
    transform: translateY(100%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .bottom-sheet,
  .bottom-sheet-scrim {
    animation: none;
  }
}
</style>
