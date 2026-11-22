<script setup lang="ts">
import { computed } from 'vue'
import type { Project } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import AppIcon from '../ui/AppIcon.vue'
import IconButton from '../ui/IconButton.vue'
import NamesSection from './NamesSection.vue'
import { fillBlanks } from '../../domain/fillBlanks'
import { projectNameOf } from '../../domain/layerRecord'
import type { SinceFile } from '../../domain/beadsSinceFile'
import { saveReminderMeta } from '../../i18n/saveReminderWords'
import AppTooltip from '../ui/AppTooltip.vue'

// The head of the Project panel, always shown (ProjectPanel card, ticket 554): the `project:` title with the local save
// state, the Project's name and maker. Each layer's Technique is in its Layer settings (ticket 0670). It only asks.
const props = defineProps<{
  project: Project
  saveFailed: boolean
  unsaved: boolean
  /** The Project is saved but its reference image's picture is not kept on this device (ticket 0790). */
  referenceNotSaved?: boolean
  /** The Project is open in another tab (ticket 0937): nothing drawn here is saved. */
  openElsewhere?: boolean
  /** The open Project's Beads since last file (ticket 1192): its Project file's state, under the save state. */
  sinceFile?: SinceFile
}>()
const emit = defineEmits<{
  rename: [name: string]
  'save-maker-name': [name: string]
  save: []
}>()

const { t, locale } = useI18n()

const state = computed(() => (props.saveFailed ? 'failed' : props.unsaved || props.referenceNotSaved || props.openElsewhere ? 'unsaved' : 'saved'))
const stateText = computed(() =>
  state.value === 'saved'
    ? t.value.panels.project.savedLocal
    : state.value === 'unsaved'
      ? props.openElsewhere
        ? t.value.storage.notSavedHere
        : props.unsaved
          ? t.value.panels.project.notSavedYet
          : t.value.referenceImage.notSaved
      : fillBlanks(t.value.panels.project.notSaved, { reason: t.value.panels.project.saveRefused }),
)

const since = computed<SinceFile>(() => props.sinceFile ?? { beads: 0 })
/** The Project file holds every bead: one was saved and nothing was drawn since. A status, never a button. */
const fileSaved = computed(() => since.value.lastFileAt !== undefined && since.value.beads === 0)
const fileMeta = computed(() => saveReminderMeta(t.value.saveReminder, locale.value, since.value, Date.now()))
</script>

<template>
  <section class="project-head" role="group" :aria-label="projectNameOf(project)" data-testid="project-head">
    <div class="project-head__title">
      <span class="project-head__label">{{ t.panels.project.titleLabel }}</span>
      <!-- The save state in words beside its icon (SaveStates card, ticket 0858): a polite live region, so "Not saved" is
           announced. Saved is a check, never the floppy, which is the Save Project file action alone. -->
      <div class="project-head__state" :class="`project-head__state--${state}`">
        <p class="project-head__text" role="status" aria-live="polite" data-testid="save-state" :class="`project-head__state--${state}`">{{ stateText }}</p>
        <IconButton v-if="state === 'failed'" variant="plain" icon="warning" :label="stateText" tooltip data-testid="save-try-again" @click="emit('save')" />
        <span v-else class="project-head__icon" aria-hidden="true" data-testid="save-icon">
          <AppIcon v-if="state === 'saved'" name="check" :size="16" />
          <span v-else class="project-head__dot" />
        </span>
      </div>
    </div>

    <!-- The Project file's state (ticket 1192), in the save state's own style: a tick or a cross, the why in its Tooltip. -->
    <AppTooltip class="project-head__file-tip" :name="t.panels.project.savedDevice" :body="t.saveReminder.body" :meta="fileMeta" :announce="false">
      <div
        class="project-head__state project-head__file"
        :class="{ 'project-head__state--unsaved': !fileSaved }"
        role="img"
        tabindex="0"
        :aria-label="fileSaved ? t.panels.project.savedDevice : t.panels.project.notSavedDevice"
        data-testid="file-state"
      >
        <p class="project-head__text" aria-hidden="true">{{ t.panels.project.savedDevice }}</p>
        <span class="project-head__icon" aria-hidden="true">
          <AppIcon :name="fileSaved ? 'check' : 'close'" :size="16" :data-testid="fileSaved ? 'file-state-tick' : 'file-state-cross'" />
        </span>
      </div>
    </AppTooltip>

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
  text-transform: lowercase;
}

.project-head__state {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-width: 0;
  margin: 0;
  color: var(--accent-strong);
}

.project-head__state--unsaved {
  color: var(--muted);
}

.project-head__state--failed {
  color: var(--danger);
}

/* The words, one line, then the icon; a long state wraps rather than pushing the icon out. */
.project-head__text {
  margin: 0;
  font: var(--type-small);
  text-align: end;
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
  width: 5.5px;
  height: 5.5px;
  background: var(--accent-strong);
  border-radius: var(--radius-full);
}

.project-head__file-tip {
  align-self: flex-end;
}

.project-head__file {
  border-radius: var(--radius-sm);
}

.project-head__file:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.project-head__lines {
  gap: var(--space-4);
}

</style>
