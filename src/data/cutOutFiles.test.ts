import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import files from './cutOutFiles.json'

// The list of Cut out with AI's static files (ticket 0767, ADR 0087), written by scripts/cut-out-model/pack.mjs: what the
// download note says and the worker checks must match the files the build serves.

const ort = resolve(import.meta.dirname, '../../node_modules/onnxruntime-web')
const PER_FILE_CAP = 25 * 1024 * 1024

describe('cutOutFiles.json', () => {
  it('gives the installed runtime\'s version and size: an upgrade of onnxruntime-web runs pack.mjs again', () => {
    expect(files.runtime.version).toBe((JSON.parse(readFileSync(resolve(ort, 'package.json'), 'utf8')) as { version: string }).version)
    expect(files.runtime.bytes).toBe(statSync(resolve(ort, 'dist/ort-wasm-simd-threaded.wasm')).size)
  })

  it('splits the model into parts under the per-file cap, named by its content, that add up to it', () => {
    expect(files.model.parts.reduce((sum, part) => sum + part.bytes, 0)).toBe(files.model.bytes)
    for (const [index, part] of files.model.parts.entries()) {
      expect(part.bytes).toBeLessThan(PER_FILE_CAP)
      expect(part.file).toBe(`isnet-general-use-uint8-${files.model.sha256.slice(0, 8)}.onnx.part${index}`)
    }
    expect(files.runtime.bytes).toBeLessThan(PER_FILE_CAP)
  })

  it('names the tap model’s encoder and decoder (ticket 0769) the same way, by their content', () => {
    for (const [stem, model] of [
      ['slimsam-77-encoder-uint8', files.taps.encoder],
      ['slimsam-77-decoder-uint8', files.taps.decoder],
    ] as const) {
      expect(model.parts.reduce((sum, part) => sum + part.bytes, 0)).toBe(model.bytes)
      for (const [index, part] of model.parts.entries()) {
        expect(part.bytes).toBeLessThan(PER_FILE_CAP)
        expect(part.file).toBe(`${stem}-${model.sha256.slice(0, 8)}.onnx.part${index}`)
      }
    }
  })
})
