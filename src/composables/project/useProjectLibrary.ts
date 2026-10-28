import { computed, ref, shallowRef, type ComputedRef, type Ref, type ShallowRef } from 'vue'
import { inSavedOrder, markSaved, mostRecentlyUpdated } from '../../domain/projectLibrary'
import type { Project } from '../../domain/project'
import { browserLibraryStore, type LibraryStore } from '../../services/libraryStore'

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
  /** Which Project is open, or none (the New Project form). Writable: opening a Project is just setting this. */
  activeProjectId: Ref<string | undefined>
  activeProject: ComputedRef<Project | undefined>
  /** Whether the last attempted write to storage failed, so the UI can say so rather than losing the edit silently. */
  saveFailed: Ref<boolean>
  /** Whether the library in memory has changes storage hasn't taken yet (a deferred stroke or a refused write): the
   * Project panel's "unsaved". */
  unsaved: Ref<boolean>
  addProject: (project: Project) => void
  addProjects: (projects: Project[]) => void
  replaceProject: (project: Project, options?: ReplaceOptions) => void
  removeProject: (id: string) => void
  /** Removes every Project from this device and leaves none open (Menu's Delete all Projects, ticket 443). */
  removeAllProjects: () => void
  flushPendingSave: () => void
  /** Writes the library now, pending change or not, and says whether storage took it (ticket 115's Save). */
  saveNow: () => boolean
}

// The Project library: Projects on this device, which is open, and persisting them (ADR 0001, localStorage; ADR 0012).
// Persistence is a subscriber, not a step in the edit path (ticket 55): each mutator saves or marks a save pending.
// A save writes the whole library from memory, so a later one also persists what a failed one left (ticket 145).
export function useProjectLibrary(
  store: LibraryStore = browserLibraryStore,
  /** Called after each write that got through with a Project in the library, a removal aside (ticket 399: the first
   * one asks the browser to keep it). */
  onSaved?: () => void,
): ProjectLibrary {
  const projects = shallowRef<Project[]>(inSavedOrder(store.load()))
  const activeProjectId = ref<string | undefined>(mostRecentlyUpdated(projects.value)?.id)
  const activeProject = computed(() =>
    projects.value.find((project) => project.id === activeProjectId.value),
  )

  const saveFailed = ref(false)
  /** Whether the library in memory has changes storage hasn't taken yet — a deferred stroke, or a write that threw. */
  const savePending = ref(false)

  function save(announce = true): void {
    try {
      store.save(projects.value)
      savePending.value = false
      saveFailed.value = false
      if (announce && projects.value.length > 0) onSaved?.()
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

  function commit(options?: ReplaceOptions, announce = true): void {
    savePending.value = true
    if (!options?.deferSave) {
      save(announce)
    }
  }

  return {
    projects,
    activeProjectId,
    activeProject,
    saveFailed,
    unsaved: savePending,

    /** Adds a newly created Project and opens it. */
    addProject(project: Project) {
      toFront(project)
      activeProjectId.value = project.id
      commit()
    },

    /** Adds imported Projects (ticket 15's Project file); opens one only when nothing is open. Saved now, so they go
     * to the front. */
    addProjects(imported: Project[]) {
      const now = Date.now()
      projects.value = [...inSavedOrder(imported.map((project) => markSaved(project, now))), ...projects.value]
      activeProjectId.value ??= mostRecentlyUpdated(imported)?.id
      commit()
    },

    /** The single commit point for a change to an existing Project: every edit in the editor lands here. */
    replaceProject(project: Project, options?: ReplaceOptions) {
      toFront(project)
      commit(options)
    },

    /** Removes a Project; if it was the open one, the most recently updated of the rest takes its place. */
    removeProject(id: string) {
      projects.value = projects.value.filter((project) => project.id !== id)
      if (activeProjectId.value === id) {
        activeProjectId.value = mostRecentlyUpdated(projects.value)?.id
      }
      // Removing isn't the Project's first save, so it never opens the storage note (ticket 399).
      commit(undefined, false)
    },

    /** Removes every Project; none is open afterwards. Like any removal it isn't a first save, so it never opens the
     * storage note. */
    removeAllProjects() {
      projects.value = []
      activeProjectId.value = undefined
      commit(undefined, false)
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
