<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useId, watch } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import { PANEL_CONTEXT } from './panelContext'
import IconButton from '../ui/IconButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { usePressClosed } from '../../composables/shell/usePressClosed'

// The shell Menu, Project and the Frame bar open in (spec 0440, tickets 443, 475; MenuPanel, TopSheet cards): a dropdown
// from 1024px, else a Top sheet under the strip. Escape or a press outside closes it; focus returns to the button.
// A `sub` slot is one sub-view over the root (spec 0478): Back arrow, `subTitle`, pinned `footer`; resets on swap.
const props = defineProps<{
  title: string
  /** The strip button this panel hangs from, by test id. */
  anchor: string
  /** The Menu is a `menu` of items from 1024px; the Project panel holds fields and is a plain dialog. */
  menu?: boolean
  /** Which edge lines up with the button; `end` hangs the panel to its left (the Frame bar from the edit pencil). */
  align?: 'start' | 'end'
  /** A dropdown at every width, never the Top sheet: a button on the canvas, not in the strip. */
  dropdown?: boolean
  /** The dropdown's width, when not `panel-width`. */
  width?: string
  /** A press outside that still works the panel's own thing, so it goes through and the panel stays. */
  keepsPress?: (event: PointerEvent) => boolean
  /** The sub-view's title; a panel with a `sub` slot gives one. */
  subTitle?: string
  /** Opens already on the sub-view; Escape then closes the panel instead of going back. */
  startInSub?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const wide = useMediaQuery('(min-width: 1024px)')
const sheet = computed(() => !wide.value && !props.dropdown)
const { t } = useI18n()
/** Whether the sub-view is showing, and whether the panel opened on it (so Escape closes rather than goes back). */
const inSub = ref(props.startInSub ?? false)
const openedInSub = props.startInSub ?? false
const itemRole = computed(() => (wide.value && props.menu && !inSub.value ? ('menuitem' as const) : undefined))
/** The row that opened the sub-view, found again by its test id to take focus back from Back. */
let returnTestId: string | null = null
const subBodyEl = ref<HTMLElement>()
function openSub() {
  returnTestId = document.activeElement?.getAttribute('data-testid') ?? null
  inSub.value = true
  void nextTick(focusEntry)
}
function goBack() {
  inSub.value = false
  const testId = returnTestId
  void nextTick(() => {
    const row = testId ? panelEl.value?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) : null
    ;(row ?? focusables()[0])?.focus({ preventScroll: true })
  })
}
provide(PANEL_CONTEXT, { sheet, itemRole, close: () => emit('close'), openSub })

const titleId = useId()
const panelEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
/** The buttons that open, swap or close a panel themselves, so a press on one is not a press outside. */
const OPENERS = '[data-testid="strip-menu"], [data-testid="strip-project"], [data-testid="strip-frame"], [data-testid="frame-edit-toggle"]'

const anchored = useAnchoredPosition(anchorEl, panelEl, () => props.align ?? 'start')
/** The dropdown is as tall as the window allows below its button (16px clear of the bottom edge) and scrolls inside
 * past that. */
const dropdownStyle = computed(() => ({
  ...anchored.style.value,
  maxHeight: `calc(100dvh - ${Number.parseFloat(anchored.style.value.top ?? '0') || 0}px - ${16}px)`,
  ...(props.width ? { width: props.width } : {}),
}))

/** The Top sheet's box: from the strip's bottom edge down to 40px above the canvas box's bottom, the box's full
 * width. */
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

/** The style the panel is placed with, as a dropdown or as the Top sheet. */
const panelBox = computed(() => (sheet.value ? sheetBox.value : dropdownStyle.value))

