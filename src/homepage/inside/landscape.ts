// The picture What's inside lays under the beads (Homepage card, Reference image row, ticket 0797): a landscape of sky,
// sun, hills and ground, drawn to line up with the 11 × 11 Frame the ghost traces it in (LANDSCAPE in tourScripts).

/** Its colors: the sky's two blues, the sun, the hills and the ground. */
const SKY_TOP = '#6f9ae6'
const SKY_LOW = '#b7cdf3'
const SUN = '#f2c94c'
const HILLS = '#27ae60'
const GROUND = '#5b3a2a'

/** The landscape as a PNG file, `size` px square. */
export async function landscapeFile(size = 220): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const cell = size / 11
  const sky = context.createLinearGradient(0, 0, 0, size)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(0.6, SKY_LOW)
  context.fillStyle = sky
  context.fillRect(0, 0, size, size)
  context.fillStyle = HILLS
  context.beginPath()
  context.moveTo(0, 7.5 * cell)
  context.quadraticCurveTo(2.5 * cell, 6.2 * cell, 3.5 * cell, 6 * cell)
  context.quadraticCurveTo(5.5 * cell, 4.6 * cell, 7.5 * cell, 6 * cell)
  context.quadraticCurveTo(9 * cell, 6.4 * cell, size, 7.5 * cell)
  context.lineTo(size, 9 * cell)
  context.lineTo(0, 9 * cell)
  context.fill()
  context.fillStyle = GROUND
  context.fillRect(0, 9 * cell, size, 2 * cell)
  context.fillStyle = SUN
  context.beginPath()
  context.arc(8 * cell, 2 * cell, 1.1 * cell, 0, Math.PI * 2)
  context.fill()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('No picture'))), 'image/png'))
  return new File([blob], 'landscape.png', { type: 'image/png' })
}
