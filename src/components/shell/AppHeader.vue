<script setup lang="ts">
import { computed, ref } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppLogo from '../ui/AppLogo.vue'
import AppMenuItem from '../ui/AppMenuItem.vue'
import AppSelect from '../ui/AppSelect.vue'
import AppTooltip from '../ui/AppTooltip.vue'
import BeadPill from '../palette/BeadPill.vue'
import IconButton from '../ui/IconButton.vue'
import MenuButton from '../ui/MenuButton.vue'
import LanguageSwitcher from './LanguageSwitcher.vue'
import ProjectImport from '../import/ProjectImport.vue'
import ThemeToggle from './ThemeToggle.vue'
import { useAppShell } from '../../composables/shell/useAppShell'
import { useFitByPriority } from '../../composables/ui/useFitByPriority'
import { summarizeProject } from '../../domain/project'
import { overviewUrl } from '../../overview/overviewRoute'
import { beadLabel } from '../../domain/beads'
import { TOUR_ENABLED } from '../../features'
import { controlAction } from '../../composables/shell/controlRegistry'

const {
  t,
  locale,
  projects,
  activeProject,
  onNewProject,
  activeBeadLabel,
  replaceBeadCandidates,
  onPickReplaceBead,
  onImportProjects,
  decodeImage,
  shortcutsHelpOpen,
  tour,
} = useAppShell()

/** The header, and whether it has had to drop the imports' labels to stay on one line (ticket 142). */
const headerEl = ref<HTMLElement>()
const compactImports = useFitByPriority(headerEl, [() => locale.value, () => !!activeProject.value])

const shortcutsAction = controlAction('shortcuts-help')
const newProjectAction = controlAction('new-project')

/** The header Menu's items by name; its Tooltip lists them (ticket 334). */
const menuItems = computed(() => [t.value.header.overviewItem, ...(TOUR_ENABLED ? [t.value.header.tourItem] : []), t.value.header.sourceItem])

const overviewHref = overviewUrl(import.meta.env.BASE_URL)

/** The repository's own URL (ADR 0031, ticket 269): the AGPL-3.0 network clause requires a hosted copy to link to its source. */
const SOURCE_URL = 'https://github.com/czAAA/bd-beads'

</script>

