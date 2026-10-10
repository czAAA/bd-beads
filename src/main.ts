import { createApp } from 'vue'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/design-values.css'
import './styles/controls.css'
import './styles/contrast.css'
import './style.css'
import { followDeviceTheme } from './theme/theme'
import { currentThemePick } from './theme/useThemePick'
import App from './App.vue'
import { loadProjects } from './services/libraryStore'
import { loadTourStatus } from './services/tourStore'
import { startOfflineShell } from './services/offlineShell'
import { isEditorChosen, overviewUrl, shouldOpenOverview } from './overview/overviewRoute'

followDeviceTheme(window, document.documentElement, currentThemePick)

// A new visitor (an empty Project library, the Tour neither finished nor turned off) is sent to the Overview first (ticket 77).
if (shouldOpenOverview(loadProjects().length === 0, loadTourStatus(), isEditorChosen())) {
  location.replace(overviewUrl(import.meta.env.BASE_URL))
} else {
  createApp(App).mount('#app')
  // The splash in index.html (ticket 69) has done its job once the app is on screen.
  document.getElementById('splash')?.remove()
  if (import.meta.env.PROD) {
    startOfflineShell(import.meta.env.BASE_URL)
  }
}
