<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConvertImageWizardState, type ConvertPopover as PopoverName } from '../../composables/import/useConvertImageWizard'
import { useConvertColorsReadings } from '../../composables/import/useConvertColorsReadings'
import { useConvertNeighbours } from '../../composables/import/useConvertNeighbours'
import { beadLabel, offeredBeads } from '../../domain/beads'
import { LARGE_SCHEMA_BEADS } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import IconButton from '../ui/IconButton.vue'
import FormField from '../ui/form/FormField.vue'
import ConvertColorsSlider from './ConvertColorsSlider.vue'
import ConvertWidthSlider from './ConvertWidthSlider.vue'
import BeadSection from '../project/BeadSection.vue'
import TechniqueSection from '../project/TechniqueSection.vue'
import ConvertBackgroundSection from './ConvertBackgroundSection.vue'
import ConvertCleanUpButton from './ConvertCleanUpButton.vue'
import ConvertCleanUpSection from './ConvertCleanUpSection.vue'
import ConvertColorsNeighbours from './ConvertColorsNeighbours.vue'
import ConvertColorsSection from './ConvertColorsSection.vue'
import ConvertFoot from './ConvertFoot.vue'
import ConvertLightingSection from './ConvertLightingSection.vue'
import ConvertPictureSection from './ConvertPictureSection.vue'
import ConvertPopover from './ConvertPopover.vue'
import ConvertSizeSection from './ConvertSizeSection.vue'

// The quiet converter's column (ConvertImage card DS-1, ticket 0896): the picture, the Bead and Technique, Width and
// Colors in the order they are decided, then the result and Create Project at its foot (ConvertFoot, ticket 0897).
// Each one's more is a popover of its own button; Background's lives here too, so it stacks in the column under 1024 px.
const emit = defineEmits<{ paste: []; create: [] }>()

const { t } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const has = computed(() => wizard.hasPicture.value)

const pictureEl = ref<HTMLElement>()
const beadEl = ref<HTMLElement>()
const sizeEl = ref<HTMLElement>()
const colorsEl = ref<HTMLElement>()
const cleanUpButton = () => colorsEl.value?.querySelector<HTMLElement>('[data-testid="convert-clean-up-button"]') ?? undefined
/** A popover's own button, where focus goes back when it closes. */
const button = (section: HTMLElement | undefined, testid: string) => section?.querySelector<HTMLElement>(`[data-testid="${testid}"]`) ?? undefined
const backgroundButton = () => document.querySelector<HTMLElement>('[data-testid="convert-tool-background"]') ?? undefined
/** The Background tool's taps and drags on the beads go on while its popover is open. */
const onBeads = (event: PointerEvent) => event.target instanceof Element && !!event.target.closest('[data-testid="convert-image-box"]')
const isOpen = (name: PopoverName) => wizard.popover.value === name

const beadButton = computed(() => `${beadLabel(wizard.bead.value)} · ${techniqueName(t.value, wizard.technique.value)}`)

const { matchedLine } = useConvertColorsReadings()

/** The neighbours' card (DS-2, ticket 0904): shown while the Colors slider is focused or pressed, or focus is inside it;
 * never over an open popover. */
const neighboursOpen = ref(false)
const colorsRange = () => colorsEl.value?.querySelector<HTMLElement>('[data-testid="convert-colors-slider-range"]') ?? undefined
const neighbours = useConvertNeighbours({
  count: wizard.maxColors,
  most: wizard.colorsMax,
  shown: neighboursOpen,
  beadsAt: wizard.beadsAtColors,
  beadsShown: wizard.beadsShown,
})
/** Whether a target is the slider's range or inside the card. */
const inNeighbours = (target: EventTarget | null) =>
  target instanceof Node && (!!colorsRange()?.contains(target) || !!colorsEl.value?.querySelector('[data-testid="convert-neighbours"]')?.contains(target))
