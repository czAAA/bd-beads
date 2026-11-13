<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useConvertImageWizardState } from '../../composables/import/useConvertImageWizard'
import type { NeighbourPlace } from '../../composables/import/useConvertNeighbours'
import { useOverlayLayer } from '../../composables/ui/useOverlayLayer'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import AppTooltip from '../ui/AppTooltip.vue'
import TextField from '../ui/form/TextField.vue'
import ConvertBeadsThumb from './ConvertBeadsThumb.vue'

// The Colors neighbours' card (ConvertImage card DS-2, ticket 0904): beside the Colors slider while it is in use, the beads
// at one color fewer, the count shown and one more, each a button that takes its count, and a field for a number past the
// slider's end. Escape or a press outside closes it; focus leaving the slider and the card closes it too (ConvertColumn).
const props = defineProps<{
  fewer: NeighbourPlace
  more: NeighbourPlace
  /** The Colors slider's range: its own press is not outside. */
  slider: () => HTMLElement | undefined
  /** The Colors section the card stands level with, 8 above its top. */
  anchor: () => HTMLElement | undefined
}>()
/** Escape asks for focus back on the slider; a press outside does not. */
const emit = defineEmits<{ close: [refocus: boolean] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard.neighbours)
const caption = (count: number) => plural(locale.value, count, t.value.convertImage.wizard.colorsCount)

const rootEl = ref<HTMLElement>()
const top = ref<number>()
/** The picture's shape as the count shown draws it: a place not yet drawn keeps it, so the card does not jump. */
const ratio = ref<number>()

useOverlayLayer({
  isOpen: () => true,
  root: () => rootEl.value,
  close: () => emit('close', true),
  onOutsidePress: () => emit('close', false),
  isOpener: (target) => props.slider()?.contains(target) ?? false,
  outside: 'through',
})

/** The three places in their order: the left, the count shown, the right. */
const places = computed(() => [
  { side: 'fewer' as const, place: props.fewer },
  { side: 'shown' as const, place: { end: false, count: wizard.maxColors.value, beads: wizard.beadsShown.value, same: false } satisfies NeighbourPlace },
  { side: 'more' as const, place: props.more },
])

/** Takes a neighbour's count; the three shift and focus stays on the place pressed. */
function take(place: NeighbourPlace) {
  if (!place.end && !place.same) wizard.setMaxColors(place.count)
}

/** A focused place that becomes an end or turns off is drawn anew: focus goes to the same place, or to the count shown
 * where the place is no button now, so the card stays. */
const kinds = computed(() => places.value.map(({ place }) => (place.end ? 'end' : place.same ? 'same' : 'on')).join())
watch(
  kinds,
  async () => {
    const side = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('[data-side]')?.dataset.side
    if (!side || !rootEl.value?.contains(document.activeElement)) return
    await nextTick()
    if (rootEl.value?.contains(document.activeElement)) return
    const again = rootEl.value?.querySelector<HTMLElement>(`button[data-side="${side}"]`) ?? rootEl.value?.querySelector<HTMLElement>('[data-side="shown"]')
    again?.focus({ preventScroll: true })
  },
  { flush: 'pre' },
)

/** The number typed, kept from 1 to the most colors; anything else puts the count shown back. */
const draft = ref(String(wizard.maxColors.value))
watch(wizard.maxColors, (count) => (draft.value = String(count)))
function commit() {
  const typed = Number.parseInt(draft.value.trim(), 10)
  if (Number.isFinite(typed)) wizard.setMaxColors(typed)
  draft.value = String(wizard.maxColors.value)
}
function step(by: 1 | -1) {
  commit()
  wizard.setMaxColors(wizard.maxColors.value + by)
}

onMounted(() => {
  const section = props.anchor?.()
  const page = rootEl.value?.closest('.convert-page')
  if (section && page) top.value = section.getBoundingClientRect().top - page.getBoundingClientRect().top
})
</script>

<template>
  <div
    ref="rootEl"
    class="convert-neighbours"
    :style="{ ...(top !== undefined ? { '--convert-neighbours-top': `${top}px` } : {}), ...(ratio ? { '--convert-neighbours-ratio': ratio } : {}) }"
    role="group"
    :aria-label="words.name"
    data-testid="convert-neighbours"
  >
    <div class="convert-neighbours__places">
      <template v-for="{ side, place } in places" :key="side">
        <div v-if="place.end" class="convert-neighbours__end" :data-side="side" data-testid="convert-neighbour-end">
          {{ side === 'fewer' ? words.noFewer : words.noMore }}
        </div>
        <!-- A neighbour that gives the beads shown is off, with why in its Tooltip. -->
        <AppTooltip v-else-if="place.same" :name="caption(place.count)" disabled :disabled-body="words.same" :announce="false" class="convert-neighbours__tip">
          <button
            type="button"
            class="ui-control convert-neighbours__place convert-neighbours__place--same"
            aria-pressed="false"
            aria-disabled="true"
            :data-side="side"
            :data-count="place.count"
            data-testid="convert-neighbour"
          >
            <span class="convert-neighbours__frame">
              <ConvertBeadsThumb :beads="place.beads" :drawn="wizard.drawnBeads" />
            </span>
            <span class="convert-neighbours__caption">{{ caption(place.count) }}</span>
          </button>
        </AppTooltip>
        <button
          v-else
          type="button"
          class="ui-control convert-neighbours__place"
          :aria-pressed="side === 'shown'"
          :data-side="side"
          :data-count="place.count"
          data-testid="convert-neighbour"
          @click="take(place)"
        >
          <span class="convert-neighbours__frame">
            <ConvertBeadsThumb :beads="place.beads" :drawn="wizard.drawnBeads" @shape="side === 'shown' && (ratio = $event)" />
          </span>
          <span class="convert-neighbours__caption">{{ caption(place.count) }}</span>
        </button>
      </template>
    </div>
    <label class="convert-neighbours__type">
      <span class="convert-neighbours__label">{{ words.typeNumber }}</span>
      <span class="convert-neighbours__field">
        <TextField
          v-model="draft"
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          autocomplete="off"
          select-on-focus
          :aria-label="words.name"
          data-testid="convert-colors-count"
          @keydown.enter.prevent="commit"
          @keydown.up.prevent="step(1)"
          @keydown.down.prevent="step(-1)"
          @change="commit"
        />
      </span>
      <span class="convert-neighbours__range">{{ fillBlanks(words.range, { max: wizard.colorsMax.value }) }}</span>
    </label>
  </div>
