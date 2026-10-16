<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useId, watch } from 'vue'
import { inTourCard } from '../../composables/ui/tourDom'
import { swallowNextClick } from '../../composables/ui/swallowNextClick'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useEscapeLayer } from '../../composables/ui/useEscapeLayer'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { PANEL_CONTEXT } from './panelContext'

/**
 * The shell Menu and Project open in (spec 0440, ticket 443; MenuPanel and TopSheet cards): a dropdown 4px under its
 * strip button from 1024px, and under that a Top sheet sliding down from under the strip, over a scrim that starts below
 * the strip so Menu and Project stay visible and clickable (a press on the other one swaps the panels, a press on the
 * open one closes it). Same content in both, which reads `sheet` from the context for its bigger rows. Escape and a
 * press outside close it, and focus goes back to the button. One shell stays mounted while the panels swap, so nothing
 * flashes.
 */
const props = defineProps<{
  title: string
  /** The strip button this panel hangs from, by test id. */
  anchor: string
  /** The Menu is a `menu` of items from 1024px; the Project panel holds fields and is a plain dialog. */
  menu?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const wide = useMediaQuery('(min-width: 1024px)')
const sheet = computed(() => !wide.value)
const itemRole = computed(() => (wide.value && props.menu ? ('menuitem' as const) : undefined))
provide(PANEL_CONTEXT, { sheet, itemRole, close: () => emit('close') })

const titleId = useId()
const panelEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
const STRIP_BUTTONS = '[data-testid="strip-menu"], [data-testid="strip-project"]'

const anchored = useAnchoredPosition(anchorEl, panelEl, () => 'start')
/** The dropdown is as tall as the window allows below its button (16px clear of the bottom edge) and scrolls inside past that. */
const dropdownStyle = computed(() => ({ ...anchored.style.value, maxHeight: `calc(100dvh - ${Number.parseFloat(anchored.style.value.top ?? '0') || 0}px - ${16}px)` }))

/** The Top sheet's box: from the strip's bottom edge down to 40px above the canvas box's bottom, the box's full width. */
const sheetBox = ref<Record<string, string>>({})
const scrimBox = ref<Record<string, string>>({})
function measureSheet() {
  const strip = document.querySelector('[data-testid="canvas-strip"]')?.getBoundingClientRect()
  const box = document.querySelector('[data-testid="app-canvas"]')?.getBoundingClientRect()
  if (!strip || !box) return
  sheetBox.value = {
    top: `${strip.bottom}px`,
    left: `${box.left}px`,
    width: `${box.width}px`,
    maxHeight: `${Math.max(0, box.bottom - strip.bottom - 40)}px`,
  }
  scrimBox.value = { top: `${strip.bottom}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${Math.max(0, box.bottom - strip.bottom)}px` }
}

function place() {
  anchorEl.value = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`) ?? undefined
  if (wide.value) anchored.follow()
  else {
    anchored.stop()
    measureSheet()
  }
}
watch([wide, () => props.anchor], () => void nextTick(place))

/**
 * Escape first ends an edit in progress: a field that can be cancelled (the Project's rename) marks its form
 * `data-handles-escape` and hears a `panel-escape` event; with none, Escape closes the panel.
 */
function onEscape() {
  const editing = document.activeElement?.closest('[data-handles-escape]')
  if (editing) editing.dispatchEvent(new CustomEvent('panel-escape'))
  else emit('close')
}
useEscapeLayer(() => true, onEscape)

const FOCUSABLE = 'button:not(:disabled):not([aria-disabled="true"]), [href], input:not(:disabled):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(panelEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

/** Arrows, Home and End move through the panel's controls; a field and a choice group keep their own keys. Tab wraps in the Top sheet and leaves the dropdown. */
function onKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement
  const list = focusables()
  if (event.key === 'Tab') {
    if (!sheet.value) return
    const first = list[0]
    const last = list.at(-1)
    if (!first || !last) return event.preventDefault()
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
    return
  }
  const own = target.closest('input, textarea, [role="radiogroup"], [aria-haspopup]') !== null
  if (own || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = list.indexOf(target)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : event.key === 'ArrowDown' ? Math.min(list.length - 1, index + 1) : Math.max(0, index - 1)
  list[next]?.focus()
}

/** A press outside closes the panel and nothing else; the strip's own buttons are left alone, since their click swaps or closes it. */
function onPointerDownOutside(event: PointerEvent) {
  const target = event.target
  const panel = panelEl.value
  if (!panel || !(target instanceof Element) || panel.contains(target) || inTourCard(target)) return
  if (target.closest(STRIP_BUTTONS) || target.closest('[role="alertdialog"], .app-modal, .bottom-sheet')) return
  event.stopPropagation()
  event.preventDefault()
  swallowNextClick()
  emit('close')
}

/** The Dropdown closes when focus leaves it with Tab. */
function onFocusOut(event: FocusEvent) {
  if (sheet.value) return
  const next = event.relatedTarget
  if (next instanceof Element && !panelEl.value?.contains(next) && !next.closest(STRIP_BUTTONS) && !next.closest('[popover]')) emit('close')
}

/** The Top sheet's handle: a tap or a drag up closes it. */
const DRAG_CLOSE_PX = 60
let dragStartY: number | null = null
let dragOffset = 0
function onHandleDown(event: PointerEvent) {
  dragStartY = event.clientY
  dragOffset = 0
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}
function onHandleMove(event: PointerEvent) {
  if (dragStartY === null || !panelEl.value) return
  dragOffset = Math.max(0, dragStartY - event.clientY)
  panelEl.value.style.transform = `translateY(${-dragOffset}px)`
}
function onHandleUp() {
  if (dragStartY === null) return
  const offset = dragOffset
  dragStartY = null
  dragOffset = 0
  if (panelEl.value) panelEl.value.style.transform = ''
  if (offset < 4 || offset >= DRAG_CLOSE_PX) emit('close')
}

let opener: HTMLElement | null = null
onMounted(() => {
  opener = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`)
  place()
  document.addEventListener('pointerdown', onPointerDownOutside, true)
  window.addEventListener('resize', measureSheet)
  void nextTick(() => (focusables()[0] ?? panelEl.value)?.focus())
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
  window.removeEventListener('resize', measureSheet)
  anchored.stop()
  const target = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`) ?? opener
  // A dialog the panel opened (Duplicate, Delete) takes focus itself and gives it back when it closes.
  if (!document.querySelector('.app-modal')) void nextTick(() => target?.isConnected && target.focus())
})
</script>

<template>
  <div v-if="sheet" class="top-sheet-scrim" :style="scrimBox" data-testid="top-sheet-scrim" />
  <div
    ref="panelEl"
    class="panel-shell"
    :class="sheet ? 'panel-shell--sheet' : 'panel-shell--dropdown'"
    :style="sheet ? sheetBox : dropdownStyle"
    :role="itemRole ? 'menu' : 'dialog'"
    :aria-modal="sheet ? 'true' : undefined"
    :aria-labelledby="titleId"
    tabindex="-1"
    :data-testid="sheet ? 'top-sheet' : 'panel-dropdown'"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <h2 :id="titleId" class="panel-shell__title">{{ title }}</h2>
    <div class="panel-shell__body" data-testid="panel-body">
      <slot />
    </div>
    <div
      v-if="sheet"
      class="panel-shell__grab"
      data-testid="sheet-handle"
      aria-hidden="true"
      @pointerdown="onHandleDown"
      @pointermove="onHandleMove"
      @pointerup="onHandleUp"
      @pointercancel="onHandleUp"
    >
      <div class="panel-shell__handle" />
    </div>
  </div>
</template>

<style scoped>
.panel-shell {
  --panel-item-height: var(--item-height);
  position: fixed;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  color: var(--ink);
  background: var(--overlay-fill);
  border: 1px solid var(--overlay-line);
  box-shadow: var(--elevation-3);
}

.panel-shell:focus {
  outline: none;
}

:root[data-theme='contrast'] .panel-shell {
  border: 2px solid var(--line-strong);
  box-shadow: none;
}

.panel-shell__title {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.panel-shell__body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: none;
  scrollbar-width: none;
}

.panel-shell__body::-webkit-scrollbar {
  display: none;
}

/* The dropdown (MenuPanel card): `panel-width`, under the button, over everything but dialogs; taller than the window, it scrolls inside. */
.panel-shell--dropdown {
  z-index: var(--z-popover);
  width: var(--panel-width);
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  animation: panel-in var(--duration-base) var(--ease-out);
}

/* The Top sheet (TopSheet card): its box is set from the strip and the canvas box; bottom corners rounded, the handle at the bottom. */
.panel-shell--sheet {
  --panel-item-height: 2.875rem;
  z-index: var(--z-sheet);
  padding: var(--space-8) var(--space-10) 0;
  border-width: 0 0 1px;
  border-radius: 0 0 var(--top-sheet-radius) var(--top-sheet-radius);
  animation: top-sheet-in var(--duration-slow) var(--ease-out);
}

:root[data-theme='contrast'] .panel-shell--sheet {
  border-width: 0 0 2px;
}

@media (pointer: coarse) {
  .panel-shell {
    --panel-item-height: 2.75rem;
  }
}

.top-sheet-scrim {
  position: fixed;
  z-index: calc(var(--z-sheet) - 1);
  background: var(--scrim);
  animation: panel-fade var(--duration-base) var(--ease-out);
  pointer-events: none;
}

.panel-shell__grab {
  flex: none;
  padding: var(--space-10) 0;
  touch-action: none;
  cursor: grab;
}

.panel-shell__handle {
  width: 2.25rem;
  height: 4px;
  margin: 0 auto;
  background: var(--line-strong);
  border-radius: var(--radius-full);
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@keyframes top-sheet-in {
  from {
    transform: translateY(-100%);
  }
}

@keyframes panel-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel-shell--dropdown,
  .panel-shell--sheet {
    animation: panel-fade var(--duration-base) var(--ease-out);
  }
}
</style>
