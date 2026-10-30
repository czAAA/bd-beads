import { overSizeGate } from './openingLimits'
import { storedLayerBeads } from './storedBeadCount'

// A Project the library keeps sealed (ticket 0716): in its stored form, not decoded, because it is over the size gate or
// it did not open last time. What the Saved Projects list shows of it is read from the stored form alone.

/** What is known of a stored Project without decoding it. */
export interface ProjectSummary {
  id: string
  name: string
  makerName?: string
  createdAt: number
  updatedAt: number
  savedAt?: number
  /** Beads per layer, the Canvas first, counted from the stored runs. */
  layerBeads: number[]
  /** Every bead across its layers. */
  beads: number
}

/** A sealed Project: its summary and its stored JSON, which a save writes back as it is and an export wraps. */
export interface SealedProject extends ProjectSummary {
  stored: string
}

/** The summary of a Project as the library stores it from version 5 on (its layer list), or undefined when it isn't one. */
export function projectSummaryOf(stored: unknown): ProjectSummary | undefined {
  const project = stored as { id?: unknown; createdAt?: unknown; updatedAt?: unknown; savedAt?: unknown; makerName?: unknown; layers?: { name?: unknown }[] } | null
  const layerBeads = storedLayerBeads(stored)
  if (!project || typeof project.id !== 'string' || !Array.isArray(project.layers) || !layerBeads) return undefined
  const updatedAt = typeof project.updatedAt === 'number' ? project.updatedAt : 0
  return {
    id: project.id,
    name: typeof project.layers[0]?.name === 'string' ? project.layers[0].name : '',
    ...(typeof project.makerName === 'string' && project.makerName ? { makerName: project.makerName } : {}),
    createdAt: typeof project.createdAt === 'number' ? project.createdAt : updatedAt,
    updatedAt,
    ...(typeof project.savedAt === 'number' ? { savedAt: project.savedAt } : {}),
    layerBeads,
    beads: layerBeads.reduce((sum, beads) => sum + beads, 0),
  }
}

/** Whether a stored Project is over the size gate: it opens only when picked, after a warning. */
export function gated(project: Pick<ProjectSummary, 'beads'>): boolean {
  return overSizeGate(project.beads)
}
