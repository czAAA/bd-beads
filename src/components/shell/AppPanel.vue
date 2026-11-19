<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, provide, ref, useId, watch } from 'vue'
import { ownLength } from '../../composables/ui/cssZoom'
import { useAnchoredPosition } from '../../composables/ui/useAnchoredPosition'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useShellScope } from '../../composables/ui/shellScope'
import { scrollCut, useScrollPosition } from '../../composables/ui/useScrollCut'
import { PANEL_CONTEXT } from './panelContext'
import { PANEL_OPENERS } from './panels'
import IconButton from '../ui/IconButton.vue'
import { useI18n } from '../../i18n/useI18n'
import type { Region } from '../../rendering/surfaceView'
import { usePressClosed } from '../../composables/shell/usePressClosed'
import { wouldRaiseKeyboard } from '../../composables/ui/touchKeyboard'

// The shell Menu, Project and the Frame panel open in (spec 0440, tickets 443, 475; MenuPanel card): a dropdown under the
// button on every device and screen size. Escape or a press outside closes it; focus returns to the button.
// A `sub` slot is a stack of subpanels (spec 0478, ticket 493): Back arrow, title, pinned `footer`; Back and Escape pop.
const props = defineProps<{
  title: string
  /** The strip button this panel hangs from, by test id. */
  anchor: string
  /** The Menu: a plain region named by its title, its rows buttons (ticket 0856), focus wrapping inside it; the other
   * panels and every subpanel are dialogs. */
  menu?: boolean
  /** Opens without focusing a field, so a tablet's keyboard stays down (the Frame panel's size fields). */
  skipsFields?: boolean
  /** The dropdown's width, when not `panel-width`. */
  width?: string
  /** The button edge the dropdown lines up with, `start` when not given. */
  align?: 'start' | 'end'
  /** The first subpanel's title; a panel with a `sub` slot gives one. */
  subTitle?: string
  /** A figure at the right of the subpanel's header (the library's count). */
  subMeta?: string
  /** Opens already on the subpanel; Escape then closes the panel instead of going back. */
  startInSub?: boolean
}>()
const emit = defineEmits<{ close: []; placed: [box: Region] }>()

const { t } = useI18n()
/** One entry per subpanel pushed over the root, with the title it was opened with and the row that opened it (found
 * again by its test id to take focus back from Back). */
interface SubLevel {
  title?: string
  /** Its crumb at the header's right ("starter · shapes", ticket 0596); the panel's `subMeta` when none. */
  meta?: string
  returnTestId: string | null
}
const stack = ref<SubLevel[]>(props.startInSub ? [{ returnTestId: null }] : [])
/** Whether a subpanel is showing, and whether the panel opened on its first (so Escape there closes rather than goes back). */
const inSub = computed(() => stack.value.length > 0)
const depth = computed(() => stack.value.length)
const openedInSub = props.startInSub ?? false
const currentTitle = computed(() => stack.value.at(-1)?.title ?? props.subTitle)
const currentMeta = computed(() => stack.value.at(-1)?.meta ?? props.subMeta)
const subBodyEl = ref<HTMLElement>()
/** Where the body is scrolled: the edge where more lies fades, and a thumb in the panel's padding shows how much of it
 * shows and where, since a tablet shows no scrollbar (MenuPanel card). */
const bodyScroll = useScrollPosition(subBodyEl, () => 'vertical')
const bodyCut = computed(() => scrollCut(bodyScroll.value))
const thumbStyle = computed(() => {
  const { scrolled, shown, whole } = bodyScroll.value
  if (bodyCut.value === 'none') return undefined
  return { '--thumb-size': String(shown / whole), '--thumb-at': String(Math.min(1, scrolled / (whole - shown))) }
})
function openSub(title?: string, level: { meta?: string; opener?: string } = {}) {
  stack.value.push({ title, meta: level.meta, returnTestId: level.opener ?? document.activeElement?.getAttribute('data-testid') ?? null })
  void nextTick(focusEntry)
}
function goBack() {
  const testId = stack.value.pop()?.returnTestId
  void nextTick(() => {
    const row = testId ? panelEl.value?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) : null
    focusUnlessKeyboard(row ?? focusables()[0])
  })
}
provide(PANEL_CONTEXT, { close: () => emit('close'), openSub })

