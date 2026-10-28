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
import { loadLocale } from './i18n/useI18n'
import { browserDevicePreferences } from './services/devicePreferences'
import { loadProjects } from './services/libraryStore'
import { startOfflineShell } from './services/offlineShell'
import { installTouchFocusGuard } from './services/touchFocusGuard'
import { isEditorChosen, overviewUrl, shouldOpenOverview } from './overview/overviewRoute'

installTouchFocusGuard()
followDeviceTheme(window, document.documentElement, currentThemePick)

// A new visitor (an empty Project library) is sent to the Overview first (ticket 77).
if (shouldOpenOverview(loadProjects().length === 0, isEditorChosen())) {
  location.replace(overviewUrl(import.meta.env.BASE_URL))
} else {
  // Only the language in use is fetched before the app starts (ticket 0616); the splash shows meanwhile.
  void loadLocale(browserDevicePreferences.get('locale').value).then(() => {
    createApp(App).mount('#app')
    // The splash in index.html (ticket 69) has done its job once the app is on screen.
    document.getElementById('splash')?.remove()
    startOfflineShell(import.meta.env.BASE_URL)
  })
}
