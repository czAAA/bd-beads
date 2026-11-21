import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ReductionRequest } from '../domain/convertColors'
import { createColorReducer } from './colorReducer'

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
