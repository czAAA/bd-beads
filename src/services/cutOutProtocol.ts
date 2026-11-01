import type { PixelData } from '../domain/imageConversion'
import type { SubjectMask } from '../domain/subjectMask'

/** The messages between the cut-out service and its worker (tickets 0767, 0769, ADR 0087). */

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

/** The tap model's reading of one picture (its encoder's two outputs, each 256 × 64 × 64), kept by the service so later
 * taps on the picture skip the slow part (ADR 0087: about 4 s, then about 0.1 s a tap). */
export interface TapEmbedding {
  embeddings: Float32Array
  positions: Float32Array
}

interface Run {
  /** The Cache Storage the files are kept in; none where the browser has none (a page not served over https). */
  cache: string | undefined
  runtime: StaticFile
  /** Every part address the app names: the device's copy of any other is an older model's, and is dropped. */
  named: string[]
  picture: PixelData
}

export type ToWorker =
  | ({ kind: 'subject'; model: ModelFile } & Run)
  /** The regions of the tapped points, the picture read first unless its `embedding` is given. */
  | ({ kind: 'taps'; encoder: ModelFile; decoder: ModelFile; embedding: TapEmbedding | undefined; points: { x: number; y: number }[] } & Run)

export type FromWorker =
  | { kind: 'downloading'; done: number; total: number }
  | { kind: 'thinking' }
  | { kind: 'subject'; mask: SubjectMask }
  /** One region per point, in order, and the picture's reading when this run made it. */
  | { kind: 'regions'; regions: SubjectMask[]; embedding: TapEmbedding | undefined }
  | { kind: 'failed'; reason: string }
