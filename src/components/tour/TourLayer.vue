<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { hasOpenLayer } from '../../composables/ui/useEscapeLayer'
import { TOUR_CARD_ATTRIBUTE } from '../../composables/ui/tourDom'
import {
  HOLE_PADDING,
  PHONE_MAX_WIDTH,
  inflate,
  intersect,
  placeCard,
  pointerBetween,
  type Placement,
  type Rect,
} from '../../composables/tour/tourGeometry'
import { TOUR_STEPS, type TourControl, type TourStepId } from '../../domain/tour'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import type { IconName } from '../ui/icons'

/**
 * The Tour's layers (ticket 80; TourStep card): a dim layer over the app with a hole for the control the step points at,
 * a gold ring round it, one dotted line to the step card, and the card. It draws over the real editor, which keeps
 * working underneath: the dim blocks every press except the hole's, the card's, and the Pattern's own scroll and zoom
 * (the Pattern is a hole for the pointer, and the app itself keeps it from drawing unless the step is about drawing).
 *
 * Each control is found on the screen by its `data-tour` mark, so the same step works at every size: the same control is
 * in the Toolbox, the BottomToolbar or a sheet, and the first one showing is the one pointed at. A control that isn't
 * showing is reached through what opens it (the Dock button, the Tools button); if nothing is, the card centres.
 */
const { t, tour, announce } = useAppShell()

/** For each control, the `data-tour` marks that can be it, the first showing wins; the later ones open it. */
const CHAINS: Record<TourControl, string[]> = {
  'new-pattern': ['new-pattern', 'phone-new-pattern', 'header-tools'],
  'tool-paint': ['tool-paint', 'dock-tool'],
  'tool-fill': ['tool-fill', 'dock-tool'],
  'tool-select': ['tool-select', 'dock-tool'],
  'tool-erase': ['tool-erase', 'dock-tool'],
  'tool-hand': ['tool-hand', 'dock-tool'],
  'color-black': ['color-black', 'bottom-color', 'dock-color'],
  'color-yellow': ['color-yellow', 'bottom-color', 'dock-color'],
  copy: ['copy', 'dock-edit', 'header-tools'],
  // The rulers are drawn on the canvas now (ADR 0026), so the step points at the canvas itself.
  ruler: ['board'],
  'remove-line': ['remove-line', 'dock-tool', 'header-tools'],
  undo: ['undo', 'dock-edit'],
  size: ['frame-row', 'dock-frame', 'header-tools'],
  'progress-switch': ['progress-switch'],
  'progress-next': ['progress-next'],
  'progress-previous': ['progress-previous'],
  export: ['export', 'dock-pattern', 'header-tools'],
  board: ['board'],
}

/** The tool named on each step's card: its icon, and its hotkey when it has one. */
const STEP_TOOLS: Record<TourStepId | 'final', { icon: IconName; key?: string }> = {
  create: { icon: 'plus' },
  fill: { icon: 'fill', key: '2' },
  outline: { icon: 'paint', key: '1' },
  rhombus: { icon: 'fill', key: '2' },
  eye: { icon: 'paint', key: '1' },
  copy: { icon: 'select', key: '3' },
  finish: { icon: 'undo', key: 'Ctrl/Cmd+Z' },
  erase: { icon: 'erase', key: 'Del' },
  'remove-line': { icon: 'remove-line' },
  size: { icon: 'size' },
  rows: { icon: 'grid', key: 'P' },
  final: { icon: 'export' },
}

const toolName = computed<Record<TourStepId | 'final', string>>(() => ({
  create: t.value.patterns.newPatternButton,
  fill: t.value.tools.fillLabel,
  outline: t.value.tools.paintLabel,
  rhombus: t.value.tools.fillLabel,
  eye: t.value.tools.paintLabel,
  copy: t.value.tools.selectLabel,
  finish: t.value.palette.undoButton,
  erase: t.value.tools.eraseLabel,
  'remove-line': t.value.tools.removeLineShort,
  size: t.value.frame.title,
  rows: t.value.toolbox.groups.rowProgress,
  final: t.value.saveBox.exportButton,
}))

