<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { DEFAULT_BEAD, findBead, offeredBeads } from '../../domain/beads'
import { frameShapeOf, type FrameSettingName } from '../../domain/frameShape'
import { layerOf } from '../../domain/layerRecord'
import type { Project } from '../../domain/project'
import { formatMm, formatSizeMm } from '../../domain/projectSize'
import {
  BAND_CLASP_MM,
  designDifferences,
  designFits,
  designPicks,
  designSizes,
  euRingSize,
  starterBeadCount,
  starterMeasure,
  starterSizeRanges,
  US_RING_PRESETS,
  usRingSize,
  type Starter,
  type StarterChoice,
  type StarterPick,
  type StarterPickName,
  type StarterSize,
  type StarterSizeName,
} from '../../domain/starters'
import { plural } from '../../i18n/plural'
import { designWords, starterCountWords, starterName } from '../../i18n/starterWords'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import FormField from '../ui/form/FormField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'
import BeadPicker from './BeadPicker.vue'
import StarterPicture from './StarterPicture.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// A Starter's setup (tickets 0596, 0597; StarterGallery card, Setup): the live picture, Name and Bead on New Project only,
// Use design or Start empty, its sizes with chips and its choices, a Ring's Size system, and the Estimated size. The
// footer submits it. Moving any size or choice off the design turns it off; setting them all back turns it on.
const props = defineProps<{ starter: Starter; project?: Project }>()
const emit = defineEmits<{ submit: [choice: StarterChoice & { name: string; beadId: string }] }>()

const { t, locale } = useI18n()

const name = ref('')
const beadId = ref(DEFAULT_BEAD.id)
const sizes = reactive(designSizes(props.starter))
const picks = reactive(designPicks(props.starter))
const useDesign = ref(true)
/** Use design was turned off by a size or choice, not chosen off, so setting them back turns it on again. */
const offByChange = ref(false)
/** How a Ring size is shown and stepped: a view of the one size, kept in EU (not a size of the design). */
const system = ref<'eu' | 'us'>('eu')

const optionName = computed(() => starterName(t.value, props.starter))
const choice = computed<StarterChoice>(() => ({ sizes: { ...sizes }, picks: { ...picks }, useDesign: useDesign.value }))

/** Turns the design off when the sizes and choices leave it, and back on when they all return to it. */
function followDesign() {
  const fits = designFits(props.starter, choice.value)
  if (!fits && useDesign.value) {
    useDesign.value = false
    offByChange.value = true
  } else if (fits && offByChange.value) {
    useDesign.value = true
    offByChange.value = false
  }
}

/** Whether a size is the Ring size shown in US sizes. */
const inUs = (size: StarterSize) => size.id === 'ringSize' && system.value === 'us'

/** A size's value as its stepper shows it: a Ring size in the Size system chosen. */
function shownValue(size: StarterSize): number {
  const value = sizes[size.id] ?? size.default
  return inUs(size) ? usRingSize(value) : value
}

/** A size set from its stepper or a chip, within its range, and every size after it kept within its own (Top rows
 * within a narrower Top width). A Ring size set in US is kept as the whole EU size it comes to. */
function setSize(size: StarterSize, shown: number) {
  const range = starterSizeRanges(props.starter, sizes)[size.id]!
  const eu = inUs(size) ? euRingSize(shown) : shown
  if (!Number.isFinite(eu)) return
  sizes[size.id] = Math.min(range.max, Math.max(range.min, Math.round(eu)))
  const ranges = starterSizeRanges(props.starter, sizes)
  for (const each of props.starter.sizes) sizes[each.id] = Math.min(ranges[each.id]!.max, sizes[each.id] ?? each.default)
  followDesign()
}

function setPick(pick: StarterPick, value: string) {
  picks[pick.id] = value
  followDesign()
}

/** Use design puts back the design's own sizes and choices; Start empty keeps them as they are. */
function setDesign(value: 'design' | 'empty') {
  offByChange.value = false
  useDesign.value = value === 'design'
  if (useDesign.value) {
    Object.assign(sizes, designSizes(props.starter))
    Object.assign(picks, designPicks(props.starter))
  }
}

