import { effectScope, shallowRef, watch, type EffectScope, type Ref } from 'vue'
import { DEFAULT_BEAD } from '../../domain/beads'
import type { ColorCatalog } from '../../domain/colorCatalog'
import { converterStart, type ConvertChoices } from '../../domain/convertChoices'
import type { CreateProjectInput } from '../../domain/createProject'
import type { DecodeImage } from '../../domain/imageConversion'
import type { Grid, Project } from '../../domain/project'
import type { AllSettingsRequest } from '../project/usePictureBarFlow'
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
  /** What Close goes on to once the page has gone: the New Project form while no Project is open (ticket 0861). */
  onClosed?: () => void
  /** Add to Canvas (ticket 0883): the converted beads put on the open Project where the reference image lies. */
  addToCanvas?: (grid: Grid, request: AllSettingsRequest) => void
  /** The last conversion's choices, kept on the device (ticket 0893): the converter opens on them, Create Project sets them. */
  convertChoices: Ref<ConvertChoices>
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

  /** The reference image's All settings that opened the page, whose beads Add to Canvas puts on the open Project. */
  let fromReference: AllSettingsRequest | undefined

  function open(draft: CreateProjectInput = lastDraft.value, file?: File, request?: AllSettingsRequest): ConvertImageWizard {
    scope?.stop()
    scope = effectScope()
    fromReference = request
    // From the reference image the page keeps what it was opened with; else what this device used last (ticket 0893).
    const { start, source } = request ? { start: draft, source: undefined } : converterStart(draft, deps.convertChoices.value)
    const wizard = scope.run(() =>
      useConvertImageWizard({ start, startSource: source, decodeImage: deps.decodeImage, loadCatalog: deps.loadCatalog, addsToCanvas: !!request }),
    )!
    session.value = wizard
    if (file) void wizard.setFile(file)
    appPage.open('convert-image')
    return wizard
  }

  /** All settings in the reference image's Convert to beads (ticket 0883, ConvertImage card): the page opens with the
   * picture, the size it covers, the open Project's Bead and Weave, the match and the color count set, and ends in Add to
   * Canvas. */
  async function openFromReference(request: AllSettingsRequest, draft: CreateProjectInput): Promise<void> {
    const wizard = open(draft, undefined, request)
    await wizard.setFile(new File([request.picture], request.name, { type: request.picture.type }))
    if (session.value !== wizard || !wizard.hasPicture.value) return
    wizard.setLinked(false)
    wizard.setWidth(request.box.columns)
    wizard.setHeight(request.box.rows)
    wizard.setSource(request.source)
    wizard.setMaxColors(request.colors)
  }

  // However the page goes (Create, or a leave the guard allowed), what was set up on it goes with it.
  watch(
    appPage.page,
    (page) => {
      if (page === 'convert-image') return
      scope?.stop()
      scope = undefined
      session.value = undefined
      fromReference = undefined
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

  /** Close (×), Escape and the browser's Back on the page: the same way out as a Menu action that leaves, then on to
   * where the person came from. True once the page has gone, false when the person stayed. */
  async function close(): Promise<boolean> {
    if (!(await appPage.leave())) return false
    deps.onClosed?.()
    return true
  }

  /** Create Project: the Project the wizard made joins the library and opens, and the page goes. */
  function onCreate() {
    const request = fromReference
    if (request && session.value) {
      const grid = session.value.canvasGrid()
      appPage.open('editor')
      deps.addToCanvas?.(grid, request)
      return
    }
    const wizard = session.value
    const project = wizard?.createProject()
    if (!wizard || !project) return
    deps.convertChoices.value = {
      beadId: wizard.bead.value.id,
      technique: wizard.technique.value,
      techniqueSettings: wizard.techniqueSettings.value,
      ...(wizard.chosenSource.value ? { source: wizard.chosenSource.value } : {}),
    }
    appPage.open('editor')
    deps.addProject(project)
  }

  return {
    session,
    leaving,
    open,
    openFromReference,
    onPicture,
    onCreate,
    onClose: close,
    onConfirmLeave: () => settleLeave(true),
    onCancelLeave: () => settleLeave(false),
    onNewProjectDraft: (draft: CreateProjectInput) => (lastDraft.value = draft),
  }
}
