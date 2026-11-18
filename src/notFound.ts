import { createApp, h } from 'vue'
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/design-values.css'
import './styles/controls.css'
import './styles/contrast.css'
import './style.css'
import { followDeviceTheme } from './theme/theme'
import { currentThemePick } from './theme/useThemePick'
import { loadLocale } from './i18n/useI18n'
import { browserDevicePreferences } from './services/devicePreferences'
import PageNotFound from './components/shell/PageNotFound.vue'

// The page the host shows at an address with no page (ticket 1053; `404.html`), in the device's language, leading to
// the Homepage at the main address.
followDeviceTheme(window, document.documentElement, currentThemePick)

void loadLocale(browserDevicePreferences.get('locale').value).then(() => {
  createApp({ render: () => h(PageNotFound, { homepage: import.meta.env.BASE_URL }) }).mount('#app')
})
