<script setup lang="ts">
import { computed } from 'vue'
import type { InputMode } from '../../domain/inputMode'
import type { PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import { controlAction } from '../../composables/shell/controlRegistry'
import { useKeyHints } from '../../composables/ui/useKeyHints'
import { overviewUrl } from '../../overview/overviewRoute'
import ProjectImport from '../import/ProjectImport.vue'
import AppIcon from '../ui/AppIcon.vue'
import PanelItem from './PanelItem.vue'
import PanelSection from './PanelSection.vue'
import SettingChoice from './SettingChoice.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ThemeToggle from './ThemeToggle.vue'
import type { Project } from '../../domain/project'
import { inject } from 'vue'
import { PANEL_CONTEXT } from './panelContext'

// The body of Menu (spec 0440, ticket 443; MenuPanel card): what is about the app and the device, in four sections
// (Projects, Preferences, Help, About). It only asks: the app shell does the work. On the Overview (ticket 540, ADR 0073)
// the same panel shows its Overview item as the current page and leaves out what belongs to the editor.
const props = withDefaults(
  defineProps<{
    /** The page the panel is opened on. */
    page?: 'editor' | 'overview'
    projects?: Project[]
    toolsPosition?: PillPosition
    inputMode?: InputMode
    /** Input shows only once a pen has been seen (ticket 326), and is absent, not disabled, before. */
    penSeen?: boolean
  }>(),
  { page: 'editor', projects: () => [], toolsPosition: 'left', inputMode: 'mouse', penSeen: false },
)
const inEditor = computed(() => props.page === 'editor')
const emit = defineEmits<{
  import: [projects: Project[]]
  'export-all': []
  'saved-projects': []
  'new-project': []
  'delete-all': []
  'update:toolsPosition': [position: PillPosition]
  'update:inputMode': [mode: InputMode]
  shortcuts: []
}>()

const { t } = useI18n()
const { shown: hintsShown } = useKeyHints()
const context = inject(PANEL_CONTEXT)

const SOURCE_URL = 'https://github.com/czAAA/bd-beads'
const overviewHref = overviewUrl(import.meta.env.BASE_URL)

const actions = {
  newProject: controlAction('new-project'),
  exportAll: controlAction('export-all'),
  savedProjects: controlAction('saved-projects'),
  deleteAll: controlAction('delete-all-projects'),
  shortcuts: controlAction('shortcuts-help'),
}
const version = __APP_VERSION__

const positionOptions = computed(() => [
  { value: 'left' as const, icon: 'position-left' as const, label: t.value.toolPill.left },
  { value: 'top' as const, icon: 'position-top' as const, label: t.value.toolPill.top },
  { value: 'right' as const, icon: 'position-right' as const, label: t.value.toolPill.right },
  { value: 'bottom' as const, icon: 'position-bottom' as const, label: t.value.toolPill.bottom },
])
const inputOptions = computed(() => [
  { value: 'pen' as const, label: t.value.panels.menu.pen, icon: 'pen-mode' as const },
  { value: 'mouse' as const, label: t.value.panels.menu.mouse, icon: 'pen-mode-off' as const },
])
</script>

<template>
  <div class="menu-panel" data-testid="menu-panel">
    <PanelSection v-if="inEditor" :label="t.panels.menu.projects">
      <!-- New Project opens in this panel (spec 0478): the shell swaps to the subpanel the app shell fills. -->
      <PanelItem icon="plus" accent stays data-testid="menu-new-project" @select="emit('new-project'); context?.openSub()">{{ actions.newProject.name(t) }}</PanelItem>
      <!-- Import keeps the panel open after the file is read and shows the result inline (ticket 523). -->
      <div class="menu-panel__import" data-testid="menu-import">
        <ProjectImport :projects="projects" testid-prefix="menu-" @import="emit('import', $event)" />
      </div>
      <PanelItem icon="export" value=".openbeads" data-testid="menu-export-all" @select="emit('export-all')">{{ actions.exportAll.name(t) }}</PanelItem>
      <PanelItem
        icon="library"
        :value="String(projects.length)"
        :disabled="projects.length === 0"
        :name="actions.savedProjects.name(t)"
        :disabled-body="t.projects.noSavedProjectsMessage"
        stays
        data-testid="menu-saved-projects"
        @select="emit('saved-projects'); context?.openSub()"
      >
        {{ actions.savedProjects.name(t) }}
      </PanelItem>
      <PanelItem
        icon="delete"
        danger
        :disabled="projects.length === 0"
        :name="actions.deleteAll.name(t)"
        :disabled-body="t.projects.noSavedProjectsMessage"
        data-testid="menu-delete-all"
        @select="emit('delete-all')"
      >
        {{ actions.deleteAll.name(t) }}
      </PanelItem>
    </PanelSection>

    <PanelSection :label="t.panels.menu.preferences">
      <div class="menu-panel__row">
        <span class="menu-panel__label"><AppIcon name="globe" :size="16" />{{ t.languageSwitcher.ariaLabel }}</span>
        <LanguageSwitcher />
      </div>
      <div class="menu-panel__stack">
        <span class="menu-panel__label"><AppIcon name="sun" :size="16" />{{ t.theme.groupLabel }}</span>
        <ThemeToggle />
      </div>
      <SettingChoice
        v-if="inEditor"
        :model-value="toolsPosition"
        :label="t.toolPill.position"
        icon="grid"
        :options="positionOptions"
        data-testid="menu-tools-position"
        @update:model-value="emit('update:toolsPosition', $event)"
      />
      <SettingChoice
        v-if="inEditor && penSeen"
        :model-value="inputMode"
        :label="t.panels.menu.input"
        icon="pen-mode"
        :options="inputOptions"
        inline
        data-testid="menu-input-mode"
        @update:model-value="emit('update:inputMode', $event)"
      />
    </PanelSection>

    <PanelSection :label="t.panels.menu.help">
      <PanelItem v-if="inEditor" icon="keyboard" :value="hintsShown ? '?' : undefined" data-testid="menu-item-shortcuts" @select="emit('shortcuts')">{{ t.shortcutsHelp.title }}</PanelItem>
      <PanelItem icon="bead" :href="overviewHref" :aria-current="inEditor ? undefined : 'page'" data-testid="menu-item-overview">{{ t.header.overviewItem }}</PanelItem>
    </PanelSection>

    <PanelSection :label="t.panels.menu.about">
      <!-- The repository is public under AGPL-3.0 (ADR 0031, ticket 269); this link is what the license's network clause requires a hosted copy to offer. -->
      <PanelItem icon="code" :href="SOURCE_URL" external data-testid="menu-item-source">{{ t.header.sourceItem }}</PanelItem>
      <div class="menu-panel__version" data-testid="menu-version">
        <span>{{ t.panels.menu.version }}</span>
        <span class="menu-panel__number">{{ version }}</span>
      </div>
    </PanelSection>
  </div>
</template>

<style scoped>
.menu-panel__row,
.menu-panel__stack,
.menu-panel__version {
  display: flex;
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: var(--space-4) var(--space-12);
  font: var(--type-control);
  color: var(--ink);
}

.menu-panel__row {
  align-items: center;
  justify-content: space-between;
  gap: var(--space-8);
}

.menu-panel__stack {
  flex-direction: column;
  gap: var(--space-8);
}

.menu-panel__label {
  display: flex;
  align-items: center;
  gap: var(--space-10);
}

.menu-panel__version {
  align-items: center;
  justify-content: space-between;
  padding-left: calc(var(--space-12) + 16px + var(--space-10));
  color: var(--muted);
}

.menu-panel__number {
  font: var(--type-meta);
}

/* Import is a file label (ProjectImport), dressed as one of the rows above and below it. */
.menu-panel__import :deep(.project-import__button) {
  display: flex;
  width: 100%;
  box-sizing: border-box;
  min-height: var(--panel-item-height);
  padding: 0 var(--space-12);
  gap: var(--space-10);
  border-radius: var(--radius-sm);
}
</style>
