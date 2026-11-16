<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useConvertColorsReadings } from '../../composables/import/useConvertColorsReadings'
import { useConvertFootLines } from '../../composables/import/useConvertFootLines'
import { useConvertImageWizardState, type ConvertPopover } from '../../composables/import/useConvertImageWizard'
import { useConvertNeighbours } from '../../composables/import/useConvertNeighbours'
import { useConvertSizeReadings } from '../../composables/import/useConvertSizeReadings'
import { beadLabel, offeredBeads } from '../../domain/beads'
import type { ConvertLayout } from '../../domain/convertLayout'
import { fillBlanks } from '../../domain/fillBlanks'
import { plural } from '../../i18n/plural'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import BeadSection from '../project/BeadSection.vue'
import TechniqueSection from '../project/TechniqueSection.vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import FormField from '../ui/form/FormField.vue'
import ConvertBackgroundSection from './ConvertBackgroundSection.vue'
import ConvertCleanUpSection from './ConvertCleanUpSection.vue'
import ConvertColorsNeighbours from './ConvertColorsNeighbours.vue'
import ConvertColorsSection from './ConvertColorsSection.vue'
import ConvertColorsSlider from './ConvertColorsSlider.vue'
import ConvertLightingSection from './ConvertLightingSection.vue'
import ConvertPictureSection from './ConvertPictureSection.vue'
import ConvertSheet from './ConvertSheet.vue'
import ConvertSizeSection from './ConvertSizeSection.vue'
import ConvertWidthSlider from './ConvertWidthSlider.vue'

// The dock of the docked converter (ConvertImage card DS-4, ticket 0911), on a Phone, a Tablet or Side: the result, the five
// settings (Picture, Bead, Width, Colors, Clean up) and Create Project; a setting's press opens its sheet in the dock's
// place (the Tablet's stays under its card). The beads above keep what room the sheet leaves them.
const props = defineProps<{ layout: Exclude<ConvertLayout, 'desktop'> }>()
const emit = defineEmits<{ paste: []; create: [] }>()

const { t, locale } = useI18n()
const wizard = useConvertImageWizardState()
const words = computed(() => t.value.convertImage.wizard)
const { lines, heard, ready, buttonLabel } = useConvertFootLines()
const readings = useConvertSizeReadings(wizard)
const has = computed(() => wizard.hasPicture.value)
const { matchedLine } = useConvertColorsReadings()
const open = computed(() => wizard.popover.value)
const create = () => emit('create')

type Setting = 'picture' | 'bead' | 'width' | 'colors-count' | 'clean-up'
const SETTING_ICONS = { picture: 'image', bead: 'bead', width: 'size', 'colors-count': 'palette', 'clean-up': 'clean-up' } as const

const beadName = computed(() => `${beadLabel(wizard.bead.value)} · ${techniqueName(t.value, wizard.technique.value)}`)
/** What each setting holds now, for its accessible name ("Width: 60 beads"); none before a picture. */
const values = computed<Record<Setting, string>>(() => {
  const cleaned = wizard.cleanUp.cleaned.value
  return {
    picture: wizard.fileName.value,
    bead: beadName.value,
    width: has.value ? readings.width.value.valuetext : '',
    'colors-count': has.value ? plural(locale.value, wizard.maxColors.value, words.value.colorsCount) : '',
    'clean-up': has.value && wizard.cleanUp.on.value && cleaned > 0 ? plural(locale.value, cleaned, words.value.cleanUp.cleaned) : '',
  }
})
const names = computed<Record<Setting, string>>(() => ({
  picture: words.value.dockPicture,
  bead: words.value.dockBead,
  width: t.value.form.widthLabel,
  'colors-count': words.value.colorsLabel,
  'clean-up': words.value.cleanUp.title,
}))
const SETTINGS: Setting[] = ['picture', 'bead', 'width', 'colors-count', 'clean-up']
/** The sheets a setting owns: its own, and the ones its "More for ..." buttons lead to. */
const OWNS: Record<Setting, ConvertPopover[]> = {
  picture: ['picture', 'lighting'],
  bead: ['bead'],
  width: ['width', 'size'],
  'colors-count': ['colors-count', 'colors'],
  'clean-up': ['clean-up'],
}
const owner = (popover: ConvertPopover | undefined) => SETTINGS.find((setting) => popover !== undefined && OWNS[setting].includes(popover))
const isOpen = (setting: Setting) => owner(open.value) === setting
const off = (setting: Setting) => !has.value && setting !== 'bead'
const settingName = (setting: Setting) => {
  const value = values.value[setting]
  // The Bead's setting is shortened on the dock; its name and its sheet's title stay whole (DS-4).
  const name = setting === 'bead' ? words.value.sheetBeadAndTechnique : names.value[setting]
  return value ? fillBlanks(words.value.settingName, { setting: name, value }) : name
}

