<script setup lang="ts">
import { computed } from 'vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { frameWeave } from '../../domain/layerWeave'
import type { Project } from '../../domain/project'
import type { Layer } from '../../domain/grid'
import type { Technique } from '../../domain/weave'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import NamesSection from './NamesSection.vue'
import TechniqueSection from './TechniqueSection.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// The head of the Project panel, always shown (ProjectPanel card, ticket 554): the `project:` title with the local save
// state, the Project's name and maker, and the one Technique control with its settings. It only asks; the shell works.
const props = defineProps<{
  project: Project
  saveFailed: boolean
  unsaved: boolean
}>()
const emit = defineEmits<{
  rename: [name: string]
  'save-maker-name': [name: string]
  save: []
  'set-technique': [technique: Technique]
  'set-canvas-technique': [technique: Technique]
  /** A setting of the woven layer's Technique (ticket 0626): the Frame's where there is one, else the Canvas's. */
  'set-weave-setting': [layer: Layer, id: string, value: number]
}>()

const { t } = useI18n()
const techniqueAction = controlAction('change-technique')
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const state = computed(() => (props.saveFailed ? 'failed' : props.unsaved ? 'unsaved' : 'saved'))
const stateText = computed(() =>
  state.value === 'saved'
    ? t.value.panels.project.savedLocal
    : state.value === 'unsaved'
      ? t.value.panels.project.notSavedYet
      : fillBlanks(t.value.panels.project.notSaved, { reason: t.value.panels.project.saveRefused }),
)

const weave = computed(() => frameWeave(props.project))
const locked = computed(() => !techniqueAction.enabled?.(deps.value))
/** A Project with a Frame weaves it (Row progress belongs to the Frame); one without weaves the Canvas. */
const hasFrame = computed(() => props.project.frame !== undefined)

function setTechnique(technique: Technique) {
  if (hasFrame.value) emit('set-technique', technique)
  else emit('set-canvas-technique', technique)
}

function setSetting(id: string, value: number) {
  emit('set-weave-setting', hasFrame.value ? 'frame' : 'canvas', id, value)
}
</script>

<template>
  <section class="project-head" role="group" :aria-label="project.name" data-testid="project-head">
    <div class="project-head__title">
      <span class="project-head__label">{{ t.panels.project.titleLabel }}</span>
      <!-- The save state (SaveStates card): the words are a polite live region so "Not saved" is announced; the icon and its Tooltip say the same. -->
      <div class="project-head__state" :class="`project-head__state--${state}`">
        <p class="project-head__text" role="status" aria-live="polite" data-testid="save-state" :class="`project-head__state--${state}`">{{ stateText }}</p>
        <IconButton v-if="state === 'failed'" variant="plain" icon="warning" :label="stateText" tooltip data-testid="save-try-again" @click="emit('save')" />
        <AppTooltip v-else :name="stateText" :announce="false">
          <span class="project-head__icon" aria-hidden="true" data-testid="save-icon">
            <AppIcon name="save" :size="16" />
            <span v-if="state === 'unsaved'" class="project-head__dot" />
          </span>
        </AppTooltip>
      </div>
    </div>

    <NamesSection
      class="project-head__lines"
      inline
      :name="project.name"
      :maker-name="project.makerName ?? ''"
      @update:name="emit('rename', $event)"
      @update:maker-name="emit('save-maker-name', $event)"
    />

    <TechniqueSection
      class="project-head__technique"
      testid="project"
      :technique="weave.technique"
      :settings="weave.techniqueSettings ?? {}"
      :disabled="locked"
      :technique-disabled-body="techniqueAction.disabledBody?.(t, deps)"
      @update:technique="setTechnique"
      @set-setting="setSetting"
    />
  </section>
</template>

<style scoped>
.project-head {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  padding: var(--space-4) var(--space-10) 0;
}

.project-head__title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
  min-height: var(--panel-item-height);
}

.project-head__label {
  font: var(--type-label);
  color: var(--muted);
}

.project-head__state {
  display: flex;
  align-items: center;
  margin: 0;
  color: var(--accent-strong);
}

.project-head__state--unsaved {
  color: var(--muted);
}

.project-head__state--failed {
  color: var(--danger);
}

/* The words are for screen readers; the icon and its Tooltip say the same to everyone else. */
.project-head__text {
  position: absolute;
  margin: 0;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

.project-head__icon {
  position: relative;
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: var(--radius-sm);
}

.project-head__dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 5.5px;
  height: 5.5px;
  background: var(--accent-strong);
  border-radius: var(--radius-full);
}

.project-head__lines {
  gap: var(--space-4);
}


.project-head__technique {
  margin: 0 calc(-1 * var(--space-10));
}
</style>
