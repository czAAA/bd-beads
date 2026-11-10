<script setup lang="ts">
import { computed, nextTick, ref, shallowRef } from 'vue'
import { provideShellScope } from '../../composables/ui/shellScope'
import { useI18n } from '../../i18n/useI18n'
import GhostPointer from './GhostPointer.vue'
import InsideShell from './InsideShell.vue'
import { DEMO_FRAME, DEMO_VIEW, demoLibrary } from './demoProjects'
import { createHand, ghostState, type Hand } from './hand'
import { useTakeOver } from './useTakeOver'

// The box What's inside's editor lives in (Homepage card, ticket 0797): its shell takes keys and presses only inside
// it, and its panels, popovers and dialogs stay in it, so the page around it works as before. Starting afresh mounts
// a new shell on a fresh demo library. The ghost's hand works in it; a press, drag or key of the beader's takes it over.
const props = defineProps<{
  /** The beader took the editor over: the focus may come into it. */
  takenOver?: boolean
  /** Which word its Canvas strip's Expand button reads (ticket 0830); none where the demo has the width already. */
  expand?: 'expand' | 'collapse'
}>()
const emit = defineEmits<{
  /** The beader pressed, dragged or typed in the editor. */
  takeOver: []
  /** Expand or Collapse pressed in its Canvas strip. */
  toggleExpand: []
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
/** Expand in the demo's strip is the page's own control (ticket 0830): a press on it neither takes the editor over nor
 * closes what the ghost opened. */
const pagesOwn = (target: Element) => !!target.closest('.canvas-strip__expand')
provideShellScope({ root: () => rootEl.value, teleportTo: '.inside-editor', pagesOwn })

/** Each fresh demo is a new shell, keyed by its session. */
const session = ref(0)
const shell = shallowRef<InstanceType<typeof InsideShell>>()
/** The library each fresh demo starts on, made once a session. */
const library = computed(() => (void session.value, demoLibrary(t.value)))
const ghost = ghostState()

useTakeOver(() => rootEl.value, () => emit('takeOver'), pagesOwn)

/** Where the focus was when something the ghost opened took it. */
let focusBefore: HTMLElement | undefined

/** The ghost never takes the focus from the page (Homepage card, Screen readers): a panel it opens focuses itself, so
 * until the beader takes over (their press or key comes first) it lets go, which closes nothing, and the focus goes
 * back where it was once the row is done. */
function onFocusIn(event: FocusEvent) {
  if (props.takenOver) return
  const from = event.relatedTarget
  if (from instanceof HTMLElement && !rootEl.value?.contains(from)) focusBefore = from
  if (event.target instanceof HTMLElement) event.target.blur()
}

/** The focus back where it was before the ghost's row, unless the beader has put it somewhere since. */
function giveFocusBack(): void {
  const was = focusBefore
  focusBefore = undefined
  if (was?.isConnected && (!document.activeElement || document.activeElement === document.body)) was.focus({ preventScroll: true })
}

/** A CSS time on the root, in ms. */
function cssMs(name: string): number {
  const value = rootEl.value ? getComputedStyle(rootEl.value).getPropertyValue(name).trim() : ''
  const amount = Number.parseFloat(value)
  return Number.isNaN(amount) ? 0 : value.endsWith('ms') ? amount : amount * 1000
}

/** A length token in px: a `rem` one by the root's font size. */
function cssPx(name: string): number {
  const value = rootEl.value ? getComputedStyle(rootEl.value).getPropertyValue(name).trim() : ''
  const amount = Number.parseFloat(value)
  if (Number.isNaN(amount)) return 0
  return value.endsWith('rem') ? amount * Number.parseFloat(getComputedStyle(document.documentElement).fontSize) : amount
}

/** Lets the shell draw: a frame or two once it is mounted. */
async function settle(): Promise<void> {
  await nextTick()
  for (let frames = 0; frames < 60 && !shell.value?.wired.canvas.surfaceProbe.value; frames++) await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

/** How much taller the Frame's margin sheet is than the Frame, at the demo's size (ticket 0802): its margin, 4 beads
 * above and 4 below, which hold its band and title block, and its border and padding, which grow with it (measured: a
 * 7-row Frame's sheet is 1.27 times its 15 rows). A thin Frame such as the ring's is mostly sheet. */
const SHEET_MARGIN_ROWS = 8
const SHEET_BORDER = 1.27

/** The zoom a fresh demo's editor starts at: the view is at most 3 times it, however often it is set (ticket 0821). */
let ownZoom: number | undefined

/** The view the tour plays in: `DEMO_VIEW` across the drawing area, the Frame's middle at the view's (where a Starter's
 * Frame is laid, so the ring Starter lands where the band was), zoomed to show it and the Frame's sheet whole, clear of
 * the Tool pill. Set once before anything is drawn, and again only when Expand or Collapse resizes the demo (0830). */
async function frameDrawings(): Promise<void> {
  const canvas = shell.value?.wired.canvas
  const area = rootEl.value?.querySelector('[data-testid="app-drawing-area"]')?.getBoundingClientRect()
  if (!canvas || !area) return
  const pill = rootEl.value?.querySelector('[data-testid="tool-pill"]')?.getBoundingClientRect().height ?? 0
  // The sheet lies round the view's middle, so it keeps clear of the pill below and as much room above.
  const room = area.height - 2 * (pill + 16)
  const { left, right } = DEMO_VIEW
  const at = (row: number, column: number) => canvas.surfaceProbe.value?.beadOnScreen({ row, column })
  const first = at(DEMO_FRAME.row, left)
  const across = at(DEMO_FRAME.row, right)
  const down = at(DEMO_FRAME.row + DEMO_FRAME.rows - 1, left)
  if (first && across && down && across.x > first.x && down.y > first.y) {
    const wide = (area.width * 0.9) / (across.x - first.x)
    const pitch = (down.y - first.y) / Math.max(1, DEMO_FRAME.rows - 1)
    const tall = room / ((DEMO_FRAME.rows + SHEET_MARGIN_ROWS) * SHEET_BORDER * pitch)
    ownZoom ??= canvas.zoom.value
    canvas.setZoom(Math.min(canvas.zoom.value * Math.min(wide, tall), ownZoom * 3))
  }
  await settle()
  const corner = at(DEMO_FRAME.row, left)
  const opposite = at(DEMO_FRAME.row + DEMO_FRAME.rows - 1, right)
  if (corner && opposite) canvas.panBy(area.left + area.width / 2 - (corner.x + opposite.x) / 2, area.top + area.height / 2 - (corner.y + opposite.y) / 2)
}

/** A fresh demo: Ring with nothing drawn, the Menu's Saved Projects listing the demo's own three. */
async function fresh(): Promise<void> {
  ghost.shown = false
  session.value += 1
  ownZoom = undefined
  await settle()
  await frameDrawings()
  await settle()
}

/** The view set again for the demo's new size (Expand or Collapse, ticket 0830), the editor otherwise as it is. */
async function refit(): Promise<void> {
  await settle()
  await frameDrawings()
  await settle()
}

/** Try it yourself (ticket 0830): the focus goes into the editor's region, which is the beader's now. */
function takeFocus(): void {
  rootEl.value?.focus({ preventScroll: true })
}

/** The ghost's hand for a run of the tour. */
function hand(instant: boolean, signal: AbortSignal): Hand {
  const wired = shell.value!.wired
  return createHand({
    root: rootEl.value!,
    shell: wired.shell,
    canvas: wired.canvas,
    ghost,
    instant,
    signal,
    moveMs: cssMs('--ghost-move'),
    rippleMs: cssMs('--ghost-ripple'),
    pauseMs: cssMs('--ghost-pause'),
    dragMs: cssMs('--ghost-drag'),
    dragHoldMs: cssMs('--ghost-drag-hold'),
    roomPx: cssPx('--ghost-room'),
  })
}

defineExpose({ fresh, refit, takeFocus, hand, hideGhost: () => void (ghost.shown = false), giveFocusBack })
</script>

<template>
  <div
    ref="rootEl"
    class="inside-editor"
    role="region"
    tabindex="-1"
    :aria-label="t.homepage.inside.editor"
    data-testid="inside-editor"
    :data-taken-over="takenOver || undefined"
    @focusin="onFocusIn"
  >
    <InsideShell :key="session" ref="shell" :projects="library" :expand="expand" @start-afresh="fresh" @toggle-expand="emit('toggleExpand')" />
    <GhostPointer :ghost="ghost" />
  </div>
</template>

<style scoped>
/* The box holds every overlay of its shell: `contain` makes it the room of their `fixed` place, and it clips them. Its
 * shell's parts size themselves by its width, as the editor's by the screen's. */
.inside-editor {
  container: shell / inline-size;
  position: relative;
  contain: layout paint;
  overflow: hidden;
  overflow: clip;
  min-width: 0;
  min-height: 0;
  border-radius: var(--canvas-box-radius);
}

/* Try it yourself puts the focus on the region itself; the ring is drawn inside, where the box doesn't clip it. */
.inside-editor:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: calc(-1 * var(--focus-width));
}
</style>
