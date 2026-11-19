// The view a reload opens at (ticket 1108): the zoom and the point of the drawing in the middle of the drawing area, in
// the drawing's own pixels at that zoom, kept for the tab with the Project it belongs to.

/** Where a Project was looked at from when the page was left: its zoom and the scroll of the drawing area's middle. */
export interface KeptView {
  zoom: number
  middle: { x: number; y: number }
}

/** A kept view and the Project it is of. */
export interface KeptProjectView {
  project: string
  view: KeptView
}

/** The kept view a stored string holds, when it holds one whole; nothing for anything else. */
export function parseKeptView(raw: string | null): KeptProjectView | undefined {
  let value: unknown
  try {
    value = raw === null ? undefined : JSON.parse(raw)
  } catch {
    return undefined
  }
  const kept = value as Partial<KeptProjectView> | undefined
  const zoom = kept?.view?.zoom
  const middle = kept?.view?.middle
  if (typeof kept?.project !== 'string' || typeof zoom !== 'number' || !(zoom > 0) || !Number.isFinite(zoom)) return undefined
  if (!Number.isFinite(middle?.x) || !Number.isFinite(middle?.y)) return undefined
  return { project: kept.project, view: { zoom, middle: { x: middle!.x, y: middle!.y } } }
}
