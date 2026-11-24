// A QR code for one short string (ticket 1233; PrintCover card, "The address"): version 2, error correction M, byte mode,
// so up to 26 bytes: room for "https://openbeads.com" and nothing longer. No dependency: the Cover page's footer is its
// only use.

const SIZE = 25
const DATA_WORDS = 28
const ECC_WORDS = 16
/** How many bytes fit: 4 bits of mode and 8 of length leave 28 words less 12 bits. */
const MOST_BYTES = 26

/** A QR code's modules, `true` for dark, row by row. */
export type QrMatrix = readonly (readonly boolean[])[]

// GF(256) with the QR polynomial 0x11d.
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)
{
  let value = 1
  for (let power = 0; power < 255; power += 1) {
    EXP[power] = value
    LOG[value] = power
    value <<= 1
    if (value & 0x100) value ^= 0x11d
  }
  for (let power = 255; power < 512; power += 1) EXP[power] = EXP[power - 255]!
}

function multiply(a: number, b: number): number {
  return a === 0 || b === 0 ? 0 : EXP[LOG[a]! + LOG[b]!]!
}

/** The Reed-Solomon remainder of `data` for `ECC_WORDS` check words. */
function checkWords(data: readonly number[]): number[] {
  let generator = [1]
  for (let power = 0; power < ECC_WORDS; power += 1) {
    const next = new Array<number>(generator.length + 1).fill(0)
    generator.forEach((coefficient, index) => {
      next[index] = next[index]! ^ multiply(coefficient, EXP[power]!)
      next[index + 1] = next[index + 1]! ^ coefficient
    })
    generator = next
  }
  // `generator` runs lowest power first; the long division wants the highest first.
  const divisor = generator.slice().reverse()
  const remainder = [...data, ...new Array<number>(ECC_WORDS).fill(0)]
  for (let index = 0; index < data.length; index += 1) {
    const factor = remainder[index]!
    if (factor === 0) continue
    divisor.forEach((coefficient, step) => {
      remainder[index + step] = remainder[index + step]! ^ multiply(coefficient, factor)
    })
  }
  return remainder.slice(data.length)
}

