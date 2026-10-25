<script setup lang="ts">
import { computed } from 'vue'
import { controlAction, controlDeps } from '../../composables/shell/controlRegistry'
import { MAX_MAKER_NAME } from '../../domain/makerName'
import { MAX_PROJECT_NAME, normalizeProjectName } from '../../domain/projectName'
import { frameWeave, type Project } from '../../domain/project'
import { describeWeave, TECHNIQUES, type Technique } from '../../domain/weave'
import { techniqueName } from '../../i18n/techniqueName'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import PanelPicker from '../shell/PanelPicker.vue'
import BrickBlockField from './BrickBlockField.vue'
import EditableLine from './EditableLine.vue'

// The head of the Project panel, always shown (ProjectPanel card, ticket 554): the `project:` title with the local save
// state, the Project's name and maker, and the one Technique control with Brick block. It only asks; the shell works.
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
  'set-brick-block': [brickBlock: number]
  'set-canvas-technique': [technique: Technique]
  'set-canvas-brick-block': [brickBlock: number]
}>()

const { t } = useI18n()
const rename = controlAction('rename-project')
const techniqueAction = controlAction('change-technique')
const brickBlockAction = controlAction('change-brick-block')
const deps = computed(() => controlDeps({ activeProject: () => props.project }))

const state = computed(() => (props.saveFailed ? 'failed' : props.unsaved ? 'unsaved' : 'saved'))
const stateText = computed(() =>
  state.value === 'saved'
    ? t.value.panels.project.savedLocal
    : state.value === 'unsaved'
      ? t.value.panels.project.notSavedYet
      : t.value.panels.project.notSaved.replace('{reason}', t.value.panels.project.saveRefused),
)

const renameLabel = computed(() => t.value.panels.project.rename.replace('{name}', props.project.name))

const weave = computed(() => frameWeave(props.project))
const locked = computed(() => !techniqueAction.enabled?.(deps.value))
const techniqueOptions = computed(() => TECHNIQUES.map((value) => ({ value, label: techniqueName(t.value, value) })))
/** A Project with a Frame weaves it (Row progress belongs to the Frame); one without weaves the Canvas. */
const hasFrame = computed(() => props.project.frame !== undefined)

function setTechnique(technique: Technique) {
  if (hasFrame.value) emit('set-technique', technique)
  else emit('set-canvas-technique', technique)
}

function setBrickBlock(brickBlock: number) {
  if (hasFrame.value) emit('set-brick-block', brickBlock)
  else emit('set-canvas-brick-block', brickBlock)
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

    <div class="project-head__lines">
      <EditableLine
        :label="t.panels.project.nameLabel"
        :value="project.name"
        :edit-label="renameLabel"
        :edit-tooltip="rename.body?.(t)"
        :maxlength="MAX_PROJECT_NAME"
        :required-message="t.panels.project.nameRequired"
        :normalize="normalizeProjectName"
        testid="project-name"
        @save="emit('rename', $event)"
      />

      <EditableLine
        small
        :label="t.panels.project.makerLabel"
        :value="project.makerName ?? ''"
        :edit-label="t.panels.project.changeMaker"
        :empty-text="t.panels.project.addMaker"
        :placeholder="t.saveBox.yourName"
        :maxlength="MAX_MAKER_NAME"
        :normalize="(raw) => raw.trim()"
        testid="project-maker"
        @save="emit('save-maker-name', $event)"
      />
    </div>

    <div class="project-head__technique">
      <PanelPicker
        :model-value="weave.technique"
        :label="t.form.techniqueLabel"
        icon="pattern"
        :options="techniqueOptions"
        :disabled="locked"
        :disabled-body="locked ? techniqueAction.disabledBody?.(t, deps) : undefined"
        data-testid="project-technique"
        @update:model-value="setTechnique"
      />
      <BrickBlockField
        v-if="describeWeave(weave).hasBrickBlock"
        class="project-head__brick"
        :model-value="weave.brickBlock ?? 1"
        :disabled="locked"
        :disabled-body="locked ? brickBlockAction.disabledBody?.(t, deps) : undefined"
        testid="project-brick-block"
        @update:model-value="setBrickBlock"
      />
    </div>
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
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

.project-head__technique {
  display: flex;
  flex-direction: column;
  margin: 0 calc(-1 * var(--space-10));
}

.project-head__brick {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--space-10);
  min-height: var(--panel-item-height);
}
</style>
