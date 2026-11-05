import { computed, ref, shallowRef, watch } from 'vue'
import type { Rect } from '../../domain/canvas'
import { ImageConversionError, type ImageRejection } from '../../domain/imageConversion'
import { touch, type Project } from '../../domain/project'
import {
  fittedPlace,
  newReferenceImage,
  referenceHeight,
  replacedPicture,
  withReferenceImage,
  type OpacityStep,
  type ReferenceBox,
  type ReferenceImage,
  type ReferencePlace,
  type WidthLimits,
} from '../../domain/referenceImage'
import { referenceBoxPx, referenceWidthLimits, type DrawnReference } from '../../rendering/referenceImage'
import type { PictureStore } from '../../services/pictureStore'
import type { DrawablePicture, PreparedPicture } from '../../services/referencePicture'
import { useDialogs, type Dialogs } from '../shell/useDialogs'

/** What the reference image needs from the app shell: the open Project and its write path, the library's ids, where
 * pictures are kept and how they are made and read, and the panels it puts away or opens. */
export interface ReferenceImageFlowDeps {
  currentProject: () => Project | undefined
  replaceProject: (project: Project) => void
  /** Every Project id the library holds, sealed ones too: a picture of none of them is dropped. */
  libraryIds: () => readonly string[]
  store: PictureStore
  /** A picked file made ready to keep; throws an ImageConversionError for one Convert image would refuse. */
  prepare: (file: File) => Promise<PreparedPicture>
  decode: (blob: Blob) => Promise<DrawablePicture>
  /** The Canvas positions in view: what a picture is fitted inside on an empty Canvas without a Frame. */
  inView: () => Rect | undefined
  announce: (text: string) => void
  /** Opens the Project panel, where a refusal of a file picked from the strip button is told. */
  openProjectPanel: () => void
  /** Puts the open panel away, as Adjust opens. */
  closePanel: () => void
  /** The dialog registry Remove image asks through (ticket 0618); its own when none is given. */
  dialogs?: Dialogs
}

/** The Project panel's reference image section, by its fold id (usePanelSection). */
export const REFERENCE_SECTION_ID = 'project:reference'

/** Where a file was picked: the strip button, or the Project panel's section. */
export type PickedFrom = 'strip' | 'panel'

/** The open Project's picture as the flow holds it: its bytes, and once decoded, what draws it. */
interface LoadedPicture {
  projectId: string
  blob: Blob
  drawable?: DrawablePicture
}

/** The reference image (ReferenceImage card, ticket 0790, ADR 0089): its picture, kept on the device by Project id, shown,
 * hidden, its opacity and Adjust. A view like Background: saved through `replaceProject`, never an Undo step nor held by
 * Row progress; a device that won't keep the picture shows it for the session. */
