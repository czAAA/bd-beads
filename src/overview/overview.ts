import { createApp, h } from 'vue'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/design-values.css'
import '../styles/controls.css'
import '../styles/contrast.css'
import '../style.css'
import { followDeviceTheme } from '../theme/theme'
import { currentThemePick } from '../theme/useThemePick'
import { loadPatterns } from '../services/libraryStore'
import { saveTourProgress, saveTourStatus } from '../services/tourStore'
import { markEditorChosen, overviewUrl } from './overviewRoute'
import OverviewPage from './OverviewPage.vue'

// The Overview is its own page beside the editor (ticket 77), so it starts the same way main.ts does.
followDeviceTheme(window, document.documentElement, currentThemePick)

const base = import.meta.env.BASE_URL

/** Both ways in leave for the editor; the tab remembers it, so the main address doesn't send the visitor back here. */
function goToEditor() {
  markEditorChosen()
  location.assign(base)
}

createApp({
  render: () =>
    h(OverviewPage, {
      patternCount: loadPatterns().length,
      overviewHref: overviewUrl(base),
      onMakeFirstPattern: () => {
        saveTourStatus('running')
        goToEditor()
      },
      onOpenEditor: goToEditor,
      // The menu's Take the tour starts over from step 1, whatever was done before.
      onTakeTour: () => {
        saveTourProgress({ done: [] })
        saveTourStatus('running')
        goToEditor()
      },
    }),
}).mount('#app')
