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
import PrivacyPolicy from './components/shell/PrivacyPolicy.vue'

// The privacy policy's page (ticket 0082; `privacy/index.html`): the policy in English, with one line in the device's
// language saying so, and the way back to the Homepage.
followDeviceTheme(window, document.documentElement, currentThemePick)

void loadLocale(browserDevicePreferences.get('locale').value).then(() => {
  createApp({ render: () => h(PrivacyPolicy, { homepage: import.meta.env.BASE_URL }) }).mount('#app')
})
