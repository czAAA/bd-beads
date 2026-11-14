import { watchEffect } from 'vue'

/** The tab's title for the editor (ticket 0986): "{name} · openbeads" while a Project is open, the app's name with none,
 * at every width, so a phone whose strip shows no name still says which Project this is. */
export function useDocumentTitle(deps: { projectName: () => string | undefined; appTitle: () => string }) {
  watchEffect(() => {
    const name = deps.projectName()
    document.title = name ? `${name} · ${deps.appTitle()}` : deps.appTitle()
  })
}
