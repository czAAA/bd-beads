<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConvertImageWizardState, type ConvertPopover as PopoverName } from '../../composables/import/useConvertImageWizard'
import { useConvertSizeReadings } from '../../composables/import/useConvertSizeReadings'
import { beadLabel, offeredBeads } from '../../domain/beads'
import { LARGE_SCHEMA_BEADS } from '../../domain/convertSize'
import { fillBlanks } from '../../domain/fillBlanks'
import { groupThousands } from '../../domain/formatNumber'
import { MIN_IMAGE_COLORS } from '../../domain/imageConversion'
import { plural, pluralForm } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppNote from '../ui/AppNote.vue'
import IconButton from '../ui/IconButton.vue'
import FormField from '../ui/form/FormField.vue'
import ValueSlider from '../ui/form/ValueSlider.vue'
import BeadSection from '../project/BeadSection.vue'
import TechniqueSection from '../project/TechniqueSection.vue'
import ConvertBackgroundSection from './ConvertBackgroundSection.vue'
import ConvertCleanUpButton from './ConvertCleanUpButton.vue'
import ConvertCleanUpSection from './ConvertCleanUpSection.vue'
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

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const readings = useConvertSizeReadings(wizard)
const has = computed(() => wizard.hasPicture.value)
const offBody = computed(() => (has.value ? undefined : words.value.addPictureFirst))
/** A value an off slider shows before a picture (DS-1). */
const NONE = '—'

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

/** The Colors slider's marks (DS-1): each doubles the one before twice over, so they stand evenly on its scale. */
const COLORS_MARKS = [4, 16, 64]
const colorsMarks = computed(() =>
  COLORS_MARKS.filter((value) => value > MIN_IMAGE_COLORS && value < wizard.colorsMax.value).map((value) => ({ value, label: String(value) })),
)
/** The most Finishes the line under Colors names; more are counted (DS-2). */
const NAMED_FINISHES = 3
/** Under Colors, where they are matched (DS-1): the Bead's palette, the Default Palette, or the picture's own. */
const matchedLine = computed(() => {
  const source = wizard.source.value
  if (source === 'exact') return words.value.matchedExact
  if (source === 'default') return words.value.matchedDefault
  if (source === 'my-beads') return plural(locale.value, wizard.myBeadsCodes.value.length, words.value.myBeads.matched)
  const bead = beadLabel(wizard.bead.value).toLocaleLowerCase(locale.value)
  const on = wizard.finishesApplied.value
  // With Finishes on (ticket 0901, DS-2): their names, or past three their count, so the line stays two lines at most.
  if (on.length > NAMED_FINISHES) return fillBlanks(pluralForm(locale.value, on.length, words.value.finish.matchedMany), { bead }, { count: on.length })
  if (on.length > 0) {
    const names = on.map((finish) => t.value.palette.beadColors.finishes[finish].toLocaleLowerCase(locale.value))
    return fillBlanks(words.value.finish.matched, { bead, finishes: names.join(words.value.finish.separator) })
  }
  return fillBlanks(words.value.matchedBead, { bead })
})
const colorsValue = computed(() => plural(locale.value, wizard.maxColors.value, words.value.colorsCount))
const colorsMaxLabel = computed(() => fillBlanks(words.value.maxLabel, { value: groupThousands(wizard.colorsMax.value, locale.value) }))
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

    <section ref="pictureEl" class="convert-column__section">
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

    <section ref="beadEl" class="convert-column__section">
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

    <section ref="sizeEl" class="convert-column__section">
      <ValueSlider
        :label="t.form.widthLabel"
        :model-value="wizard.sizing.value.width"
        :min="wizard.sizing.value.range.min"
        :max="wizard.sizing.value.range.max"
        :value="has ? readings.width.value.value : NONE"
        :secondary="has ? readings.width.value.secondary : undefined"
        :valuetext="has ? readings.width.value.valuetext : NONE"
        :min-label="has ? readings.width.value.minLabel : ''"
        :max-label="has ? readings.width.value.maxLabel : ''"
        :marks="has ? readings.widthMarks.value : undefined"
        :off-body="offBody"
        doubling
        testid="convert-width"
        @update:model-value="wizard.setWidth"
      >
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
      </ValueSlider>
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

    <section ref="colorsEl" class="convert-column__section">
      <ValueSlider
        :label="words.colorsLabel"
        :model-value="wizard.maxColors.value"
        :min="MIN_IMAGE_COLORS"
        :max="wizard.colorsMax.value"
        :value="has ? colorsValue : NONE"
        :valuetext="has ? colorsValue : NONE"
        :min-label="has ? String(MIN_IMAGE_COLORS) : ''"
        :max-label="has ? colorsMaxLabel : ''"
        :marks="has ? colorsMarks : undefined"
        :off-body="offBody"
        doubling
        testid="convert-colors-slider"
        @update:model-value="wizard.setMaxColors"
      >
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
      </ValueSlider>
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

@media (max-width: 63.99rem), (orientation: portrait) {
  .convert-column {
    border-left: 0;
  }
}
</style>