</template>

<style scoped>
/* Over the preview's right edge, 12 left of the column, its top 8 above the Colors section's (DS-2). */
.convert-neighbours {
  position: absolute;
  top: calc(var(--convert-neighbours-top, var(--space-16)) - var(--space-8));
  right: calc(var(--convert-column-width) + var(--space-12));
  z-index: 6;
  display: flex;
  flex-direction: column;
  gap: var(--space-10);
  box-sizing: border-box;
  padding: var(--space-12) var(--space-12) var(--space-10);
  background: var(--elevated);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  box-shadow: var(--elevation-3);
}

:root[data-theme='dark'] .convert-neighbours {
  border-color: var(--line-strong);
  box-shadow: none;
}

.convert-neighbours__places {
  display: flex;
  gap: var(--space-8);
  align-items: stretch;
}

.convert-neighbours__tip {
  display: flex;
  flex: 0 1 var(--convert-neighbour-width);
  min-width: 0;
}

/* 96 wide; in the stacked column of a phone the three share what room there is. */
.convert-neighbours__place {
  display: flex;
  flex: 0 1 var(--convert-neighbour-width);
  flex-direction: column;
  gap: var(--space-6);
  align-items: center;
  min-width: 0;
  padding: 0;
  color: var(--ink);
  background: none;
  border: 0;
  border-radius: var(--radius-md);
  cursor: pointer;
}

.convert-neighbours__frame {
  box-sizing: border-box;
  width: 100%;
  padding: var(--space-4);
  background: var(--box);
  border-radius: var(--radius-md);
  box-shadow: inset 0 0 0 1px var(--line);
}

.convert-neighbours__place[aria-pressed='true'] .convert-neighbours__frame {
  box-shadow:
    inset 0 0 0 1px var(--line),
    0 0 0 2px var(--elevated),
    0 0 0 4px var(--ring);
}

.convert-neighbours__place:focus-visible {
  outline: none;
}

.convert-neighbours__place:focus-visible .convert-neighbours__frame {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.convert-neighbours__caption {
  padding: 0 var(--space-4);
  font: var(--type-control);
  font-weight: 500;
  white-space: nowrap;
  border-radius: var(--radius-sm);
}

.convert-neighbours__place[aria-pressed='true'] .convert-neighbours__caption {
  font-weight: 600;
}

.convert-neighbours__place:not([aria-disabled='true']):hover .convert-neighbours__caption {
  background: var(--hover-fill);
}

.convert-neighbours__place--same {
  cursor: default;
  opacity: var(--swatch-faded-opacity);
}

/* An end of the range: an empty dashed place, not a button. */
.convert-neighbours__tip > .convert-neighbours__place {
  flex-basis: 100%;
}

.convert-neighbours__end {
  display: grid;
  flex: 0 1 var(--convert-neighbour-width);
  place-items: center;
  box-sizing: border-box;
  min-width: 0;
  padding: var(--space-4);
  font: var(--type-control);
  color: var(--muted);
  text-align: center;
  border: 1.5px dashed var(--line-strong);
  border-radius: var(--radius-md);
}

.convert-neighbours__type {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  align-items: center;
  padding-top: var(--space-10);
  border-top: 1px solid var(--line-soft);
}

.convert-neighbours__label {
  flex: 1 0 auto;
  white-space: nowrap;
  font: var(--type-label);
  color: var(--muted);
}

.convert-neighbours__field {
  flex: none;
  width: var(--convert-count-field-width);
}

.convert-neighbours__field :deep(.text-field) {
  height: var(--control-height);
  padding: 0 var(--space-8);
}

.convert-neighbours__field :deep(.text-field__input) {
  width: 100%;
  min-width: 0;
  font: var(--type-meta);
  text-align: right;
}

.convert-neighbours__range {
  flex: none;
  font: var(--type-meta-small);
  color: var(--muted);
  white-space: nowrap;
}

@media (max-width: 74.99rem) {
  .convert-neighbours {
    right: calc(var(--convert-column-width-narrow) + var(--space-12));
  }
}

/* Under 1024 px or in portrait the column stacks: the card stands in its flow, under the slider. */
@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-neighbours {
    position: static;
    box-shadow: none;
  }
}
</style>
