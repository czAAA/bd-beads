import { computed, getCurrentScope, onScopeDispose, ref, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { inSavedOrder, markSaved, mostRecentlyUpdated, takeInOutside } from '../../domain/projectLibrary'
import type { Project } from '../../domain/project'
import { gated, type ProjectSummary, type SealedProject } from '../../domain/sealedProject'
import { projectNameOf } from '../../domain/layerRecord'
import { withFreeNames } from '../../domain/projectName'
import type { LibraryEntry } from './useSavedProjectConfirms'
import { browserLibraryStore, type HeldProject, type LibraryStore, type OutsideChange, type ProjectChange } from '../../services/libraryStore'
import type { ProjectClaim, ProjectLocks } from '../../services/projectLocks'

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
  /** Whether the library in memory has changes storage hasn't taken yet (a deferred stroke, a write that hasn't landed or
   * a refused one): the Project panel's "unsaved". */
  unsaved: Ref<boolean>
  addProject: (project: Project) => void
  /** Adds imported Projects under names the library doesn't hold yet and hands back what joined (ticket 0860). */
  addProjects: (projects: Project[]) => Project[]
  /** Every name the library holds, sealed Projects' too: what a new or imported name must not repeat (tickets 0860, 0866). */
  names: () => string[]
  replaceProject: (project: Project, options?: ReplaceOptions) => void
  /** Removes a Project from this device and holds it in memory as `removed`, for Delete's Undo (ticket 0983). */
  removeProject: (id: string) => void
  /** The Project removed last, held in memory only (never stored) until Undo brings it back or the hold is let go: its
   * records beside the library stay while it is held (ticket 0983). */
  removed: ShallowRef<RemovedProject | undefined>
  /** Puts the held Project back in the library as it was, and opens it again if it was open. */
  restoreRemoved: () => void
  /** Lets the held Project go: it is gone from the device, its records beside the library with it. */
  forgetRemoved: () => void
  /** Removes every Project from this device and leaves none open (Menu's Delete all Projects, ticket 443). */
  removeAllProjects: () => void
  flushPendingSave: () => void
  /** The page is going: notes, for the next start, each write not yet landed (ADR 0012). Call it after flushPendingSave. */
  noteClosing: () => void
  /** Writes the library now, pending change or not, and says whether storage took it once it has answered (ticket
   * 115's Save). */
  saveNow: () => Promise<boolean>
  /** Whether the open Project is open in another tab, which had it first (ticket 0834): this tab then shows that tab's
   * beads as it stores them and writes none of its own changes to it. Never, for a library given no locks. */
  openElsewhere: ComputedRef<boolean>
  /** Takes the open Project over from the tab that has it (Work here instead, ticket 0937): this tab then draws and saves
   * it, from what that tab stored, and that tab is told it is open elsewhere. A no-op while it is not open elsewhere. */
  workHere: () => void
}

/** A removed Project as Delete's Undo needs it: the Project, decoded or sealed, and whether it was the open one. */
interface RemovedProject {
  project: HeldProject
  wasOpen: boolean
}

const isSealed = (project: HeldProject): project is SealedProject => 'stored' in project

function byId(projects: readonly HeldProject[]): Map<string, HeldProject> {
  return new Map(projects.map((project) => [project.id, project]))
}

/** Runs a take-in where nothing can show its failure, ignoring it: the next save tries again and says so. */
function quietly(work: Promise<void>): void {
  work.catch(() => {
    // Unreadable or blocked storage: memory stays as it is.
  })
}

