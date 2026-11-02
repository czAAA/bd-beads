import { effectScope, shallowRef, watch, type EffectScope } from 'vue'
import { DEFAULT_BEAD } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import type { CreateProjectInput } from '../../domain/createProject'
import type { DecodeImage } from '../../domain/imageConversion'
import type { Project } from '../../domain/project'
import { DEFAULT_TECHNIQUE } from '../../domain/weave'
import type { AppPage } from '../shell/useAppPage'
import { useDialogs, type Dialogs } from '../shell/useDialogs'
import { useConvertImageWizard, type ConvertImageWizard } from './useConvertImageWizard'

/** What the flow needs from the app shell: the dialog registry, the App pages, the library's add and the two services
 * the wizard reads through. */
export interface ConvertImageFlowDeps {
  dialogs?: Dialogs
  appPage: AppPage
  addProject: (project: Project) => void
  decodeImage: DecodeImage
  loadCatalog: (id: string) => Promise<ColorCatalog>
}

/** Convert image (spec 0645, ADR 0010, ADR 0086): an App page that makes a new Project, its setup its own. Open it from
 * New Project, the Menu's row or a picture dropped or pasted on the app; Create adds the Project it made, leaving adds
 * nothing and touches the open Project not at all. Once a picture is set it guards leaving: the person is asked first. */
export function useConvertImageFlow(deps: ConvertImageFlowDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  const { appPage } = deps
  /** The wizard while the page is showing; its effects live in a scope of their own, stopped when the page goes. */
  const session = shallowRef<ConvertImageWizard>()
  let scope: EffectScope | undefined
  /** The form's last values, for a picture dropped while the form is not shown. */
  const lastDraft = shallowRef<CreateProjectInput>({ name: '', technique: DEFAULT_TECHNIQUE, beadId: DEFAULT_BEAD.id, makerName: '' })

  function open(draft: CreateProjectInput = lastDraft.value, file?: File) {
    scope?.stop()
    scope = effectScope()
    const wizard = scope.run(() => useConvertImageWizard({ start: draft, decodeImage: deps.decodeImage, loadCatalog: deps.loadCatalog }))!
    session.value = wizard
    if (file) void wizard.setFile(file)
    appPage.open('convert-image')
  }

  // However the page goes (Create, or a leave the guard allowed), what was set up on it goes with it.
  watch(
    appPage.page,
    (page) => {
      if (page === 'convert-image') return
      scope?.stop()
      scope = undefined
      session.value = undefined
    },
    { flush: 'sync' },
  )

  /** A picture dropped or pasted on the app with no dialog and no other page showing: the converter opens with it set. */
  function onPicture(file: File): boolean {
    if (dialogs.open.value || appPage.page.value !== 'editor') return false
    open(lastDraft.value, file)
    return true
  }

  // --- Leaving -----------------------------------------------------------------------------------------------------

  const leaving = dialogs.flag('leave-converter')
  let answer: ((leave: boolean) => void) | undefined

  /** "Leave the converter?": resolves true on Leave, false on Back to converter (and on Escape). */
  function askToLeave(): Promise<boolean> {
    answer?.(false)
    return new Promise((resolve) => {
      answer = resolve
      leaving.value = true
    })
  }

  function settleLeave(leave: boolean) {
    leaving.value = false
    const resolve = answer
    answer = undefined
    resolve?.(leave)
  }

  // The guard is registered while a picture is set: with none there is nothing to lose, and leaving is at once.
  let unregister: (() => void) | undefined
  watch(
    () => session.value?.hasPicture.value ?? false,
    (hasPicture) => {
      unregister?.()
      unregister = hasPicture ? appPage.registerLeaveGuard(askToLeave) : undefined
    },
    { flush: 'sync' },
  )

  /** Create Project: the Project the wizard made joins the library and opens, and the page goes. */
  function onCreate() {
    const project = session.value?.createProject()
    if (!project) return
    appPage.open('editor')
    deps.addProject(project)
  }

  return {
    session,
    leaving,
    open,
    onPicture,
    onCreate,
    /** Close (×) and Escape on the page: the same way out as a Menu action that leaves. */
    onClose: () => void appPage.leave(),
    onConfirmLeave: () => settleLeave(true),
    onCancelLeave: () => settleLeave(false),
    onNewProjectDraft: (draft: CreateProjectInput) => (lastDraft.value = draft),
  }
}
