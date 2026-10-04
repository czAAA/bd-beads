import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { inSavedOrder, markSaved, mostRecentlyUpdated, type Project } from '../../domain/project'
import { browserLibraryStore, type LibraryStore } from '../../services/libraryStore'

/** How a change to a Project should reach storage (see replaceProject). */
export interface ReplaceOptions {
  /**
   * Don't write yet — just remember that there is something to write, for a flushPendingSave() to come. What a
   * dragged paint/erase stroke passes for every cell it touches, so the stroke writes once when it ends instead of
   * once per mousemove (ticket 55).
   */
  deferSave?: boolean
}

export interface ProjectLibrary {
  /** Every Project on this device (CONTEXT.md's Project library), most recently saved first — the source of truth persistence follows. */
  projects: Ref<Project[]>
  /** Which Project is open, or none (the New Project form). Writable: opening a Project is just setting this. */
  activeProjectId: Ref<string | undefined>
  activeProject: ComputedRef<Project | undefined>
  /** Whether the last attempted write to storage failed, so the UI can say so rather than losing the edit silently. */
  saveFailed: Ref<boolean>
  addProject: (project: Project) => void
  addProjects: (projects: Project[]) => void
  replaceProject: (project: Project, options?: ReplaceOptions) => void
  removeProject: (id: string) => void
  flushPendingSave: () => void
  /** Writes the library now, pending change or not, and says whether storage took it (ticket 115's Save). */
  saveNow: () => boolean
}

/**
 * The Project library: the Projects on this device, which one is open, and persisting them (ADR 0001, localStorage
 * only; ADR 0012 for when a save happens and what a refused one does).
 *
 * Persistence is a subscriber to the library rather than a step in the edit path (ticket 55). Every change goes
 * through one of the mutators below, each of which updates the in-memory library and then either saves it or marks a
 * save as pending; nothing watches the Projects for changes, because a watch would also fire on each individual
 * stroke cell and make the deferral load-bearing for correctness rather than just for speed.
 *
 * A save writes the whole library from memory (see LibraryStore.save), which is both cheaper than the old read-modify-write
 * per Project and self-healing: any later save also persists whatever an earlier deferred or failed one left pending,
 * so a missed flush can cost at most the newest un-flushed stroke, never an older edit.
 *
 * The library is kept in last-saved order (ticket 145): each mutator that saves a Project stamps it (markSaved) and
 * moves it to the front, and the order is written with the library, so it survives a reload as it stood.
 */
export function useProjectLibrary(store: LibraryStore = browserLibraryStore): ProjectLibrary {
  const projects = ref<Project[]>(inSavedOrder(store.load()))
  const activeProjectId = ref<string | undefined>(mostRecentlyUpdated(projects.value)?.id)
  const activeProject = computed(() =>
    projects.value.find((project) => project.id === activeProjectId.value),
  )

  const saveFailed = ref(false)
  /** Whether the library in memory has changes storage hasn't taken yet — a deferred stroke, or a write that threw. */
  let savePending = false

  function save(): void {
    try {
      store.save(projects.value)
      savePending = false
      saveFailed.value = false
    } catch {
      // Out of quota, or storage refused outright (a private window can). The edit itself stands in memory; leaving
      // it pending means the next save retries it, and saveFailed tells the user it isn't safe yet.
      savePending = true
      saveFailed.value = true
    }
  }

  /** Puts a just-saved Project at the front of the library, in place of its old copy. */
  function toFront(project: Project): void {
    const saved = markSaved(project)
    projects.value = [saved, ...projects.value.filter((existing) => existing.id !== project.id)]
  }

  function commit(options?: ReplaceOptions): void {
    savePending = true
    if (!options?.deferSave) {
      save()
    }
  }

  return {
    projects,
    activeProjectId,
    activeProject,
    saveFailed,

    /** Adds a newly created Project and opens it. */
    addProject(project: Project) {
      toFront(project)
      activeProjectId.value = project.id
      commit()
    },

    /**
     * Adds imported Projects (ticket 15's Project file). Opening one of them would interrupt whatever is already
     * open, so it only steps in when nothing is. They are saved on this device now, so they go to the front.
     */
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
      commit()
    },

    /** Writes whatever a deferred change (or a failed save) left pending; a no-op when storage is already up to date. */
    flushPendingSave() {
      if (savePending) {
        save()
      }
    },

    /**
     * The Save tool's write (ticket 115): unlike flushPendingSave it doesn't trust the pending flag, since what Save
     * reports back — "Saved" — has to be true whatever state that flag is in. It saves the open Project, so that one
     * moves to the front of the library even with nothing changed. Returns whether the write got through;
     * a refusal also raises saveFailed, like any other.
     */
    saveNow(): boolean {
      if (activeProject.value) {
        toFront(activeProject.value)
      }
      save()
      return !saveFailed.value
    },
  }
}
