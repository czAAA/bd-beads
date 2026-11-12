<script setup lang="ts">
import { computed, ref } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useElementSize } from '../../composables/ui/useElementSize'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { useRovingFocus } from '../../composables/ui/useRovingFocus'
import { pictureBarPlace, type ScreenBox } from '../../composables/canvas/pictureBarPlacement'
import { fillBlanks } from '../../domain/fillBlanks'
import { imageInputAccept } from '../../domain/imageConversion'
import { movedBy, OPACITY_STEPS, type OpacityStep, type ReferencePlace } from '../../domain/referenceImage'
import { useI18n } from '../../i18n/useI18n'
import { arrowMove, screenToGrid, type ReferenceView } from '../../rendering/referenceImage'
import AppButton from '../ui/AppButton.vue'
import FileButton from '../ui/form/FileButton.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import IconButton from '../ui/IconButton.vue'

// The picture bar (ReferenceImage card, ticket 0883): a pill over the shown reference image's top edge, level, in screen
// px: the Move grip, Set Frame around the picture, Convert to beads and ···, which opens Opacity, Replace and Remove in
// place. One `toolbar` Tab stop; the grip's drag and arrows move the picture, saved on release with no Undo step.
const props = defineProps<{
  place: ReferencePlace
  /** The picture's box on screen, the bar's height and where it stands (pictureBarPlacement). */
  picture: ScreenBox
  barHeight: number
  sheet?: ScreenBox
  view: ReferenceView & { viewport: { width: number; height: number } }
  /** One bead across, in grid px: what an arrow moves the picture. */
  bead: number
  opacity: OpacityStep
  /** Set Frame around the picture's Tooltip body, or why it is off. */
  frameBody: string
  frameOff?: string
  /** Convert to beads' Tooltip body, or why it is off; pressed while its popover is open. */
  convertBody: string
  convertOff?: string
  converting: boolean
}>()

const emit = defineEmits<{
  /** A drag of the Move grip as it goes, drawn but not saved. */
  preview: [place: ReferencePlace]
  commit: [place: ReferencePlace, announcement: string]
  /** Set Frame around the picture hovered or focused (its preview), and pressed. */
  'frame-preview': [on: boolean]
  frame: []
  convert: []
  opacity: [opacity: OpacityStep]
  replace: [file: File]
  remove: []
}>()

const { t } = useI18n()
const words = computed(() => t.value.referenceImage)
const barEl = ref<HTMLElement>()
const { width } = useElementSize(barEl, { box: 'border-box' })
const at = computed(() => pictureBarPlace(props.picture, { width: width.value, height: props.barHeight }, props.view.viewport, props.sheet))

const moveAction = controlAction('move-reference-image')
/** ··· has opened Opacity, Replace and Remove. */
const opened = ref(false)
const fold = () => (opened.value = false)
useOverlayLayer({ isOpen: () => opened.value, root: () => barEl.value, close: fold, outside: 'through' })

const roving = useRovingFocus(barEl, { selector: '.picture-bar__item', axis: () => 'horizontal', managesTabIndex: true })

const opacityOptions = computed(() => OPACITY_STEPS.map((step) => ({ value: String(step) as `${OpacityStep}`, label: fillBlanks(words.value.percent, { count: step }) })))

/** The grip's drag under way: the pointer, where it started on the drawing area and the place it started from. */
const press = ref<{ pointer: number; start: { x: number; y: number }; from: ReferencePlace; place: ReferencePlace }>()

/** A pointer's place on the drawing area, in its px: the bar's box sits in it. */
function local(event: PointerEvent): { x: number; y: number } {
  const area = barEl.value?.offsetParent?.getBoundingClientRect()
  return { x: event.clientX - (area?.left ?? 0), y: event.clientY - (area?.top ?? 0) }
}

function begin(event: PointerEvent) {
  if (event.button !== 0 || press.value) return
  event.stopPropagation()
  ;(event.currentTarget as Element).setPointerCapture?.(event.pointerId)
  press.value = { pointer: event.pointerId, start: local(event), from: props.place, place: props.place }
}

