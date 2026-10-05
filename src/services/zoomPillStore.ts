import { DEFAULT_ZOOM_PILL_CORNER, isZoomPillCorner, type ZoomPillCorner } from '../domain/zoomPillCorner'

export const ZOOM_PILL_STORAGE_KEY = 'bd-beads:zoom-pill'

/** The corner the Zoom pill rests in, kept on this device like the Rulers and the theme (ticket 297). */
export interface ZoomPillStore {
  load: () => ZoomPillCorner
  save: (corner: ZoomPillCorner) => void
}

export function createZoomPillStore(storage: Pick<Storage, 'getItem' | 'setItem'>): ZoomPillStore {
  return {
    load() {
      try {
        const saved = storage.getItem(ZOOM_PILL_STORAGE_KEY)
        return isZoomPillCorner(saved) ? saved : DEFAULT_ZOOM_PILL_CORNER
      } catch {
        // Storage can be blocked (private mode, site data off): the pill rests in its default corner.
        return DEFAULT_ZOOM_PILL_CORNER
      }
    },
    save(corner) {
      try {
        storage.setItem(ZOOM_PILL_STORAGE_KEY, corner)
      } catch {
        // Storage can be blocked; the move still holds for this visit.
      }
    },
  }
}

/** The Zoom pill's corner in this browser's localStorage. */
export const browserZoomPillStore: ZoomPillStore = {
  load: () => createZoomPillStore(localStorage).load(),
  save: (corner) => createZoomPillStore(localStorage).save(corner),
}