const designOptions = computed(() => [
  { value: 'design' as const, label: t.value.starters.useDesign },
  { value: 'empty' as const, label: t.value.starters.startEmpty },
])
const systemOptions = computed(() => [
  { value: 'eu' as const, label: t.value.starters.sizeSystem.eu },
  { value: 'us' as const, label: t.value.starters.sizeSystem.us },
])

/** Why the design is off: a size or choice changed, which setting it back undoes, or Start empty chosen. */
const note = computed(() => {
  if (useDesign.value) return undefined
  if (!offByChange.value) return t.value.starters.emptyNote
  const differences = designDifferences(props.starter, choice.value)
  const template = differences.every((each) => 'pick' in each) ? t.value.starters.designOffChoiceNote : t.value.starters.designOffNote
  return fillBlanks(template, { size: designWords(t.value, locale.value, props.starter, differences) })
})

/** What one row of settings is: a size's stepper and chips, a choice, or the Ring size's Size system. */
type Row = { size: StarterSize } | { pick: StarterPick } | { system: true }

/** The setup's settings in the card's order: each size, a choice before the size it names or after them all, and the
 * Size system before the Ring size. */
const rows = computed<Row[]>(() => {
  const { sizes: all, picks: chosen } = props.starter
  const ordered: Row[] = []
  for (const size of all) {
    for (const pick of chosen) if (pick.before === size.id) ordered.push({ pick })
    if (size.id === 'ringSize') ordered.push({ system: true })
    ordered.push({ size })
  }
  return [...ordered, ...chosen.filter((pick) => !pick.before).map((pick) => ({ pick }))]
})

/** A size's words: a setting of the Starter's Frame shape its words from the Frame panel, a Ring's or Band's its own; its hint
 * beside it. */
function sizeWords(size: StarterSize): { label: string; less: string; more: string; hint: string } {
  const custom = frameShapeOf(props.starter)?.settings.some((setting) => setting.id === size.id) ?? false
  const words = custom ? t.value.frame.sizeSettings[size.labelKey as FrameSettingName] : t.value.starters.setupSizes[size.labelKey as 'width' | 'ringSize' | 'wrist']
  const hints = t.value.starters.sizeHints as Partial<Record<StarterSizeName | 'ringSizeUs', string>>
  const hint = size === props.starter.sizes[0] && custom ? t.value.starters.hints[props.starter.shape!] : hints[inUs(size) ? 'ringSizeUs' : size.id]
  return { label: words.label, less: words.less, more: words.more, hint: hint ?? '' }
}

/** A size's stepper range and step as shown: a Ring size in US goes by halves. */
function stepperOf(size: StarterSize): { min: number; max: number; stepBy: number } {
  const { min, max } = starterSizeRanges(props.starter, sizes)[size.id]!
  return inUs(size) ? { min: usRingSize(min), max: usRingSize(max), stepBy: 0.5 } : { min, max, stepBy: 1 }
}

/** A size's chips: the usual sizes its range allows now, US sizes for a Ring size shown in US. */
function presetsOf(size: StarterSize): readonly number[] {
  const { min, max } = stepperOf(size)
  return (inUs(size) ? US_RING_PRESETS : size.presets).filter((preset) => preset >= min && preset <= max)
}

/** Whether a chip is the design's own size. */
const designChip = (size: StarterSize, preset: number) => (inUs(size) ? preset === usRingSize(size.default) : preset === size.default)

const pickOptions = (pick: StarterPick) =>
  pick.values.map((value) => ({ value, label: (t.value.starters.picks[pick.id as StarterPickName].options as Record<string, string>)[value] ?? value }))

/** The open Project's Canvas (ADR 0079): its Bead is the one the Starter's Frame is made in. */
const projectCanvas = computed(() => props.project && layerOf(props.project, 'canvas'))
const bead = computed(() => (projectCanvas.value ? projectCanvas.value.bead : findBead(beadId.value)))

/** The Estimated size and the lines under it (StarterGallery card, Setup 5): a Shape's or earring's width × height, a
 * Ring's inside and width, a Band's width × length; the bead count, a pair's, and a Ring's or Band's rows. */
