<script setup lang="ts">
import { computed, ref } from 'vue'
import { rotationSwapsAxes } from '../../domain/grid'
import type { Project } from '../../domain/project'
import { summarizeProject, projectDimensions } from '../../domain/project'
import { useI18n } from '../../i18n/useI18n'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import ExpandablePanel from '../ui/ExpandablePanel.vue'
import { useMediaQuery } from '../../composables/ui/useMediaQuery'
import ProjectThumbnail from './ProjectThumbnail.vue'

/**
 * Saved Projects (ticket 147; SavedProjects and SavedProjectsExpanded cards): the five most recently saved Projects as
 * round thumbnails, with name and size under each; expanded, every Project and a footer with Export Project and Export
 * all. The open Project is ringed in the accent. Remove is a small × at a thumbnail's top-right, shown on hover or
 * keyboard focus. `projects` comes in the library's own order, most recently saved first (ticket 145).
 */
const props = defineProps<{
  projects: Project[]
  activeProjectId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
  /** Export project (ticket 118): the open Project as a Project file. */
  exportProject: []
  /** Export library: every saved Project in one file. */
  exportLibrary: []
}>()

const { t } = useI18n()

/** The 24" and larger tier (ticket 83; responsive.md, bp-desktop): the column has room for two rows before expanding. */
const isDesktop = useMediaQuery('(min-width: 1920px)')

/** How many thumbnails the collapsed box holds: one row of five, or two rows (ten) at the 24" tier. */
const recent = computed(() => (isDesktop.value ? 10 : 5))
const collapsedHeight = computed(() => (isDesktop.value ? 'var(--saved-body-height-desktop)' : 'var(--saved-body-height)'))

const expanded = ref(false)
const shown = computed(() => (expanded.value ? props.projects : props.projects.slice(0, recent.value)))

const meta = computed(() =>
  t.value.projects.shownOf.replace('{shown}', String(shown.value.length)).replace('{total}', String(props.projects.length)),
)

/** The Project open right now, if any — the one "Export Project" writes out. */
const activeProject = computed(() => props.projects.find((project) => project.id === props.activeProjectId))

/** A thumbnail's size line, as the Project shows on screen. */
function sizeOf(project: Project): string {
  // A canvas with no Frame has no size to state (SavedPatterns card, v16; ADR 0026).
  if (!project.frame) return t.value.canvas.noFrame
  return rotationSwapsAxes(project.rotation) ? `${projectDimensions(project).rows}×${projectDimensions(project).columns}` : `${projectDimensions(project).columns}×${projectDimensions(project).rows}`
}
</script>

<template>
  <ExpandablePanel
    v-model:expanded="expanded"
    class="project-list"
    :title="t.projects.heading"
    icon="library"
    :expandable="projects.length > 0"
    :empty="projects.length === 0"
    :clip-overflow="false"
    :collapsed-height="collapsedHeight"
    data-testid="project-list"
  >
    <template v-if="projects.length > 0" #meta>
      <span data-testid="project-list-meta">{{ meta }}</span>
    </template>

    <p v-if="projects.length === 0" class="project-list__empty" data-testid="project-list-empty">
      {{ t.projects.noSavedProjectsMessage }}
    </p>
    <ul v-else class="project-list__grid">
      <li
        v-for="project in shown"
        :key="project.id"
        class="project-list__item"
        data-testid="project-item"
        :class="{ 'project-list__item--active': project.id === activeProjectId }"
      >
        <AppTooltip :name="project.name" :announce="false">
          <button
            type="button"
            class="ui-control project-list__select"
            :data-testid="`select-project-${project.id}`"
            :aria-label="summarizeProject(project)"
            :aria-pressed="project.id === activeProjectId"
            @click="emit('select', project.id)"
          >
            <span class="project-list__circle">
              <ProjectThumbnail :project="project" />
            </span>
            <span class="project-list__name">{{ project.name }}</span>
            <span class="project-list__size">{{ sizeOf(project) }}</span>
          </button>
        </AppTooltip>
        <button
          type="button"
          class="ui-control project-list__remove"
          :data-testid="`remove-project-${project.id}`"
          :aria-label="`${t.projects.removeButton}: ${summarizeProject(project)}`"
          @click="emit('remove', project.id)"
        >
          <AppIcon name="close" :size="14" />
        </button>
      </li>
    </ul>

    <template #footer>
      <AppButton variant="in-box" size="sm" data-testid="export-project" :disabled="!activeProject" @click="emit('exportProject')">
        {{ t.transfer.exportProjectButton }}
      </AppButton>
      <AppButton variant="in-box" size="sm" data-testid="export-library" :disabled="projects.length === 0" @click="emit('exportLibrary')">
        {{ t.transfer.exportLibraryButton }}
      </AppButton>
    </template>
  </ExpandablePanel>
