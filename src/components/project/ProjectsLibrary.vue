<script setup lang="ts">
import { computed } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import type { Project } from '../../domain/project'
import { projectDimensions } from '../../domain/projectExtent'
import { summarizeProject } from '../../domain/projectLibrary'
import { namedPieces } from '../../domain/pieceNames'
import { piecesOf } from '../../domain/pieces'
import { layerOf } from '../../domain/layerRecord'
import { plural } from '../../i18n/plural'
import { useI18n } from '../../i18n/useI18n'
import ProjectImport from '../import/ProjectImport.vue'
import PanelItem from '../shell/PanelItem.vue'
import PanelListRow from '../shell/PanelListRow.vue'
import AppIcon from '../ui/AppIcon.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import ProjectThumbnail from './ProjectThumbnail.vue'
import { fillBlanks } from '../../domain/fillBlanks'

// The Projects library, a subpanel of the Menu (ticket 0553; MenuPanel card): Import and Export all, then every
// saved Project as a two-line row, newest first (`projects` arrives in that order, ticket 145). A press opens the
// Project; × Remove asks first. Delete all projects is the panel's pinned footer.
const props = defineProps<{
  projects: Project[]
  activeProjectId?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
  /** The Projects a file held, ready to be saved. */
  import: [projects: Project[]]
  exportAll: []
}>()

const { t, locale } = useI18n()
const exportAll = controlAction('export-all')

/** What a row states about a Project's Pieces: the count, and the Tooltip's lines. */
const facts = computed(() =>
  new Map(
    props.projects.map((project) => {
      const total = piecesOf(layerOf(project, 'canvas').beads, project).length
      const named = namedPieces(project).map((piece) => piece.name)
      const unnamed = total - named.length
      const lines = [...named, ...(unnamed > 0 && named.length > 0 ? [fillBlanks(t.value.projects.unnamedPieces, { count: unnamed })] : [])]
      const body = [lines.join(' · '), project.frame ? frameSize(project) : ''].filter(Boolean).join('\n')
      return [project.id, { total, title: plural(locale.value, total, t.value.projects.pieces), body: body || undefined }]
    }),
  ),
)

function frameSize(project: Project): string {
  const { columns, rows } = projectDimensions(project)
  return fillBlanks(t.value.projects.frameSize, { width: columns, height: rows })
}
</script>

<template>
  <div class="projects-library" data-testid="project-list">
    <div class="projects-library__import" data-testid="menu-import">
      <ProjectImport :projects="projects" testid-prefix="menu-" value=".openbeads" @import="emit('import', $event)" />
    </div>
    <PanelItem
      icon="export"
      value=".openbeads"
      :disabled="projects.length === 0"
      :name="exportAll.name(t)"
      :disabled-body="t.projects.emptyTitle"
      stays
      data-testid="menu-export-all"
      @select="emit('exportAll')"
    >
      {{ exportAll.name(t) }}
    </PanelItem>
    <hr class="projects-library__rule" />

    <div v-if="projects.length === 0" class="projects-library__empty" data-testid="project-list-empty">
      <p class="projects-library__empty-title">{{ t.projects.emptyTitle }}</p>
      <p class="projects-library__empty-body">{{ t.projects.emptyBody }}</p>
    </div>
    <ul v-else class="projects-library__list">
      <li v-for="project in projects" :key="project.id" class="projects-library__item" data-testid="project-item">
        <PanelListRow
          :name="project.name"
          :sub="project.makerName"
          :active="project.id === activeProjectId"
          :label="summarizeProject(project)"
          :select-testid="`select-project-${project.id}`"
          @select="emit('select', project.id)"
        >
          <template #thumb><ProjectThumbnail :project="project" /></template>
          <template #facts>
            <AppTooltip :name="facts.get(project.id)!.title" :body="facts.get(project.id)!.body" :announce="false">
              <span class="projects-library__facts">
                <span class="projects-library__pieces" data-testid="project-pieces"><AppIcon name="piece" :size="14" />{{ facts.get(project.id)!.total }}</span>
                <span class="projects-library__frame" :data-testid="project.frame ? 'project-framed' : undefined" aria-hidden="true"><AppIcon v-if="project.frame" name="frame" :size="14" /></span>
              </span>
            </AppTooltip>
          </template>
          <template #actions>
            <button
              type="button"
              class="ui-control projects-library__remove"
              :data-testid="`remove-project-${project.id}`"
              :aria-label="`${t.projects.removeButton}: ${summarizeProject(project)}`"
              @click="emit('remove', project.id)"
            >
              <AppIcon name="close" :size="14" />
            </button>
          </template>
        </PanelListRow>
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Import is a file label (ProjectImport), dressed as one of the rows around it. */
.projects-library__import :deep(.project-import__button) {
  display: flex;
  flex-wrap: wrap;
  width: 100%;
  box-sizing: border-box;
  height: auto;
  min-height: var(--panel-item-height);
  white-space: normal;
  padding: 0 var(--space-10);
  gap: var(--space-2) var(--space-8);
  border-radius: var(--radius-sm);
}

.projects-library__import :deep(.project-import__label) {
  min-width: min-content;
}

.projects-library__rule {
  margin: var(--space-4) 0;
  border: 0;
  border-top: 1px solid var(--line-soft);
}

.projects-library__list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.projects-library__facts {
  display: inline-flex;
  align-items: center;
  gap: var(--space-8);
}

.projects-library__pieces {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font: var(--type-meta-small);
}

.projects-library__frame {
  display: inline-grid;
  width: var(--panel-mark-size);
  height: var(--panel-mark-size);
}

/* Remove: a 20px × shown on hover or keyboard focus, and always without hover. */
.projects-library__remove {
  display: grid;
  place-items: center;
  width: var(--thumbnail-remove);
  height: var(--thumbnail-remove);
  padding: 0;
  color: var(--muted);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--duration-fast) var(--ease-standard);
}

.projects-library__remove:focus-visible {
  outline: var(--focus-width) solid var(--focus-ring);
  outline-offset: var(--focus-offset);
}

.projects-library__item:hover .projects-library__remove,
.projects-library__item:focus-within .projects-library__remove {
  opacity: 1;
  color: var(--ink);
}

@media (hover: none) {
  .projects-library__remove {
    opacity: 1;
  }
}

.projects-library__empty {
  padding: var(--space-16) var(--space-10);
  text-align: center;
}

.projects-library__empty-title {
  margin: 0;
  font: var(--type-control);
  color: var(--ink);
}

.projects-library__empty-body {
  margin: var(--space-4) 0 0;
  font: var(--type-small);
  color: var(--muted);
}
</style>
