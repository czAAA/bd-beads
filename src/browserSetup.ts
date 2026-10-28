// The app's own styles and fonts, so a component mounted in a browser test looks as it does in the app (ticket 552).
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/design-values.css'
import './styles/controls.css'
import './styles/contrast.css'
import './style.css'

import { afterEach } from 'vitest'
import { LOCALES } from './domain/locale'
import { loadLocale } from './i18n/useI18n'
import { unmountAll } from './testUtils/browserFit'

// Every language, as a test mounts in any of them at once; the app itself fetches only the one in use (ticket 0616).
await Promise.all(LOCALES.map(loadLocale))

afterEach(() => {
  unmountAll()
  localStorage.clear()
})