const root = computed(() => (typeof document === 'undefined' ? undefined : document))
const settingButton = (setting: Setting | undefined) => root.value?.querySelector<HTMLElement>(`[data-setting="${setting}"]`) ?? undefined
/** The setting whose sheet was open last: its button is where focus goes back to once the sheet has closed. */
const lastOwner = ref<Setting>()
watch(open, (now) => {
  const setting = owner(now)
  if (setting) lastOwner.value = setting
  else if (now === 'background') lastOwner.value = undefined
})
const opener = () =>
  (open.value === 'background' ? root.value?.querySelector<HTMLElement>('[data-testid="convert-tool-background"]') : settingButton(owner(open.value) ?? lastOwner.value)) ?? undefined
/** The Background tool's taps and drags on the beads go on while its sheet is open. */
const onBeads = (event: PointerEvent) => event.target instanceof Element && !!event.target.closest('[data-testid="convert-image-box"]')

const sheetTitle = computed(() => {
  switch (open.value) {
    case 'size':
      return words.value.sizeTitle
    case 'colors':
      return words.value.colorsLabel
    case 'lighting':
      return words.value.lighting.title
    case 'background':
      return words.value.removeBackground
    case 'bead':
      return words.value.sheetBeadAndTechnique
    case undefined:
      return ''
    default:
      return names.value[owner(open.value) ?? 'picture']
  }
})

/** The neighbours' card is a layer of its own over the sheet: its Escape or outside press closes the sheet too. */
async function closeFromNeighbours() {
  wizard.closePopover()
  await nextTick()
  settingButton(lastOwner.value)?.focus({ preventScroll: true })
}

/** A Phone and Side's sheet takes the dock's place; a Tablet's stands over its dock, which stays. */
const dockShown = computed(() => props.layout === 'tablet' || open.value === undefined)

// The Colors sheet's neighbours (DS-2, ticket 0904): the beads at one color fewer, the count and one more, always shown.
const neighbours = useConvertNeighbours({ count: wizard.maxColors, most: wizard.colorsMax, shown: computed(() => open.value === 'colors-count'), beadsAt: wizard.beadsAtColors, beadsShown: wizard.beadsShown })
const colorsRange = () => document.querySelector<HTMLElement>('[data-testid="convert-colors-slider-range"]') ?? undefined
const resultLine = computed(() => (lines.value ? `${lines.value.grid} · ${lines.value.measured}` : ''))
const phoneFirstLine = computed(() => (lines.value ? `${lines.value.grid} · ${lines.value.measured} · ${lines.value.colors}` : ''))
</script>