// The Project library: Projects on this device, which is open, and persisting them (ADR 0001, ADR 0012, spec 1018).
// Each mutator saves or marks a save pending (ticket 55). A save hands the store only what this tab changed and removed
// since it last read or wrote, so it touches only those and also persists what a failed one left (tickets 145, 0834).
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

  /** What storage held of each Project when this tab last read or wrote it: one that differs from it was changed here. */
  let known = byId([...opened.projects, ...opened.sealed])
  /** The Project open here that another tab had open first (ticket 0834), whose stored copy this tab keeps to. */
  const heldElsewhere = ref<string>()
  /** The Project this tab has asked for and not yet heard about: kept to its stored copy too, until the answer. */
  let asking: string | undefined

  /** The library as this tab holds it now. */
  const inMemory = (): HeldProject[] => [...projects.value, ...sealed.value]

  /** The Projects this tab may not change now: the one another tab has open first, and the one it has asked for. */
  const refused = (): ReadonlySet<string> => new Set([heldElsewhere.value, asking].filter((id): id is string => id !== undefined))

  /** Holds the library in memory; the open Project, if another tab removed it, gives way as on a removal. */
  function hold(merged: HeldProject[]): void {
    const here = new Set<HeldProject>(inMemory())
    if (merged.length === here.size && merged.every((project) => here.has(project))) return
    projects.value = inSavedOrder(merged.filter((project): project is Project => !isSealed(project)))
    sealed.value = merged.filter(isSealed)
    if (activeProjectId.value !== undefined && !projects.value.some((project) => project.id === activeProjectId.value)) {
      activeProjectId.value = mostRecentlyUpdated(projects.value)?.id
    }
  }

  /** Takes in what other tabs stored (ADR 0091): this tab's own changes stay on top, a Project removed elsewhere stays
   * removed, and a Project in `blocked` (another tab has it open first) is the stored copy. In memory only: the write
   * is save's. */
  function takeIn(outside: { changed: readonly HeldProject[]; gone: readonly string[] }, blocked: ReadonlySet<string>): void {
    const taken = takeInOutside(inMemory(), known, outside, (id) => !blocked.has(id))
    known = taken.known
    // What was drawn on a Project another tab has open first goes back to its stored copy, changed there or not.
    hold(taken.library.map((entry) => (blocked.has(entry.id) ? (known.get(entry.id) ?? entry) : entry)))
  }

  /** Rereads the Projects `ids` name (all when none), for what other tabs stored since this tab last read or wrote. */
  async function reread(ids?: readonly string[], blocked: ReadonlySet<string> = refused()): Promise<void> {
    const decoded = new Set(projects.value.map((project) => project.id))
    const kept = new Set(sealed.value.map((project) => project.id))
    const keepSealed = (summary: ProjectSummary) => !decoded.has(summary.id) && (kept.has(summary.id) || gated(summary))
    const fresh = await store.reread([...known.values()], keepSealed, ids)
    takeIn(
      { changed: fresh.changed.filter((project) => !unanswered.has(project.id)), gone: fresh.gone.filter((id) => !unanswered.has(id)) },
      blocked,
    )
  }

  /** Puts a Project back to the copy this tab last read from storage, dropping what was drawn on it here. */
  function backToStored(id: string): void {
    const stored = known.get(id)
    if (stored) hold(inMemory().map((project) => (project.id === id ? stored : project)))
  }

  const saveFailed = ref(false)
  /** Whether the library in memory has changes storage hasn't taken yet — a deferred stroke, a write that hasn't landed,
   * or one that failed. */
  const savePending = ref(false)
  /** Changes committed so far, and saves started so far: a save's answer clears the pending flag only when no change came
   * after it and no later save is the one to answer for it. */
  let edits = 0
  let saves = 0
  /** The Projects written by a save that hasn't answered yet, how many such saves each is in: what storage says of them
   * meanwhile is older than this tab's copy, so a reread leaves them be. */
  const unanswered = new Map<string, number>()

  /** What storage doesn't hold yet: the Projects changed or made here, and the ids removed here. */
  function pendingChanges(): { changed: ProjectChange[]; removed: string[] } {
    const blocked = refused()
    const here = inMemory()
    const hereIds = new Set(here.map((project) => project.id))
    return {
      changed: here
        // A Project made here is written whatever the locks say; only a stored one another tab has first is left be.
        .filter((project) => known.get(project.id) !== project && !(blocked.has(project.id) && known.has(project.id)))
        .map((project) => ({ project, knownStored: known.has(project.id) })),
      removed: [...known.keys()].filter((id) => !hereIds.has(id)),
    }
  }

  /** Hands the store what changed since the last read or write, inside this call, and says whether it landed. It counts
   * as stored from here (`known`), taken back should the write fail. Never rejects: a refusal raises saveFailed and the
   * change stays pending for the next save. */
  async function save(): Promise<boolean> {
    const mine = ++saves
    const covered = edits
    // A Project another tab has first is never written from here: what was drawn on it goes back to its stored copy.
    const blocked = refused()
    if (blocked.size > 0 && inMemory().some((project) => blocked.has(project.id) && known.get(project.id) !== project)) {
      blocked.forEach(backToStored)
      quietly(reread([...blocked], blocked))
    }
    const { changed, removed } = pendingChanges()
    const before = new Map<string, HeldProject | undefined>()
    for (const { project } of changed) before.set(project.id, known.get(project.id))
    for (const id of removed) before.set(id, known.get(id))
    for (const { project } of changed) known.set(project.id, project)
    for (const id of removed) known.delete(id)
    const ids = [...before.keys()]
    for (const id of ids) unanswered.set(id, (unanswered.get(id) ?? 0) + 1)
    const answered = () => {
      for (const id of ids) {
        const left = (unanswered.get(id) ?? 1) - 1
        if (left > 0) unanswered.set(id, left)
        else unanswered.delete(id)
      }
    }
    try {
      const { dropped } = await store.save(changed, removed)
      answered()
      // A Project another tab removed is gone here too, even though it was changed here.
      if (dropped.length > 0) takeIn({ changed: [], gone: dropped }, refused())
      // An earlier save still unanswered, or one that failed, left a change not stored: this answer cannot clear the flags.
      const left = pendingChanges()
      if (mine === saves && unanswered.size === 0 && left.changed.length === 0 && left.removed.length === 0) {
        saveFailed.value = false
        if (edits === covered) savePending.value = false
      }
      return true
    } catch {
      answered()
      let restored = false
      for (const { project } of changed) {
        if (known.get(project.id) !== project) continue
        restored = true
        const earlier = before.get(project.id)
        if (earlier) known.set(project.id, earlier)
        else known.delete(project.id)
      }
      for (const id of removed) {
        const earlier = before.get(id)
        if (!known.has(id) && earlier) {
          known.set(id, earlier)
          restored = true
        }
      }
      // Out of quota, or storage refused outright (a private window can). The edit itself stands in memory; leaving
      // it pending means the next save retries it, and saveFailed tells the user it isn't safe yet.
      if (mine === saves || restored) {
        savePending.value = true
        saveFailed.value = true
      }
      return false
    }
  }

  /** Puts a just-saved Project at the front of the library, in place of its old copy. */
  function toFront(project: Project): void {
    const saved = markSaved(project)
    projects.value = [saved, ...projects.value.filter((existing) => existing.id !== project.id)]
  }

  function commit(options?: ReplaceOptions): void {
    edits += 1
    savePending.value = true
    if (!options?.deferSave) {
      void save()
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
  const stopHearing = store.onOutsideChange((named: OutsideChange) => quietly(reread(named)))
  if (getCurrentScope()) onScopeDispose(stopHearing)

  /** This tab's claim of the open Project, while it has one open. */
  let claimed: ProjectClaim | undefined
  if (locks) {
    const claim = (id: string | undefined) => {
      // Leaving a Project another tab has: what this tab drew on it goes back to that tab's copy, never to be written.
      if (heldElsewhere.value !== undefined) {
        backToStored(heldElsewhere.value)
        quietly(reread())
      }
      // Leaving one this tab has: a stroke still waiting to be saved is written before the next tab may take it.
      else if (savePending.value) void save()
      claimed?.letGo()
      claimed = undefined
      heldElsewhere.value = undefined
      if (id === undefined) return
      asking = id
      claimed = locks.claim(id, (heldHere) => {
        asking = undefined
        const wasElsewhere = heldElsewhere.value === id
        if (heldHere && wasElsewhere) {
          // The other tab let go, or this one took it over: start from what it stored, before this tab's changes count.
          quietly(reread(undefined, new Set([id])).then(() => void (heldElsewhere.value === id && (heldElsewhere.value = undefined))))
          return
        }
        heldElsewhere.value = heldHere ? undefined : id
        // Another tab has it, or took it over from this one (ticket 0937): a stroke not yet written goes back to its
        // stored copy.
        if (!heldHere) {
          backToStored(id)
          quietly(reread(undefined, new Set([id])))
        }
      })
    }
    watch(activeProjectId, claim, { immediate: true, flush: 'sync' })
    if (getCurrentScope()) onScopeDispose(() => claimed?.letGo())
  }

  const removed = shallowRef<RemovedProject>()

  const names = () => [...projects.value.map(projectNameOf), ...sealed.value.map((kept) => kept.name)]

  return {
    projects,
    names,
    sealed,
    openSealed,
    openElsewhere: computed(() => heldElsewhere.value !== undefined && heldElsewhere.value === activeProjectId.value),
    workHere: () => {
      if (heldElsewhere.value !== undefined) claimed?.takeOver()
    },
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
     * to the front; a taken name gets the next free number (ticket 0860). */
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
      const project = inMemory().find((each) => each.id === id)
      if (project) removed.value = { project, wasOpen: activeProjectId.value === id }
      projects.value = projects.value.filter((project) => project.id !== id)
      sealed.value = sealed.value.filter((project) => project.id !== id)
      if (activeProjectId.value === id) {
        activeProjectId.value = mostRecentlyUpdated(projects.value)?.id
      }
      commit()
    },

    removed,

    restoreRemoved() {
      const held = removed.value
      if (!held) return
      removed.value = undefined
      const { project, wasOpen } = held
      if (isSealed(project)) sealed.value = [...sealed.value, project]
      else projects.value = inSavedOrder([...projects.value, project])
      if (wasOpen) activeProjectId.value = project.id
      commit()
    },

    forgetRemoved() {
      removed.value = undefined
    },

    /** Removes every Project; none is open afterwards. */
    removeAllProjects() {
      removed.value = undefined
      projects.value = []
      sealed.value = []
      activeProjectId.value = undefined
      commit()
    },

    /** Writes whatever a deferred change (or a failed save) left pending; a no-op when storage is already up to
     * date. */
    flushPendingSave() {
      if (savePending.value) {
        void save()
      }
    },

    noteClosing() {
      store.noteClosing()
    },

    // The Save tool's write (ticket 115): doesn't trust the pending flag, since "Saved" must be true; saves the open
    // Project (moving it to the front). Answers whether the write got through once the store has answered; a refusal
    // also raises saveFailed.
    saveNow(): Promise<boolean> {
      if (activeProject.value) {
        toFront(activeProject.value)
      }
      return save()
    },
  }
}
