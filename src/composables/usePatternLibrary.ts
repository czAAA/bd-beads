import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { inSavedOrder, markSaved, mostRecentlyUpdated, type Pattern } from '../domain/pattern'
import { browserLibraryStore, type LibraryStore } from '../services/libraryStore'

/** How a change to a Pattern should reach storage (see replacePattern). */
export interface ReplaceOptions {
  /**
   * Don't write yet — just remember that there is something to write, for a flushPendingSave() to come. What a
   * dragged paint/erase stroke passes for every cell it touches, so the stroke writes once when it ends instead of
   * once per mousemove (ticket 55).
   */
  deferSave?: boolean
}

export interface PatternLibrary {
  /** Every Pattern on this device (CONTEXT.md's Pattern library), most recently saved first — the source of truth persistence follows. */
  patterns: Ref<Pattern[]>
  /** Which Pattern is open, or none (the New Pattern form). Writable: opening a Pattern is just setting this. */
  activePatternId: Ref<string | undefined>
  activePattern: ComputedRef<Pattern | undefined>
  /** Whether the last attempted write to storage failed, so the UI can say so rather than losing the edit silently. */
  saveFailed: Ref<boolean>
  addPattern: (pattern: Pattern) => void
  addPatterns: (patterns: Pattern[]) => void
  replacePattern: (pattern: Pattern, options?: ReplaceOptions) => void
  removePattern: (id: string) => void
  flushPendingSave: () => void
  /** Writes the library now, pending change or not, and says whether storage took it (ticket 115's Save). */
  saveNow: () => boolean
}

/**
 * The Pattern library: the Patterns on this device, which one is open, and persisting them (ADR 0001, localStorage
 * only; ADR 0012 for when a save happens and what a refused one does).
 *
 * Persistence is a subscriber to the library rather than a step in the edit path (ticket 55). Every change goes
 * through one of the mutators below, each of which updates the in-memory library and then either saves it or marks a
 * save as pending; nothing watches the Patterns for changes, because a watch would also fire on each individual
 * stroke cell and make the deferral load-bearing for correctness rather than just for speed.
 *
 * A save writes the whole library from memory (see LibraryStore.save), which is both cheaper than the old read-modify-write
 * per Pattern and self-healing: any later save also persists whatever an earlier deferred or failed one left pending,
 * so a missed flush can cost at most the newest un-flushed stroke, never an older edit.
 *
 * The library is kept in last-saved order (ticket 145): each mutator that saves a Pattern stamps it (markSaved) and
 * moves it to the front, and the order is written with the library, so it survives a reload as it stood.
 */
export function usePatternLibrary(store: LibraryStore = browserLibraryStore): PatternLibrary {
  const patterns = ref<Pattern[]>(inSavedOrder(store.load()))
  const activePatternId = ref<string | undefined>(mostRecentlyUpdated(patterns.value)?.id)
  const activePattern = computed(() =>
    patterns.value.find((pattern) => pattern.id === activePatternId.value),
  )

  const saveFailed = ref(false)
  /** Whether the library in memory has changes storage hasn't taken yet — a deferred stroke, or a write that threw. */
  let savePending = false

  function save(): void {
    try {
      store.save(patterns.value)
      savePending = false
      saveFailed.value = false
    } catch {
      // Out of quota, or storage refused outright (a private window can). The edit itself stands in memory; leaving
      // it pending means the next save retries it, and saveFailed tells the user it isn't safe yet.
      savePending = true
      saveFailed.value = true
    }
  }

  /** Puts a just-saved Pattern at the front of the library, in place of its old copy. */
  function toFront(pattern: Pattern): void {
    const saved = markSaved(pattern)
    patterns.value = [saved, ...patterns.value.filter((existing) => existing.id !== pattern.id)]
  }

  function commit(options?: ReplaceOptions): void {
    savePending = true
    if (!options?.deferSave) {
      save()
    }
  }

  return {
    patterns,
    activePatternId,
    activePattern,
    saveFailed,

    /** Adds a newly created Pattern and opens it. */
    addPattern(pattern: Pattern) {
      toFront(pattern)
      activePatternId.value = pattern.id
      commit()
    },

    /**
     * Adds imported Patterns (ticket 15's Pattern file). Opening one of them would interrupt whatever is already
     * open, so it only steps in when nothing is. They are saved on this device now, so they go to the front.
     */
    addPatterns(imported: Pattern[]) {
      const now = Date.now()
      patterns.value = [...inSavedOrder(imported.map((pattern) => markSaved(pattern, now))), ...patterns.value]
      activePatternId.value ??= mostRecentlyUpdated(imported)?.id
      commit()
    },

    /** The single commit point for a change to an existing Pattern: every edit in the editor lands here. */
    replacePattern(pattern: Pattern, options?: ReplaceOptions) {
      toFront(pattern)
      commit(options)
    },

    /** Removes a Pattern; if it was the open one, the most recently updated of the rest takes its place. */
    removePattern(id: string) {
      patterns.value = patterns.value.filter((pattern) => pattern.id !== id)
      if (activePatternId.value === id) {
        activePatternId.value = mostRecentlyUpdated(patterns.value)?.id
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
     * reports back — "Saved" — has to be true whatever state that flag is in. It saves the open Pattern, so that one
     * moves to the front of the library even with nothing changed. Returns whether the write got through;
     * a refusal also raises saveFailed, like any other.
     */
    saveNow(): boolean {
      if (activePattern.value) {
        toFront(activePattern.value)
      }
      save()
      return !saveFailed.value
    },
  }
}
