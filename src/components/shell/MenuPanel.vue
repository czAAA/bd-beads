<script setup lang="ts">
import { computed } from 'vue'
import { LOCALES, LOCALE_NAMES } from '../../domain/locale'
import type { InputMode } from '../../domain/inputMode'
import type { PillPosition } from '../../domain/toolPill'
import { useI18n } from '../../i18n/useI18n'
import { controlAction } from '../../composables/shell/controlRegistry'
import { TOUR_ENABLED } from '../../features'
import { useKeyHints } from '../../composables/ui/useKeyHints'
import { overviewUrl } from '../../overview/overviewRoute'
import { useThemePick } from '../../theme/useThemePick'
import type { ThemePick } from '../../theme/theme'
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

/**
 * The body of Menu (spec 0440, ticket 443; MenuPanel card): what is about the app and the device, in four sections,
 * Projects · Preferences · Help · About. Nothing here repeats a tool or is about the open Project. The same rows fill the
 * dropdown and the Top sheet; in the sheet the choices (Language, Theme, Tools position, Input) become one option per
 * line. It only asks: the app shell does the work.
 */
defineProps<{
  projects: Project[]
  toolsPosition: PillPosition
  inputMode: InputMode
  /** Input shows only once a pen has been seen (ticket 326), and is absent, not disabled, before. */
  penSeen: boolean
}>()
const emit = defineEmits<{
  'new-project': []
  import: [projects: Project[]]
  'import-result': [id: string, text: string, tone: 'success' | 'danger']
  'export-all': []
  'saved-projects': []
  'delete-all': []
  'update:toolsPosition': [position: PillPosition]
  'update:inputMode': [mode: InputMode]
  shortcuts: []
  tour: []
}>()

const { t, locale, setLocale } = useI18n()
const { pick, setPick } = useThemePick()
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

const languageOptions = computed(() => LOCALES.map((code) => ({ value: code, label: LOCALE_NAMES[code], icon: 'globe' as const, lang: code, testid: `language-${code}` })))
const themeOptions = computed<{ value: ThemePick; label: string; icon: 'device' | 'sun' | 'moon' | 'contrast' }[]>(() => [
  { value: 'device', icon: 'device', label: t.value.theme.matchDevice },
  { value: 'light', icon: 'sun', label: t.value.theme.light },
  { value: 'dark', icon: 'moon', label: t.value.theme.dark },
  { value: 'contrast', icon: 'contrast', label: t.value.theme.contrast },
])
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
const sheet = computed(() => context?.sheet.value ?? false)
</script>

<template>
  <div class="menu-panel" data-testid="menu-panel">
    <PanelSection :label="t.panels.menu.projects">
      <PanelItem icon="plus" data-testid="menu-new-project" @select="emit('new-project')">{{ actions.newProject.name(t) }}</PanelItem>
      <!-- Import keeps the panel open until the file is read (its picker belongs to it), then the result is a toast and the panel goes. -->
      <div class="menu-panel__import" data-testid="menu-import">
        <ProjectImport toast-results :projects="projects" testid-prefix="menu-" @import="emit('import', $event)" @import-result="(id, text, tone) => emit('import-result', id, text, tone)" />
      </div>
      <PanelItem icon="export" value=".openbeads" data-testid="menu-export-all" @select="emit('export-all')">{{ actions.exportAll.name(t) }}</PanelItem>
      <PanelItem
        icon="library"
        :value="String(projects.length)"
        :disabled="projects.length === 0"
        :name="actions.savedProjects.name(t)"
        :disabled-body="t.projects.noSavedProjectsMessage"
        data-testid="menu-saved-projects"
        @select="emit('saved-projects')"
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
      <SettingChoice v-if="sheet" :model-value="locale" :label="t.languageSwitcher.ariaLabel" icon="globe" :options="languageOptions" data-testid="menu-language" @update:model-value="setLocale" />
      <div v-else class="menu-panel__row">
        <span class="menu-panel__label"><AppIcon name="globe" :size="16" />{{ t.languageSwitcher.ariaLabel }}</span>
        <LanguageSwitcher />
      </div>
      <SettingChoice v-if="sheet" :model-value="pick" :label="t.theme.groupLabel" icon="sun" :options="themeOptions" @update:model-value="setPick" />
      <div v-else class="menu-panel__stack">
        <span class="menu-panel__label"><AppIcon name="sun" :size="16" />{{ t.theme.groupLabel }}</span>
        <ThemeToggle />
      </div>
      <SettingChoice
        :model-value="toolsPosition"
        :label="t.toolPill.position"
        icon="grid"
        :options="positionOptions"
        data-testid="menu-tools-position"
        @update:model-value="emit('update:toolsPosition', $event)"
      />
      <SettingChoice
        v-if="penSeen"
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
      <PanelItem icon="keyboard" :value="hintsShown ? '?' : undefined" data-testid="menu-item-shortcuts" @select="emit('shortcuts')">{{ t.shortcutsHelp.title }}</PanelItem>
      <PanelItem icon="bead" :href="overviewHref" data-testid="menu-item-overview">{{ t.header.overviewItem }}</PanelItem>
      <!-- The Tour is switched off (TOUR_ENABLED, ticket 247): no item until it is turned back on. -->
      <PanelItem v-if="TOUR_ENABLED" icon="info" data-testid="menu-item-tour" @select="emit('tour')">{{ t.header.tourItem }}</PanelItem>
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
