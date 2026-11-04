import type { PictureStore } from '../services/pictureStore'

/** A picture store in memory (ticket 0790), for a test of what the app keeps; `refuses` makes it a device that won't
 * keep any, as a private window can. */
export function memoryPictureStore({ refuses = false }: { refuses?: boolean } = {}): PictureStore & { kept: Map<string, Blob> } {
  const kept = new Map<string, Blob>()
  return {
    kept,
    get: async (id) => kept.get(id),
    put: async (id, picture) => {
      if (refuses) return false
      kept.set(id, picture)
      return true
    },
    remove: async (id) => void kept.delete(id),
    keepOnly: async (ids) => {
      for (const id of [...kept.keys()]) if (!ids.has(id)) kept.delete(id)
    },
  }
}
