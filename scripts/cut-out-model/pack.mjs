// Cut out with AI (ticket 0767, ADR 0087): the model split into parts under the 25 MiB per-file cap, named by its
// content, in public/ai/; and src/data/cutOutFiles.json, the list the service reads, with the installed runtime's size.
//   node scripts/cut-out-model/pack.mjs <isnet-general-use-uint8.onnx>
import { createHash } from 'node:crypto'
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename, join } from 'node:path'

const [source] = process.argv.slice(2)
if (!source) throw new Error('usage: node scripts/cut-out-model/pack.mjs <isnet-general-use-uint8.onnx>')

const OUT = 'public/ai'
const LIST = 'src/data/cutOutFiles.json'
const PART = 24 * 1024 * 1024
const ort = 'node_modules/onnxruntime-web'

const bytes = readFileSync(source)
const sha256 = createHash('sha256').update(bytes).digest('hex')
const name = `${basename(source, '.onnx')}-${sha256.slice(0, 8)}`

mkdirSync(OUT, { recursive: true })
// An older model's parts go: the app names only the new one.
for (const file of readdirSync(OUT)) if (file.includes('.onnx.part') && !file.startsWith(`${name}.`)) rmSync(join(OUT, file))

const parts = []
for (let at = 0, index = 0; at < bytes.length; at += PART, index += 1) {
  const file = `${name}.onnx.part${index}`
  writeFileSync(join(OUT, file), bytes.subarray(at, at + PART))
  parts.push({ file, bytes: Math.min(PART, bytes.length - at) })
}

const runtime = {
  version: JSON.parse(readFileSync(join(ort, 'package.json'), 'utf8')).version,
  bytes: statSync(join(ort, 'dist/ort-wasm-simd-threaded.wasm')).size,
}
if (runtime.bytes > PART) throw new Error(`the runtime is ${runtime.bytes} bytes, over the per-file cap`)

const list = {
  model: {
    name: 'IS-Net general-use, uint8 (dynamic quantization)',
    license: 'Apache-2.0',
    source: 'xuebinqin/DIS isnet-general-use.pth, exported by scripts/cut-out-model/export_isnet.py',
    side: 1024,
    bytes: bytes.length,
    sha256,
    parts,
  },
  runtime,
}
writeFileSync(LIST, `${JSON.stringify(list, null, 2)}\n`)
console.log(`${name}: ${(bytes.length / 1e6).toFixed(1)} MB in ${parts.length} part(s) in ${OUT}/; runtime ${runtime.version}, ${(runtime.bytes / 1e6).toFixed(1)} MB`)
