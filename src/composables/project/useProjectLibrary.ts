import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { inSavedOrder, markSaved, mergeLibrary, mostRecentlyUpdated } from '../../domain/projectLibrary'
import type { Project } from '../../domain/project'
import { gated, type ProjectSummary, type SealedProject } from '../../domain/sealedProject'
import { projectNameOf } from '../../domain/layerRecord'
import { withFreeNames } from '../../domain/projectName'
import type { LibraryEntry } from './useSavedProjectConfirms'
import { browserLibraryStore, type HeldProject, type LibraryStore } from '../../services/libraryStore'
import type { ProjectLocks } from '../../services/projectLocks'

/** How a change to a Project should reach storage (see replaceProject). */
export interface ReplaceOptions {
  /** Don't write yet, only remember there is something to write for a flushPendingSave(): a stroke writes once at
   * its end, not per mousemove (ticket 55). */
  deferSave?: boolean
}

export interface ProjectLibrary {
  /** Every Project on this device (CONTEXT.md's Project library), most recently saved first — the source of truth
   * persistence follows. Shallow (ticket 0616): a Project is only ever replaced whole, so it is held as it is and its
   * beads are read without a reactive proxy in the way. */
  projects: ShallowRef<Project[]>
  /** The Projects kept sealed in their stored form (ticket 0716): over the size gate, or the one that didn't open last
   * time. Listed in Saved Projects, never open; picking one opens it (openSealed). */
  sealed: ShallowRef<SealedProject[]>
  /** Decodes a sealed Project and opens it. */
  openSealed: (id: string) => void
  /** A Project of the library by id, decoded or sealed, as the Saved Projects questions name it. */
  entryOf: (id: string) => LibraryEntry | undefined
  /** Opens a Project by id: a sealed one is decoded first. */
  openProject: (id: string) => void
  /** Which Project is open, or none (the New Project form). Writable: opening a Project is just setting this. */
  activeProjectId: Ref<string | undefined>
  activeProject: ComputedRef<Project | undefined>
  /** Whether the last attempted write to storage failed, so the UI can say so rather than losing the edit silently. */
  saveFailed: Ref<boolean>
  /** Whether the library in memory has changes storage hasn't taken yet (a deferred stroke or a refused write): the
   * Project panel's "unsaved". */
  unsaved: Ref<boolean>
  addProject: (project: Project) => void
  /** Adds imported Projects under names the library doesn't hold yet and hands back what joined (ticket 0860). */
  addProjects: (projects: Project[]) => Project[]
  /** Every name the library holds, sealed Projects' too: what a new or imported name must not repeat (tickets 0860, 0866). */
  names: () => string[]
  replaceProject: (project: Project, options?: ReplaceOptions) => void
  removeProject: (id: string) => void
  /** Removes every Project from this device and leaves none open (Menu's Delete all Projects, ticket 443). */
  removeAllProjects: () => void
  flushPendingSave: () => void
  /** Writes the library now, pending change or not, and says whether storage took it (ticket 115's Save). */
  saveNow: () => boolean
  /** Whether the open Project is open in another tab, which had it first (ticket 0834): this tab then shows that tab's
   * beads as it stores them and writes none of its own changes to it. Never, for a library given no locks. */
  openElsewhere: ComputedRef<boolean>
}

const isSealed = (project: HeldProject): project is SealedProject => 'stored' in project

function byId(projects: readonly HeldProject[]): Map<string, HeldProject> {
  return new Map(projects.map((project) => [project.id, project]))
}

/** Runs a take-in where nothing can show its failure, ignoring it: the next save tries again and says so. */
function quietly(work: () => void): void {
  try {
    work()
  } catch {
    // Unreadable or blocked storage: memory stays as it is.
  }
}

