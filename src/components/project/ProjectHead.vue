<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import IconButton from '../ui/IconButton.vue'
import NamesSection from './NamesSection.vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { projectNameOf } from '../../domain/layerRecord'

// The head of the Project panel, always shown (ProjectPanel card, ticket 554): the `project:` title with the local save
// state, the Project's name and maker. Each layer's Technique is in its Layer settings (ticket 0670). It only asks.
const props = defineProps<{
  project: Project
  saveFailed: boolean
  unsaved: boolean
}>()
const emit = defineEmits<{
  rename: [name: string]
  'save-maker-name': [name: string]
  save: []
}>()

const { t } = useI18n()

const state = computed(() => (props.saveFailed ? 'failed' : props.unsaved ? 'unsaved' : 'saved'))
const stateText = computed(() =>
  state.value === 'saved'
    ? t.value.panels.project.savedLocal
    : state.value === 'unsaved'
      ? t.value.panels.project.notSavedYet
      : fillBlanks(t.value.panels.project.notSaved, { reason: t.value.panels.project.saveRefused }),
)

</script>

<template>
  <section class="project-head" role="group" :aria-label="projectNameOf(project)" data-testid="project-head">
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
      :name="projectNameOf(project)"
      :maker-name="project.makerName ?? ''"
      @update:name="emit('rename', $event)"
      @update:maker-name="emit('save-maker-name', $event)"
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

</style>
