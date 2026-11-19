import { createApp, h } from 'vue'
import '../styles/fonts.css'
import '../styles/tokens.css'
import '../styles/design-values.css'
import '../styles/controls.css'
import '../styles/contrast.css'
import '../style.css'
import '../styles/boxHandoff.css'
import { followDeviceTheme } from '../theme/theme'
import { currentThemePick } from '../theme/useThemePick'
import { followAddressLocale, pagesBase } from '../i18n/addressLocale'
import { loadLocale } from '../i18n/useI18n'
import { browserDevicePreferences } from '../services/devicePreferences'
import { browserLibraryStore } from '../services/libraryStore'
import { browserAppUpdates, startOfflineShell } from '../services/offlineShell'
import { browserOpeningNote } from '../services/openingNote'
import { downloadFile } from '../services/fileDownload'
import { packLibraryFile, packProjectFile, packStoredProjectFile } from '../services/projectFileCodec'
import { useProjectLibrary } from '../composables/project/useProjectLibrary'
import { libraryFileName, projectFileName, projectFileNameOf } from '../domain/projectFile'
import { convertImageAddress, firstProjectAddress, firstStarterAddress, newProjectAddress, projectAddress, savedProjectsAddress } from '../domain/openingAddress'
import type { Project } from '../domain/project'
import type { SealedProject } from '../domain/sealedProject'
import { signInAddress } from '../domain/account'
import { browserAccount } from '../services/account'
import { browserFeedback } from '../services/feedback'
import { notesFromBase } from '../services/notesFile'
import { browserPictureStore } from '../services/pictureStore'
import { browserPersistentStorage } from '../services/persistentStorage'
import { leaveWithBox } from './boxHandoff'
import { keepDemoCopy, type DemoSnapshot } from './demoCopy'
import { editorUrl, hasArrived, markArrived, shouldOpenEditor, WHATS_NEW_HASH } from './homepageRoute'
import HomePage from './HomePage.vue'

// The Homepage is its own page beside the editor (ticket 77), at the main address (ticket 1052), so it starts the same
// way main.ts does.
followDeviceTheme(window, document.documentElement, currentThemePick)

const base = import.meta.env.BASE_URL
// A language's code in the address (ticket 1053) is the device's language from now on, read before it is loaded.
followAddressLocale(browserDevicePreferences.get('locale'))
/** The editor's address, under the address's language folder when it names one, so the way in keeps the code. */
const editor = () => editorUrl(pagesBase())

/** Every way in leaves for the editor, at its plain address or one asking for Saved Projects, a Project (ticket 0716)
 * or the first Project (ticket 0866). Its content leaves first and its canvas box grows into the editor's (tickets
 * 0776, 0783). */
async function goToEditor(address = editor()) {
  await leaveWithBox(document.querySelector('.homepage'))
  location.assign(address)
}

/** The library's start, begun with the page and not waited for (spec 1018): the page shows after the count alone. */
const libraryStarted = browserLibraryStore.start()

/** The beader's library, opened once it has started: by the Menu's Saved Projects (ticket 0716) or by Open editor from
 * here. A gated Project, or one that didn't open, stays stored. */
let library: ReturnType<typeof useProjectLibrary> | undefined
const openLibrary = async () => {
  if ((await libraryStarted) === 'unopened') throw new Error('The library could not be opened')
  return (library ??= useProjectLibrary(browserLibraryStore, { held: browserOpeningNote.read()?.id }))
}

/** What's inside's Open editor from here (ticket 0879): the demo's Project kept in the library, its picture beside it,
 * and the editor opened on it at the demo's view, as every way in leaves. */
async function openDemoCopy(snapshot: DemoSnapshot) {
  let opened: Awaited<ReturnType<typeof openLibrary>>
  try {
    opened = await openLibrary()
  } catch {
    // The Projects couldn't be opened: the editor's own address says so, with Reload.
    await goToEditor()
    return
  }
  const id = await keepDemoCopy(snapshot, { library: opened, pictures: browserPictureStore })
  await goToEditor(projectAddress(editor(), id, snapshot.view))
}

/** Export all from the Menu's Saved Projects: a sealed Project is written from its stored form (ticket 0716). */
async function exportAll(projects: Project[], sealed: SealedProject[]) {
  await downloadFile(libraryFileName(), await packLibraryFile(projects, sealed.map((project) => project.stored)), 'application/json')
}

/** The Delete dialog's Save Project file (ticket 0842): one Project's file, a sealed one written from its stored form. */
async function saveProjectFile(project: Project | SealedProject) {
  const [name, contents] =
    'stored' in project
      ? [projectFileNameOf(project.name, project.makerName), await packStoredProjectFile(project.stored)]
      : [projectFileName(project), await packProjectFile(project)]
  await downloadFile(name, contents, 'application/json')
}

// Only the language in use is fetched before the page starts (ticket 0616), and the count of Projects (spec 1018).
void Promise.all([loadLocale(browserDevicePreferences.get('locale').value), browserLibraryStore.count()]).then(([, counted]) => {
  // A maker with Projects who opens the main address as a tab's first page lands in the editor (ticket 1052).
  if (shouldOpenEditor(counted, hasArrived())) {
    location.replace(editor())
    return
  }
  markArrived()
  createApp({
    render: () =>
      h(HomePage, {
        // An unknown count is shown as none, with the Saved Projects list saying why (spec 1018).
        projectCount: counted === 'unopened' ? 0 : counted,
        libraryUnopened: counted === 'unopened',
        feedback: browserFeedback,
        // What's new's notes, this Build's file in the language shown, read when it opens (ticket 1047).
        notes: notesFromBase(base),
        // "Update ready"'s What's new (ticket 1048) opens the page at What's new, unfolded and in view.
        atWhatsNew: location.hash === WHATS_NEW_HASH,
        // What waits for Reload, heard through the same port as the editor's "Update ready" (ticket 1049).
        updates: browserAppUpdates,
        // The Menu's Account section and Kept by this browser, as in the editor (ticket 1113); a signed-in person's
        // change of language, theme or Lifted pieces here is sent as the editor sends it (ticket 1086).
        account: browserAccount,
        persistentStorage: browserPersistentStorage,
        // Decoded only when the Menu shows Saved Projects or Open editor from here keeps the demo's Project.
        openLibrary,
        // The first Project is made at once and opens on the Canvas, no form first (ticket 0866).
        onMakeFirstProject: () => goToEditor(firstProjectAddress(editor())),
        // Start from a ready design: the same, opened on the Frame panel's Starter gallery (ticket 0953).
        onStartFromStarter: () => goToEditor(firstStarterAddress(editor())),
        onOpenEditor: () => goToEditor(),
        // Create free account (ticket 0391): the editor, opened on the Sign in Subpanel.
        onCreateAccount: () => goToEditor(signInAddress(editor())),
        onOpenSavedProjects: () => goToEditor(savedProjectsAddress(editor())),
        // The Menu's rows only the editor can do (ticket 1113): the editor opens on the form, or on the page.
        onNewProject: () => goToEditor(newProjectAddress(editor())),
        onConvertImage: () => goToEditor(convertImageAddress(editor())),
        onOpenProject: (id: string) => goToEditor(projectAddress(editor(), id)),
        onOpenDemoCopy: openDemoCopy,
        onExportAll: exportAll,
        onSaveProjectFile: saveProjectFile,
      }),
  }).mount('#app')

  // A first visit that lands here still downloads the offline copy of the whole app (ticket 69).
  startOfflineShell(base)
})