const estimate = computed(() => {
  if (!bead.value) return { value: '', lines: [] as string[] }
  const words = t.value.starters
  const units = { mm: t.value.form.unitMm, cm: t.value.form.unitCm }
  const measure = starterMeasure(props.starter, choice.value, bead.value)
  const count = starterCountWords(t.value, locale.value, props.starter, choice.value, bead.value)
  if (measure.shape === 'ring') {
    const value = fillBlanks(words.ringEstimate, { inside: formatMm(measure.insideMm, locale.value), width: formatMm(measure.widthMm, locale.value) })
    return { value, lines: [count, plural(locale.value, measure.rows, words.rowsRound)] }
  }
  if (measure.shape === 'band') {
    const clasp = `${formatMm(BAND_CLASP_MM / 10, locale.value)} ${t.value.form.unitCm}`
    const value = formatSizeMm({ widthMm: measure.widthMm, heightMm: measure.lengthMm }, units, locale.value)
    return { value, lines: [count, plural(locale.value, measure.rows, words.bandRows), fillBlanks(words.claspLeft, { clasp })] }
  }
  const value = formatSizeMm(measure, units, locale.value)
  if (!props.starter.pair) return { value, lines: [count] }
  return { value, lines: [count, plural(locale.value, 2 * starterBeadCount(props.starter, choice.value, bead.value), words.forPair)] }
})

const pictureName = computed(() => fillBlanks(useDesign.value ? t.value.starters.pictureWithDesign : t.value.starters.pictureEmpty, { option: optionName.value }))

function onSubmit() {
  emit('submit', { ...choice.value, name: name.value.trim() || optionName.value, beadId: projectCanvas.value?.beadId ?? beadId.value })
}
</script>

<template>
  <form id="starter-setup-form" class="starter-setup" novalidate data-testid="starter-setup" @submit.prevent="onSubmit">
    <div class="starter-setup__picture" role="img" :aria-label="pictureName" data-testid="starter-setup-picture">
      <StarterPicture :starter="starter" :choice="choice" :bead-id="bead?.id" :drawn-px="320" />
    </div>

    <div v-if="!project" class="starter-setup__pair">
      <FormField :label="t.form.nameLabel" label-for="starter-name-input" :aside="t.form.optional">
        <TextField id="starter-name-input" v-model="name" data-testid="starter-name-input" type="text" :placeholder="optionName" />
      </FormField>
      <FormField :label="t.form.beadLabel" label-id="starter-bead-label">
        <BeadPicker v-model="beadId" :beads="offeredBeads()" testid="starter-bead-picker" />
      </FormField>
    </div>

    <FormField :label="t.starters.designLabel" label-id="starter-design-label">
      <SegmentedControl
        :model-value="useDesign ? 'design' : 'empty'"
        :options="designOptions"
        labelledby="starter-design-label"
        data-testid="starter-design"
        @update:model-value="setDesign"
      />
      <AppNote v-if="note" data-testid="starter-design-note">{{ note }}</AppNote>
    </FormField>

    <template v-for="row in rows" :key="'size' in row ? row.size.id : 'pick' in row ? row.pick.id : 'system'">
      <div v-if="'size' in row" class="starter-setup__size" :data-testid="`starter-size-${row.size.id}`">
        <span class="starter-setup__label" :data-testid="`starter-size-label-${row.size.id}`">
          <span>{{ sizeWords(row.size).label }}</span>
          <span class="starter-setup__hint">{{ sizeWords(row.size).hint }}</span>
        </span>
        <div class="starter-setup__controls">
          <AppStepper
            :model-value="shownValue(row.size)"
            :min="stepperOf(row.size).min"
            :max="stepperOf(row.size).max"
            :step-by="stepperOf(row.size).stepBy"
            :value-label="sizeWords(row.size).label"
            :decrease-label="sizeWords(row.size).less"
            :increase-label="sizeWords(row.size).more"
            :decrease-testid="`starter-size-decrease-${row.size.id}`"
            :increase-testid="`starter-size-increase-${row.size.id}`"
            :value-testid="`starter-size-value-${row.size.id}`"
            @update:model-value="setSize(row.size, $event)"
          />
          <div class="starter-setup__presets" role="group" :aria-label="t.starters.presetsLabel">
            <button
              v-for="preset in presetsOf(row.size)"
              :key="preset"
              class="starter-setup__chip"
              type="button"
              :aria-pressed="shownValue(row.size) === preset"
              :data-testid="`starter-size-preset-${row.size.id}-${preset}`"
              @click="setSize(row.size, preset)"
            >
              {{ preset }}
              <span v-if="designChip(row.size, preset)" class="starter-setup__dot"><span class="starter-setup__hidden">{{ t.starters.designSize }}</span></span>
            </button>
          </div>
        </div>
      </div>
      <FormField v-else-if="'pick' in row" :label="t.starters.picks[row.pick.id].label" :label-id="`starter-pick-label-${row.pick.id}`">
        <SegmentedControl
          :model-value="picks[row.pick.id] ?? row.pick.default"
          :options="pickOptions(row.pick)"
          :labelledby="`starter-pick-label-${row.pick.id}`"
          :data-testid="`starter-pick-${row.pick.id}`"
          @update:model-value="setPick(row.pick, $event)"
        />
      </FormField>
      <FormField v-else :label="t.starters.sizeSystem.label" label-id="starter-system-label">
        <SegmentedControl v-model="system" :options="systemOptions" labelledby="starter-system-label" data-testid="starter-size-system" />
      </FormField>
    </template>

    <div class="starter-setup__estimate" role="group" :aria-label="t.size.estimateLabel">
      <p class="starter-setup__estimate-row">
        <span>{{ t.size.estimateLabel }}</span>
        <strong data-testid="starter-estimate">{{ estimate.value }}</strong>
      </p>
      <p class="starter-setup__count" data-testid="starter-count">{{ estimate.lines.join(' · ') }}</p>
    </div>
  </form>