</template>

<style scoped>
.project-list__empty {
  margin: 0;
  font: var(--type-meta);
  font-family: var(--font-sans);
  color: var(--muted);
}

/* Five columns, rows 12 apart, columns 8 apart (ticket 175: 4px read as no gap at all between names). */
.project-list__grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: var(--space-12) var(--space-8);
  margin: 0;
  padding: var(--space-4) 0 0;
  list-style: none;
}

.project-list__item {
  position: relative;
  display: flex;
  justify-content: center;
  min-width: 0;
}

.project-list__item > :deep(.app-tooltip) {
  min-width: 0;
}

.project-list__select {
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  padding: 0;
  color: var(--ink);
  text-align: center;
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.project-list__select:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 2px;
}

/* A 44px circle on `elevated`, holding the Project's own 36px thumbnail. */
.project-list__circle {
  display: grid;
  place-items: center;
  width: var(--thumbnail-circle);
  height: var(--thumbnail-circle);
  background: var(--elevated);
  border-radius: var(--radius-full);
  transition: box-shadow var(--duration-fast) var(--ease-standard);
}

@media (hover: hover) {
  .project-list__select:hover .project-list__circle {
    box-shadow: 0 0 0 1px var(--line-strong);
  }
}

.project-list__name {
  display: block;
  width: var(--thumbnail-name-width);
  margin-top: var(--space-6);
  overflow: hidden;
  font: var(--type-small);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.project-list__size {
  font: var(--type-meta-tiny);
  color: var(--muted);
}

/* The open Project: the accent ring around its circle, and its name in the accent. */
.project-list__item--active .project-list__circle {
  box-shadow:
    0 0 0 2px var(--panel),
    0 0 0 4px var(--accent-strong);
}

.project-list__item--active .project-list__name {
  color: var(--accent-strong);
}

/* Remove: a 20px round × at the circle's top-right, shown on hover or keyboard focus, and always without hover. */
.project-list__remove {
  position: absolute;
  top: calc(-1 * var(--space-4));
  right: var(--space-2);
  display: grid;
  place-items: center;
  width: var(--thumbnail-remove);
  height: var(--thumbnail-remove);
  padding: 0;
  color: var(--ink);
  background: var(--panel);
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-full);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.project-list__remove :deep(.icon) {
  width: 0.6875rem !important;
  height: 0.6875rem !important;
}

.project-list__item:hover .project-list__remove,
.project-list__item:focus-within .project-list__remove {
  opacity: 1;
}

@media (hover: none) {
  .project-list__remove {
    opacity: 1;
  }
}

.project-list__remove:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: 1px;
}

:root[data-theme='contrast'] .project-list__remove {
  border-width: 2px;
}

/* Forced colors: the open Project keeps a visible ring. */
@media (forced-colors: active) {
  .project-list__item--active .project-list__circle {
    outline: 2px solid Highlight;
    outline-offset: 2px;
  }
}
</style>
