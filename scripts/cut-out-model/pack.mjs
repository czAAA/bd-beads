// Cut out with AI (tickets 0767, 0769, ADR 0087): the models split into parts under the 25 MiB per-file cap, named by
// their content, in public/ai/; and src/data/cutOutFiles.json, the list the service reads, with the runtime's size.
//   node scripts/cut-out-model/pack.mjs <isnet-general-use-uint8.onnx> <vision_encoder_quantized.onnx> <prompt_encoder_mask_decoder_quantized.onnx>
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [isnet, encoder, decoder] = process.argv.slice(2)
if (!isnet || !encoder || !decoder) {
  throw new Error('usage: node scripts/cut-out-model/pack.mjs <isnet-general-use-uint8.onnx> <slimsam encoder.onnx> <slimsam decoder.onnx>')
}

const OUT = 'public/ai'
const LIST = 'src/data/cutOutFiles.json'
const PART = 24 * 1024 * 1024
const ort = 'node_modules/onnxruntime-web'
const SLIMSAM = {
  license: 'Apache-2.0',
  source: 'Xenova/slimsam-77-uniform@5850ab45f587c112167512ffef949107115e26a0 (from nielsr/slimsam-77-uniform)',
}

mkdirSync(OUT, { recursive: true })
const written = new Set()

/** One model's entry in the list, its parts written to public/ai/ under `stem` and its content's hash. */
function pack(source, stem, about) {
  const bytes = readFileSync(source)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  const name = `${stem}-${sha256.slice(0, 8)}`
  const parts = []
  for (let at = 0, index = 0; at < bytes.length; at += PART, index += 1) {
    const file = `${name}.onnx.part${index}`
    writeFileSync(join(OUT, file), bytes.subarray(at, at + PART))
    written.add(file)
    parts.push({ file, bytes: Math.min(PART, bytes.length - at) })
  }
  console.log(`${name}: ${(bytes.length / 1e6).toFixed(1)} MB in ${parts.length} part(s)`)
  return { ...about, side: 1024, bytes: bytes.length, sha256, parts }
}

const model = pack(isnet, 'isnet-general-use-uint8', {
  name: 'IS-Net general-use, uint8 (dynamic quantization)',
  license: 'Apache-2.0',
  source: 'xuebinqin/DIS isnet-general-use.pth, exported by scripts/cut-out-model/export_isnet.py',
})
const taps = {
  encoder: pack(encoder, 'slimsam-77-encoder-uint8', { name: 'SlimSAM-77-uniform vision encoder, quantized', ...SLIMSAM }),
  decoder: pack(decoder, 'slimsam-77-decoder-uint8', { name: 'SlimSAM-77-uniform prompt encoder and mask decoder, quantized', ...SLIMSAM }),
}
// An older model's parts go: the app names only these.
for (const file of readdirSync(OUT)) if (file.includes('.onnx.part') && !written.has(file)) rmSync(join(OUT, file))

const runtime = {
  version: JSON.parse(readFileSync(join(ort, 'package.json'), 'utf8')).version,
  bytes: statSync(join(ort, 'dist/ort-wasm-simd-threaded.wasm')).size,
}
if (runtime.bytes > PART) throw new Error(`the runtime is ${runtime.bytes} bytes, over the per-file cap`)

writeFileSync(LIST, `${JSON.stringify({ model, taps, runtime }, null, 2)}\n`)
console.log(`in ${OUT}/; runtime ${runtime.version}, ${(runtime.bytes / 1e6).toFixed(1)} MB`)