function drag(event: PointerEvent) {
  const pressed = press.value
  if (!pressed || event.pointerId !== pressed.pointer) return
  const start = screenToGrid(props.view, pressed.start)
  const point = screenToGrid(props.view, local(event))
  const place = movedBy(pressed.from, point.x - start.x, point.y - start.y)
  press.value = { ...pressed, place }
  emit('preview', place)
}

function end(event: PointerEvent) {
  const pressed = press.value
  if (!pressed || event.pointerId !== pressed.pointer) return
  press.value = undefined
  if (pressed.place !== pressed.from) emit('commit', pressed.place, words.value.moved)
}

function cancel() {
  const pressed = press.value
  press.value = undefined
  if (pressed) emit('preview', pressed.from)
}

/** The grip's arrows move the picture a bead the way they point on screen, Shift ten, as in Adjust. */
function onGripKey(event: KeyboardEvent) {
  const moved = arrowMove(props.view, props.bead, event)
  if (!moved) return
  event.preventDefault()
  event.stopPropagation()
  emit('commit', movedBy(props.place, moved.x, moved.y), words.value.moved)
}

/** Convert to beads' popover gives focus back to its button as it closes. */
defineExpose({ focusConvert: () => barEl.value?.querySelector<HTMLElement>('[data-testid="picture-bar-convert"]')?.focus() })

const accept = imageInputAccept()
const pickerEl = ref<HTMLElement>()
const choose = () => pickerEl.value?.querySelector<HTMLInputElement>('input[type="file"]')?.click()
function onFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) emit('replace', file)
  input.value = ''
  fold()
}
</script>

<template>
  <div
    ref="barEl"
    class="picture-bar"
    :class="{ 'picture-bar--moving': press }"
    :style="{ left: `${at.left}px`, top: `${at.top}px` }"
    role="toolbar"
    :aria-label="words.name"
    data-testid="picture-bar"
    @keydown="roving.onKeydown"
    @focusin="roving.onFocusin"
  >
    <IconButton
      variant="plain"
      shape="round"
      class="picture-bar__item picture-bar__grip"
      :action="moveAction"
      data-testid="picture-bar-move"
      @pointerdown="begin"
      @pointermove="drag"
      @pointerup="end"
      @pointercancel="cancel"
      @keydown="onGripKey"
    >
      <span class="picture-bar__grip-line" aria-hidden="true" />
    </IconButton>
    <span class="picture-bar__divider" aria-hidden="true" />
    <IconButton
      variant="plain"
      shape="round"
      class="picture-bar__item"
      icon="frame"
      :label="words.frameAround.name"
      :tooltip="{ body: frameBody }"
      :disabled="!!frameOff"
      :disabled-body="frameOff"
      data-testid="picture-bar-frame"
      @mouseenter="frameOff || emit('frame-preview', true)"
      @mouseleave="emit('frame-preview', false)"
      @focus="frameOff || emit('frame-preview', true)"
      @blur="emit('frame-preview', false)"
      @click="emit('frame')"
    />
    <IconButton
      variant="plain"
      shape="round"
      class="picture-bar__item"
      icon="convert-to-beads"
      :label="words.convert.name"
      :tooltip="{ body: convertBody, suppressed: converting }"
      :disabled="!!convertOff"
      :disabled-body="convertOff"
      :pressed="converting"
      data-testid="picture-bar-convert"
      @click="emit('convert')"
    />
    <span class="picture-bar__divider" aria-hidden="true" />
    <IconButton
      variant="plain"
      shape="round"
      class="picture-bar__item"
      :icon="opened ? 'close' : 'more'"
      :label="opened ? words.bar.close : words.bar.more"
      tooltip
      :pressed="opened"
      data-testid="picture-bar-more"
      @click="opened = !opened"
    />
    <template v-if="opened">
      <span class="picture-bar__divider" aria-hidden="true" />
      <SegmentedControl
        class="picture-bar__opacity"
        :model-value="String(opacity) as `${OpacityStep}`"
        :options="opacityOptions"
        small
        :aria-label="words.opacity"
        data-testid="picture-bar-opacity"
        @update:model-value="emit('opacity', Number($event) as OpacityStep)"
      />
      <span class="picture-bar__divider" aria-hidden="true" />
      <AppButton variant="text" icon="image" class="picture-bar__item picture-bar__text" data-testid="picture-bar-replace" @click="choose">{{ words.bar.replace }}</AppButton>
      <span ref="pickerEl" hidden>
        <FileButton :label="words.replace" :accept="accept" tabindex="-1" data-testid="picture-bar-replace-input" @change="onFile" />
      </span>
      <AppButton variant="text" icon="delete" class="picture-bar__item picture-bar__text picture-bar__remove" data-testid="picture-bar-remove" @click="fold(), emit('remove')">{{ words.bar.remove }}</AppButton>
    </template>
  </div>
