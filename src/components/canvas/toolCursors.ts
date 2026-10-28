import { fromHex } from '../../domain/color'
import type { Tool } from '../../domain/tool'

// The Tool pointers (ticket 542): the design system's cursor files, one per tool, as the CSS `cursor` value. A cursor
// image cannot read CSS custom properties, so the files' ink and halo are fixed; only the colour bead of Paint and
// Fill is written in. Hot spots and fallbacks are the ones in the files' README.
const files = import.meta.glob<string>('../../../docs/design/system/assets/Cursors/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
})

const sources: Readonly<Record<string, string>> = Object.fromEntries(
  Object.entries(files).map(([path, svg]) => [/([^/]+)\.svg$/.exec(path)![1], svg]),
)

type Pointer = { file: string; hotSpot: readonly [number, number]; fallback: string }

const POINTERS: Readonly<Record<Tool, Pointer>> = {
  paint: { file: 'paint', hotSpot: [5, 19], fallback: 'crosshair' },
  erase: { file: 'erase', hotSpot: [6, 17], fallback: 'crosshair' },
  hand: { file: 'hand', hotSpot: [11, 12], fallback: 'grab' },
  select: { file: 'select', hotSpot: [4, 3], fallback: 'default' },
  fill: { file: 'fill', hotSpot: [18, 18], fallback: 'crosshair' },
  piece: { file: 'piece', hotSpot: [12, 12], fallback: 'crosshair' },
}

const cache = new Map<string, string>()

/** The Tool pointer as a plain image (ticket 546): the same file, colour and hot spot as `toolPointer`, for the app to
 * draw itself where a CSS cursor is not shown (a hovering Pencil). */
export function toolPointerImage(
  tool: Tool,
  options: { color?: string | null; dragging?: boolean } = {},
): { url: string; hotSpot: readonly [number, number] } {
  const { hotSpot, file } = POINTERS[tool]
  const dragging = tool === 'hand' && options.dragging === true
  const color = options.color && fromHex(options.color) ? options.color : undefined
  const key = `${tool}|${dragging}|${color ?? ''}`
  let url = cache.get(key)
  if (url === undefined) {
    const source = sources[dragging ? 'hand-grabbing' : file] ?? ''
    const svg = color ? source.replace(/currentColor/g, color) : source.replace(/<rect[^>]*>(<\/rect>)?/g, '')
    url = `data:image/svg+xml,${encodeURIComponent(svg)}`
    cache.set(key, url)
  }
  return { url, hotSpot }
}

/** The CSS `cursor` value for a tool: the image, its hot spot and the system's cursor as fallback. Hand shows its
 * closed hand while `dragging`; Paint and Fill carry a bead in `color`, and none when it is absent. */
export function toolPointer(tool: Tool, options: { color?: string | null; dragging?: boolean } = {}): string {
  const { url, hotSpot } = toolPointerImage(tool, options)
  const dragging = tool === 'hand' && options.dragging === true
  return `url("${url}") ${hotSpot[0]} ${hotSpot[1]}, ${dragging ? 'grabbing' : POINTERS[tool].fallback}`
}