const titleId = useId()
const panelEl = ref<HTMLElement>()
const anchorEl = ref<HTMLElement>()
/** The buttons that open, swap or close a panel themselves, so a press on one is not a press outside. */
const OPENERS = PANEL_OPENERS

/** Where the strip button it hangs from is looked for: its own shell's, not another on the page (ticket 0797). */
const scope = useShellScope()
const findInShell = (selector: string) => (scope.root() ?? document).querySelector<HTMLElement>(selector)
/** The canvas box's bottom bar (the Progress bar, or Convert image's steps): a panel ends above it and a press on it
 * goes through, so the bar works while a panel is open (ticket 0850). */
const BOTTOM_BAR = '[data-bottom-bar]'
/** The bottom bar of the canvas box the panel's button is in; none where the button is in no canvas box. */
const ownBar = () => anchorEl.value?.closest('[data-testid="app-canvas"]')?.querySelector(BOTTOM_BAR)
function barTop(): number | undefined {
  const bar = ownBar()?.getBoundingClientRect()
  return bar && bar.height > 0 ? bar.top : undefined
}
const onOwnBar = (target: EventTarget | null) => target instanceof Node && !!ownBar()?.contains(target)
/** The shell's notice row (a Project that didn't open, a failed save): a press on its buttons acts at once and the panel
 * stays, since the Menu may open on its own while a notice shows (ticket 0985). */
const NOTICE_ROW = '[data-notice-row]'
const onNoticeRow = (target: EventTarget | null) => target instanceof Element && target.closest(NOTICE_ROW) !== null
const anchored = useAnchoredPosition(anchorEl, panelEl, () => props.align ?? 'start', () => 'below', barTop)
/** The dropdown is as tall as the room allows below its button (above the bottom bar, else 16px clear of the window's
 * bottom edge) and scrolls inside past that. */
const placed = anchored.style
const dropdownStyle = computed(() => ({
  ...placed.value,
  maxHeight:
    anchored.roomBelow.value === undefined
      ? `calc(100dvh - ${Number.parseFloat(placed.value.top ?? '0') || 0}px - ${16}px)`
      : `${anchored.roomBelow.value}px`,
  ...(props.width ? { width: props.width } : {}),
}))

// Its box on the screen, told once as it first has its place (ticket 0971: the Frame panel moves the Canvas clear of it).
let told = false
watch(placed, (style) => {
  if (told || style.opacity === '0') return
  told = true
  void nextTick(() => {
    const box = panelEl.value?.getBoundingClientRect()
    if (box) emit('placed', { x: box.left, y: box.top, width: box.width, height: box.height })
  })
})

function place() {
  anchorEl.value = findInShell(`[data-testid="${props.anchor}"]`) ?? undefined
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
  keepsPress: (event) => onOwnBar(event.target) || onNoticeRow(event.target),
  onOutsidePress: () => {
    pressClosed.markPressClosed()
    emit('close')
  },
})

const FOCUSABLE = 'button:not(:disabled):not([aria-disabled="true"]), [href], input:not(:disabled):not([type="hidden"]), [tabindex]:not([tabindex="-1"])'

function focusables(): HTMLElement[] {
  return [...(panelEl.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])]
}

/** Focuses the control, or the panel itself where that would raise a touch keyboard: the tap that opened the panel lets
 * the touch focus guard pass (ticket 0688). */
function focusUnlessKeyboard(control: HTMLElement | null | undefined) {
  ;(control && !wouldRaiseKeyboard(control) ? control : panelEl.value)?.focus({ preventScroll: true })
}

/** Focus on opening: the row the panel was opened on (the Export panel's Picture or Printable chart, ticket 0843), or
 * the first control of the section it was (the Frame panel's settings, ticket 0935), scrolled to the body's top where it
 * lies below it; else the subpanel's first field (not its Back arrow), else the panel's first control. */