</template>

<style scoped>
/* The Tool pill's look, in screen px over the drawing: `canvas`, a `box-line` edge, `elevation-3`. */
.picture-bar {
  position: absolute;
  z-index: 2;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  box-sizing: border-box;
  height: var(--picture-bar-height);
  padding: var(--space-2) var(--space-4);
  background: var(--canvas);
  border: 1px solid var(--box-line);
  border-radius: var(--radius-full);
  box-shadow: var(--elevation-3);
  pointer-events: auto;
  animation: picture-bar-in var(--duration-fast) var(--ease-standard);
}

:root[data-theme='dark'] .picture-bar {
  border-color: var(--line-strong);
}

.picture-bar :deep(.icon-btn--plain) {
  width: var(--picture-bar-button);
  height: var(--picture-bar-button);
  border-radius: var(--radius-full);
}

.picture-bar :deep(.icon-btn--plain:hover:not([aria-disabled='true'])) {
  background: color-mix(in srgb, var(--ink) 8%, transparent);
}

.picture-bar :deep(.icon-btn--plain[aria-pressed='true']) {
  color: var(--canvas);
  background: var(--ink);
}

/* The Move grip: the Frame's Move bar at the bar's size, a 32 × 6 `ink` pill in a 52 × 32 hit area. */
.picture-bar :deep(.picture-bar__grip) {
  width: var(--picture-bar-grip);
  cursor: grab;
  touch-action: none;
}

.picture-bar--moving :deep(.picture-bar__grip) {
  cursor: grabbing;
}

.picture-bar__grip-line {
  width: var(--picture-bar-grip-line);
  height: var(--frame-handle-thickness);
  background: var(--ink);
  border-radius: var(--frame-handle-thickness);
}

.picture-bar__divider {
  flex: none;
  width: 1px;
  height: var(--picture-bar-divider);
  margin: 0 var(--space-4);
  background: var(--line);
}

.picture-bar :deep(.picture-bar__text) {
  height: var(--picture-bar-button);
  font: var(--type-tab);
  white-space: nowrap;
}

.picture-bar :deep(.picture-bar__remove) {
  color: var(--danger);
}

.picture-bar :deep(.picture-bar__remove:hover) {
  background: color-mix(in srgb, var(--danger) 10%, transparent);
}

.picture-bar__opacity {
  flex: none;
}

@media (pointer: coarse) {
  .picture-bar {
    height: calc(var(--touch-target) + 2 * var(--space-4));
  }

  .picture-bar :deep(.icon-btn--plain),
  .picture-bar :deep(.picture-bar__text) {
    width: var(--touch-target);
    height: var(--touch-target);
  }

  .picture-bar :deep(.picture-bar__grip) {
    width: var(--picture-bar-grip);
  }

  .picture-bar :deep(.picture-bar__text) {
    width: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .picture-bar {
    animation: none;
  }
}

@keyframes picture-bar-in {
  from {
    opacity: 0;
  }
}
</style>
