<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useId, watch } from 'vue'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { PANEL_CONTEXT } from './panelContext'
import { PANEL_OPENERS } from './panels'
import IconButton from '../ui/IconButton.vue'
import { useI18n } from '../../i18n/useI18n'
import { usePressClosed } from '../../composables/shell/usePressClosed'

// The shell Menu, Project and the Frame bar open in (spec 0440, tickets 443, 475; MenuPanel card): a dropdown under the
// button on every device and screen size. Escape or a press outside closes it; focus returns to the button.
// A `sub` slot is a stack of sub-views (spec 0478, ticket 493): Back arrow, title, pinned `footer`; Back and Escape pop.
const props = defineProps<{
  title: string
  /** The strip button this panel hangs from, by test id. */
  anchor: string
  /** The Menu is a `menu` of items; the Project panel holds fields and is a plain dialog. */
  menu?: boolean
  /** Opens without focusing a field, so a tablet's keyboard stays down (the Frame bar's size fields). */
  skipsFields?: boolean
  /** The dropdown's width, when not `panel-width`. */
  width?: string
  /** The first sub-view's title; a panel with a `sub` slot gives one. */
  subTitle?: string
  /** Opens already on the sub-view; Escape then closes the panel instead of going back. */
  startInSub?: boolean
}>()
const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
/** One entry per sub-view pushed over the root, with the title it was opened with and the row that opened it (found
 * again by its test id to take focus back from Back). */
interface SubLevel {
  title?: string
  returnTestId: string | null
}
const stack = ref<SubLevel[]>(props.startInSub ? [{ returnTestId: null }] : [])
/** Whether a sub-view is showing, and whether the panel opened on its first (so Escape there closes rather than goes back). */
const inSub = computed(() => stack.value.length > 0)
const depth = computed(() => stack.value.length)
const openedInSub = props.startInSub ?? false
const currentTitle = computed(() => stack.value.at(-1)?.title ?? props.subTitle)
const itemRole = computed(() => (props.menu && !inSub.value ? ('menuitem' as const) : undefined))
const subBodyEl = ref<HTMLElement>()
function openSub(title?: string) {
  stack.value.push({ title, returnTestId: document.activeElement?.getAttribute('data-testid') ?? null })
  void nextTick(focusEntry)
}
function goBack() {
  const testId = stack.value.pop()?.returnTestId
  void nextTick(() => {
    const row = testId ? panelEl.value?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) : null
    ;(row ?? focusables()[0])?.focus({ preventScroll: true })
  })
}
provide(PANEL_CONTEXT, { itemRole, close: () => emit('close'), openSub })

const titleId = useId()
const panelEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
/** The buttons that open, swap or close a panel themselves, so a press on one is not a press outside. */
const OPENERS = PANEL_OPENERS

const anchored = useAnchoredPosition(anchorEl, panelEl, () => 'start')
/** The dropdown is as tall as the window allows below its button (16px clear of the bottom edge) and scrolls inside
 * past that. */
const placed = anchored.style
const dropdownStyle = computed(() => ({
  ...placed.value,
  maxHeight: `calc(100dvh - ${Number.parseFloat(placed.value.top ?? '0') || 0}px - ${16}px)`,
  ...(props.width ? { width: props.width } : {}),
}))

