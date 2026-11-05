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
}>()
const emit = defineEmits<{
  /** The beader pressed, dragged or typed in the editor. */
  takeOver: []
}>()

const { t } = useI18n()
const rootEl = ref<HTMLElement>()
provideShellScope({ root: () => rootEl.value, teleportTo: '.inside-editor' })

/** Each fresh demo is a new shell, keyed by its session. */
const session = ref(0)
const shell = shallowRef<InstanceType<typeof InsideShell>>()
/** The library each fresh demo starts on, made once a session. */
const library = computed(() => (void session.value, demoLibrary(t.value)))
const ghost = ghostState()

useTakeOver(() => rootEl.value, () => emit('takeOver'))

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

/** Lets the shell draw: a frame or two once it is mounted. */
async function settle(): Promise<void> {
  await nextTick()
  for (let frames = 0; frames < 60 && !shell.value?.wired.canvas.surfaceProbe.value; frames++) await new Promise((resolve) => requestAnimationFrame(resolve))
  await new Promise((resolve) => requestAnimationFrame(resolve))
}

/** How much taller the Frame's margin sheet is than the Frame, at the demo's size: its band and title block, which shrink
 * no further than their least scale, so on a short screen the sheet is taller for its Frame (ticket 0802). */
const SHEET_TO_FRAME = 2

/** The view the tour plays in: `DEMO_VIEW` across the middle of the drawing area, at a zoom that shows it and the Frame's
 * sheet whole above the Tool pill; set once before anything is drawn, so nothing zooms or moves after. */
async function frameDrawings(): Promise<void> {
  const canvas = shell.value?.wired.canvas
  const area = rootEl.value?.querySelector('[data-testid="app-drawing-area"]')?.getBoundingClientRect()
  if (!canvas || !area) return
  const pill = rootEl.value?.querySelector('[data-testid="tool-pill"]')?.getBoundingClientRect().height ?? 0
  const { left, right } = DEMO_VIEW
  const at = (row: number, column: number) => canvas.surfaceProbe.value?.beadOnScreen({ row, column })
  const first = at(DEMO_FRAME.row, left)
  const across = at(DEMO_FRAME.row, right)
  const down = at(DEMO_FRAME.row + DEMO_FRAME.rows - 1, left)
  if (first && across && down && across.x > first.x && down.y > first.y) {
    const wide = (area.width * 0.9) / (across.x - first.x)
    const tall = (area.height - pill - 16) / SHEET_TO_FRAME / (down.y - first.y)
    canvas.setZoom(canvas.zoom.value * Math.min(wide, tall, 3))
  }
  await settle()
  const corner = at(DEMO_FRAME.row, left)
  const opposite = at(DEMO_FRAME.row + DEMO_FRAME.rows - 1, right)
  if (corner && opposite) canvas.panBy(area.left + area.width / 2 - (corner.x + opposite.x) / 2, area.top + (area.height - pill - 16) / 2 - (corner.y + opposite.y) / 2)
}

/** A fresh demo: Kaleidoscope with nothing drawn, the Menu's Saved Projects listing the demo's own three. */
async function fresh(): Promise<void> {
  ghost.shown = false
  session.value += 1
  await settle()
  await frameDrawings()
  await settle()
}

/** The ghost's hand for a run of the tour. */
function hand(instant: boolean, signal: AbortSignal): Hand {
  const wired = shell.value!.wired
  return createHand({ root: rootEl.value!, shell: wired.shell, canvas: wired.canvas, ghost, instant, signal, moveMs: cssMs('--ghost-move'), rippleMs: cssMs('--ghost-ripple') })
}

defineExpose({ fresh, hand, hideGhost: () => void (ghost.shown = false), giveFocusBack })
</script>

<template>
  <div ref="rootEl" class="inside-editor" role="region" :aria-label="t.homepage.inside.editor" data-testid="inside-editor" :data-taken-over="takenOver || undefined" @focusin="onFocusIn">
    <InsideShell :key="session" ref="shell" :projects="library" @start-afresh="fresh" />
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
