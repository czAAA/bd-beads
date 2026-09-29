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

followDeviceTheme(window, document.documentElement, currentThemePick)

createApp(App).mount('#app')