<template>
  <div class="convert-dock" :class="`convert-dock--${layout}`" :data-layout="layout" data-testid="convert-dock">
    <ConvertSheet
      v-if="open !== undefined"
      :layout="layout"
      :label="sheetTitle"
      :opener="opener"
      :keeps-press="open === 'background' ? onBeads : undefined"
      :flush="open === 'colors'"
      :testid="`convert-sheet-${open}`"
      @close="wizard.closePopover"
    >
      <div v-if="open === 'width'" class="convert-dock__width" data-testid="convert-sheet-width-body">
        <ConvertWidthSlider>
          <template #action>
            <IconButton icon="size" :label="words.moreForSize" aria-haspopup="dialog" data-testid="convert-size-more" @click="wizard.togglePopover('size')" />
          </template>
        </ConvertWidthSlider>
        <p class="convert-dock__readout" data-testid="convert-sheet-width-result">{{ resultLine }}</p>
      </div>
      <ConvertSizeSection v-else-if="open === 'size'" />
      <div v-else-if="open === 'colors-count'" class="convert-dock__colors" data-testid="convert-sheet-colors-body">
        <ConvertColorsSlider>
          <template #action>
            <IconButton icon="palette" :label="words.moreForColors" aria-haspopup="dialog" data-testid="convert-colors-more" @click="wizard.togglePopover('colors')" />
          </template>
        </ConvertColorsSlider>
        <ConvertColorsNeighbours
          :fewer="neighbours.fewer.value"
          :more="neighbours.more.value"
          :slider="colorsRange"
          :anchor="() => undefined"
          @close="closeFromNeighbours"
        />
        <p class="convert-dock__readout" data-testid="convert-matched">{{ matchedLine }}</p>
      </div>
      <ConvertColorsSection v-else-if="open === 'colors'" />
      <div v-else-if="open === 'bead'" class="convert-dock__bead">
        <FormField :label="t.form.beadLabel">
          <BeadSection :bead="wizard.bead.value" :candidates="offeredBeads()" @pick="wizard.beadId.value = $event" />
        </FormField>
        <TechniqueSection v-model:technique="wizard.technique.value" :settings="wizard.settings.value" testid="convert" @set-setting="wizard.setSetting" />
      </div>
      <ConvertPictureSection v-else-if="open === 'picture'" @paste="emit('paste')" />
      <ConvertLightingSection v-else-if="open === 'lighting'" />
      <ConvertBackgroundSection v-else-if="open === 'background'" />
      <ConvertCleanUpSection v-else-if="open === 'clean-up'" />
    </ConvertSheet>

    <div v-if="dockShown" class="convert-dock__bar" data-testid="convert-foot">
      <div class="convert-dock__result" role="region" :aria-label="words.resultLabel">
        <template v-if="lines">
          <p v-if="layout !== 'phone'" class="convert-dock__line convert-dock__line--muted" data-testid="convert-project-line">
            {{ wizard.addsToCanvas ? words.footAddsTo : words.footProject }} {{ wizard.projectName.value }}
          </p>
          <p v-else-if="wizard.addsToCanvas" class="convert-dock__line convert-dock__line--body" data-testid="convert-project-line">
            {{ words.footAddsTo }} · {{ wizard.projectName.value }}
          </p>
          <p v-if="layout === 'phone'" class="convert-dock__line" data-testid="convert-result" aria-hidden="true">{{ phoneFirstLine }}</p>
          <template v-else>
            <p class="convert-dock__line" data-testid="convert-result" aria-hidden="true">{{ resultLine }}</p>
            <p class="convert-dock__line" aria-hidden="true">{{ lines.colors }}</p>
          </template>
          <p class="convert-dock__line convert-dock__line--muted" aria-hidden="true" data-testid="convert-result-beads">{{ lines.beads }}</p>
        </template>
        <p v-else class="convert-dock__line convert-dock__line--muted" data-testid="convert-result-none">{{ wizard.reading.value ? words.readingLine : words.bandEmpty }}</p>
        <p class="convert-dock__heard" role="status" data-testid="convert-result-heard">{{ heard }}</p>
      </div>

      <div class="convert-dock__settings" role="group" :aria-label="words.settingsLabel">
        <AppTooltip
          v-for="setting in SETTINGS"
          :key="setting"
          :name="names[setting]"
          :disabled="off(setting)"
          :disabled-body="words.addPictureFirst"
          :announce="false"
          class="convert-dock__tip"
        >
          <button
            type="button"
            class="ui-control convert-dock__setting"
            :class="{ 'convert-dock__setting--open': isOpen(setting), 'convert-dock__setting--off': off(setting) }"
            :aria-label="settingName(setting)"
            aria-haspopup="dialog"
            data-wrap-ok
            :aria-expanded="isOpen(setting)"
            :aria-disabled="off(setting) || undefined"
            :data-setting="setting"
            :data-testid="`convert-setting-${setting}`"
            @click="!off(setting) && wizard.togglePopover(setting)"
          >
            <AppIcon :name="SETTING_ICONS[setting]" :size="18" />
            <span class="convert-dock__setting-name">{{ names[setting] }}</span>
          </button>
        </AppTooltip>
      </div>

      <AppButton
        variant="primary"
        class="convert-dock__create"
        :disabled="!ready"
        :disabled-body="words.addPictureFirst"
        :label="buttonLabel"
        data-testid="convert-image-create"
        @click="create"
      >
        {{ buttonLabel }}
      </AppButton>
    </div>
  </div>