/** Set while Escape gives the slider its focus back, so that focus does not show the card again. */
let refocusing = false
function showNeighbours(event: Event) {
  if (refocusing) return
  if (has.value && wizard.popover.value === undefined && inNeighbours(event.target)) neighboursOpen.value = true
}
/** A press inside the card, which in Safari takes focus from the slider without giving it to the button pressed. */
let pressingCard = false
const pressCard = (on: boolean) => (pressingCard = on)
function leaveNeighbours(event: FocusEvent) {
  if (pressingCard || inNeighbours(event.relatedTarget)) return
  // Focus may come back at once (a place drawn anew as it turns off): only focus gone elsewhere closes the card.
  setTimeout(() => {
    if (!pressingCard && !inNeighbours(document.activeElement)) neighboursOpen.value = false
  })
}
// A popover opened while the card shows takes its place: the card never stands over one.
watch(wizard.popover, (open) => {
  if (open !== undefined) neighboursOpen.value = false
})
/** Escape closes the card with focus back on the slider; a press outside closes it where the press went. */
function closeNeighbours(refocus: boolean) {
  neighboursOpen.value = false
  pressingCard = false
  if (!refocus) return
  refocusing = true
  colorsRange()?.focus({ preventScroll: true })
  refocusing = false
}
</script>

<template>
  <div class="convert-column" data-testid="convert-column">
    <ConvertPopover
      v-if="isOpen('background')"
      place="bar"
      :label="words.removeBackground"
      :opener="backgroundButton"
      :keeps-press="onBeads"
      testid="convert-background-popover"
      @close="wizard.closePopover"
    >
      <ConvertBackgroundSection />
    </ConvertPopover>

    <!-- Each section a region named as it is labelled, so a screen reader can go to it (ticket 0995). -->
    <section ref="pictureEl" class="convert-column__section" :aria-label="words.pictureLabel">
      <ConvertPictureSection @paste="emit('paste')" />
    </section>
    <!-- Lighting (DS-3, ticket 0908): from the sun button, its top level with the picture section's, 16 under the strip. -->
    <ConvertPopover
      v-if="isOpen('lighting')"
      place="beside"
      :label="t.convertImage.wizard.lighting.title"
      :opener="() => button(pictureEl, 'convert-lighting-more')"
      :anchor="() => button(pictureEl, 'convert-picture')"
      testid="convert-lighting-popover"
      @close="wizard.closePopover"
    >
      <ConvertLightingSection />
    </ConvertPopover>

    <section ref="beadEl" class="convert-column__section" :aria-label="words.beadAndTechnique">
      <span class="convert-column__label">{{ words.beadAndTechnique }}</span>
      <AppButton
        trailing-icon="chevron-down"
        class="convert-column__bead"
        :class="{ 'convert-column__bead--open': isOpen('bead') }"
        aria-haspopup="dialog"
        :aria-expanded="isOpen('bead')"
        data-wrap-ok
        data-testid="convert-bead-button"
        @click="wizard.togglePopover('bead')"
      >
        <span class="convert-column__bead-name">{{ beadButton }}</span>
      </AppButton>
    </section>
    <ConvertPopover
      v-if="isOpen('bead')"
      place="beside"
      :label="words.beadAndTechnique"
      :opener="() => button(beadEl, 'convert-bead-button')"
      :anchor="() => beadEl"
      testid="convert-bead-popover"
      @close="wizard.closePopover"
    >
      <div class="convert-column__bead-form">
        <FormField :label="t.form.beadLabel">
          <BeadSection :bead="wizard.bead.value" :candidates="offeredBeads()" @pick="wizard.beadId.value = $event" />
        </FormField>
        <TechniqueSection v-model:technique="wizard.technique.value" :settings="wizard.settings.value" testid="convert" @set-setting="wizard.setSetting" />
      </div>
    </ConvertPopover>

    <section ref="sizeEl" class="convert-column__section" :aria-label="words.sizeTitle">
      <ConvertWidthSlider>
        <template #action>
          <IconButton
            icon="size"
            :label="words.moreForSize"
            :disabled="!has"
            :disabled-body="words.addPictureFirst"
            :class="{ 'convert-column__more--open': isOpen('size') }"
            aria-haspopup="dialog"
            :aria-expanded="isOpen('size')"
            data-testid="convert-size-more"
            @click="wizard.togglePopover('size')"
          />
        </template>
      </ConvertWidthSlider>
      <AppNote v-if="has && wizard.largeSchema.value" data-testid="convert-large-schema">{{ fillBlanks(words.largeSchema, { beads: LARGE_SCHEMA_BEADS }) }}</AppNote>
    </section>
    <ConvertPopover
      v-if="isOpen('size')"
      place="beside"
      :label="words.sizeTitle"
      :opener="() => button(sizeEl, 'convert-size-more')"
      :anchor="() => sizeEl"
      testid="convert-size-popover"
      @close="wizard.closePopover"
    >
      <ConvertSizeSection />
    </ConvertPopover>

    <section
      ref="colorsEl"
      class="convert-column__section"
      :aria-label="words.colorsLabel"
      @focusin="showNeighbours"
      @focusout="leaveNeighbours"
      @pointerdown="showNeighbours"
    >
      <ConvertColorsSlider>
        <template #action>
          <IconButton
            icon="palette"
            :label="words.moreForColors"
            :disabled="!has"
            :disabled-body="words.addPictureFirst"
            :class="{ 'convert-column__more--open': isOpen('colors') }"
            aria-haspopup="dialog"
            :aria-expanded="isOpen('colors')"
            data-testid="convert-colors-more"
            @click="wizard.togglePopover('colors')"
          />
        </template>
      </ConvertColorsSlider>
      <ConvertColorsNeighbours
        v-if="neighboursOpen"
        :fewer="neighbours.fewer.value"
        :more="neighbours.more.value"
        :slider="colorsRange"
        :anchor="() => colorsEl"
        @pointerdown.capture="pressCard(true)"
        @pointerup="pressCard(false)"
        @pointercancel="pressCard(false)"
        @close="closeNeighbours"
      />
      <p v-if="has" class="convert-column__matched" data-testid="convert-matched">{{ matchedLine }}</p>
      <!-- Clean up (DS-3, ticket 0906): what the helper did, under Colors; its popover beside the column. -->
      <ConvertCleanUpButton v-if="has" @toggle="wizard.togglePopover('clean-up')" />
    </section>
    <ConvertPopover
      v-if="isOpen('clean-up')"
      place="level"
      :label="t.convertImage.wizard.cleanUp.title"
      :opener="cleanUpButton"
      :anchor="cleanUpButton"
      testid="convert-clean-up-popover"
      @close="wizard.closePopover"
    >
      <ConvertCleanUpSection />
    </ConvertPopover>
    <ConvertPopover
      v-if="isOpen('colors')"
      place="tall"
      :label="words.colorsLabel"
      :opener="() => button(colorsEl, 'convert-colors-more')"
      testid="convert-colors-popover"
      @close="wizard.closePopover"
    >
      <ConvertColorsSection />
    </ConvertPopover>

    <ConvertFoot @create="emit('create')" />
  </div>