const viewport = ref({ w: window.innerWidth, h: window.innerHeight })
const phone = computed(() => viewport.value.w <= PHONE_MAX_WIDTH)

/** What the layers are drawn round right now, measured off the screen. */
interface Measured {
  /** The control's own rectangle and the hole cut for it, or none when it isn't on screen. */
  hole?: Rect
  /** The canvas box's scroller, where the pointer always gets through for scrolling and zooming. */
  canvas?: Rect
  /** What the card keeps clear of beside the control: the left column, or the whole board. */
  beside?: Rect
  key?: string
  card: Rect
  placement: Placement
}

const measured = ref<Measured>()
const cardEl = ref<HTMLElement>()
let controlEl: HTMLElement | undefined
let scrolledTo = ''
/** Where focus was before the Tour took it into the card, so ending the Tour hands it back. */
let focusBefore: HTMLElement | undefined

const step = computed(() => tour.step.value)
const cardKey = computed(() => (tour.finalCard.value ? 'final' : (step.value ?? 'final')))
const title = computed(() => (tour.finalCard.value ? t.value.tour.final.title : t.value.tour.steps[step.value!].title))
const body = computed(() => (tour.finalCard.value ? t.value.tour.final.body : t.value.tour.steps[step.value!].body))
const cardLabel = computed(() =>
  tour.finalCard.value
    ? t.value.tour.final.title
    : t.value.tour.stepLabel
        .replace('{n}', String(tour.stepNumber.value))
        .replace('{total}', String(tour.stepCount))
        .replace('{title}', title.value),
)
const bodyId = useId()

function rectOf(element: Element): Rect {
  const { left, top, width, height } = element.getBoundingClientRect()
  return { x: left, y: top, w: width, h: height }
}

/** Showing: has a size, isn't hidden or inert (a closed Drawer is) and is at least partly on the screen. */
function isShowing(element: HTMLElement): boolean {
  if (element.closest('[inert], [hidden]')) {
    return false
  }
  const { x, y, w, h } = rectOf(element)
  if (w === 0 || h === 0 || getComputedStyle(element).visibility === 'hidden') {
    return false
  }
  return x + w > 0 && y + h > 0 && x < window.innerWidth && y < window.innerHeight
}

function findShowing(keys: string[]): { element: HTMLElement; key: string } | undefined {
  for (const key of keys) {
    for (const candidate of document.querySelectorAll<HTMLElement>(`[data-tour~="${key}"]`)) {
      if (isShowing(candidate)) {
        return { element: candidate, key }
      }
    }
  }
  return undefined
}

function cardRect(): Rect {
  const element = cardEl.value
  return element ? { ...rectOf(element), w: element.offsetWidth, h: element.offsetHeight } : { x: 0, y: 0, w: 328, h: 200 }
}

/** The control's place, the hole for it, and where the card goes; read again whenever the screen might have moved. */
function measure() {
  if (!tour.active.value || !tour.targets.value) {
    measured.value = undefined
    controlEl = undefined
    return
  }

  viewport.value = { w: window.innerWidth, h: window.innerHeight }
  const control = tour.targets.value.control
  const found = findShowing(CHAINS[control])
  const canvas = findShowing(['canvas'])
  const canvasRect = canvas ? rectOf(canvas.element) : undefined
  let hole: Rect | undefined
  let beside: Rect | undefined

  if (found) {
    // A control in the left column may be scrolled out of it; bring it in once per step, not against a visitor who scrolls away.
    const scrollKey = `${cardKey.value}:${control}:${found.key}`
    if (control !== 'board' && scrollKey !== scrolledTo) {
      scrolledTo = scrollKey
      found.element.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    }
    const rect = rectOf(found.element)
    if (control === 'board') {
      beside = rect
      hole = canvasRect ? intersect(rect, canvasRect) : rect
    } else {
      hole = inflate(rect, HOLE_PADDING)
      const column = document.querySelector<HTMLElement>('[data-testid="app-main-panel"]')
      if (column && isShowing(column) && rect.x >= rectOf(column).x && rect.x + rect.w <= rectOf(column).x + rectOf(column).w) {
        beside = rectOf(column)
      }
    }
  }
  controlEl = found?.element

  const card = cardRect()
  const placement = placeCard(card, hole, viewport.value, beside)
  const next: Measured = { hole, canvas: canvasRect, beside, key: found?.key, card: { ...card, x: placement.x, y: placement.y }, placement }
  const before = measured.value
  if (!before || JSON.stringify(before) !== JSON.stringify(next)) {
    measured.value = next
  }
}

