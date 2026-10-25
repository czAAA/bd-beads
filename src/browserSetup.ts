// The app's own styles and fonts, so a component mounted in a browser test looks as it does in the app (ticket 552).
import './styles/fonts.css'
import './styles/tokens.css'
import './styles/design-values.css'
import './styles/controls.css'
import './styles/contrast.css'
import './style.css'

import { afterEach } from 'vitest'
import { unmountAll } from './testUtils/browserFit'

afterEach(() => {
  unmountAll()
  localStorage.clear()
})
