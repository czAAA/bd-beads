// The picture What's inside lays under the beads (Homepage card, Reference image row, ticket 0831): three eyes of the
// peacock feather on deep green, drawn from the same data as the cuff the ghost traces over it (peacock.ts), so a
// bead's color is the picture's under its middle.

import { channelsOf } from '../../domain/color'
import { DEMO_COLORS, PEACOCK_COLORS } from './demoProjects'
import { PEACOCK_CUFF, peacockAt, peacockCentre } from './peacock'

/** The feather picture as a PNG file, `width` px wide: the cuff's Frame as Ring's Canvas holds it before its quarter
 * turn, the piece running down it, since a reference image lies on the Canvas and turns with it. On screen it lies
 * across, three eyes side by side. */
export async function peacockFile(width = 300): Promise<File> {
  // The piece in mm: half a bead past its last beads' middles, the odd lines' reaching furthest along.
  const first = peacockCentre(0, 0)
  const size = { along: peacockCentre(1, PEACOCK_CUFF.length - 1).x + first.x, across: peacockCentre(PEACOCK_CUFF.lines - 1, 0).y + first.y }
  const height = Math.round((width * size.along) / size.across)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const picture = context.createImageData(width, height)
  const colors = new Map(Object.entries(PEACOCK_COLORS).map(([part, color]) => [part, channelsOf(DEMO_COLORS[color])]))
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const part = peacockAt((size.along * (y + 0.5)) / height, (size.across * (x + 0.5)) / width, PEACOCK_CUFF)
      const { r, g, b } = colors.get(part)!
      picture.data.set([r, g, b, 255], (y * width + x) * 4)
    }
  }
  context.putImageData(picture, 0, 0)
  return pngFile(canvas, 'peacock-feather.png')
}

/** What's drawn on `canvas` as a PNG file named `name`, as a file picker would hand it over. */
export async function pngFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('No picture'))), 'image/png'))
  return new File([blob], name, { type: 'image/png' })
}