const offScreen = computed(() => !!measured.value && !measured.value.hole)

/** The hole, rounded like the preview's (9px; 16px for the Pattern). */
function roundedRectPath({ x, y, w, h }: Rect, radius: number): string {
  const r = Math.min(radius, w / 2, h / 2)
  return `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`
}

const viewportPath = computed(() => `M0 0H${viewport.value.w}V${viewport.value.h}H0Z`)
const holeRadius = computed(() => (tour.targets.value?.control === 'board' ? 16 : 9))

/** What looks dimmed: everything but the hole. */
const dimPath = computed(() => viewportPath.value + (measured.value?.hole ? roundedRectPath(measured.value.hole, holeRadius.value) : ''))

/** What blocks presses: everything but the hole and the Pattern's own box, so it can still scroll and zoom. */
const blockPath = computed(
  () =>
    viewportPath.value +
    (measured.value?.hole ? roundedRectPath(measured.value.hole, holeRadius.value) : '') +
    (measured.value?.canvas ? roundedRectPath(measured.value.canvas, 0) : ''),
)

const pointer = computed(() => {
  const current = measured.value
  if (!current?.hole || !current.placement.side) {
    return undefined
  }
  return pointerBetween(current.card, current.hole)
})

const pointerPath = computed(() => {
  const p = pointer.value
  return p ? `M${p.from.x} ${p.from.y}C${p.c1.x} ${p.c1.y} ${p.c2.x} ${p.c2.y} ${p.to.x} ${p.to.y}` : ''
})

const cardStyle = computed(() => {
  const current = measured.value
  if (!current) {
    return { visibility: 'hidden' as const }
  }
  return phone.value
    ? { left: `${current.placement.x}px`, top: `${current.placement.y}px`, width: `${viewport.value.w - 24}px` }
    : { left: `${current.placement.x}px`, top: `${current.placement.y}px` }
})

const tool = computed(() => STEP_TOOLS[cardKey.value])
const name = computed(() => toolName.value[cardKey.value])
const showKey = computed(() => !!tool.value.key && !phone.value)
const showLineHint = computed(() => step.value === 'remove-line' && tour.targets.value?.control === 'ruler')

function controlWords(control: TourControl): { name: string; place: string } | undefined {
  const { tools, toolbox, palette, colorNames, patterns, frame, a11y, rowProgress, saveBox, header } = t.value
  const groups = toolbox.groups
  const words: Partial<Record<TourControl, { name: string; place: string }>> = {
    'new-pattern': { name: patterns.newPatternButton, place: header.patternSheetLabel },
    'tool-paint': { name: tools.paintLabel, place: groups.tools },
    'tool-fill': { name: tools.fillLabel, place: groups.tools },
    'tool-select': { name: tools.selectLabel, place: groups.tools },
    'tool-erase': { name: tools.eraseLabel, place: groups.tools },
    'tool-hand': { name: tools.handLabel, place: groups.tools },
    'color-black': { name: colorNames.black, place: groups.colors },
    'color-yellow': { name: colorNames.yellow, place: groups.colors },
    copy: { name: tools.copyButton, place: groups.edit },
    'remove-line': { name: tools.removeLineShort, place: groups.tools },
    undo: { name: palette.undoButton, place: groups.edit },
    size: { name: frame.title, place: a11y.toolsLandmark },
    'progress-switch': { name: rowProgress.enabledLabel, place: groups.rowProgress },
    'progress-next': { name: rowProgress.nextButton, place: groups.rowProgress },
    'progress-previous': { name: rowProgress.previousButton, place: groups.rowProgress },
    export: { name: saveBox.exportButton, place: header.patternSheetLabel },
  }
  return words[control]
}

