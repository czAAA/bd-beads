// Spike 0763: lay out the files the spike page serves, the way the app will serve them (ADR 0087): each static file
// under the 25 MiB per-file cap, a larger model split into parts the worker joins, and a manifest of sizes and hashes.
//   node pack.mjs <work dir> <out dir> [photos dir]
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const [work, out, photos] = process.argv.slice(2)
const PART = 24 * 1024 * 1024
const ort = 'node_modules/onnxruntime-web'
const ortVersion = JSON.parse(readFileSync(join(ort, 'package.json'), 'utf8')).version

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'models'), { recursive: true })
mkdirSync(join(out, 'ort'), { recursive: true })

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

function pack(id, label, src, meta) {
  if (!existsSync(src)) return console.warn(`${id}: ${src} is missing, left out`)
  const bytes = readFileSync(src)
  const name = basename(src, '.onnx') + '-' + sha256(bytes).slice(0, 8)
  const parts = []
  for (let at = 0, i = 0; at < bytes.length; at += PART, i++) {
    const url = `models/${name}.onnx.part${i}`
    writeFileSync(join(out, url), bytes.subarray(at, at + PART))
    parts.push({ url, bytes: Math.min(PART, bytes.length - at) })
  }
  return { id, label, bytes: bytes.length, sha256: sha256(bytes), parts, ...meta }
}

const isnet = {
  license: 'Apache-2.0',
  source: 'xuebinqin/DIS isnet-general-use.pth, exported by spike/0763/prepare/export_isnet.py',
  input: 1024,
}
const slimsam = {
  license: 'Apache-2.0',
  source: 'Xenova/slimsam-77-uniform@5850ab45 (from nielsr/slimsam-77-uniform, Zigeng/SlimSAM)',
}

const models = [
  pack('isnet-uint8', 'IS-Net general-use, uint8 (dynamic)', join(work, 'isnet/isnet-general-use-uint8.onnx'), isnet),
  pack('isnet-uint8w', 'IS-Net general-use, uint8 weights', join(work, 'isnet/isnet-general-use-uint8w.onnx'), isnet),
  pack('isnet-fp32', 'IS-Net general-use, uncompressed', join(work, 'isnet/isnet-general-use-fp32.onnx'), isnet),
  pack('slimsam-encoder', 'SlimSAM-77 encoder, uint8', join(work, 'slimsam/vision_encoder_quantized.onnx'), slimsam),
  pack('slimsam-decoder', 'SlimSAM-77 decoder, uint8', join(work, 'slimsam/prompt_encoder_mask_decoder_quantized.onnx'), slimsam),
].filter(Boolean)

const wasm = 'ort-wasm-simd-threaded.wasm'
copyFileSync(join(ort, 'dist', wasm), join(out, 'ort', wasm))
const runtime = { version: ortVersion, url: `ort/${wasm}`, bytes: statSync(join(out, 'ort', wasm)).size }
if (runtime.bytes > PART) throw new Error(`${wasm} is ${runtime.bytes} bytes, over the per-file cap`)

const pictures = []
if (photos && existsSync(photos)) {
  mkdirSync(join(out, 'photos'))
  for (const f of readdirSync(photos).filter((f) => /\.(jpe?g|png|webp|heic)$/i.test(f)).sort()) {
    copyFileSync(join(photos, f), join(out, 'photos', f))
    pictures.push(`photos/${f}`)
  }
}

writeFileSync(join(out, 'manifest.json'), JSON.stringify({ runtime, models, photos: pictures }, null, 1))
for (const m of models) console.log(`${m.id}: ${(m.bytes / 1e6).toFixed(1)} MB in ${m.parts.length} part(s)`)
console.log(`runtime ${ortVersion}: ${(runtime.bytes / 1e6).toFixed(1)} MB; ${pictures.length} photo(s)`)
