<script setup lang="ts">
import { computed, inject, onMounted, ref, watch } from 'vue'
import { DEFAULT_BEAD, beadLabel, findBead, offeredBeads } from '../../domain/beads'
import type { CreateProjectInput } from '../../domain/createProject'
import { DEFAULT_BEAD_SHAPE, DEFAULT_TECHNIQUE, weaveSettings, type BeadShape, type Technique, type TechniqueSettings } from '../../domain/weave'
import { formatImageLimits } from '../../domain/imageConversion'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useI18n } from '../../i18n/useI18n'
import BeadSection from './BeadSection.vue'
import NamesSection from './NamesSection.vue'
import TechniqueSection from './TechniqueSection.vue'
import AppButton from '../ui/AppButton.vue'
import FormField from '../ui/form/FormField.vue'
import { PANEL_CONTEXT } from '../shell/panelContext'

const { t } = useI18n()

const emit = defineEmits<{
  submit: [payload: CreateProjectInput]
  // The form's current values, emitted on any change (and once on mount): what a picture dropped on the app later
  // opens Convert image on (spec 0645).
  draft: [payload: CreateProjectInput]
  /** Convert image (spec 0645): the wizard opens on a copy of the form's values. */
  'convert-image': [payload: CreateProjectInput]
}>()

const name = ref('')
const beadId = ref(DEFAULT_BEAD.id)
const technique = ref<Technique>(DEFAULT_TECHNIQUE)
/** The Bead shape (ADR 0068, ticket 508): how the Canvas draws each cell. */
const beadShape = ref<BeadShape>(DEFAULT_BEAD_SHAPE)
/** The Technique settings' values by id (tickets 477, 485, 0626): each kept while another Technique is chosen, used by
 * the Technique that describes it only; one never changed is its default. */
const settings = ref<TechniqueSettings>({})
/** The chosen Technique's settings at their values, each within its range. */
const techniqueSettings = computed(() => weaveSettings({ technique: technique.value, techniqueSettings: settings.value }))
/** This Project's own maker's name (ticket 182): blank by default regardless of the device-wide value it overrides. */
const makerName = ref('')

const names = ref<InstanceType<typeof NamesSection>>()

/** Focuses and selects the Name (ticket 181), to encourage naming; on a touch device it waits for a tap, so the
 * keyboard stays down (ticket 515). */
function focusName() {
  names.value?.focusName()
}
defineExpose({ focusName })
onMounted(focusName)

const selectedBead = computed(() => findBead(beadId.value))
const namePlaceholder = computed(() => (selectedBead.value ? beadLabel(selectedBead.value, t.value.formFactors) : ''))

const panel = inject(PANEL_CONTEXT, undefined)

/** Pick a starter (ticket 0596): the Starter gallery's first step, one level deeper; Back brings focus back here. */
function pickStarter() {
  panel?.openSub(t.value.starters.title, { opener: 'pick-starter' })
}

/** What Create Project makes: a Canvas, its size set later in the Frame section (ticket 342). */
function currentInput(): CreateProjectInput {
  return {
    name: name.value.trim(),
    technique: technique.value,
    ...(Object.keys(techniqueSettings.value).length > 0 ? { techniqueSettings: techniqueSettings.value } : {}),
    beadId: beadId.value,
    ...(beadShape.value !== DEFAULT_BEAD_SHAPE ? { beadShape: beadShape.value } : {}),
    makerName: makerName.value.trim(),
  }
}

watch([name, beadId, beadShape, technique, settings, makerName], () => emit('draft', currentInput()), { immediate: true })

function onSubmit() {
  emit('submit', currentInput())
}

const convertAction = controlAction('convert-image')

/** The limits, filled in from the constants the validation enforces (see formatImageLimits), always under the button. */
const limitsHint = computed(() => formatImageLimits(t.value.convertImage.limitsHint))
</script>

<template>
  <!--
    The New Project form (ticket 149; NewProjectForm card), in the Menu panel's subpanel: the Open canvas title and what
    it is for, Name (optional), Maker's name (ticket 182, also optional), Bead and Technique (the sections the Project
    panel shares, ticket 568), then three accent buttons: Create Project, Convert image and Pick a starter. It states no
    size (ticket 342): a Project starts as a Canvas and its size is set in the Frame sheet. Convert image opens its own
    popup on a copy of these values (spec 0645).
  -->
  <form id="new-project-form" class="new-project-form" novalidate @submit.prevent="onSubmit">
    <header class="new-project-form__head">
      <h2 class="new-project-form__title" data-testid="open-canvas-title">{{ t.form.openCanvasTitle }}</h2>
      <p class="new-project-form__subtitle">{{ t.form.openCanvasSubtitle }}</p>
    </header>

    <NamesSection ref="names" v-model:name="name" v-model:maker-name="makerName" :name-placeholder="namePlaceholder" />

    <FormField :label="t.form.beadLabel" label-id="bead-label">
      <BeadSection v-model:bead-shape="beadShape" :bead="selectedBead" :candidates="offeredBeads()" @pick="beadId = $event" />
    </FormField>

    <TechniqueSection
      v-model:technique="technique"
      :settings="settings"
      testid="new-project"
      @set-setting="(id, value) => (settings = { ...settings, [id]: value })"
    />

    <AppButton class="new-project-form__submit" type="submit" variant="primary" icon="plus" data-testid="create-project">
      {{ t.form.submit }}
    </AppButton>

    <!--
      Convert image (CONTEXT.md, ADR 0010) as the form's second way out: a picture instead of an empty canvas, in the
      Convert image wizard (spec 0645). The limits are always written under it.
    -->
    <p class="new-project-form__or" aria-hidden="true">{{ t.form.or }}</p>
    <div class="new-project-form__convert" data-testid="convert-image-field">
      <AppButton
        class="new-project-form__convert-button"
        variant="primary"
        icon="image"
        :action="convertAction"
        data-testid="convert-image"
        @click="emit('convert-image', currentInput())"
      >
        {{ t.convertImage.fileLabel }}
      </AppButton>
      <p class="new-project-form__hint" data-testid="convert-image-limits">{{ limitsHint }}</p>
    </div>

    <p class="new-project-form__or" aria-hidden="true">{{ t.form.or }}</p>
    <div class="new-project-form__starters">
      <AppButton variant="primary" icon="frame" data-testid="pick-starter" @click="pickStarter">
        {{ t.form.pickStarter }}
      </AppButton>
    </div>
  </form>
</template>

<style scoped>
/* Its Tooltip wraps it (AppButton), so the class lands inside the wrapper, out of this file's scope (ticket 0679). */
.new-project-form__convert :deep(.new-project-form__convert-button) {
  width: 100%;
  height: var(--field-height);
}

.new-project-form__head {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.new-project-form__title {
  margin: 0;
  font: var(--type-title);
  color: var(--ink);
}

.new-project-form__subtitle {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

.new-project-form__starters {
  display: flex;
  flex-direction: column;
  gap: var(--space-8);
}

.new-project-form__starters > :first-child {
  width: 100%;
  height: var(--field-height);
}

.new-project-form {
  display: flex;
  flex-direction: column;
  gap: var(--space-16);
}

.new-project-form__submit {
  width: 100%;
  height: var(--field-height);
}

/* "or", between two rules. */
.new-project-form__or {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
  font: var(--type-meta-small);
  color: var(--muted);
}

.new-project-form__or::before,
.new-project-form__or::after {
  flex: 1;
  height: 1px;
  content: '';
  background: var(--panel-rule);
}

.new-project-form__convert {
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.new-project-form__hint {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

</style>