function focusEntry() {
  const chosen = panelEl.value?.querySelector<HTMLElement>('[data-panel-entry]:not([aria-disabled="true"])')
  if (chosen) {
    revealInBody(chosen)
    return void (chosen.matches(FOCUSABLE) ? chosen : chosen.querySelector<HTMLElement>(FOCUSABLE))?.focus({ preventScroll: true })
  }
  const first = inSub.value ? subBodyEl.value?.querySelector<HTMLElement>(FOCUSABLE) : focusables()[0]
  if (props.skipsFields) return void panelEl.value?.focus({ preventScroll: true })
  focusUnlessKeyboard(first ?? focusables()[0])
}

/** Scrolls the panel's body, and only it, until the entry's top meets the body's, where the entry lies below the fold. */
function revealInBody(entry: HTMLElement) {
  const body = subBodyEl.value
  if (!body) return
  const below = entry.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom
  if (below > 0) body.scrollTop += ownLength(body, entry.getBoundingClientRect().top - body.getBoundingClientRect().top)
}

/** Arrows, Home and End move through the panel's controls; a field and a choice group keep their own keys. Tab and
 * Shift+Tab wrap in every panel, so focus never leaves the open panel for the controls under it (ADR 0075, ticket 0939). */
function onKeydown(event: KeyboardEvent) {
  // A key the content already used (the Frame panel's arrows move the Frame) is not a move through the panel.
  if (event.defaultPrevented) return
  const target = event.target as HTMLElement
  const list = focusables()
  if (event.key === 'Tab') {
    if (!list.length) return
    const index = list.indexOf(target)
    const edge = event.shiftKey ? index <= 0 : index === list.length - 1
    if (!edge) return
    event.preventDefault()
    list[event.shiftKey ? list.length - 1 : 0]?.focus({ preventScroll: true })
    return
  }
  // A choice group keeps Home and End (its first and last choice); ↑/↓ leave it.
  const own = target.closest('input, textarea') !== null || (target.closest('[role="radiogroup"]') !== null && (event.key === 'Home' || event.key === 'End'))
  if (own || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  event.preventDefault()
  const index = list.indexOf(target)
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : event.key === 'ArrowDown' ? Math.min(list.length - 1, index + 1) : Math.max(0, index - 1)
  list[next]?.focus({ preventScroll: true })
}

/** The dropdown closes when focus leaves it some way other than Tab (a shortcut, a screen reader's move); a press on
 * the bottom bar leaves it open. */
function onFocusOut(event: FocusEvent) {
  if (props.menu) return
  const next = event.relatedTarget
  if (next instanceof Element && !panelEl.value?.contains(next) && !next.closest(OPENERS) && !next.closest('[popover]') && !onOwnBar(next)) emit('close')
}

/** `place` again after the button moved with no scroll or resize (the edit pencil on a zoom); the panel's element and
 * box, for what keeps clear of it. */
defineExpose({ place, el: panelEl, box: dropdownStyle })

let opener: HTMLElement | null = null
const pressClosed = usePressClosed()
onMounted(() => {
  opener = findInShell(`[data-testid="${props.anchor}"]`)
  place()
  void nextTick(focusEntry)
})
onBeforeUnmount(() => {
  anchored.stop()
  const target = findInShell(`[data-testid="${props.anchor}"]`) ?? opener
  // A dialog the panel opened (Duplicate, Delete) takes focus itself and gives it back when it closes. Focus moves to
  // the button before the dialog mounts, so the button is what the dialog gives it back to (ticket 0939).
  if (pressClosed.wasPressClosed() || findInShell('.app-modal')) return
  if (target?.isConnected) target.focus({ preventScroll: true })
  else void nextTick(() => target?.isConnected && target.focus({ preventScroll: true }))
})
</script>

<template>
  <div
    ref="panelEl"
    class="app-panel app-panel--dropdown"
    :style="dropdownStyle"
    :role="menu && !inSub ? 'region' : 'dialog'"
    :aria-labelledby="titleId"
    tabindex="-1"
    data-testid="panel-dropdown"
    @keydown="onKeydown"
    @focusout="onFocusOut"
  >
    <!-- Plain boxes, not header and footer: in a dialog those would be a second banner and contentinfo (ticket 0856). -->
    <div v-if="inSub" class="app-panel__header">
      <IconButton icon="chevron-left" variant="plain" :label="t.panels.back" tooltip data-testid="panel-back" @click="goBack" />
      <h2 :id="titleId" class="app-panel__heading" data-testid="panel-sub-title">{{ currentTitle }}</h2>
      <span v-if="currentMeta" class="app-panel__meta" data-testid="panel-sub-meta">{{ currentMeta }}</span>
    </div>
    <h2 v-else :id="titleId" class="app-panel__title">{{ title }}</h2>
    <div class="app-panel__scroll">
      <div ref="subBodyEl" class="app-panel__body" :data-cut="bodyCut" data-testid="panel-body">
        <slot v-if="inSub" name="sub" :depth="depth" />
        <slot v-else />
      </div>
      <div v-if="thumbStyle" class="app-panel__thumb" :style="thumbStyle" aria-hidden="true" data-testid="panel-scroll-thumb" />
    </div>
    <div v-if="inSub && $slots.footer" class="app-panel__footer" data-testid="panel-footer">
      <slot name="footer" :depth="depth" />
    </div>
  </div>
</template>

<style scoped>
.app-panel {
  --panel-item-height: var(--panel-row);
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

.app-panel:focus {
  outline: none;
}

:root[data-theme='contrast'] .app-panel {
  border: 2px solid var(--line-strong);
  box-shadow: none;
}

.app-panel__title {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: 0;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.app-panel__header {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-8);
  padding-bottom: var(--space-8);
}

.app-panel__heading {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

.app-panel__meta {
  margin-left: auto;
  padding-right: var(--space-6);
  font: var(--type-meta);
  color: var(--muted);
}

.app-panel__footer:empty {
  display: none;
}

.app-panel__footer {
  flex: none;
  padding: var(--space-10) 0;
  border-top: 1px solid var(--panel-rule);
}

/* The body and its scroll thumb: the body scrolls with no scrollbar of its own (a tablet shows none). */
.app-panel__scroll {
  position: relative;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.app-panel__body {
  --fade-start: 0px;
  --fade-end: 0px;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: none;
  scrollbar-width: none;
}

.app-panel__body::-webkit-scrollbar {
  display: none;
}

/* The edge where more of the body lies fades over `panel-edge-fade`, as the Canvas strip's and the Tool pill's do. */
.app-panel__body:not([data-cut='none']) {
  mask-image: linear-gradient(to bottom, transparent, var(--ink) var(--fade-start), var(--ink) calc(100% - var(--fade-end)), transparent);
}

.app-panel__body:is([data-cut='start'], [data-cut='both']) {
  --fade-start: var(--panel-edge-fade);
}

.app-panel__body:is([data-cut='end'], [data-cut='both']) {
  --fade-end: var(--panel-edge-fade);
}

/* A slim `line-strong` thumb, centred in the panel's right padding: its share of the body's height is the share that
 * shows, and it runs from the body's top to its foot as the body scrolls. Only a look: the body scrolls under a
 * finger, the wheel or the keys. */
.app-panel__thumb {
  --thumb-height: max(var(--panel-thumb-min), var(--thumb-size) * 100%);
  position: absolute;
  top: calc((100% - var(--thumb-height)) * var(--thumb-at));
  right: calc(-0.5 * (var(--space-8) + var(--panel-thumb-width)));
  width: var(--panel-thumb-width);
  height: var(--thumb-height);
  background: var(--line-strong);
  border-radius: var(--radius-full);
  pointer-events: none;
}

/* The dropdown (MenuPanel card): `panel-width`, under the button, over everything but dialogs; taller than the
 * window, it scrolls inside. */
.app-panel--dropdown {
  z-index: var(--z-popover);
  width: var(--panel-width);
  /* Never wider than the screen less the 8px gutter the position keeps (on a phone `panel-width` is wider than the screen, so this cap sets the width). */
  max-width: calc(100vw - 2 * var(--frame-panel-gap));
  padding: var(--space-8);
  border-radius: var(--radius-lg);
  animation: panel-in var(--duration-base) var(--ease-out);
}

@media (pointer: coarse) {
  .app-panel {
    --panel-item-height: var(--panel-row-touch);
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
  .app-panel--dropdown {
    animation: panel-fade var(--duration-base) var(--ease-out);
  }
}
</style>