<template>
  <!--
    The header (ticket 142; Header card): 64px, in order — the brand; the open Project's summary and Bead pill (only
    while a Project is open) and Replace bead; a flexible gap; the two imports with their one-line results; New
    Project; EN / RU; the theme control; Keyboard shortcuts. Nothing shrinks but the Project's name. When it still
    doesn't fit, it fits by priority (`writing.md`, Fitting longer text): the imports drop their labels first
    (compactImports). Under 1024px there is no header at all (ticket 295, ADR 0032): its contents live in the Dock's
    Project and Menu sheets, and this stays mounted but `display: none`.
  -->
  <header ref="headerEl" class="app-header" :class="{ 'app-header--compact': compactImports }" data-testid="app-topbar">
    <h1 class="app-header__brand">
      <AppLogo class="app-header__mark" :size="22" />
      <span class="app-header__name">{{ t.app.title }}</span>
    </h1>

    <!-- The header menu (ticket 210; HeaderMenu card), next to the logo: Overview (ticket 77; Take the tour joins it in ticket 80) and Source code (ticket 269, the repo's own AGPL-3.0 link). -->
    <MenuButton :label="t.header.menuButton" icon="menu" icon-only :items="menuItems" data-testid="header-menu">
      <AppMenuItem icon="bead" :href="overviewHref" data-testid="menu-item-overview">
        {{ t.header.overviewItem }}
      </AppMenuItem>
      <AppMenuItem v-if="TOUR_ENABLED" icon="info" data-testid="menu-item-tour" @select="tour.start()">
        {{ t.header.tourItem }}
      </AppMenuItem>
      <!-- The repository is public under AGPL-3.0 (ADR 0031, ticket 269); this link is what the license's network clause requires a hosted copy to offer. -->
      <AppMenuItem icon="code" :href="SOURCE_URL" target="_blank" rel="noopener" data-testid="menu-item-source">
        {{ t.header.sourceItem }}
      </AppMenuItem>
    </MenuButton>

    <template v-if="activeProject">
      <p class="app-header__editing" data-testid="project-info">
        <AppTooltip :name="activeProject.name" :body="activeProject.frame ? summarizeProject(activeProject) : undefined" :announce="false">
          <span class="app-header__summary" data-testid="current-project-summary" tabindex="0">
            {{ summarizeProject(activeProject) }}
          </span>
        </AppTooltip>
        <BeadPill data-testid="current-project-bead">{{ activeBeadLabel }}</BeadPill>
      </p>
      <AppSelect
        variant="primary"
        data-testid="replace-bead-select"
        :aria-label="t.replaceBead.selectLabel"
        :value="''"
        @change="onPickReplaceBead($event.target as HTMLSelectElement)"
      >
        <option value="" disabled>{{ t.replaceBead.selectLabel }}</option>
        <option v-for="bead in replaceBeadCandidates" :key="bead.id" :value="bead.id">
          {{ beadLabel(bead) }}
        </option>
      </AppSelect>
    </template>

    <span class="app-header__gap" />

    <!-- Imported Projects go straight into the library, which decides what to open and persists them. -->
    <div class="app-header__imports" data-testid="project-actions">
      <ProjectImport :decode-image="decodeImage" :projects="projects" :compact="compactImports" @import="onImportProjects" />
    </div>
    <AppButton
      variant="primary"
      icon="plus"
      :action="newProjectAction"
      data-testid="new-project-button"
      :disabled="projects.length === 0"
      @click="onNewProject"
    />
    <LanguageSwitcher />
    <ThemeToggle />
    <!-- Keyboard shortcuts only helps a fine pointer or a keyboard (ticket 166; responsive.md "Input, not width"). -->
    <span class="app-header__shortcuts">
      <IconButton
        :action="shortcutsAction"
        shape="round"
        data-testid="shortcuts-button"
        @click="shortcutsHelpOpen = true"
      />
    </span>
  </header>
</template>

<style scoped>
/*
 * The header (ticket 142; Header card): 64px on `canvas`, a `line-soft` rule under it, items 10px apart, none
 * shrinking but the Project's name.
 */
.app-header {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--space-10);
  box-sizing: border-box;
  min-height: var(--header-height);
  padding: 0 var(--space-32);
  background: var(--canvas);
  border-bottom: 1px solid var(--line-soft);
}

/* The 24" and larger tier (ticket 83; responsive.md, bp-desktop): header padding 0 40 (no 40px spacing token: 2.5rem). */
@media (min-width: 1920px) {
  .app-header {
    padding-right: 2.5rem;
    padding-left: 2.5rem;
  }
}

/* No header under 1024px (ticket 295, ADR 0032): the screen belongs to the canvas. */
@media (max-width: 1023px) {
  .app-header {
    display: none;
  }
}

.app-header > * {
  flex: none;
}

.app-header__shortcuts {
  display: none;
}

@media (any-pointer: fine) {
  .app-header__shortcuts {
    display: inline-flex;
  }
}

.app-header__brand {
  display: flex;
  align-items: center;
  gap: var(--space-8);
  margin: 0 var(--space-10) 0 0;
}

.app-header__mark {
  color: var(--accent);
}

.app-header__name {
  font: var(--type-brand);
  letter-spacing: var(--tracking-brand);
  color: var(--ink);
}

/* The Project's summary and its Bead pill. */
.app-header__editing {
  display: flex;
  align-items: center;
  gap: var(--space-10);
  margin: 0;
}

/*
 * Only once the imports have dropped their labels may the Project's name give way, cut with an ellipsis (the second
 * fitting step); the Bead pill keeps its size.
 */
.app-header--compact > .app-header__editing {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
}

.app-header__summary {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  font: var(--type-control);
  color: var(--ink);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.app-header > .app-header__gap {
  flex: 1 1 0;
}

.app-header__imports {
  display: flex;
  align-items: center;
  gap: var(--space-10);
}
</style>