/** The data bits: byte mode, the length, the bytes, the terminator and the pad words. */
function dataWords(bytes: Uint8Array): number[] {
  const bits: number[] = []
  const put = (value: number, count: number) => {
    for (let bit = count - 1; bit >= 0; bit -= 1) bits.push((value >> bit) & 1)
  }
  put(0b0100, 4)
  put(bytes.length, 8)
  bytes.forEach((byte) => put(byte, 8))
  put(0, Math.min(4, DATA_WORDS * 8 - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)
  const words: number[] = []
  for (let at = 0; at < bits.length; at += 8) words.push(parseInt(bits.slice(at, at + 8).join(''), 2))
  for (let pad = 0; words.length < DATA_WORDS; pad += 1) words.push(pad % 2 === 0 ? 0xec : 0x11)
  return words
}

const MASKS: readonly ((row: number, column: number) => boolean)[] = [
  (r, c) => (r + c) % 2 === 0,
  (r) => r % 2 === 0,
  (_, c) => c % 3 === 0,
  (r, c) => (r + c) % 3 === 0,
  (r, c) => (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0,
  (r, c) => ((r * c) % 2) + ((r * c) % 3) === 0,
  (r, c) => (((r * c) % 2) + ((r * c) % 3)) % 2 === 0,
  (r, c) => (((r + c) % 2) + ((r * c) % 3)) % 2 === 0,
]

/** The 15 format bits for error correction M and `mask`: 5 data bits, 10 BCH bits, then XOR 0x5412. */
function formatBits(mask: number): number {
  const data = (0b00 << 3) | mask
  let remainder = data << 10
  for (let bit = 14; bit >= 10; bit -= 1) if ((remainder >> bit) & 1) remainder ^= 0x537 << (bit - 10)
  return ((data << 10) | remainder) ^ 0x5412
}

/** A grid of modules and which of them are fixed (finders, timing, alignment, format). */
function frame(): { modules: boolean[][]; fixed: boolean[][] } {
  const modules = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
  const fixed = Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
  const set = (row: number, column: number, dark: boolean) => {
    if (row < 0 || column < 0 || row >= SIZE || column >= SIZE) return
    modules[row]![column] = dark
    fixed[row]![column] = true
  }
  // Finders with their separators.
  for (const [top, left] of [[0, 0], [0, SIZE - 7], [SIZE - 7, 0]] as const) {
    for (let row = -1; row <= 7; row += 1) {
      for (let column = -1; column <= 7; column += 1) {
        const ring = Math.max(Math.abs(row - 3), Math.abs(column - 3))
        set(top + row, left + column, ring !== 2 && ring !== 4)
      }
    }
  }
  for (let at = 8; at < SIZE - 8; at += 1) {
    set(6, at, at % 2 === 0)
    set(at, 6, at % 2 === 0)
  }
  // The one alignment pattern of version 2, and the always-dark module.
  for (let row = -2; row <= 2; row += 1) {
    for (let column = -2; column <= 2; column += 1) set(18 + row, 18 + column, Math.max(Math.abs(row), Math.abs(column)) !== 1)
  }
  set(SIZE - 8, 8, true)
  // Room for the format bits.
  for (let at = 0; at < 9; at += 1) {
    set(8, at, false)
    set(at, 8, false)
  }
  for (let at = 0; at < 8; at += 1) {
    set(8, SIZE - 1 - at, false)
    set(SIZE - 1 - at, 8, false)
  }
  set(SIZE - 8, 8, true)
  return { modules, fixed }
}

/** The format bits written round the finders, both copies. */
function writeFormat(modules: boolean[][], mask: number): void {
  const bits = formatBits(mask)
  const bit = (index: number) => ((bits >> index) & 1) === 1
  for (let index = 0; index < 15; index += 1) {
    // First copy: round the top-left finder.
    if (index < 6) modules[index]![8] = bit(index)
    else if (index < 8) modules[index + 1]![8] = bit(index)
    else if (index === 8) modules[8]![7] = bit(index)
    else modules[8]![14 - index] = bit(index)
    // Second copy: under the bottom-left and right of the top-right finder.
    if (index < 8) modules[8]![SIZE - 1 - index] = bit(index)
    else modules[SIZE - 15 + index]![8] = bit(index)
  }
  modules[SIZE - 8]![8] = true
}

/** The standard penalty: runs, 2×2 blocks, finder look-alikes and imbalance. Lower is better. */
function penalty(modules: readonly (readonly boolean[])[]): number {
  let score = 0
  const lines = [...modules, ...modules.map((_, column) => modules.map((row) => row[column]!))]
  for (const line of lines) {
    let run = 1
    for (let at = 1; at <= SIZE; at += 1) {
      if (at < SIZE && line[at] === line[at - 1]) run += 1
      else {
        if (run >= 5) score += run - 2
        run = 1
      }
    }
    const text = line.map((dark) => (dark ? '1' : '0')).join('')
    for (const pattern of ['10111010000', '00001011101']) {
      for (let from = text.indexOf(pattern); from !== -1; from = text.indexOf(pattern, from + 1)) score += 40
    }
  }
  for (let row = 0; row < SIZE - 1; row += 1) {
    for (let column = 0; column < SIZE - 1; column += 1) {
      const dark = modules[row]![column]
      if (dark === modules[row]![column + 1] && dark === modules[row + 1]![column] && dark === modules[row + 1]![column + 1]) score += 3
    }
  }
  const darkCount = modules.reduce((sum, row) => sum + row.filter(Boolean).length, 0)
  score += Math.floor(Math.abs((darkCount * 100) / (SIZE * SIZE) - 50) / 5) * 10
  return score
}

/** The QR code of `value` (at most 26 bytes of UTF-8): its 25 × 25 modules, no quiet zone. */
export function qrMatrix(value: string): QrMatrix {
  const bytes = new TextEncoder().encode(value)
  if (bytes.length > MOST_BYTES) throw new Error(`A QR code of this size holds ${MOST_BYTES} bytes, not ${bytes.length}`)
  const data = dataWords(bytes)
  const words = [...data, ...checkWords(data)]
  const bits = words.flatMap((word) => Array.from({ length: 8 }, (_, bit) => ((word >> (7 - bit)) & 1) === 1))

  const { modules: base, fixed } = frame()
  // The bits go up and down two-column strips from the right, skipping the timing column.
  let next = 0
  let upward = true
  for (let right = SIZE - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let step = 0; step < SIZE; step += 1) {
      const row = upward ? SIZE - 1 - step : step
      for (const column of [right, right - 1]) {
        if (fixed[row]![column]) continue
        base[row]![column] = bits[next] ?? false
        next += 1
      }
    }
    upward = !upward
  }

  let best: boolean[][] | undefined
  let bestScore = Infinity
  MASKS.forEach((applies, mask) => {
    const modules = base.map((row, r) => row.map((dark, c) => (fixed[r]![c] ? dark : dark !== applies(r, c))))
    writeFormat(modules, mask)
    const score = penalty(modules)
    if (score < bestScore) {
      bestScore = score
      best = modules
    }
  })
  return best!
}
