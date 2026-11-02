import type { PixelData } from '../domain/imageConversion'
import type { SubjectMask } from '../domain/subjectMask'

/** The messages between the cut-out service and its worker (ticket 0767, ADR 0087). */

/** One of the app's static files as the worker fetches it: in parts it joins (a model over the per-file cap), each at
 * its address with its size. */
export interface StaticFile {
  bytes: number
  parts: { url: string; bytes: number }[]
}

/** A model: its file, its SHA-256 (checked once joined) and the side of the square it reads. */
export interface ModelFile extends StaticFile {
  sha256: string
  side: number
}

export type ToWorker = {
  kind: 'subject'
  /** The Cache Storage the files are kept in; none where the browser has none (a page not served over https). */
  cache: string | undefined
  runtime: StaticFile
  model: ModelFile
  picture: PixelData
}

export type FromWorker =
  | { kind: 'downloading'; done: number; total: number }
  | { kind: 'thinking' }
  | { kind: 'subject'; mask: SubjectMask }
  | { kind: 'failed'; reason: string }
