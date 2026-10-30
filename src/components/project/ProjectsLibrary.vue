<script setup lang="ts">
import { computed, toRaw } from 'vue'
import { controlAction } from '../../composables/shell/controlRegistry'
import { piecesWhenIdle } from '../../composables/canvas/idlePieces'
import type { Project } from '../../domain/project'
import { shownDimensions } from '../../domain/projectExtent'
import { inSavedOrder, summarizeProject } from '../../domain/projectLibrary'
import { namedPieces, namedPiecesFrom } from '../../domain/pieceNames'
import { piecesOf } from '../../domain/pieces'
import { beadsOver, SIZE_GATE_BEADS, tooManyToWalk } from '../../domain/openingLimits'
import type { SealedProject } from '../../domain/sealedProject'
import { frameOf, heldWeave, layerOf, pieceNamesOf, projectNameOf } from '../../domain/layerRecord'
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
// Project; × Remove asks first. Delete all projects is the panel's pinned footer. A sealed Project (ticket 0716) is
// never decoded here: its row shows its bead count and last save (both dates in the Tooltip) in place of the thumbnail
// and the Piece count.
const props = withDefaults(
  defineProps<{
    projects: Project[]
    /** The Projects kept in their stored form (ticket 0716), listed among the rest by last save. */
    sealed?: SealedProject[]
    activeProjectId?: string
  }>(),
  { sealed: () => [], activeProjectId: undefined },
)

const emit = defineEmits<{
  select: [id: string]
  remove: [id: string]
  /** The Projects a file held, ready to be saved. */
  import: [projects: Project[]]
  exportAll: []
}>()

const { t, locale } = useI18n()
const exportAll = controlAction('export-all')

/** Every row: the Projects in the order they arrive, each sealed one put in by last save. */
const rows = computed(() => {
  const merged: (Project | SealedProject)[] = [...props.projects]
  for (const kept of inSavedOrder([...props.sealed])) {
    const at = merged.findIndex((other) => inSavedOrder([other, kept])[0] === kept)
    merged.splice(at === -1 ? merged.length : at, 0, kept)
  }
  return merged
})
const isSealed = (entry: Project | SealedProject): entry is SealedProject => 'stored' in entry
const count = computed(() => props.projects.length + props.sealed.length)

/** A Project's Pieces: counted at once on an ordinary layer; on one too big to walk (ticket 0716) counted in idle time,
 * undefined until then, and never past the size gate. */
function piecesNow(shown: Project): { total: number; named: string[] } | 'counting' | 'too big' {
  // The answers are kept per set of beads, so ask with the beads themselves, never a reactive copy of them.
  const project = toRaw(shown)
  const beads = layerOf(project, 'canvas').beads
  const weave = heldWeave(project, 'canvas')
  if (!tooManyToWalk(beads)) return { total: piecesOf(beads, weave).length, named: namedPieces(project).map((piece) => piece.name) }
  if (beadsOver(beads, SIZE_GATE_BEADS)) return 'too big'
  const walked = piecesWhenIdle(`saved-projects:${project.id}`, beads, weave, pieceNamesOf(project) ?? [])
  return walked ? { total: walked.pieces.length, named: namedPiecesFrom(project, walked).map((piece) => piece.name) } : 'counting'
}

/** What a row states about a Project's Pieces: the count (or what stands for it), and the Tooltip's lines. */
const facts = computed(() =>
  new Map(
    props.projects.map((project) => {
      const pieces = piecesNow(project)
      const size = frameOf(project) ? frameSize(project) : undefined
      if (pieces === 'counting') return [project.id, { shown: '…', title: t.value.projects.countingPieces, body: size }]
      if (pieces === 'too big') return [project.id, { shown: t.value.projects.tooBigToCount, title: t.value.projects.tooBigToCount, body: size }]
      const { total, named } = pieces
      const unnamed = total - named.length
      const lines = [...named, ...(unnamed > 0 && named.length > 0 ? [fillBlanks(t.value.projects.unnamedPieces, { count: unnamed })] : [])]
      const body = [lines.join(' · '), size ?? ''].filter(Boolean).join('\n')
      return [project.id, { shown: String(total), title: plural(locale.value, total, t.value.projects.pieces), body: body || undefined }]
    }),
  ),
)

