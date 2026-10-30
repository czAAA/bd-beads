import { computed, onBeforeUnmount, ref, watch, type ComputedRef, type Ref } from 'vue'
import { layerOf } from '../../../domain/layerRecord'
import type { Project } from '../../../domain/project'
import type { ProjectTheme } from '../../../rendering/beadLook'
import type { Size } from '../../../rendering/cellSize'
import { emptyCanvasLook } from '../../../rendering/emptyCanvasLook'
import { SETTLE_MS } from '../../../rendering/gestureView'
import type { SurfaceView } from '../../../rendering/surfaceView'

/** What the empty Canvas look follows: the view the beads' layer draws (the held one while two fingers twist). */
export interface EmptyCanvasDeps {
  props: { project: Project; zoom: number }
  surface: Ref<SurfaceView>
  /** The drawing area's box, which the pattern reaches half past on every side. */
  size: Ref<Size>
  theme: Ref<ProjectTheme>
}

/** The empty Canvas under the drawing as CSS variables on the drawing area (ticket 0717): its Position marks at the zoom,
 * scroll and quarter turn the beads are drawn at, so a pan, a pinch or a Project opening never shows a bare patch. The
 * tile's image waits for the zoom to settle; until then the last one is scaled. */
export function useEmptyCanvasLook({ props, surface, size, theme }: EmptyCanvasDeps): ComputedRef<Record<string, string> | undefined> {
  const tileZoom = ref(props.zoom)
  let settle: ReturnType<typeof setTimeout> | undefined
  watch(() => props.zoom, (zoom) => {
    clearTimeout(settle)
    settle = setTimeout(() => (tileZoom.value = zoom), SETTLE_MS)
  })
  onBeforeUnmount(() => clearTimeout(settle))
  return computed(() => {
    const { technique, techniqueSettings, cell } = layerOf(props.project, 'canvas').weave
    return emptyCanvasLook({
      weave: { technique, techniqueSettings, cell },
      color: theme.value.positionMark,
      surface: surface.value,
      zoom: props.zoom,
      tileZoom: tileZoom.value,
      pixelRatio: globalThis.devicePixelRatio || 1,
      reach: Math.max(size.value.width, size.value.height) / 2,
    })
  })
}
