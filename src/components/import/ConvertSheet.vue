<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { provideConvertSheet } from '../../composables/import/convertSheet'
import { wouldRaiseKeyboard } from '../../composables/ui/touchKeyboard'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import type { ConvertLayout } from '../../domain/convertLayout'
import ConvertSheetHead from './ConvertSheetHead.vue'

// One setting's sheet on the docked converter (ConvertImage card DS-4, ticket 0911): on a Phone it takes the dock's place
// at the foot of the page, on a Tablet it is a card above the dock, on Side it takes the column's place. A grab zone
// (Phone), a head with the name and Close, then the setting's own content, scrolling inside past the half detent.
const props = defineProps<{
  layout: ConvertLayout
  /** Its accessible name and the head's title. */
  label: string
  /** The button that opened it: focus goes back to it on close. */
  opener: () => HTMLElement | undefined
  /** A press outside that still works its own thing, so the sheet stays open (the Background tool's taps on the beads). */
  keepsPress?: (event: PointerEvent) => boolean
  testid: string
  /** The content runs edge to edge (the Colors list's table). */
  flush?: boolean
  /** The content draws the head itself, with its (i), its value or a back arrow (ConvertSheetHead, ticket 0919). */
  ownHead?: boolean
  /** A Phone's sheet that may be dragged past half the screen, to the full detent (the Colors list alone, DS-4). */
  tall?: boolean
}>()
const emit = defineEmits<{ close: [] }>()
/** At the full detent: the beads keep `--convert-preview-min` and the sheet takes the rest (Phone, `tall`). */
const full = defineModel<boolean>('full', { default: false })
const detent = computed(() => (props.layout === 'phone' && props.tall && full.value ? 'full' : 'half'))

const rootEl = ref<HTMLElement>()

/** Closes, and once the dock is back (a Phone's takes the sheet's place) gives focus to the setting that opened it. */
async function close() {
  const back = props.opener()
  emit('close')
  await nextTick()
  const target = back?.isConnected ? back : props.opener()
  target?.focus({ preventScroll: true })
}

provideConvertSheet({ close: () => void close() })

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close,
  isOpener: (target) => props.opener()?.contains(target) ?? false,
  keepsPress: props.keepsPress,
})

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
/** Focus goes to the sheet's first control. A field first would raise a touch keyboard nobody asked for: the sheet
 * itself takes focus then (ticket 0688). */
async function focusFirst() {
  await nextTick()
  // Past the head a setting draws itself (ticket 0919): its Back and (i) are not where a change starts.
  const first = [...(rootEl.value?.querySelectorAll<HTMLElement>(`.convert-sheet__body ${FOCUSABLE.split(', ').join(', .convert-sheet__body ')}`) ?? [])].find(
    (control) => !control.closest('.convert-sheet-head'),
  )
  ;(first && !wouldRaiseKeyboard(first) ? first : rootEl.value)?.focus({ preventScroll: true })
}
onMounted(focusFirst)
// Another setting put in this sheet's place (the Colors list from Colors): it opens at half, focus on its first control.
watch(
  () => props.testid,
  () => {
    full.value = false
    void focusFirst()
  },
)

// A drag on the grab zone (Phone): down closes the sheet; a tall one goes up to the full detent, and from there down
// to half, or closes when let go in the lower half of what the half detent holds.
const DRAG_TO_CLOSE = 40
/** Let go from the full detent under this share of the window's height, the sheet closes rather than stopping at half. */
const CLOSE_FROM_FULL_UNDER = 0.75
let grabbedAt: number | undefined
function grab(event: PointerEvent) {
  grabbedAt = event.clientY
  ;(event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId)
}
function drop(event: PointerEvent) {
  const started = grabbedAt
  grabbedAt = undefined
  if (started === undefined) return
  const moved = event.clientY - started
  if (detent.value === 'full') {
    if (moved < DRAG_TO_CLOSE) return
    full.value = false
    if (event.clientY > window.innerHeight * CLOSE_FROM_FULL_UNDER) close()
  } else if (moved >= DRAG_TO_CLOSE) close()
  else if (props.tall && -moved >= DRAG_TO_CLOSE) full.value = true
}
</script>

<template>
  <div ref="rootEl" class="convert-sheet" :class="[`convert-sheet--${layout}`, { 'convert-sheet--flush': flush }]" :data-detent="detent" role="dialog" tabindex="-1" :aria-label="label" :data-testid="testid">
    <div v-if="layout === 'phone'" class="convert-sheet__grab" aria-hidden="true" data-testid="convert-sheet-grab" @pointerdown="grab" @pointerup="drop" @pointercancel="grabbedAt = undefined">
      <span class="convert-sheet__pill" />
    </div>
    <ConvertSheetHead v-if="!ownHead" :title="label" />
    <div class="convert-sheet__body" data-testid="convert-sheet-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
/* The surface runs on under the home bar: the foot pads by the bottom inset. The sheet is at most half the
 * window and gives way to the beads' half (the page's rule, which counts the strip and the notch), its body scrolling inside. */
.convert-sheet {
  --convert-sheet-half: calc(50dvh - env(safe-area-inset-bottom));
  position: relative;
  z-index: var(--convert-layer-popover);
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  min-height: 0;
  box-sizing: border-box;
  max-height: var(--convert-sheet-half);
  padding: 0 var(--space-16) env(safe-area-inset-bottom);
  background: var(--elevated);
  border-top: 1px solid var(--line);
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  box-shadow: var(--convert-sheet-shadow);
  animation: convert-sheet-rise 200ms ease-out;
}

.convert-sheet:focus {
  outline: none;
}

:root[data-theme='dark'] .convert-sheet {
  border-top-color: var(--line-strong);
}

.convert-sheet__grab {
  display: flex;
  flex: none;
  justify-content: center;
  height: var(--convert-sheet-grab);
  cursor: grab;
  touch-action: none;
}

.convert-sheet__pill {
  width: calc(var(--space-32) + var(--space-4));
  height: var(--space-4);
  margin-top: var(--space-6);
  background: var(--line-strong);
  border-radius: var(--radius-full);
}

.convert-sheet__body {
  box-sizing: border-box;
  flex: 0 1 auto;
  min-height: 0;
  padding-bottom: var(--space-12);
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  scrollbar-color: var(--line-strong) transparent;
}

/* The full detent (the Colors list, DS-4): the sheet takes all the page leaves under the beads' `--convert-preview-min`. */
.convert-sheet[data-detent='full'] {
  flex: 1 1 auto;
  max-height: none;
}

.convert-sheet[data-detent='full'] .convert-sheet__body {
  flex: 1 1 auto;
}

.convert-sheet--flush {
  padding-inline: 0;
}

/* A Tablet's sheet is a card, 560 wide, centred, 12 above the dock and in the flow, so the beads fit above it (DS-4). */
.convert-sheet--tablet {
  width: min(var(--convert-sheet-card-width), calc(100% - var(--space-32)));
  max-height: var(--convert-sheet-card-max);
  margin: 0 auto var(--space-12);
  padding: var(--space-4) var(--space-20);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  animation: none;
}

/* Side's sheet takes the column's place, its full height, scrolling inside. */
.convert-sheet--side {
  flex: 1;
  max-height: none;
  padding-inline: var(--space-16);
  border-top: 0;
  border-radius: 0;
  box-shadow: none;
  animation: none;
}

.convert-sheet--side .convert-sheet__body {
  flex: 1;
}

@keyframes convert-sheet-rise {
  from {
    transform: translateY(100%);
  }

  to {
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .convert-sheet {
    animation: none;
  }
}
</style>