function frameSize(project: Project): string {
  const { columns, rows } = shownDimensions(project)
  return fillBlanks(t.value.projects.frameSize, { width: columns, height: rows })
}

const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }))
const shortDateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { day: 'numeric', month: 'short' }))

/** A sealed row's last save, short ("Oct 30"); its Tooltip has both dates in full. */
function shortDate(at: number): string {
  return shortDateFormat.value.format(new Date(at))
}

/** A sealed row's dates in full, for its Tooltip: when it was made and last saved. */
function sealedDates(project: SealedProject): string {
  const date = (at: number) => dateFormat.value.format(new Date(at))
  return fillBlanks(t.value.projects.sealedDates, { created: date(project.createdAt), saved: date(project.savedAt ?? project.updatedAt) })
}

</script>

<template>
  <div class="projects-library" data-testid="project-list">
    <div class="projects-library__import" data-testid="menu-import">
      <ProjectImport :projects="[...projects, ...sealed]" testid-prefix="menu-" value=".openbeads" @import="emit('import', $event)" />
    </div>
    <PanelItem
      icon="export"
      value=".openbeads"
      :disabled="count === 0"
      :name="exportAll.name(t)"
      :disabled-body="t.projects.emptyTitle"
      stays
      data-testid="menu-export-all"
      @select="emit('exportAll')"
    >
      {{ exportAll.name(t) }}
    </PanelItem>
    <hr class="projects-library__rule" />

    <div v-if="count === 0" class="projects-library__empty" data-testid="project-list-empty">
      <p class="projects-library__empty-title">{{ t.projects.emptyTitle }}</p>
      <p class="projects-library__empty-body">{{ t.projects.emptyBody }}</p>
    </div>
    <ul v-else class="projects-library__list">
      <li v-for="entry in rows" :key="entry.id" class="projects-library__item" data-testid="project-item">
        <PanelListRow
          v-if="isSealed(entry)"
          :name="entry.name"
          :sub="plural(locale, entry.beads, t.projects.beads)"
          :label="entry.name"
          :select-testid="`select-project-${entry.id}`"
          @select="emit('select', entry.id)"
        >
          <template #thumb><span class="projects-library__sealed" data-testid="project-sealed" aria-hidden="true"><AppIcon name="library" :size="16" /></span></template>
          <template #facts>
            <AppTooltip :name="sealedDates(entry)" :announce="false">
              <span class="projects-library__pieces" data-testid="project-saved-on">{{ shortDate(entry.savedAt ?? entry.updatedAt) }}</span>
            </AppTooltip>
          </template>
          <template #actions>
            <button
              type="button"
              class="ui-control projects-library__remove"
              :data-testid="`remove-project-${entry.id}`"
              :aria-label="`${t.projects.removeButton}: ${entry.name}`"
              @click="emit('remove', entry.id)"
            >
              <AppIcon name="close" :size="14" />
            </button>
          </template>
        </PanelListRow>
        <PanelListRow
          v-else
          :name="projectNameOf(entry)"
          :sub="entry.makerName"
          :active="entry.id === activeProjectId"
          :label="summarizeProject(entry)"
          :select-testid="`select-project-${entry.id}`"
          @select="emit('select', entry.id)"
        >
          <template #thumb><ProjectThumbnail :project="entry" /></template>
          <template #facts>
            <AppTooltip :name="facts.get(entry.id)!.title" :body="facts.get(entry.id)!.body" :announce="false">
              <span class="projects-library__facts">
                <span class="projects-library__pieces" data-testid="project-pieces"><AppIcon name="piece" :size="14" />{{ facts.get(entry.id)!.shown }}</span>
                <span class="projects-library__frame" :data-testid="frameOf(entry) ? 'project-framed' : undefined" aria-hidden="true"><AppIcon v-if="frameOf(entry)" name="frame" :size="14" /></span>
              </span>
            </AppTooltip>
          </template>
          <template #actions>
            <button
              type="button"
              class="ui-control projects-library__remove"
              :data-testid="`remove-project-${entry.id}`"
              :aria-label="`${t.projects.removeButton}: ${summarizeProject(entry)}`"
              @click="emit('remove', entry.id)"
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

.projects-library__sealed {
  display: grid;
  place-items: center;
  width: var(--thumbnail-size);
  height: var(--thumbnail-size);
  color: var(--muted);
  background: var(--board);
  border-radius: var(--radius-sm);
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
