import { createApp, h } from 'vue'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/design-values.css'
import '../styles/controls.css'
import '../styles/contrast.css'
import '../style.css'
import { followDeviceTheme } from '../theme/theme'
import { currentThemePick } from '../theme/useThemePick'
import { loadProjects } from '../services/libraryStore'
import { startOfflineShell } from '../services/offlineShell'
import { markEditorChosen } from './homepageRoute'
import HomePage from './HomePage.vue'

// The Homepage is its own page beside the editor (ticket 77), so it starts the same way main.ts does.
followDeviceTheme(window, document.documentElement, currentThemePick)

const base = import.meta.env.BASE_URL

/** Both ways in leave for the editor; the tab remembers it, so the main address doesn't send the visitor back here. */
function goToEditor() {
  markEditorChosen()
  location.assign(base)
}

createApp({
  render: () =>
    h(HomePage, {
      projectCount: loadProjects().length,
      onMakeFirstProject: goToEditor,
      onOpenEditor: goToEditor,
    }),
}).mount('#app')

// A first visit that lands here still downloads the offline copy of the whole app (ticket 69).
startOfflineShell(base)
