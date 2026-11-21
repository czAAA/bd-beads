import { effectScope, nextTick, ref } from 'vue'
import { describe, expect, it } from 'vitest'
import type { ReductionRequest } from '../../domain/convertColors'
import type { ReducedColors } from '../../domain/imageColors'
import type { ColorReducer } from '../../services/colorReducer'
import { useColorReduction } from './useColorReduction'

const answer = (hex: string): ReducedColors => ({ colors: [{ hex, count: 1 }], byHex: new Map(), keptApart: false })

/** A reducer that answers when the test says, to put one request after another. */
function holdingReducer() {
  const waiting: ((reduced: ReducedColors) => void)[] = []
  const reducer: ColorReducer = { reduce: (_request, done) => void waiting.push(done), stop: () => undefined }
  return { reducer, waiting }
}

function setup() {
  const asked = ref(12)
  const held = holdingReducer()
  const scope = effectScope()
  const reduction = scope.run(() =>
    useColorReduction((): ReductionRequest => ({ counts: new Map(), asked: asked.value, targets: undefined, choices: new Map(), leastBeads: 0 }), held.reducer),
  )!
  return { asked, scope, reduction, ...held }
}

describe('useColorReduction (ticket 1163)', () => {
  it('says it is reducing from the request until its result lands', () => {
    const { reduction, waiting } = setup()
    expect(reduction.reducing.value).toBe(true)
    waiting[0]!(answer('#111111'))
    expect(reduction.reducing.value).toBe(false)
    expect(reduction.reduced.value.colors[0]!.hex).toBe('#111111')
  })

  it('keeps the last result while a newer one is made', () => {
    const { asked, reduction, waiting } = setup()
    waiting[0]!(answer('#111111'))
    asked.value = 24
    expect(reduction.reducing.value).toBe(true)
    expect(reduction.reduced.value.colors[0]!.hex).toBe('#111111')
  })

  it('shows the latest request only: an older result arriving late never lands', async () => {
    const { asked, reduction, waiting } = setup()
    asked.value = 24
    await nextTick()
    waiting[1]!(answer('#222222'))
    waiting[0]!(answer('#111111'))
    expect(reduction.reduced.value.colors[0]!.hex).toBe('#222222')
    expect(reduction.reducing.value).toBe(false)
  })
})
