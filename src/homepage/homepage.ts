import { createApp, h } from 'vue'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/design-values.css'
import '../styles/controls.css'
import '../styles/contrast.css'
import '../style.css'
import { followDeviceTheme } from '../theme/theme'
import { currentThemePick } from '../theme/useThemePick'
import { loadLocale } from '../i18n/useI18n'
import { browserDevicePreferences } from '../services/devicePreferences'
import { browserLibraryStore, storedProjectCount } from '../services/libraryStore'
import { startOfflineShell } from '../services/offlineShell'
import { browserOpeningNote } from '../services/openingNote'
import { downloadFile } from '../services/fileDownload'
import { packLibraryFile } from '../services/projectFileCodec'
import { useProjectLibrary } from '../composables/project/useProjectLibrary'
import { libraryFileName } from '../domain/projectFile'
import { projectAddress, savedProjectsAddress } from '../domain/openingAddress'
import type { Project } from '../domain/project'
import type { SealedProject } from '../domain/sealedProject'
import { markEditorChosen } from './homepageRoute'
import HomePage from './HomePage.vue'

// The Homepage is its own page beside the editor (ticket 77), so it starts the same way main.ts does.
followDeviceTheme(window, document.documentElement, currentThemePick)

const base = import.meta.env.BASE_URL

/** Every way in leaves for the editor, at its plain address or one asking for Saved Projects or a Project (ticket
 * 0716); the tab remembers it, so the main address doesn't send the visitor back here. */
function goToEditor(address = base) {
  markEditorChosen()
  location.assign(address)
}

/** Export all from the Menu's Saved Projects: a sealed Project is written from its stored form (ticket 0716). */
async function exportAll(projects: Project[], sealed: SealedProject[]) {
  await downloadFile(libraryFileName(), await packLibraryFile(projects, sealed.map((project) => project.stored)), 'application/json')
}

// Only the language in use is fetched before the page starts (ticket 0616).
void loadLocale(browserDevicePreferences.get('locale').value).then(() => {
  createApp({
    render: () =>
      h(HomePage, {
        projectCount: storedProjectCount(),
        // Decoded only when the Menu shows Saved Projects; a gated Project, or one that didn't open, stays stored.
        openLibrary: () => useProjectLibrary(browserLibraryStore, undefined, { held: browserOpeningNote.read()?.id }),
        onMakeFirstProject: () => goToEditor(),
        onOpenEditor: () => goToEditor(),
        onOpenSavedProjects: () => goToEditor(savedProjectsAddress(base)),
        onOpenProject: (id: string) => goToEditor(projectAddress(base, id)),
        onExportAll: exportAll,
      }),
  }).mount('#app')

  // A first visit that lands here still downloads the offline copy of the whole app (ticket 69).
  startOfflineShell(base)
})
