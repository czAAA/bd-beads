import { ref } from 'vue'
import type { ZoomPillCorner } from '../../domain/zoomPillCorner'
import type { ZoomPillStore } from '../../services/zoomPillStore'

/** Which corner the phone's Zoom pill rests in (ticket 297): bottom-right until moved, then kept on the device. */
export function useZoomPillCorner(store: ZoomPillStore) {
  const zoomPillCorner = ref<ZoomPillCorner>(store.load())

  function setZoomPillCorner(corner: ZoomPillCorner): void {
    zoomPillCorner.value = corner
    store.save(corner)
  }

  return { zoomPillCorner, setZoomPillCorner }
}
