// Spike 0763: the messages between the spike page and its model worker, and the manifest prepare.sh writes.

export const SIDE = 1024
export const SAM_MASK = 256

export interface Part { url: string; bytes: number }
export interface ModelFile { id: ModelId; label: string; bytes: number; sha256: string; parts: Part[]; license: string; source: string }
export interface Manifest { runtime: { version: string; url: string; bytes: number }; models: ModelFile[]; photos: string[] }

export type IsNetId = 'isnet-uint8' | 'isnet-uint8w' | 'isnet-fp32'
export type ModelId = IsNetId | 'slimsam-encoder' | 'slimsam-decoder'

export type ToWorker =
  // lean: no memory arena and no memory pattern, so the heap holds what a run needs rather than what it once needed.
  | { kind: 'load'; base: string; manifest: Manifest; id: ModelId; lean: boolean }
  | { kind: 'release'; id: ModelId }
  // RGBA at SIDE x SIDE: the picture stretched (IS-Net), or scaled into the top left corner, w x h, the rest padding (SlimSAM).
  | { kind: 'subject'; id: IsNetId; rgba: Uint8ClampedArray }
  | { kind: 'embed'; rgba: Uint8ClampedArray; w: number; h: number }
  | { kind: 'tap'; x: number; y: number }

interface Memory { wasm: number }

export type FromWorker =
  | { kind: 'progress'; id: ModelId | 'runtime'; done: number; total: number }
  | { kind: 'downloaded'; id: ModelId | 'runtime'; bytes: number; ms: number }
  | ({ kind: 'loaded'; id: ModelId; ms: number; firstSession: boolean } & Memory)
  // mask: SIDE x SIDE, 0 to 1, min-max scaled as upstream does.
  | ({ kind: 'subject'; id: IsNetId; mask: Float32Array; preMs: number; runMs: number } & Memory)
  | ({ kind: 'embedded'; preMs: number; runMs: number } & Memory)
  // logits: SAM_MASK x SAM_MASK over the padded SIDE x SIDE input, the best of the three masks by its IoU score.
  | ({ kind: 'tapped'; logits: Float32Array; iou: number; runMs: number } & Memory)
  | { kind: 'error'; message: string }