</template>

<style scoped>
.convert-dock {
  position: relative;
  z-index: var(--convert-layer-popover);
  flex: none;
  box-sizing: border-box;
  min-width: 0;
}

/* On a Phone the dock gives way to the beads' half (the page's half rule), and its sheet with it. */
.convert-dock--phone {
  display: flex;
  flex: 0 1 auto;
  flex-direction: column;
  min-height: 0;
}

.convert-dock__bar {
  background: var(--canvas);
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
  box-sizing: border-box;
  padding: var(--space-10) var(--space-16) calc(var(--space-12) + env(safe-area-inset-bottom));
}

.convert-dock__result {
  min-height: calc(var(--space-32) + var(--space-4));
}

.convert-dock__line {
  margin: 0;
  font: var(--type-meta);
  color: var(--ink);
  overflow-wrap: anywhere;
}

.convert-dock__line--muted {
  color: var(--muted);
}

.convert-dock__line--body {
  font: var(--type-body);
}

.convert-dock__heard {
  position: absolute;
  width: 1px;
  height: 1px;
  margin: -1px;
  overflow: hidden;
  clip-path: inset(50%);
}

.convert-dock__settings {
  display: flex;
  gap: var(--space-2);
}

.convert-dock__tip {
  flex: 1 1 0;
  min-width: 0;
}

.convert-dock__setting {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  align-items: center;
  justify-content: flex-start;
  box-sizing: border-box;
  width: 100%;
  height: var(--convert-settings-height);
  padding: var(--space-8) var(--space-2) 0;
  font: var(--type-small);
  color: var(--ink);
  text-align: center;
  background: none;
  border: 0;
  border-radius: var(--radius-md);
}

.convert-dock__setting-name {
  overflow-wrap: anywhere;
}

.convert-dock__setting:hover {
  background: color-mix(in srgb, var(--ink) 6%, transparent);
}

.convert-dock__setting:active {
  background: color-mix(in srgb, var(--ink) 12%, transparent);
}

.convert-dock__setting--open,
.convert-dock__setting--open:hover {
  color: var(--canvas);
  background: var(--ink);
}

.convert-dock__setting--off {
  color: var(--faint);
}

.convert-dock__create {
  width: 100%;
  min-height: var(--touch-target);
}

.convert-dock__width,
.convert-dock__colors,
.convert-dock__bead {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.convert-dock__readout {
  margin: 0;
  font: var(--type-meta);
  color: var(--muted);
}

/* A Phone's and a Tablet's dock has a line on top where the preview ends (the bar's, so a sheet adds no height). */
.convert-dock--phone .convert-dock__bar,
.convert-dock--tablet .convert-dock__bar {
  border-top: 1px solid var(--panel-rule);
}

/* A Tablet's dock is one row: the result, the five settings, Create Project (DS-4). */

.convert-dock--tablet .convert-dock__bar {
  flex-direction: row;
  gap: var(--space-16);
  align-items: center;
  padding: var(--space-12) var(--space-24) calc(var(--space-12) + env(safe-area-inset-bottom));
}

.convert-dock--tablet .convert-dock__result {
  flex: 0 1 calc(var(--space-32) * 7 + var(--space-16));
  min-width: 0;
}

.convert-dock--tablet .convert-dock__settings {
  flex: 1 1 0;
  min-width: 0;
  max-width: calc(var(--space-32) * 10 + var(--space-20));
  margin-inline: auto;
}

.convert-dock--tablet .convert-dock__create {
  flex: none;
  width: calc(var(--space-32) * 5 + var(--space-20));
}

/* Side's column at the right: 320 wide, the three result lines at the top, the settings and Create Project under. */
.convert-dock--side {
  display: flex;
  flex-direction: column;
  width: var(--convert-side-column-width);
  padding-inline-end: env(safe-area-inset-right);
  border-left: 1px solid var(--panel-rule);
}

.convert-dock--side .convert-dock__bar {
  flex: 1;
  justify-content: space-between;
  padding: var(--space-12) var(--space-16) calc(var(--space-12) + env(safe-area-inset-bottom));
}

.convert-dock--side .convert-dock__settings {
  flex-wrap: wrap;
}

.convert-dock--side .convert-dock__tip {
  flex: 1 1 calc(100% / 3 - var(--space-2));
}
</style>
