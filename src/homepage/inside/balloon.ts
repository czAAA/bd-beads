// The picture What's inside converts (Homepage card, Convert image row, ticket 0828): a hot-air balloon in a blue sky,
// its envelope in bold stripes over a basket, two clouds by it. Another picture than the Reference image row's
// mountains, in a few clear colors, so the converted beads and their found colors read at a glance.

/** Its colors: the sky's two blues, the clouds, the envelope's stripes, its ropes and the basket. */
const SKY_TOP = '#4f86d9'
const SKY_LOW = '#a9c8f0'
const CLOUD = '#ffffff'
const STRIPES = ['#e8413c', '#f39c32', '#f7d046', '#2bb3a3'] as const
const ROPE = '#6b4a35'
const BASKET = '#8a5a3b'

/** The balloon as a PNG file, `size` px square. */
export async function balloonFile(size = 360): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')!
  const sky = context.createLinearGradient(0, 0, 0, size)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(1, SKY_LOW)
  context.fillStyle = sky
  context.fillRect(0, 0, size, size)
  cloud(context, size * 0.2, size * 0.72, size * 0.1)
  cloud(context, size * 0.82, size * 0.3, size * 0.08)
  // The envelope: a round top narrowing to its mouth, cut into upright stripes.
  const middle = size / 2
  const top = size * 0.1
  const radius = size * 0.27
  const mouth = size * 0.66
  context.save()
  context.beginPath()
  context.arc(middle, top + radius, radius, Math.PI, 0)
  context.quadraticCurveTo(middle + radius, top + radius * 1.7, middle + radius * 0.3, mouth)
  context.lineTo(middle - radius * 0.3, mouth)
  context.quadraticCurveTo(middle - radius, top + radius * 1.7, middle - radius, top + radius)
  context.closePath()
  context.clip()
  const stripe = (radius * 2) / 6
  for (let index = 0; index < 6; index++) {
    context.fillStyle = STRIPES[(index + 1) % STRIPES.length]!
    context.fillRect(middle - radius + index * stripe, top, stripe, mouth - top)
  }
  context.restore()
  // The ropes down to the basket.
  const basketTop = size * 0.76
  context.strokeStyle = ROPE
  context.lineWidth = size * 0.012
  for (const side of [-1, 1]) {
    context.beginPath()
    context.moveTo(middle + side * radius * 0.3, mouth)
    context.lineTo(middle + side * size * 0.05, basketTop)
    context.stroke()
  }
  context.fillStyle = BASKET
  context.fillRect(middle - size * 0.06, basketTop, size * 0.12, size * 0.09)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('No picture'))), 'image/png'))
  return new File([blob], 'balloon.png', { type: 'image/png' })
}

/** A cloud of three puffs round (`x`, `y`). */
function cloud(context: CanvasRenderingContext2D, x: number, y: number, puff: number): void {
  context.fillStyle = CLOUD
  context.beginPath()
  context.arc(x - puff, y, puff * 0.8, 0, Math.PI * 2)
  context.arc(x, y - puff * 0.4, puff, 0, Math.PI * 2)
  context.arc(x + puff, y, puff * 0.8, 0, Math.PI * 2)
  context.fill()
}