/** A pointer move is one polite status line, "Next: Yellow, in Colors." */
watch(
  () => tour.targets.value?.control,
  (control) => {
    const words = control && tour.active.value ? controlWords(control) : undefined
    if (words) {
      announce(t.value.tour.pointer.replace('{control}', words.name).replace('{place}', words.place))
    }
  },
)

// The card lands with focus, and everything it says is named and described by the dialog itself.
watch(
  cardKey,
  async () => {
    await nextTick()
    measure()
    await nextTick()
    cardEl.value?.focus({ preventScroll: true })
  },
  { flush: 'post' },
)

watch(
  () => tour.active.value,
  async (active) => {
    if (active) {
      focusBefore = document.activeElement instanceof HTMLElement ? document.activeElement : undefined
      await nextTick()
      measure()
      cardEl.value?.focus({ preventScroll: true })
    } else {
      scrolledTo = ''
      if (focusBefore?.isConnected) {
        focusBefore.focus({ preventScroll: true })
      }
      focusBefore = undefined
    }
  },
)

/** Focusable things in the card, then the lit control: the only places Tab goes while a step is up. */
function tabStops(): HTMLElement[] {
  const inCard = [...(cardEl.value?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? [])]
  const lit = controlEl && !controlEl.hasAttribute('disabled') && controlEl.tabIndex >= -1 ? [controlEl] : []
  return [...inCard, ...lit]
}

function onKeydown(event: KeyboardEvent) {
  if (!tour.active.value) {
    return
  }

  if (event.key === 'Escape') {
    // An open menu, sheet or modal closes first; its own listener runs once this one lets go.
    if (hasOpenLayer()) {
      return
    }
    event.preventDefault()
    event.stopImmediatePropagation()
    if (tour.finalCard.value) {
      tour.keepEditing()
    } else {
      tour.skip()
    }
    return
  }

  if (event.key === 'Tab') {
    const stops = tabStops()
    if (stops.length === 0) {
      return
    }
    const current = stops.findIndex((stop) => stop === document.activeElement || stop.contains(document.activeElement))
    const nextIndex = current < 0 ? 0 : (current + (event.shiftKey ? -1 : 1) + stops.length) % stops.length
    event.preventDefault()
    event.stopImmediatePropagation()
    stops[nextIndex]!.focus()
  }
}

let timer: ReturnType<typeof setInterval> | undefined

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  window.addEventListener('resize', measure)
  window.addEventListener('scroll', measure, true)
  // A sheet opening, the Drawer sliding in, a menu closing: anything that moves a control, noticed within a blink.
  timer = setInterval(measure, 120)
  measure()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  window.removeEventListener('resize', measure)
  window.removeEventListener('scroll', measure, true)
  clearInterval(timer)
})

watch(() => [tour.targets.value, tour.active.value, tour.finalCard.value], measure, { flush: 'post' })

/** What the final card's Export does: press the Export that is showing (or what opens it), as the visitor would. */
function onExport() {
  const found = findShowing(CHAINS.export)
  tour.keepEditing()
  found?.element.click()
}

const strand = computed(() =>
  TOUR_STEPS.map((_, index) => (tour.finalCard.value || index + 1 < tour.stepNumber.value ? 'done' : index + 1 === tour.stepNumber.value ? 'current' : 'rest')),
)
</script>

