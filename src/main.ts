import { createApp } from 'vue'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/design-values.css'
import './styles/controls.css'
import './styles/contrast.css'
import './style.css'
import './styles/boxHandoff.css'
import { followDeviceTheme } from './theme/theme'
import { currentThemePick } from './theme/useThemePick'
import App from './App.vue'
import { loadLocale } from './i18n/useI18n'
import LibraryUnopened from './components/shell/LibraryUnopened.vue'
import { browserDevicePreferences } from './services/devicePreferences'
import { browserLibraryStore } from './services/libraryStore'
import { startOfflineShell } from './services/offlineShell'
import { installTouchFocusGuard } from './services/touchFocusGuard'
import { growIntoEditor } from './homepage/boxHandoff'
import { markArrived } from './homepage/homepageRoute'

installTouchFocusGuard()
followDeviceTheme(window, document.documentElement, currentThemePick)

/** The Projects on this device couldn't be opened (ADR 0094): the message with Reload, never the Homepage or the editor. */
function showUnopened(): void {
  void loadLocale(browserDevicePreferences.get('locale').value).then(() => {
    createApp(LibraryUnopened).mount('#app')
    document.getElementById('splash')?.remove()
  })
}

// The editor never sends anyone to the Homepage (ticket 1052): the main address is the Homepage's, and from here on
// it stays so in this tab.
markArrived()

void browserLibraryStore.count().then((count) => {
  if (count === 'unopened') {
    showUnopened()
    return
  }
  // Only the language in use is fetched before the app starts (ticket 0616), and the library's start (spec 1018); the
  // splash shows meanwhile.
  void Promise.all([loadLocale(browserDevicePreferences.get('locale').value), browserLibraryStore.start()]).then(([, started]) => {
    if (started === 'unopened') {
      showUnopened()
      return
    }
    createApp(App).mount('#app')
    // The splash in index.html (ticket 69) has done its job once the app is on screen.
    document.getElementById('splash')?.remove()
    void growIntoEditor()
    startOfflineShell(import.meta.env.BASE_URL)
  })
})
