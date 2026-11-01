// Spike 0763: the measuring page. Picks a picture, drives the model worker, draws the masks and keeps a table of
// numbers per device (download, load, first and second mask, WebAssembly heap) to paste into the report.
import { SAM_MASK, SIDE, type FromWorker, type IsNetId, type Manifest, type ModelId, type ToWorker } from './protocol'

const BASE = `${import.meta.env.BASE_URL}spike-0763/`
const MAX_SIDE = 2048
const MB = 1e6

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const status = (text: string) => ($('status').textContent = text)
const ctx = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true }) as CanvasRenderingContext2D

interface Row { device: string; browser: string; photo: string; step: string; model: string; ms?: number; mb?: number; wasmMb?: number; note?: string }
const rows: Row[] = JSON.parse(localStorage.getItem('spike-0763-rows') ?? '[]')

function platform() {
  const ua = navigator.userAgent
  const ipad = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const browser = /Edg\//.test(ua) ? 'Edge' : /CriOS|Chrome\//.test(ua) ? 'Chrome' : /Firefox|FxiOS/.test(ua) ? 'Firefox' : /Safari/.test(ua) ? 'Safari' : 'other'
  return `${browser} on ${ipad ? 'iPadOS' : /Mac/.test(ua) ? 'macOS' : navigator.platform}`
}

const device = $<HTMLInputElement>('device')
device.value = localStorage.getItem('spike-0763-device') ?? ''
device.onchange = () => localStorage.setItem('spike-0763-device', device.value)
const memory = (navigator as { deviceMemory?: number }).deviceMemory
$('env').textContent = `${platform()} · ${navigator.hardwareConcurrency} cores · ${memory ? `device memory ${memory} GB · ` : ''}crossOriginIsolated ${crossOriginIsolated} · ${navigator.userAgent}`

let photoName = ''
function log(step: string, model: string, values: Partial<Row>) {
  rows.push({ device: device.value || '?', browser: platform(), photo: photoName, step, model, ...values })
  localStorage.setItem('spike-0763-rows', JSON.stringify(rows))
  renderRows()
}

const escape = (text: string) => text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const fixed = (v: number | undefined, digits = 0) => (v === undefined ? '' : v.toFixed(digits))
function renderRows() {
  const head = '<tr><th>Device</th><th>Browser</th><th>Photo</th><th>Step</th><th>Model</th><th>ms</th><th>MB</th><th>Wasm MB</th><th>Note</th></tr>'
  $('results').innerHTML = head + rows.map((r) =>
    `<tr><td>${escape(r.device)}</td><td>${r.browser}</td><td>${escape(r.photo)}</td><td>${r.step}</td><td>${r.model}</td><td class="n">${fixed(r.ms)}</td><td class="n">${fixed(r.mb, 1)}</td><td class="n">${fixed(r.wasmMb)}</td><td>${escape(r.note ?? '')}</td></tr>`).join('')
}
renderRows()

// --- The worker: one request at a time, answered by the first message of the kinds it waits for.
class Models {
  worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  loaded = new Set<ModelId>()
  embedded = false
  subjects = new Map<IsNetId, number>()
  taps = 0
  peakWasm = 0
  waiting?: { kinds: FromWorker['kind'][]; resolve: (m: FromWorker) => void; reject: (e: Error) => void }
  onMessage?: (m: FromWorker) => void

  constructor() {
    this.worker.onmessage = ({ data }: MessageEvent<FromWorker>) => {
      this.onMessage?.(data)
      if ('wasm' in data) this.peakWasm = Math.max(this.peakWasm, data.wasm)
      if (data.kind === 'progress') status(`Downloading ${data.id}: ${(data.done / MB).toFixed(1)} of ${(data.total / MB).toFixed(1)} MB`)
      if (data.kind === 'error') this.waiting?.reject(new Error(data.message))
      else if (this.waiting?.kinds.includes(data.kind)) this.waiting.resolve(data)
    }
    this.worker.onerror = (e) => this.waiting?.reject(new Error(e.message || 'the worker failed'))
  }

  call<K extends FromWorker['kind']>(message: ToWorker, kinds: K[], transfer: Transferable[] = []) {
    if (this.waiting) return Promise.reject(new Error('busy: wait for the step running now'))
    return new Promise<Extract<FromWorker, { kind: K }>>((resolve, reject) => {
      const settle = <T>(f: (v: T) => void) => (v: T) => {
        this.waiting = undefined
        f(v)
      }
      this.waiting = { kinds, resolve: settle(resolve as (m: FromWorker) => void), reject: settle(reject) }
      this.worker.postMessage(message, transfer)
    })
  }

