import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { withReferenceImage, type ReferencePlace } from '../../domain/referenceImage'
import { en } from '../../i18n/en'
import { OPEN_SPACE } from '../../rendering/space'
import { surfaceView } from '../../rendering/surfaceView'
import { bareProject } from '../../testUtils/layerFields'
import { pictureBarPlace } from './pictureBarPlacement'
import { usePictureBarLayout } from './usePictureBarLayout'

const picture = { name: 'rose.png', type: 'image/png', width: 6, height: 4, bytes: 10 }
/** At 100% with nothing scrolled, the picture's box on screen is its box in grid px: 200 × 133 from (300, 233). */
const rests: ReferencePlace = { x: 400, y: 300, width: 200, angle: 0 }
const viewport = { width: 1000, height: 700 }

function setup() {
  const place = ref(rests)
  const barWidth = ref(0)
  const project = withReferenceImage(bareProject({ technique: 'loom' }), { picture, place: rests, opacity: 50, shown: true })
  const view = surfaceView({ space: OPEN_SPACE, technique: 'loom', rotation: 0, zoom: 1, viewport })
  const layout = usePictureBarLayout({
    project: () => project,
    view: () => view,
    place: () => place.value,
    covered: () => undefined,
    framed: () => undefined,
    sheet: () => undefined,
    barWidth: () => barWidth.value,
    framePreviewOn: ref(false),
    converting: () => false,
    messages: () => en,
  })
  return { layout, place, barWidth }
}

describe('the picture bar\'s box, which the Turn handle stands clear of (ticket 1160)', () => {
  it('is none until the bar has measured its width, then the bar where it stands over the picture', () => {
    const { layout, barWidth } = setup()
    expect(layout.bar.value).toBeUndefined()
    barWidth.value = 160
    const size = { width: 160, height: layout.barHeight.value }
    expect(layout.bar.value).toEqual({ ...pictureBarPlace(layout.picture.value!, size, viewport), ...size })
    expect(layout.bar.value).toMatchObject({ left: 320, top: layout.picture.value!.top - 14 - size.height })
  })

  it('follows the picture, and is none once the bar is out of view with it', () => {
    const { layout, place, barWidth } = setup()
    barWidth.value = 160
    place.value = { ...rests, x: 500 }
    expect(layout.bar.value?.left).toBe(420)
    place.value = { ...rests, x: 3000 }
    expect(layout.bar.value).toBeUndefined()
  })
})
