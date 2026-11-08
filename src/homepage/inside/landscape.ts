// The picture What's inside lays under the beads (Homepage card, Reference image row, ticket 0797): a mountain panorama
// of sky, sun, snow-lined peaks, their grey slopes and the ground, drawn to line up with the 7 × 36 ring band the ghost
// traces it in (LANDSCAPE in tourScripts).

import { PANORAMA, RIDGE, SUN } from './demoProjects'

/** Its colors: the sky's two blues, the sun, the snow, the slopes and the ground. */
const SKY_TOP = '#6f9ae6'
const SKY_LOW = '#b7cdf3'
const SUN_COLOR = '#f2c94c'
const SNOW = '#ffffff'
const SLOPES = '#9aa0a6'
const GROUND = '#5b3a2a'

/** The panorama as a PNG file, `width` px wide. */
export async function landscapeFile(width = 432): Promise<File> {
  const cell = width / PANORAMA.columns
  const tall = cell * PANORAMA.cellAspect
  const height = Math.round(tall * PANORAMA.rows)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')!
  const sky = context.createLinearGradient(0, 0, 0, height)
  sky.addColorStop(0, SKY_TOP)
  sky.addColorStop(0.7, SKY_LOW)
  context.fillStyle = sky
  context.fillRect(0, 0, width, height)
  // The slopes under the ridge, the snow line along its top.
  const ridge = (column: number) => (RIDGE[column] + 0.5) * tall
  context.beginPath()
  context.moveTo(0, ridge(0))
  RIDGE.forEach((_, column) => context.lineTo((column + 0.5) * cell, ridge(column)))
  context.lineTo(width, ridge(PANORAMA.columns - 1))
  context.lineTo(width, height)
  context.lineTo(0, height)
  context.closePath()
  context.fillStyle = SLOPES
  context.fill()
  context.strokeStyle = SNOW
  context.lineWidth = tall * 0.7
  context.lineJoin = 'round'
  context.beginPath()
  RIDGE.forEach((_, column) => (column ? context.lineTo : context.moveTo).call(context, (column + 0.5) * cell, ridge(column)))
  context.stroke()
  context.fillStyle = GROUND
  context.fillRect(0, (PANORAMA.rows - 1) * tall, width, tall)
  context.fillStyle = SUN_COLOR
  context.beginPath()
  context.arc((SUN.column + SUN.size / 2) * cell, (SUN.row + SUN.size / 2) * tall, cell * 1.1, 0, Math.PI * 2)
  context.fill()
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((made) => (made ? resolve(made) : reject(new Error('No picture'))), 'image/png'))
  return new File([blob], 'landscape.png', { type: 'image/png' })
}
