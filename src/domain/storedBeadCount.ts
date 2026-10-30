import type { EncodedBeads } from './projectEncoding'

// A Project's bead count read from its stored runs (ADR 0009), without decoding it (ticket 0716): decoding a 31-million
// bead layer takes seconds and gigabytes, while its stored form is a few thousand short strings.

/** How many beads a compact encoding holds: the lengths of its runs that are not a gap. */
function encodedBeadCount({ colors, rows }: EncodedBeads): number {
  let count = 0
  for (const entry of Object.values(rows)) {
    const runs = entry.slice(entry.indexOf(':') + 1)
    if (runs === '') continue
    for (const run of runs.split(',')) {
      const marker = run.indexOf('x')
      const index = Number(marker === -1 ? run : run.slice(0, marker))
      // As decoding reads it: a gap, or an index the color table doesn't hold, is no bead.
      if (!(index >= 1 && index <= colors.length)) continue
      const length = marker === -1 ? 1 : Number(run.slice(marker + 1))
      count += length > 0 ? Math.ceil(length) : 0
    }
  }
  return count
}

function isEncoded(value: unknown): value is EncodedBeads {
  const rows = (value as EncodedBeads | null | undefined)?.rows
  return typeof rows === 'object' && rows !== null
}

/** The beads of one stored layer: its own and, for a Frame, its Folded ones. */
function layerBeads(layer: { encodedBeads?: unknown; encodedFolded?: unknown }): number {
  return (isEncoded(layer.encodedBeads) ? encodedBeadCount(layer.encodedBeads) : 0) + (isEncoded(layer.encodedFolded) ? encodedBeadCount(layer.encodedFolded) : 0)
}

/** The beads of each layer of a stored Project, the Canvas first: from the layer list (library version 5 on), or the
 * Canvas and its Frame as version 4 stored them. Undefined for an older shape, which the caller decodes as before. */
export function storedLayerBeads(stored: unknown): number[] | undefined {
  const project = stored as { layers?: unknown; encodedBeads?: unknown; frame?: { encodedBeads?: unknown; encodedFolded?: unknown } } | null
  if (Array.isArray(project?.layers)) return project.layers.map(layerBeads)
  if (project && isEncoded(project.encodedBeads)) return [layerBeads(project), ...(project.frame ? [layerBeads(project.frame)] : [])]
  return undefined
}