  stop() {
    this.worker.terminate()
    this.waiting?.reject(new Error('stopped'))
  }
}

let manifest: Manifest
let models = new Models()
const fresh = () => {
  models.stop()
  models = new Models()
}

async function load(on: Models, id: ModelId) {
  if (on.loaded.has(id)) return
  on.onMessage = (m) => {
    if (m.kind === 'downloaded') log('download', m.id, { ms: m.ms, mb: m.bytes / MB })
  }
  status(`Loading ${id}…`)
  const lean = $<HTMLInputElement>('lean').checked
  const m = await on.call({ kind: 'load', base: BASE, manifest, id, lean }, ['loaded'])
  on.onMessage = undefined
  on.loaded.add(id)
  log('load', id, { ms: m.ms, wasmMb: m.wasm / MB, note: [lean ? 'lean' : '', m.firstSession ? 'includes starting the runtime' : ''].filter(Boolean).join(', ') })
}

// --- The picture: a working copy at most MAX_SIDE on its long side, and the model inputs drawn from it.
const picture = document.createElement('canvas')
const view = $<HTMLCanvasElement>('view')

async function usePicture(src: string, name: string) {
  const img = new Image()
  img.src = src
  await img.decode()
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight))
  picture.width = Math.round(img.naturalWidth * scale)
  picture.height = Math.round(img.naturalHeight * scale)
  ctx(picture).drawImage(img, 0, 0, picture.width, picture.height)
  photoName = `${name} (${img.naturalWidth}×${img.naturalHeight})`
  models.embedded = false
  for (const c of ['view', 'cut', 'maskA', 'maskB', 'maskDiff']) $<HTMLCanvasElement>(c).width = 0
  view.width = picture.width
  view.height = picture.height
  ctx(view).drawImage(picture, 0, 0)
  status(`Picture: ${photoName}`)
}

function input(fit: 'stretch' | 'longest') {
  const c = document.createElement('canvas')
  c.width = c.height = SIDE
  const scale = SIDE / Math.max(picture.width, picture.height)
  const w = fit === 'stretch' ? SIDE : Math.round(picture.width * scale)
  const h = fit === 'stretch' ? SIDE : Math.round(picture.height * scale)
  ctx(c).fillStyle = '#fff' // a transparent picture reads as white, not black
  ctx(c).fillRect(0, 0, w, h)
  ctx(c).drawImage(picture, 0, 0, w, h)
  return { rgba: ctx(c).getImageData(0, 0, SIDE, SIDE).data, w, h, scale }
}

// A mask over the picture, from model values (0 to 1) on a side x side grid of which the first w x h cover the picture.
function maskCanvas(values: Float32Array, side: number, w: number, h: number, alpha: (v: number) => number) {
  const grid = document.createElement('canvas')
  grid.width = grid.height = side
  const image = ctx(grid).createImageData(side, side)
  for (let i = 0; i < values.length; i++) image.data[i * 4 + 3] = alpha(values[i])
  ctx(grid).putImageData(image, 0, 0)
  const out = document.createElement('canvas')
  out.width = picture.width
  out.height = picture.height
  ctx(out).drawImage(grid, 0, 0, w, h, 0, 0, out.width, out.height)
  return out
}

function checker(c: CanvasRenderingContext2D) {
  const s = Math.max(8, Math.round(c.canvas.width / 64))
  for (let y = 0; y < c.canvas.height; y += s) for (let x = 0; x < c.canvas.width; x += s) {
    c.fillStyle = (x / s + y / s) % 2 ? '#ddd' : '#fff'
    c.fillRect(x, y, s, s)
  }
}

function showCutOut(target: HTMLCanvasElement, mask: HTMLCanvasElement) {
  const layer = document.createElement('canvas')
  layer.width = picture.width
  layer.height = picture.height
  const l = ctx(layer)
  l.drawImage(mask, 0, 0)
  l.globalCompositeOperation = 'source-in'
  l.drawImage(picture, 0, 0)
  target.width = picture.width
  target.height = picture.height
  checker(ctx(target))
  ctx(target).drawImage(layer, 0, 0)
}

const subjectAlpha = (v: number) => Math.round(v * 255)
const isnetChoice = $<HTMLSelectElement>('isnet')

