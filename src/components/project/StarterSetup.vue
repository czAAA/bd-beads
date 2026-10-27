<script setup lang="ts">
import { computed, ref } from 'vue'
import { DEFAULT_BEAD, findBead, offeredBeads } from '../../domain/beads'
import { customFrameSize, frameKindOf, sizeSettingOf } from '../../domain/frameKind'
import { resolveProjectBead, type Project } from '../../domain/project'
import { estimatedSizeMm, formatSizeMm } from '../../domain/projectSize'
import { starterBeadCount, type Starter, type StarterChoice } from '../../domain/starters'
import { plural } from '../../i18n/plural'
import { starterSizeWords } from '../../i18n/starterWords'
import { useI18n } from '../../i18n/useI18n'
import AppNote from '../ui/AppNote.vue'
import AppStepper from '../ui/form/AppStepper.vue'
import FormField from '../ui/form/FormField.vue'
import SegmentedControl from '../ui/form/SegmentedControl.vue'
import TextField from '../ui/form/TextField.vue'
import BeadPicker from './BeadPicker.vue'
import StarterPicture from './StarterPicture.vue'

// A Starter's setup (ticket 0596; StarterGallery card, Setup), the level under its card: the large live picture, Name
// and Bead on New Project only, Use design or Start empty, its size with the usual sizes as chips, and the Estimated
// size. The panel's pinned footer submits it. A design is made for one size, so changing the size turns it off.
const props = defineProps<{ starter: Starter; project?: Project }>()
const emit = defineEmits<{ submit: [choice: StarterChoice & { name: string; beadId: string }] }>()

const { t, locale } = useI18n()

const name = ref('')
const beadId = ref(DEFAULT_BEAD.id)
const size = ref(props.starter.size)
const useDesign = ref(true)
/** Use design was turned off by a size change, not chosen off, so setting the size back turns it on again. */
const offBySize = ref(false)

const setting = computed(() => sizeSettingOf({ kind: props.starter.kind })!)
const words = computed(() => t.value.frame.sizeSettings[props.starter.setting])
const optionName = computed(() => t.value.frame.customKinds[props.starter.kind])

function setSize(value: number) {
  size.value = Math.min(setting.value.max, Math.max(setting.value.min, Math.round(value) || props.starter.size))
  if (size.value !== props.starter.size && useDesign.value) {
    useDesign.value = false
    offBySize.value = true
  } else if (size.value === props.starter.size && offBySize.value) {
    useDesign.value = true
    offBySize.value = false
  }
}

/** Use design puts back the design's own size; Start empty keeps the size as it is. */
function setDesign(value: 'design' | 'empty') {
  offBySize.value = false
  useDesign.value = value === 'design'
  if (useDesign.value) size.value = props.starter.size
}

const designOptions = computed(() => [
  { value: 'design' as const, label: t.value.starters.useDesign },
  { value: 'empty' as const, label: t.value.starters.startEmpty },
])

/** Why the design is off: a size change, which setting it back undoes, or Start empty chosen. */
const note = computed(() => {
  if (useDesign.value) return undefined
  if (!offBySize.value) return t.value.starters.emptyNote
  return t.value.starters.designOffNote.replace('{size}', starterSizeWords(t.value, locale.value, props.starter, props.starter.size))
})

const bead = computed(() => (props.project ? resolveProjectBead(props.project) : findBead(beadId.value)))

/** The Frame's Estimated size with the Bead: its shape's bounding size. */
const estimate = computed(() => {
  if (!bead.value) return ''
  const settings = { [props.starter.setting]: size.value }
  const technique = frameKindOf({ kind: props.starter.kind }).custom!.technique
  const mm = estimatedSizeMm({ ...customFrameSize(props.starter.kind, settings), technique, kind: props.starter.kind, settings }, bead.value)
  return formatSizeMm(mm, { mm: t.value.form.unitMm, cm: t.value.form.unitCm }, locale.value)
})
const count = computed(() => plural(locale.value, starterBeadCount(props.starter, size.value), t.value.starters.beads))

const pictureName = computed(() => (useDesign.value ? t.value.starters.pictureWithDesign : t.value.starters.pictureEmpty).replace('{option}', optionName.value))

function onSubmit() {
  emit('submit', { size: size.value, useDesign: useDesign.value, name: name.value.trim() || optionName.value, beadId: props.project?.beadId ?? beadId.value })
}
</script>

<template>
  <form id="starter-setup-form" class="starter-setup" novalidate data-testid="starter-setup" @submit.prevent="onSubmit">
    <div class="starter-setup__picture" role="img" :aria-label="pictureName" data-testid="starter-setup-picture">
      <StarterPicture :starter="starter" :size="size" :design="useDesign" :bead-id="bead?.id" :drawn-px="320" />
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

    <div class="starter-setup__size">
      <span id="starter-size-label" class="starter-setup__label" data-testid="starter-size-label">
        <span>{{ words.label }}</span>
        <span class="starter-setup__hint">{{ t.starters.hints[starter.kind] }}</span>
      </span>
      <div class="starter-setup__controls">
        <AppStepper
          :model-value="size"
          :min="setting.min"
          :max="setting.max"
          :value-label="words.label"
          :decrease-label="words.less"
          :increase-label="words.more"
          decrease-testid="starter-size-decrease"
          increase-testid="starter-size-increase"
          value-testid="starter-size-value"
          @update:model-value="setSize"
        />
        <div class="starter-setup__presets" role="group" :aria-label="t.starters.presetsLabel">
          <button
            v-for="preset in starter.presets"
            :key="preset"
            class="starter-setup__chip"
            type="button"
            :aria-pressed="size === preset"
            :data-testid="`starter-size-preset-${preset}`"
            @click="setSize(preset)"
          >
            {{ preset }}
            <span v-if="preset === starter.size" class="starter-setup__dot"><span class="starter-setup__hidden">{{ t.starters.designSize }}</span></span>
          </button>
        </div>
      </div>
    </div>

    <div class="starter-setup__estimate" role="group" :aria-label="t.size.estimateLabel">
      <p class="starter-setup__estimate-row">
        <span>{{ t.size.estimateLabel }}</span>
        <strong data-testid="starter-estimate">{{ estimate }}</strong>
      </p>
      <p class="starter-setup__count" data-testid="starter-count">{{ count }}</p>
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