// The Project library: Projects on this device, which is open, and persisting them (ADR 0001, localStorage; ADR 0012).
// Each mutator saves or marks a save pending (ticket 55). A save takes in what other tabs stored, then writes the whole
// library, so it touches only what this tab changed and also persists what a failed one left (tickets 145, 0834).
export function useProjectLibrary(
  store: LibraryStore = browserLibraryStore,
  /** `held`: the Project that didn't open last time (safe start, ticket 0716), kept sealed, and then none opens.
   * `locks`: the tabs' locks on the open Project (ticket 0834), for the editor; the Homepage's list opens none. */
  { held, locks }: { held?: string; locks?: ProjectLocks } = {},
): ProjectLibrary {
  // A Project over the size gate stays in its stored form and never opens on its own (ticket 0716).
  const opened = store.open((summary) => summary.id === held || gated(summary))
  const projects = shallowRef<Project[]>(inSavedOrder(opened.projects))
  const sealed = shallowRef<SealedProject[]>(opened.sealed)
  const activeProjectId = ref<string | undefined>(held === undefined ? mostRecentlyUpdated(projects.value)?.id : undefined)
  const activeProject = computed(() =>
    projects.value.find((project) => project.id === activeProjectId.value),
  )

  /** What storage held when this tab last read or wrote it: a Project that differs from it was changed here. */
  let known = byId([...opened.projects, ...opened.sealed])
  let revision = opened.revision
  /** The Project open here that another tab had open first (ticket 0834), whose stored copy this tab keeps to. */
  const heldElsewhere = ref<string>()
  /** The Project this tab has asked for and not yet heard about: kept to its stored copy too, until the answer. */
  let asking: string | undefined

  /** The library as this tab holds it now. */
  const inMemory = (): HeldProject[] => [...projects.value, ...sealed.value]

  /** Holds the merged library in memory; the open Project, if another tab removed it, gives way as on a removal. */
  function hold(merged: HeldProject[]): void {
    const here = new Set<HeldProject>(inMemory())
    if (merged.length === here.size && merged.every((project) => here.has(project))) return
    projects.value = inSavedOrder(merged.filter((project): project is Project => !isSealed(project)))
    sealed.value = merged.filter(isSealed)
    if (activeProjectId.value !== undefined && !projects.value.some((project) => project.id === activeProjectId.value)) {
      activeProjectId.value = mostRecentlyUpdated(projects.value)?.id
    }
  }

  let takingIn = false
  /** Takes in what other tabs stored since this tab last read or wrote (ticket 0834), this tab's own changes on top,
   * and the Project another tab has open first as that tab stored it. In memory only: the write is save's. */
  function takeIn(): void {
    // The open Project giving way below re-claims, which takes in again: once is enough.
    if (takingIn) return
    takingIn = true
    try {
      mergeStored()
    } finally {
      takingIn = false
    }
  }

  function mergeStored(): void {
    const decoded = new Set(projects.value.map((project) => project.id))
    const kept = new Set(sealed.value.map((project) => project.id))
    const keepSealed = (summary: ProjectSummary) => !decoded.has(summary.id) && (kept.has(summary.id) || gated(summary))
    const fresh = store.reread(revision, keepSealed, [...inMemory(), ...known.values()])
    const stored = fresh ? [...fresh.projects, ...fresh.sealed] : [...known.values()]
    hold(mergeLibrary(inMemory(), known, stored, (id) => id !== heldElsewhere.value && id !== asking))
    if (fresh) {
      known = byId(stored)
      revision = fresh.revision
    }
  }

  const saveFailed = ref(false)
  /** Whether the library in memory has changes storage hasn't taken yet — a deferred stroke, or a write that threw. */
  const savePending = ref(false)

  function save(): void {
    try {
      takeIn()
      revision = store.save(projects.value, sealed.value)
      known = byId(inMemory())
      savePending.value = false
      saveFailed.value = false
    } catch {
      // Out of quota, or storage refused outright (a private window can). The edit itself stands in memory; leaving
      // it pending means the next save retries it, and saveFailed tells the user it isn't safe yet.
      savePending.value = true
      saveFailed.value = true
    }
  }

  /** Puts a just-saved Project at the front of the library, in place of its old copy. */
  function toFront(project: Project): void {
    const saved = markSaved(project)
    projects.value = [saved, ...projects.value.filter((existing) => existing.id !== project.id)]
  }

  function commit(options?: ReplaceOptions): void {
    savePending.value = true
    if (!options?.deferSave) {
      save()
    }
  }

  /** Decodes a sealed Project and opens it: it joins the library in its place by last save, and stays stored as it
   * was until it changes, so nothing is written. */
  function openSealed(id: string): void {
    const picked = sealed.value.find((project) => project.id === id)
    if (!picked) return
    const project = store.unseal(picked)
    if (known.get(id) === picked) known.set(id, project)
    sealed.value = sealed.value.filter((other) => other !== picked)
    projects.value = inSavedOrder([...projects.value, project])
    activeProjectId.value = id
  }

  // Another tab's write comes in as it lands, so the list and a Project open there first follow it here (ticket 0834).
  const stopHearing = store.onOutsideChange(() => quietly(takeIn))
  if (getCurrentScope()) onScopeDispose(stopHearing)

  if (locks) {
    let letGo: (() => void) | undefined
    const claim = (id: string | undefined) => {
      // Leaving a Project another tab has: what this tab drew on it goes back to that tab's copy, never to be written.
      if (heldElsewhere.value !== undefined) quietly(takeIn)
      // Leaving one this tab has: a stroke still waiting to be saved is written before the next tab may take it.
      else if (savePending.value) save()
      letGo?.()
      letGo = undefined
      heldElsewhere.value = undefined
      if (id === undefined) return
      asking = id
      letGo = locks.claim(id, (heldHere) => {
        asking = undefined
        // The other tab let go: start from what it stored, before this tab's changes count.
        if (heldHere && heldElsewhere.value === id) quietly(takeIn)
        heldElsewhere.value = heldHere ? undefined : id
      })
    }
    watch(activeProjectId, claim, { immediate: true, flush: 'sync' })
    if (getCurrentScope()) onScopeDispose(() => letGo?.())
  }

  const names = () => [...projects.value.map(projectNameOf), ...sealed.value.map((kept) => kept.name)]

  return {
    projects,
    names,
    sealed,
    openSealed,
    openElsewhere: computed(() => heldElsewhere.value !== undefined && heldElsewhere.value === activeProjectId.value),
    activeProjectId,
    activeProject,
    saveFailed,
    unsaved: savePending,

    entryOf(id: string): LibraryEntry | undefined {
      const project = projects.value.find((each) => each.id === id)
      if (project) return { id, name: projectNameOf(project) }
      const kept = sealed.value.find((each) => each.id === id)
      return kept && { id, name: kept.name, ...(gated(kept) ? { gatedBeads: kept.beads } : {}) }
    },

    openProject(id: string) {
      if (sealed.value.some((each) => each.id === id)) openSealed(id)
      else activeProjectId.value = id
    },

    /** Adds a newly created Project and opens it. */
    addProject(project: Project) {
      toFront(project)
      activeProjectId.value = project.id
      commit()
    },

    /** Adds imported Projects (ticket 15's Project file); opens one only when nothing is open. Saved now, so they go
     * to the front; a taken name gets Duplicate's next free number (ticket 0860). */
    addProjects(imported: Project[]) {
      const now = Date.now()
      const joined = inSavedOrder(withFreeNames(imported, names()).map((project) => markSaved(project, now)))
      projects.value = [...joined, ...projects.value]
      activeProjectId.value ??= mostRecentlyUpdated(imported)?.id
      commit()
      return joined
    },

    /** The single commit point for a change to an existing Project: every edit in the editor lands here. */
    replaceProject(project: Project, options?: ReplaceOptions) {
      toFront(project)
      commit(options)
    },

    /** Removes a Project; if it was the open one, the most recently updated of the rest takes its place. */
    removeProject(id: string) {
      projects.value = projects.value.filter((project) => project.id !== id)
      sealed.value = sealed.value.filter((project) => project.id !== id)
      if (activeProjectId.value === id) {
        activeProjectId.value = mostRecentlyUpdated(projects.value)?.id
      }
      commit()
    },

    /** Removes every Project; none is open afterwards. */
    removeAllProjects() {
      projects.value = []
      sealed.value = []
      activeProjectId.value = undefined
      commit()
    },

    /** Writes whatever a deferred change (or a failed save) left pending; a no-op when storage is already up to
     * date. */
    flushPendingSave() {
      if (savePending.value) {
        save()
      }
    },

    // The Save tool's write (ticket 115): doesn't trust the pending flag, since "Saved" must be true; saves the open
    // Project (moving it to the front). Returns whether the write got through; a refusal also raises saveFailed.
    saveNow(): boolean {
      if (activeProject.value) {
        toFront(activeProject.value)
      }
      save()
      return !saveFailed.value
    },
  }
}