function place() {
  anchorEl.value = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`) ?? undefined
  anchored.follow()
}
watch(() => props.anchor, () => {
  stack.value = []
  void nextTick(place)
})

// Escape first ends an edit in progress: a cancellable field (the Project's rename) marks its form
// `data-handles-escape` and hears a `panel-escape` event; with none, Escape closes the panel.
function onEscape() {
  if (depth.value > (openedInSub ? 1 : 0)) return goBack()
  const editing = document.activeElement?.closest('[data-handles-escape]')
  if (editing) editing.dispatchEvent(new CustomEvent('panel-escape'))
  else emit('close')
}
useOverlayLayer({
  isOpen: () => true,
  root: () => panelEl.value,
  close: onEscape,
  // The strip's own buttons are left alone, since their click swaps or closes the panel.
  isOpener: (target) => target.closest(OPENERS) !== null,
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
  if (props.skipsFields) return void panelEl.value?.focus({ preventScroll: true })
  ;(first ?? focusables()[0] ?? panelEl.value)?.focus({ preventScroll: true })
}

/** Arrows, Home and End move through the panel's controls; a field and a choice group keep their own keys. Tab is
 * left to the browser: it leaves the dropdown. */
function onKeydown(event: KeyboardEvent) {
  // A key the content already used (the Frame bar's arrows move the Frame) is not a move through the panel.
  if (event.defaultPrevented) return
  const target = event.target as HTMLElement
  const list = focusables()
  if (event.key === 'Tab') return
  const own = target.closest('input, textarea, [role="radiogroup"], [aria-haspopup]') !== null
  if (own || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = list.indexOf(target)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : event.key === 'ArrowDown' ? Math.min(list.length - 1, index + 1) : Math.max(0, index - 1)
  list[next]?.focus({ preventScroll: true })
}

/** The dropdown closes when focus leaves it with Tab. */
function onFocusOut(event: FocusEvent) {
  const next = event.relatedTarget
  if (next instanceof Element && !panelEl.value?.contains(next) && !next.closest(OPENERS) && !next.closest('[popover]')) emit('close')
}

/** `place` again after the button moved with no scroll or resize (the edit pencil on a zoom); the panel's element and
 * box, for what keeps clear of it. */
defineExpose({ place, el: panelEl, box: dropdownStyle })

let opener: HTMLElement | null = null
const pressClosed = usePressClosed()
onMounted(() => {
  opener = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`)
  place()
  void nextTick(focusEntry)
})
onBeforeUnmount(() => {
  anchored.stop()
  const target = document.querySelector<HTMLElement>(`[data-testid="${props.anchor}"]`) ?? opener
  // A dialog the panel opened (Duplicate, Delete) takes focus itself and gives it back when it closes.
  if (!pressClosed.wasPressClosed() && !document.querySelector('.app-modal')) void nextTick(() => target?.isConnected && target.focus({ preventScroll: true }))
})
</script>

<template>
  <div
    ref="panelEl"
    class="panel-shell panel-shell--dropdown"
    :style="dropdownStyle"
    :role="itemRole ? 'menu' : 'dialog'"
    :aria-labelledby="titleId"
    tabindex="-1"
    data-testid="panel-dropdown"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <header v-if="inSub" class="panel-shell__header">
      <IconButton icon="chevron-left" variant="plain" :label="t.panels.back" tooltip data-testid="panel-back" @click="goBack" />
      <h2 :id="titleId" class="panel-shell__heading" data-testid="panel-sub-title">{{ currentTitle }}</h2>
    </header>
    <h2 v-else :id="titleId" class="panel-shell__title">{{ title }}</h2>
    <div ref="subBodyEl" class="panel-shell__body" data-testid="panel-body">
      <slot v-if="inSub" name="sub" :depth="depth" />
      <slot v-else />
    </div>
    <footer v-if="inSub && $slots.footer" class="panel-shell__footer" data-testid="panel-footer">
      <slot name="footer" :depth="depth" />
    </footer>
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

.panel-shell__footer:empty {
  display: none;
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
  /* Never wider than the screen less the 8px gutter the position keeps (the phone's larger rem makes 21.25rem nearly 390px). */
  max-width: calc(100vw - 2 * var(--frame-bar-gap));
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  animation: panel-in var(--duration-base) var(--ease-out);
}

@media (pointer: coarse) {
  .panel-shell {
    --panel-item-height: 2.75rem;
  }
}

@keyframes panel-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

@keyframes panel-fade {
  from {
    opacity: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel-shell--dropdown {
    animation: panel-fade var(--duration-base) var(--ease-out);
  }
}
</style>
