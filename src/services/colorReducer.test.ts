import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReductionRequest } from '../domain/convertColors'
import { createColorReducer, createColorReductionQueue } from './colorReducer'

const request = (asked = 12): ReductionRequest => ({ counts: new Map([['#000000', 3], ['#ffffff', 2]]), asked, targets: undefined, choices: new Map(), leastBeads: 0 })

/** A Worker that answers only when the test says. */
class FakeWorker {
  static all: FakeWorker[] = []
  onmessage: ((event: { data: unknown }) => void) | null = null
  onerror: (() => void) | null = null
  terminated = false
  posted: { id: number }[] = []
  constructor() {
    FakeWorker.all.push(this)
  }
  postMessage(message: { id: number }) {
    this.posted.push(message)
  }
  terminate() {
    this.terminated = true
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
  FakeWorker.all = []
})

describe('createColorReducer (ticket 1163)', () => {
  it('reduces on the spot where the browser has no worker', () => {
    let reduced
    createColorReducer().reduce(request(), (result) => (reduced = result))
    expect(reduced).toMatchObject({ colors: [{ hex: '#000000', count: 3 }, { hex: '#ffffff', count: 2 }] })
  })

  it('replaces a request still running and answers only the latest', () => {
    vi.stubGlobal('Worker', FakeWorker)
    const reducer = createColorReducer()
    const answers: string[] = []
    reducer.reduce(request(12), () => answers.push('first'))
    const [first] = FakeWorker.all
    reducer.reduce(request(24), () => answers.push('second'))
    expect(first!.terminated).toBe(true)
    const second = FakeWorker.all[1]!
    second.onmessage!({ data: { id: second.posted[0]!.id, reduced: {} } })
    expect(answers).toEqual(['second'])
  })

  it('reduces on the spot when the worker fails', () => {
    vi.stubGlobal('Worker', FakeWorker)
    let reduced
    createColorReducer().reduce(request(), (result) => (reduced = result))
    FakeWorker.all[0]!.onerror!()
    expect(reduced).toMatchObject({ colors: [{ hex: '#000000', count: 3 }, { hex: '#ffffff', count: 2 }] })
  })
})

describe('createColorReductionQueue (ticket 1253)', () => {
  it('reduces on the spot where the browser has no worker', async () => {
    await expect(createColorReductionQueue().reduce(request())).resolves.toMatchObject({ colors: [{ hex: '#000000', count: 3 }, { hex: '#ffffff', count: 2 }] })
  })

  it('answers every request, each with its own result, from one worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const queue = createColorReductionQueue()
    const first = queue.reduce(request(12))
    const second = queue.reduce(request(24))
    const [worker] = FakeWorker.all
    expect(FakeWorker.all).toHaveLength(1)
    const [a, b] = worker!.posted
    worker!.onmessage!({ data: { id: b!.id, reduced: { colors: [], byHex: new Map(), keptApart: true } } })
    worker!.onmessage!({ data: { id: a!.id, reduced: { colors: [], byHex: new Map(), keptApart: false } } })
    await expect(first).resolves.toMatchObject({ keptApart: false })
    await expect(second).resolves.toMatchObject({ keptApart: true })
  })

  it('drops what is waiting when cleared: a later request gets a fresh worker', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const queue = createColorReductionQueue()
    let dropped = false
    void queue.reduce(request(12)).then(() => (dropped = true))
    queue.clear()
    expect(FakeWorker.all[0]!.terminated).toBe(true)
    const next = queue.reduce(request(24))
    const worker = FakeWorker.all[1]!
    worker.onmessage!({ data: { id: worker.posted[0]!.id, reduced: { colors: [], byHex: new Map(), keptApart: true } } })
    await expect(next).resolves.toMatchObject({ keptApart: true })
    expect(dropped).toBe(false)
  })

  it('reduces on the spot what was waiting when the worker fails', async () => {
    vi.stubGlobal('Worker', FakeWorker)
    const waiting = createColorReductionQueue().reduce(request())
    FakeWorker.all[0]!.onerror!()
    await expect(waiting).resolves.toMatchObject({ colors: [{ hex: '#000000', count: 3 }, { hex: '#ffffff', count: 2 }] })
  })
})
