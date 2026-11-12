<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef } from 'vue'
import { provideShellScope } from '../../composables/ui/shellScope'
import { useI18n } from '../../i18n/useI18n'
import type { DemoSnapshot } from '../demoCopy'
import GhostPointer from './GhostPointer.vue'
import InsideShell from './InsideShell.vue'
import { DEMO_CUFF, DEMO_VIEW_MARGIN, demoLibrary } from './demoProjects'
import { createHand, ghostState, type Hand } from './hand'
import { watchOnly } from './watchOnly'

// The box What's inside's editor lives in (Homepage card, ticket 0797): its shell takes keys and presses only inside
// it, and its panels, popovers and dialogs stay in it, so the page around it works as before. Starting afresh mounts
// a new shell on a fresh demo library. The ghost's hand works in it; the beader only watches (ticket 0879).
defineProps<{
  /** Which word its Canvas strip's Expand button reads (ticket 0830); none where the demo has the width already. */
  expand?: 'expand' | 'collapse'
}>()
const emit = defineEmits<{
  /** Expand or Collapse pressed in its Canvas strip. */
  toggleExpand: []
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
/** Expand in the demo's strip is the page's own control (ticket 0830), the one thing in the box a beader can press. */
const EXPAND = '.canvas-strip__expand'
// Every press in the box is the page's, never the shell's: none closes what the ghost opened (ticket 0879).
provideShellScope({ root: () => rootEl.value, teleportTo: '.inside-editor', pagesOwn: () => true })

/** Each fresh demo is a new shell, keyed by its session. */
const session = ref(0)
const shell = shallowRef<InstanceType<typeof InsideShell>>()
/** The library each fresh demo starts on, made once a session. */
const library = computed(() => (void session.value, demoLibrary(t.value)))
const ghost = ghostState()

/** Only to watch (ticket 0879): all of the box but Expand is inert, whatever the ghost opens in it. */
let stopWatchOnly: (() => void) | undefined
onMounted(() => (stopWatchOnly = rootEl.value && watchOnly(rootEl.value, EXPAND)))
onBeforeUnmount(() => stopWatchOnly?.())

/** Where the focus was when something the ghost opened took it. */
let focusBefore: HTMLElement | undefined

/** The ghost never takes the focus from the page (Homepage card, Screen readers): a panel it opens may focus itself
 * before the box makes it inert, so it lets go at once, which closes nothing, and the focus goes back where it was once
 * the row is done. */
function onFocusIn(event: FocusEvent) {
  if (event.target instanceof Element && event.target.closest(EXPAND)) return
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

/** How many lines taller the cuff's margin sheet is than its Frame (ticket 0802): its margin, 4 beads above and 4
 * below, for its band and title block. Measured at the demo's sizes, the sheet with its border is that tall. */
const SHEET_MARGIN_LINES = 8

/** How far along the piece from the Frames' middle the view's middle is, in beads: the Frames' middle lies between two
 * beads of a peyote line, and the bead under the view's middle is where a Starter's Frame is laid (it lands where the
 * band was only from the further of the two). */
const STARTER_ALONG = 0.75

/** The zoom a fresh demo's editor starts at: the view is at most 3 times it, however often it is set (ticket 0821). */
let ownZoom: number | undefined

/** The view the tour plays in (ticket 0831): the cuff's Frame and `DEMO_VIEW_MARGIN` beads either side across nine
 * tenths of the area, its sheet clear of the Tool pill, its middle at the view's but for `STARTER_ALONG`. Set before
 * anything is drawn, and again only when Expand or Collapse resizes the demo. The Canvas is turned: rows run across. */
async function frameDrawings(): Promise<void> {
  const canvas = shell.value?.wired.canvas
  const area = rootEl.value?.querySelector('[data-testid="app-drawing-area"]')?.getBoundingClientRect()
  if (!canvas || !area) return
  const pill = rootEl.value?.querySelector('[data-testid="tool-pill"]')?.getBoundingClientRect().height ?? 0
  // The sheet lies round the view's middle, so it keeps clear of the pill below and as much room above.
  const room = area.height - 2 * (pill + 16)
  const at = (row: number, column: number) => canvas.surfaceProbe.value?.beadOnScreen({ row, column })
  const last = { row: DEMO_CUFF.row + DEMO_CUFF.rows - 1, column: DEMO_CUFF.column + DEMO_CUFF.columns - 1 }
  const first = at(DEMO_CUFF.row, DEMO_CUFF.column)
  const opposite = at(last.row, last.column)
  if (first && opposite && opposite.x !== first.x && opposite.y !== first.y) {
    const along = Math.abs(opposite.x - first.x) / (DEMO_CUFF.rows - 1)
    const line = Math.abs(opposite.y - first.y) / (DEMO_CUFF.columns - 1)
    const wide = (area.width * 0.9) / ((DEMO_CUFF.rows + 2 * DEMO_VIEW_MARGIN) * along)
    const tall = room / ((DEMO_CUFF.columns + SHEET_MARGIN_LINES) * line)
    ownZoom ??= canvas.zoom.value
    canvas.setZoom(Math.min(canvas.zoom.value * Math.min(wide, tall), ownZoom * 3))
  }
  await settle()
  const corner = at(DEMO_CUFF.row, DEMO_CUFF.column)
  const far = at(last.row, last.column)
  if (!corner || !far) return
  // The Starter's ring is laid round the bead under the view's middle: a little along from the Frames', it is the band's.
  const along = ((far.x - corner.x) / (DEMO_CUFF.rows - 1)) * STARTER_ALONG
  canvas.panBy(area.left + area.width / 2 - (corner.x + far.x) / 2 - along, area.top + area.height / 2 - (corner.y + far.y) / 2)
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

/** What Open editor from here takes (ticket 0879): the Project on the demo's Canvas, its zoom and the bead in the middle
 * of its drawing area as they are at the call, then its reference image's picture; none before the demo has a Project. */
async function snapshot(): Promise<DemoSnapshot | undefined> {
  const canvas = shell.value?.wired.canvas
  const project = canvas?.activeProject.value
  if (!canvas || !project) return undefined
  const at = canvas.visibleCentre()
  const view = at && { zoom: canvas.zoom.value, at: { row: at.row, column: at.column } }
  const picture = project.referenceImage ? (await canvas.referenceImage.picturesOf([project.id])).get(project.id) : undefined
  return { project, ...(picture ? { picture } : {}), ...(view ? { view } : {}) }
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

defineExpose({ fresh, refit, snapshot, hand, hideGhost: () => void (ghost.shown = false), giveFocusBack })
</script>

<template>
  <div
    ref="rootEl"
    class="inside-editor"
    role="region"
    :aria-label="t.homepage.inside.editor"
    data-testid="inside-editor"
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
</style>