async function findSubject(on: Models, id: IsNetId) {
  await load(on, id)
  status(`Finding the subject with ${id}…`)
  const start = performance.now()
  const { rgba } = input('stretch')
  const m = await on.call({ kind: 'subject', id, rgba }, ['subject'], [rgba.buffer])
  const mask = maskCanvas(m.mask, SIDE, SIDE, SIDE, subjectAlpha)
  const ms = performance.now() - start
  const n = (on.subjects.get(id) ?? 0) + 1
  on.subjects.set(id, n)
  if (on === models) {
    showCutOut($('cut'), mask)
    $('cutCaption').textContent = `Subject, ${id}`
  }
  log(n === 1 ? 'first mask' : n === 2 ? 'second mask' : `mask ${n}`, id, {
    ms, wasmMb: m.wasm / MB, note: `model ${m.runMs.toFixed(0)} ms, input ${m.preMs.toFixed(0)} ms`,
  })
  return mask
}

let sam: { scale: number; w: number; h: number } | undefined
async function tapAt(px: number, py: number) {
  await load(models, 'slimsam-encoder')
  await load(models, 'slimsam-decoder')
  const start = performance.now()
  let embedMs = 0
  if (!models.embedded) {
    status('Reading the picture for taps…')
    const { rgba, w, h, scale } = input('longest')
    const e = await models.call({ kind: 'embed', rgba, w, h }, ['embedded'], [rgba.buffer])
    embedMs = e.runMs + e.preMs
    sam = { scale, w, h }
    models.embedded = true
    log('tap: picture read', 'slimsam-encoder', { ms: embedMs, wasmMb: e.wasm / MB })
  }
  const { scale, w, h } = sam as NonNullable<typeof sam>
  status('Cutting out the tapped part…')
  const m = await models.call({ kind: 'tap', x: px * scale, y: py * scale }, ['tapped'])
  const quarter = SIDE / SAM_MASK
  const mask = maskCanvas(m.logits, SAM_MASK, w / quarter, h / quarter, (v) => (v > 0 ? 160 : 0))
  const v = ctx(view)
  v.drawImage(picture, 0, 0)
  const tint = document.createElement('canvas')
  tint.width = picture.width
  tint.height = picture.height
  const t = ctx(tint)
  t.drawImage(mask, 0, 0)
  t.globalCompositeOperation = 'source-in'
  t.fillStyle = '#6e44ff'
  t.fillRect(0, 0, tint.width, tint.height)
  v.drawImage(tint, 0, 0)
  v.fillStyle = '#fff'
  v.strokeStyle = '#000'
  v.lineWidth = Math.max(2, picture.width / 300)
  v.beginPath()
  v.arc(px, py, picture.width / 80, 0, Math.PI * 2)
  v.fill()
  v.stroke()
  models.taps++
  const n = models.taps
  log(n === 1 ? 'first tap mask' : n === 2 ? 'second tap mask' : `tap mask ${n}`, 'slimsam', {
    ms: performance.now() - start, wasmMb: m.wasm / MB, note: `decoder ${m.runMs.toFixed(0)} ms, IoU score ${m.iou.toFixed(2)}${embedMs ? ', includes the picture read' : ''}`,
  })
  status('Done')
}

async function runAll() {
  fresh()
  const id = isnetChoice.value as IsNetId
  await findSubject(models, id)
  await findSubject(models, id)
  const cx = picture.width / 2
  const cy = picture.height / 2
  await tapAt(cx, cy)
  await tapAt(cx + picture.width / 6, cy)
  log('run all', id, { wasmMb: models.peakWasm / MB, note: 'the WebAssembly heap at its largest' })
  status('Run all done. Stop the Timelines recording now.')
}

async function compare() {
  const id = isnetChoice.value as IsNetId
  if (id === 'isnet-fp32') throw new Error('choose a compressed IS-Net to compare')
  const own = new Models()
  try {
    const a = await findSubject(own, id)
    own.worker.postMessage({ kind: 'release', id } satisfies ToWorker)
    const b = await findSubject(own, 'isnet-fp32')
    const da = ctx(a).getImageData(0, 0, a.width, a.height).data
    const db = ctx(b).getImageData(0, 0, b.width, b.height).data
    const diff = ctx(b).createImageData(b.width, b.height)
    let both = 0, either = 0, absSum = 0
    for (let i = 3; i < da.length; i += 4) {
      const inA = da[i] >= 128, inB = db[i] >= 128
      if (inA && inB) both++
      if (inA || inB) either++
      absSum += Math.abs(da[i] - db[i]) / 255
      if (inA !== inB) diff.data.set([220, 30, 30, 255], i - 3)
      else diff.data.set(inA ? [60, 60, 60, 255] : [255, 255, 255, 255], i - 3)
    }
    const iou = either ? both / either : 1
    const mad = absSum / (da.length / 4)
    showCutOut($('maskA'), a)
    showCutOut($('maskB'), b)
    const d = $<HTMLCanvasElement>('maskDiff')
    d.width = b.width
    d.height = b.height
    ctx(d).putImageData(diff, 0, 0)
    $('maskACaption').textContent = `Compressed, ${id}`
    $('compareResult').textContent = `IoU ${iou.toFixed(4)} · mean difference ${(mad * 100).toFixed(2)} %`
    log('compare', `${id} vs isnet-fp32`, { note: `IoU ${iou.toFixed(4)}, mean difference ${(mad * 100).toFixed(2)} %` })
    status('Compare done')
  } finally {
    own.stop()
  }
}

