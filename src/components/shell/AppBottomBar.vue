<script setup lang="ts">
import AppButton from '../ui/AppButton.vue'
import AppDock from '../tools/AppDock.vue'
import IconButton from '../ui/IconButton.vue'
import ProjectImport from '../import/ProjectImport.vue'
import { useAppShell } from '../../composables/shell/useAppShell'

const {
  t,
  settingFrame,
  inputMode,
  inputModeAvailable,
  toggleInputMode,
  projects,
  activeProject,
  framing,
  activeTool,
  selectedColorId,
  onImportProjects,
  decodeImage,
  onImportToast,
  openPhoneSheet,
  onSelectPhoneSheet,
  phoneNewProjectOpen,
} = useAppShell()
</script>

<template>
  <!--
    Bottom of the phone layout (under 1024px, ticket 295): two states. With no Project open, a focused project-management
    bar (New Project + Import + Import QR) replaces the Dock so the first action is immediately obvious, with the Menu
    button at its bottom right so language and theme stay reachable. Once a Project is open the Dock appears.
  -->
  <div v-if="!framing && !activeProject" class="app-shell__phone-project-bar" data-testid="phone-project-bar">
    <AppButton variant="primary" icon="plus" data-testid="phone-bar-new-project" data-tour="phone-new-project" @click="phoneNewProjectOpen = true">
      {{ t.projects.newProjectButton }}
    </AppButton>
    <ProjectImport :decode-image="decodeImage" compact toast-results :projects="projects" testid-prefix="phone-bar-" @import="onImportProjects" @import-result="onImportToast" />
    <IconButton tooltip icon="menu" :label="t.header.menuButton" data-testid="phone-bar-menu" @click="openPhoneSheet = 'menu'" />
  </div>
  <AppDock
    v-else-if="!framing && !!activeProject"
    class="app-shell__dock"
    :active-tool="activeTool"
    :selected-color-id="selectedColorId"
    :open-sheet="openPhoneSheet"
    :setting-frame="settingFrame"
    :input-mode="inputModeAvailable ? inputMode : undefined"
    @toggle-input-mode="toggleInputMode"
    @select-sheet="onSelectPhoneSheet"
  />
</template>

<style scoped>
/* The phone layout's Dock (ticket 79, 295): a flex sibling of the body, shown under 1024px. */
.app-shell__dock {
  display: none;
}

/* Project-management bar: shown instead of the Dock when no Project is open. */
.app-shell__phone-project-bar {
  display: none;
}

@media (max-width: 1023px) {
  .app-shell__dock {
    display: flex;
    flex: none;
  }

  .app-shell__phone-project-bar {
    display: flex;
    flex: none;
    align-items: center;
    gap: var(--space-4);
    height: var(--dock-height);
    /* Tight enough that New Project, both imports and Menu fit a 320px screen in Russian. */
    padding: 0 var(--space-12);
    padding-bottom: env(safe-area-inset-bottom);
    background: var(--canvas);
    border-top: 1px solid var(--line-soft);
  }

  /* New Project grows to take the remaining width; the import icons and Menu sit at a fixed square size beside it. */
  .app-shell__phone-project-bar :deep(.app-button) {
    flex: 1 1 0;
  }
}
</style>