<template>
  <div v-if="tour.active.value" class="tour" data-testid="tour">
    <!-- Presses outside the hole, the card and the Pattern's own box go nowhere. -->
    <svg class="tour__block" :width="viewport.w" :height="viewport.h" aria-hidden="true">
      <path :d="blockPath" fill-rule="evenodd" fill="transparent" />
    </svg>
    <svg class="tour__dim" :width="viewport.w" :height="viewport.h" aria-hidden="true">
      <path class="tour__dim-path" :d="dimPath" fill-rule="evenodd" />
    </svg>
    <svg :key="cardKey + (measured?.key ?? '')" class="tour__marks" :width="viewport.w" :height="viewport.h" aria-hidden="true">
      <template v-if="measured?.hole && tour.targets.value?.control !== 'board'">
        <rect class="tour__glow" v-bind="{ x: measured.hole.x, y: measured.hole.y, width: measured.hole.w, height: measured.hole.h }" rx="9" />
        <rect class="tour__ring" v-bind="{ x: measured.hole.x, y: measured.hole.y, width: measured.hole.w, height: measured.hole.h }" rx="9" />
      </template>
      <template v-if="pointer">
        <path class="tour__pointer" :d="pointerPath" />
        <circle class="tour__dot" :cx="pointer.to.x" :cy="pointer.to.y" r="2.2" />
      </template>
    </svg>

    <div
      ref="cardEl"
      :key="cardKey"
      class="tour-card"
      :class="{ 'tour-card--phone': phone }"
      :style="cardStyle"
      role="dialog"
      :aria-label="cardLabel"
      :aria-describedby="bodyId"
      tabindex="-1"
      data-testid="tour-card"
      v-bind="{ [TOUR_CARD_ATTRIBUTE]: '' }"
    >
      <div class="tour-card__top">
        <span class="tour-card__tile" aria-hidden="true"><AppIcon :name="tool.icon" :size="17" /></span>
        <span class="tour-card__tool">{{ name }}</span>
        <kbd v-if="showKey" class="tour-card__key" aria-hidden="true">{{ tool.key }}</kbd>
        <span v-if="!tour.finalCard.value" class="tour-card__count">
          <span data-testid="tour-progress">{{ t.tour.progress.replace('{n}', String(tour.stepNumber.value)).replace('{total}', String(tour.stepCount)) }}</span>
          <span class="tour-card__strand" aria-hidden="true">
            <i v-for="(state, index) in strand" :key="index" :class="`tour-card__bead--${state}`" />
          </span>
        </span>
      </div>

      <h2 class="tour-card__title">{{ title }}</h2>
      <div :id="bodyId" class="tour-card__text">
        <p>{{ body }}</p>
        <p v-if="showLineHint" class="tour-card__hint" data-testid="tour-line-hint">{{ t.tour.selectLineHint }}</p>
        <p v-if="step === 'create'" class="tour-card__hint">{{ t.tour.backToLoomNote }}</p>
        <p v-if="offScreen" class="tour-card__off" data-testid="tour-off-screen">
          <AppIcon name="info" :size="16" /><span>{{ t.tour.offScreen }}</span>
        </p>
      </div>

      <AppButton v-if="step === 'create'" variant="box" size="sm" data-testid="tour-back-to-loom" :title="t.tour.backToLoomName" :aria-label="t.tour.backToLoomName" @click="tour.backToLoom()">
        {{ t.tour.backToLoom }}
      </AppButton>

      <div class="tour-card__footer">
        <template v-if="tour.finalCard.value">
          <AppButton variant="text" data-testid="tour-keep-editing" @click="tour.keepEditing()">{{ t.tour.final.keepEditing }}</AppButton>
          <AppButton variant="primary" data-testid="tour-export" @click="onExport">{{ t.tour.final.export }}</AppButton>
        </template>
        <template v-else>
          <AppButton variant="text" data-testid="tour-skip" @click="tour.skip()">{{ t.tour.skip }}</AppButton>
          <AppButton variant="secondary" data-testid="tour-next" @click="tour.next()">{{ t.tour.next }}</AppButton>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* z-tour-dim 84, z-tour-connector 85, z-tour-card 86 (StackingOrder card): above modals, below tooltips. */