function download(name: string, blob: Blob) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 5000)
}

const guard = (f: () => Promise<unknown>) => () => {
  f().catch((e: Error) => status(`Failed: ${e.message}`))
}

$('all').onclick = guard(runAll)
$('loadIsnet').onclick = guard(() => load(models, isnetChoice.value as IsNetId).then(() => status('Loaded')))
$('subject').onclick = guard(() => findSubject(models, isnetChoice.value as IsNetId).then(() => status('Done')))
$('loadSam').onclick = guard(async () => {
  await load(models, 'slimsam-encoder')
  await load(models, 'slimsam-decoder')
  status('Loaded')
})
$('restart').onclick = () => {
  fresh()
  status('New worker: nothing loaded')
}
$('stop').onclick = () => {
  fresh()
  status('Stopped')
}
$('compare').onclick = guard(compare)
view.onclick = (e) => {
  const r = view.getBoundingClientRect()
  void guard(() => tapAt(((e.clientX - r.left) / r.width) * picture.width, ((e.clientY - r.top) / r.height) * picture.height))()
}
$('copy').onclick = guard(async () => {
  const line = (cells: unknown[]) => `| ${cells.join(' | ')} |`
  const text = [
    line(['Device', 'Browser', 'Photo', 'Step', 'Model', 'ms', 'MB', 'Wasm MB', 'Note']),
    line(Array(9).fill('---')),
    ...rows.map((r) => line([r.device, r.browser, r.photo, r.step, r.model, fixed(r.ms), fixed(r.mb, 1), fixed(r.wasmMb), r.note ?? ''])),
  ].join('\n')
  await navigator.clipboard.writeText(text)
  status('Copied')
})
$('json').onclick = () => download(`spike-0763-${(device.value || 'device').replace(/\W+/g, '-')}.json`, new Blob([JSON.stringify({ userAgent: navigator.userAgent, rows }, null, 1)]))
$('savePng').onclick = () => {
  for (const id of ['view', 'cut', 'maskA', 'maskB', 'maskDiff']) {
    const c = $<HTMLCanvasElement>(id)
    if (c.width) c.toBlob((b) => b && download(`${photoName.split(' ')[0]}-${id}.png`, b))
  }
}
$('clear').onclick = () => {
  if (!confirm('Clear every row?')) return
  rows.length = 0
  localStorage.removeItem('spike-0763-rows')
  renderRows()
}

const photos = $<HTMLSelectElement>('photos')
photos.onchange = guard(() => usePicture(BASE + photos.value, photos.value.replace(/^photos\//, '')))
$<HTMLInputElement>('file').onchange = guard(async () => {
  const file = $<HTMLInputElement>('file').files?.[0]
  if (file) await usePicture(URL.createObjectURL(file), file.name)
})

guard(async () => {
  manifest = await (await fetch(`${BASE}manifest.json`, { cache: 'no-store' })).json()
  for (const m of manifest.models.filter((m) => m.id.startsWith('isnet'))) isnetChoice.add(new Option(`${m.label} (${(m.bytes / MB).toFixed(0)} MB)`, m.id))
  const size = (ids: string[]) => manifest.models.filter((m) => ids.includes(m.id)).reduce((s, m) => s + m.bytes, 0) / MB
  $('files').textContent = `onnxruntime-web ${manifest.runtime.version}: runtime ${(manifest.runtime.bytes / MB).toFixed(1)} MB, IS-Net uint8 ${size(['isnet-uint8']).toFixed(1)} MB, SlimSAM ${size(['slimsam-encoder', 'slimsam-decoder']).toFixed(1)} MB`
  for (const p of manifest.photos) photos.add(new Option(p.replace(/^photos\//, ''), p))
  if (manifest.photos.length) await usePicture(BASE + manifest.photos[0], manifest.photos[0].replace(/^photos\//, ''))
  else status('Choose a picture')
})()