</template>

<style scoped>
/* A short column: no `position`, so the popovers it holds stand against the page, not clipped by its scroll. */
.convert-column {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-width: thin;
  background: var(--canvas);
  border-left: 1px solid var(--panel-rule);
}

.convert-column__section {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  padding: var(--space-16) var(--space-20);
}

/* Sections are parted by rules inset 20. */
.convert-column__section + .convert-column__section,
.convert-popover + .convert-column__section {
  background: linear-gradient(var(--line-soft), var(--line-soft)) top / calc(100% - 2 * var(--space-20)) 1px no-repeat;
}

.convert-column__label {
  font: var(--type-label);
  color: var(--muted);
}

/* The Bead and Technique button: the name wraps and the button grows; its chevron in `muted` at the right. */
.convert-column__bead {
  justify-content: space-between;
  width: 100%;
  height: auto;
  min-height: var(--field-height);
  padding: var(--space-8) var(--space-10) var(--space-8) var(--space-12);
  text-align: left;
  white-space: normal;
  background: var(--canvas);
}

.convert-column__bead :deep(.app-button__trailing) {
  flex: none;
  color: var(--muted);
}

.convert-column__bead--open {
  border-color: var(--ink);
  box-shadow: inset 0 0 0 0.5px var(--ink);
}

.convert-column__bead-name {
  flex: 1 1 auto;
  min-width: 0;
  overflow-wrap: anywhere;
}

.convert-column__bead-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-12);
}

/* A "More for …" button while its popover is open: ink fill, canvas icon. */
.convert-column :deep(.convert-column__more--open.icon-btn) {
  color: var(--canvas);
  background: var(--ink);
  border-color: var(--ink);
}

.convert-column__matched {
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}
</style>