.tour {
  position: fixed;
  inset: 0;
  z-index: var(--z-tour-dim);
  pointer-events: none;
}

.tour__block,
.tour__dim,
.tour__marks {
  position: absolute;
  inset: 0;
}

.tour__block path {
  pointer-events: all;
}

.tour__dim {
  animation: tour-fade var(--duration-base) var(--ease-standard) both;
}

.tour__dim-path {
  fill: var(--tour-dim);
}

.tour__marks {
  z-index: var(--z-tour-connector);
  /* The ring and the line come in after the card has landed. */
  animation: tour-fade var(--duration-base) var(--ease-standard) var(--duration-base) both;
}

.tour__ring {
  fill: none;
  stroke: var(--tour-highlight);
  stroke-width: var(--tour-ring-width);
}

.tour__glow {
  fill: none;
  stroke: var(--tour-highlight);
  stroke-width: 8px;
  opacity: 0.38;
}

.tour__pointer {
  fill: none;
  stroke: var(--muted);
  stroke-width: 1.25px;
  stroke-linecap: round;
  stroke-dasharray: 0 4.5;
}

.tour__dot {
  fill: var(--muted);
}

.tour-card {
  position: absolute;
  z-index: var(--z-tour-card);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  width: 328px;
  padding: var(--space-14) var(--space-16) var(--space-12);
  color: var(--ink);
  background: var(--overlay-fill);
  border: var(--tour-card-line-width) solid var(--overlay-line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
  pointer-events: auto;
  animation: tour-arrive var(--duration-base) var(--ease-standard) both;
}

.tour-card:focus {
  outline: none;
}

.tour-card:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

.tour-card__top {
  display: flex;
  align-items: center;
  gap: var(--space-8);
}

.tour-card__tile {
  display: grid;
  flex: none;
  place-items: center;
  width: 30px;
  height: 30px;
  color: var(--ink);
  background: color-mix(in srgb, var(--tour-highlight) 28%, transparent);
  border-radius: 8px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tour-highlight) 60%, transparent);
}

:root[data-theme='contrast'] .tour-card__tile {
  background: none;
  box-shadow: inset 0 0 0 2px var(--ink);
}

.tour-card__tool {
  font: var(--type-label);
}

.tour-card__key {
  padding: 0 var(--space-6);
  font-family: var(--font-mono, 'DM Mono', monospace);
  font-size: 12px;
  line-height: 20px;
  color: var(--ink);
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-bottom-width: 2px;
  border-radius: 5px;
}

.tour-card__count {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: flex-end;
  margin-left: auto;
  font: var(--type-meta-small);
  color: var(--muted);
}

.tour-card__strand {
  display: flex;
  gap: 3px;
}

.tour-card__strand i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.tour-card__bead--done {
  background: var(--ink);
}

.tour-card__bead--current {
  background: var(--tour-highlight);
  box-shadow: 0 0 0 1px var(--ink);
}

.tour-card__bead--rest {
  background: var(--bead-empty);
}

.tour-card__title {
  margin: 0;
  font: var(--type-title);
}

.tour-card__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  font: var(--type-body);
}

.tour-card__text p {
  margin: 0;
}

.tour-card__hint {
  color: var(--muted);
}

.tour-card__off {
  display: flex;
  gap: var(--space-8);
  align-items: flex-start;
  color: var(--muted);
}

.tour-card__footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-4);
}

@keyframes tour-fade {
  from {
    opacity: 0;
  }
}

@keyframes tour-arrive {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

/* Reduced motion: fades only, and the card doesn't move. */
@media (prefers-reduced-motion: reduce) {
  @keyframes tour-arrive {
    from {
      opacity: 0;
    }
  }
}
</style>