</template>

<style scoped>
.starter-setup {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

/* The large live picture (StarterGallery card, Setup 1). */
.starter-setup__picture {
  box-sizing: border-box;
  height: var(--starter-picture-height);
  overflow: hidden;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-lg);
}

/* Side by side where the panel has room (desktop and tablet), one above the other on a phone. */
.starter-setup__pair {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: var(--space-12);
}

.starter-setup__size {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.starter-setup__label {
  display: flex;
  gap: var(--space-8);
  justify-content: space-between;
  font: var(--type-control);
}

.starter-setup__hint {
  font: var(--type-meta);
  color: var(--muted);
}

.starter-setup__controls {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-8);
  align-items: center;
}

.starter-setup__presets {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-6);
}

.starter-setup__chip {
  position: relative;
  box-sizing: border-box;
  min-width: var(--item-height);
  height: var(--item-height);
  padding: 0 var(--space-10);
  font: var(--type-control);
  color: var(--ink);
  cursor: pointer;
  background: var(--elevated);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-md);
  font-variant-numeric: tabular-nums;
}

.starter-setup__chip:hover {
  background: var(--hover-fill);
}

.starter-setup__chip[aria-pressed='true'] {
  color: var(--on-accent);
  background: var(--accent);
  border-color: var(--accent);
}

.starter-setup__chip:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* The design's own size: a dot at the chip's top right. */
.starter-setup__dot {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  width: var(--starter-size-dot);
  height: var(--starter-size-dot);
  background: currentColor;
  border-radius: var(--radius-full);
}

.starter-setup__hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.starter-setup__estimate {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding: var(--space-10) var(--space-12);
  background: var(--surface);
  border-radius: var(--radius-lg);
}

.starter-setup__estimate-row {
  display: flex;
  gap: var(--space-8);
  justify-content: space-between;
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.starter-setup__estimate-row strong {
  font-family: var(--font-mono);
  font-weight: inherit;
  font-variant-numeric: tabular-nums;
}

.starter-setup__count {
  margin: 0;
  font: var(--type-meta);
  color: var(--muted);
  text-align: right;
}
</style>