export function useReferenceImageFlow(deps: ReferenceImageFlowDeps) {
  const dialogs = deps.dialogs ?? useDialogs()
  const removing = dialogs.flag('remove-reference-image')
  const image = computed(() => deps.currentProject()?.referenceImage)
  /** A picked file is being read and made smaller. */
  const preparing = ref(false)
  /** Why the last picked file was refused, told in the Project panel's section. */
  const refusal = ref<ImageRejection>()
  /** Adjust is on: the picture's outline and handles show, and the tools rest. */
  const adjusting = ref(false)
  /** The place a drag shows before it is let go and saved. */
  const draft = ref<ReferencePlace>()
  const loaded = shallowRef<LoadedPicture>()
  /** Pictures the device refused to keep, by Project id: shown for the session from here. */
  const session = new Map<string, Blob>()
  const unsaved = ref(new Set<string>())

  /** The Canvas's box, or the part in view on an empty Canvas without a Frame. */
  function box(project: Project): ReferenceBox {
    return referenceBoxPx(project, deps.inView())
  }

  const limits = computed<WidthLimits | undefined>(() => {
    const project = deps.currentProject()
    return project && referenceWidthLimits(project, box(project))
  })

  const drawn = computed<DrawnReference | undefined>(() => {
    const project = deps.currentProject()
    const shown = image.value
    const picture = loaded.value
    if (!project || !shown?.shown || picture?.projectId !== project.id || !picture.drawable) return undefined
    const place = draft.value ?? shown.place
    return { image: picture.drawable.image, place, height: referenceHeight({ picture: shown.picture, place }), opacity: shown.opacity }
  })

  /** The Project panel's thumbnail: the kept picture's address. */
  const thumbnail = computed(() => (loaded.value?.projectId === deps.currentProject()?.id ? loaded.value?.drawable?.url : undefined))
  /** The open Project's picture is shown but not kept on the device. */
  const notSaved = computed(() => {
    const project = deps.currentProject()
    return !!project?.referenceImage && unsaved.value.has(project.id)
  })

  function save(project: Project, next: ReferenceImage | undefined): void {
    deps.replaceProject(touch(withReferenceImage(project, next), {}))
  }

  function release(): void {
    loaded.value?.drawable?.release()
    loaded.value = undefined
  }

  /** Holds a Project's picture and decodes it to be drawn. */
  async function hold(projectId: string, blob: Blob): Promise<void> {
    release()
    const holding: LoadedPicture = { projectId, blob }
    loaded.value = holding
    try {
      const drawable = await deps.decode(blob)
      if (loaded.value === holding) loaded.value = { ...holding, drawable }
      else drawable.release()
    } catch {
      // A kept picture that no longer decodes: the Project keeps its settings and draws none.
    }
  }

  async function keep(projectId: string, blob: Blob): Promise<void> {
    const kept = await deps.store.put(projectId, blob)
    const refused = new Set(unsaved.value)
    if (kept) {
      session.delete(projectId)
      refused.delete(projectId)
    } else {
      session.set(projectId, blob)
      refused.add(projectId)
    }
    unsaved.value = refused
  }

  async function pictureOf(projectId: string): Promise<Blob | undefined> {
    return session.get(projectId) ?? (loaded.value?.projectId === projectId ? loaded.value.blob : undefined) ?? (await deps.store.get(projectId))
  }

  /** A picked file (the strip button's picker, Add reference image, Replace image): made ready and kept; a new picture is
   * fitted inside the Canvas's box and opens in Adjust, a replacement keeps the place. A refused file changes nothing
   * and says why in the Project panel's section, which opens for it when the strip button picked it. */
  async function pick(file: File, from: PickedFrom): Promise<void> {
    const started = deps.currentProject()
    if (!started) return
    refusal.value = undefined
    preparing.value = true
    let prepared: PreparedPicture
    try {
      prepared = await deps.prepare(file)
    } catch (error) {
      refusal.value = error instanceof ImageConversionError ? error.reason : 'decodeFailed'
      if (from === 'strip') deps.openProjectPanel()
      return
    } finally {
      preparing.value = false
    }
    const project = deps.currentProject()
    // The person moved to another Project while the picture was being made ready: it is not this one's.
    if (!project || project.id !== started.id) return
    const existing = project.referenceImage
    const next = existing ? replacedPicture(existing, prepared.picture) : newReferenceImage(prepared.picture, box(project))
    await keep(project.id, prepared.blob)
    const opened = hold(project.id, prepared.blob)
    save(deps.currentProject() ?? project, next)
    if (!existing) startAdjust()
    await opened
  }

  /** The strip button and `I`: shows or hides the picture. */
  function toggleShown(): void {
    const project = deps.currentProject()
    if (!project?.referenceImage) return
    if (project.referenceImage.shown) adjusting.value = false
    save(project, { ...project.referenceImage, shown: !project.referenceImage.shown })
  }

  function setOpacity(opacity: OpacityStep): void {
    const project = deps.currentProject()
    if (!project?.referenceImage || project.referenceImage.opacity === opacity) return
    save(project, { ...project.referenceImage, opacity })
  }

  /** Remove image asks first (ConfirmDialogs card). */
  function requestRemove(): void {
    if (image.value) removing.value = true
  }

  function cancelRemove(): void {
    removing.value = false
  }

  async function confirmRemove(): Promise<void> {
    removing.value = false
    const project = deps.currentProject()
    if (!project?.referenceImage) return
    adjusting.value = false
    draft.value = undefined
    release()
    session.delete(project.id)
    save(project, undefined)
    await deps.store.remove(project.id)
  }

  /** Adjust on canvas, and a new picture: shows a hidden picture first, so Adjust never handles an unseen one. */
  function startAdjust(): void {
    const project = deps.currentProject()
    if (!project?.referenceImage) return
    if (!project.referenceImage.shown) save(project, { ...project.referenceImage, shown: true })
    deps.closePanel()
    adjusting.value = true
  }

  /** Done, Escape or a press outside the picture. */
  function endAdjust(): void {
    if (draft.value) commit(draft.value)
    adjusting.value = false
  }

  /** A drag in Adjust, drawn as it goes and saved once it is let go. */
  function preview(place: ReferencePlace): void {
    draft.value = place
  }

  /** A change Adjust makes, saved: a drag let go, a key, Fit to Canvas; announced where it says so. */
  function commit(place: ReferencePlace, announcement?: string): void {
    draft.value = undefined
    const project = deps.currentProject()
    if (!project?.referenceImage) return
    save(project, { ...project.referenceImage, place })
    if (announcement) deps.announce(announcement)
  }

  /** Fit to Canvas: back to the new picture's fit, upright; Adjust stays on. */
  function fit(): void {
    const project = deps.currentProject()
    if (project?.referenceImage) commit(fittedPlace(project.referenceImage.picture, box(project)))
  }

  /** Duplicate: the copy of the open Project gets its picture too, where it has one. */
  async function copyToDuplicate(copy: Project): Promise<void> {
    const source = deps.currentProject()
    if (!source?.referenceImage || source.id === copy.id) return
    const blob = await pictureOf(source.id)
    if (blob) await keep(copy.id, blob)
  }

  /** The pictures an export carries, of those Projects that have one. */
  async function picturesOf(projectIds: readonly string[]): Promise<Map<string, Blob>> {
    const found = await Promise.all(projectIds.map(async (id) => [id, await pictureOf(id)] as const))
    return new Map(found.filter((entry): entry is readonly [string, Blob] => entry[1] !== undefined))
  }

  /** Import a project: each Project's picture kept under the id it came in under. */
  async function keepImported(pictures: ReadonlyMap<string, Blob>): Promise<void> {
    await Promise.all([...pictures].map(([id, blob]) => keep(id, blob)))
  }

  // The open Project's picture is read from the device when it opens, or when its settings arrive with no picture held.
  watch(
    () => {
      const project = deps.currentProject()
      return project?.referenceImage ? project.id : undefined
    },
    async (projectId) => {
      adjusting.value = adjusting.value && projectId !== undefined && loaded.value?.projectId === projectId
      draft.value = undefined
      if (projectId === undefined) return release()
      if (loaded.value?.projectId === projectId) return
      const blob = await pictureOf(projectId)
      if (blob && deps.currentProject()?.id === projectId) await hold(projectId, blob)
    },
    { immediate: true },
  )

  // A Project gone from the library (Delete, Delete all, removed from Saved Projects) takes its picture with it; at
  // start, every picture of no Project is dropped.
  void deps.store.keepOnly(new Set(deps.libraryIds()))
  watch(
    () => deps.libraryIds(),
    (now, before) => {
      const kept = new Set(now)
      for (const id of before ?? []) {
        if (kept.has(id)) continue
        session.delete(id)
        void deps.store.remove(id)
      }
    },
  )

  return {
    image,
    drawn,
    thumbnail,
    notSaved,
    preparing,
    refusal,
    adjusting,
    limits,
    removing,
    pick,
    toggleShown,
    setOpacity,
    requestRemove,
    cancelRemove,
    confirmRemove,
    startAdjust,
    endAdjust,
    preview,
    commit,
    fit,
    copyToDuplicate,
    picturesOf,
    keepImported,
  }
}