function place() {
  anchorEl.value = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`) ?? undefined
  if (!sheet.value) anchored.follow()
  else {
    anchored.stop()
    measureSheet()
  }
}
watch([wide, () => props.anchor, () => props.dropdown], () => void nextTick(place))
watch(() => props.anchor, () => (inSub.value = false))

// Escape first ends an edit in progress: a cancellable field (the Project's rename) marks its form
// `data-handles-escape` and hears a `panel-escape` event; with none, Escape closes the panel.
function onEscape() {
  if (inSub.value && !openedInSub) return goBack()
  const editing = document.activeElement?.closest('[data-handles-escape]')
  if (editing) editing.dispatchEvent(new CustomEvent('panel-escape'))
  else emit('close')
}
/** Whether the press just let through was one the panel keeps, so the focus it moves does not close it. */
let keptPress = false
let keptPressTimer: ReturnType<typeof setTimeout> | undefined
useOverlayLayer({
  isOpen: () => true,
  root: () => panelEl.value,
  close: onEscape,
  // The strip's own buttons are left alone, since their click swaps or closes the panel.
  isOpener: (target) => target.closest(OPENERS) !== null,
  keepsPress: (event) => {
    const kept = props.keepsPress?.(event) ?? false
    // The focus it moves (onto the canvas) comes in this same task.
    if (kept) {
      keptPress = true
      clearTimeout(keptPressTimer)
      keptPressTimer = setTimeout(() => (keptPress = false))
    }
    return kept
  },
  onOutsidePress: () => {
    pressClosed.markPressClosed()
    emit('close')
  },
})

const FOCUSABLE = 'button:not(:disabled):not([aria-disabled="true"]), [href], input:not(:disabled):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(panelEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

/** Focus on opening: the sub-view's first field (not its Back arrow), else the panel's first control. */
function focusEntry() {
  const first = inSub.value ? subBodyEl.value?.querySelector<HTMLElement>(FOCUSABLE) : focusables()[0]
  ;(first ?? focusables()[0] ?? panelEl.value)?.focus({ preventScroll: true })
}

/** Arrows, Home and End move through the panel's controls; a field and a choice group keep their own keys. Tab wraps
 * in the Top sheet and leaves the dropdown. */
function onKeydown(event: KeyboardEvent) {
  // A key the content already used (the Frame bar's arrows move the Frame) is not a move through the panel.
  if (event.defaultPrevented) return
  const target = event.target as HTMLElement
  const list = focusables()
  if (event.key === 'Tab') {
    if (!sheet.value) return
    const first = list[0]
    const last = list.at(-1)
    if (!first || !last) return event.preventDefault()
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus({ preventScroll: true })
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus({ preventScroll: true })
    }
    return
  }
  const own = target.closest('input, textarea, [role="radiogroup"], [aria-haspopup]') !== null
  if (own || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = list.indexOf(target)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : event.key === 'ArrowDown' ? Math.min(list.length - 1, index + 1) : Math.max(0, index - 1)
  list[next]?.focus({ preventScroll: true })
}

/** The Dropdown closes when focus leaves it with Tab, not with a press the panel keeps (a Frame handle on the canvas). */
function onFocusOut(event: FocusEvent) {
  if (sheet.value || keptPress) return
  const next = event.relatedTarget
  if (next instanceof Element && !panelEl.value?.contains(next) && !next.closest(OPENERS) && !next.closest('[popover]')) emit('close')
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

/** `place` again after the button moved with no scroll or resize (the edit pencil on a zoom); the panel's element and
 * box, for what keeps clear of it. */
defineExpose({ place, el: panelEl, box: panelBox })

let opener: HTMLElement | null = null
const pressClosed = usePressClosed()
onMounted(() => {
  opener = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`)
  place()
  window.addEventListener('resize', measureSheet)
  void nextTick(focusEntry)
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', measureSheet)
  clearTimeout(keptPressTimer)
  anchored.stop()
  const target = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`) ?? opener
  // A dialog the panel opened (Duplicate, Delete) takes focus itself and gives it back when it closes.
  if (!pressClosed.wasPressClosed() && !document.querySelector('.app-modal')) void nextTick(() => target?.isConnected && target.focus({ preventScroll: true }))
})
</script>

<template>
  <div v-if="sheet" class="top-sheet-scrim" :style="scrimBox" data-testid="top-sheet-scrim" />
  <div
    ref="panelEl"
    class="panel-shell"
    :class="sheet ? 'panel-shell--sheet' : 'panel-shell--dropdown'"
    :style="panelBox"
    :role="itemRole ? 'menu' : 'dialog'"
    :aria-modal="sheet ? 'true' : undefined"
    :aria-labelledby="titleId"
    tabindex="-1"
    :data-testid="sheet ? 'top-sheet' : 'panel-dropdown'"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <header v-if="inSub" class="panel-shell__header">
      <IconButton icon="chevron-left" variant="plain" :label="t.panels.back" tooltip data-testid="panel-back" @click="goBack" />
      <h2 :id="titleId" class="panel-shell__heading" data-testid="panel-sub-title">{{ subTitle }}</h2>
    </header>
    <h2 v-else :id="titleId" class="panel-shell__title">{{ title }}</h2>
    <div ref="subBodyEl" class="panel-shell__body" data-testid="panel-body">
      <slot v-if="inSub" name="sub" />
      <slot v-else />
    </div>
    <footer v-if="inSub && $slots.footer" class="panel-shell__footer" data-testid="panel-footer">
      <slot name="footer" />
    </footer>
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

.panel-shell__header {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
  padding-bottom: var(--space-8);
}

.panel-shell__heading {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

.panel-shell__footer {
  flex: none;
  padding: var(--space-10) 0;
  border-top: 1px solid var(--panel-rule);
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

/* The dropdown (MenuPanel card): `panel-width`, under the button, over everything but dialogs; taller than the
 * window, it scrolls inside. */
.panel-shell--dropdown {
  z-index: var(--z-popover);
  width: var(--panel-width);
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  animation: panel-in var(--duration-base) var(--ease-out);
}

/* The Top sheet (TopSheet card): its box is set from the strip and the canvas box; bottom corners rounded, the
 * handle at the bottom. */
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
