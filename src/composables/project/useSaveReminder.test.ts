import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'
import { STALE_FILE_MS, type SinceFile } from '../../domain/beadsSinceFile'
import { useSaveReminder } from './useSaveReminder'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(100 * STALE_FILE_MS)
})
afterEach(() => vi.useRealTimers())

async function setup(options: { since?: SinceFile; persisted?: boolean; createdAt?: number } = {}) {
  const project = ref<{ id: string; createdAt: number } | undefined>({ id: 'a', createdAt: options.createdAt ?? Date.now() })
  const since = ref<SinceFile>(options.since ?? { beads: 0 })
  const busy = ref(false)
  const announce = vi.fn()
  const scope = effectScope()
  const ring = scope.run(() =>
    useSaveReminder({
      project: () => project.value,
      since: () => since.value,
      persistentStorage: { persisted: async () => options.persisted ?? false, persist: async () => {} },
      busy: () => busy.value,
      announce,
    }),
  )!
  await vi.advanceTimersByTimeAsync(0)
  /** Beads land: the count becomes `beads`. */
  const land = async (beads: number) => {
    since.value = { ...since.value, beads }
    await nextTick()
  }
  return { ring, project, since, busy, announce, land, scope }
}

describe('useSaveReminder', () => {
  it('shows nothing below the threshold', async () => {
    const { ring, land } = await setup()
    await land(49)
    await vi.advanceTimersByTimeAsync(10_000)

    expect(ring.shown.value).toBe(false)
  })

  it('appears at 50 once nothing has landed for 3 s, with the label open for 4 s and said once', async () => {
    const { ring, land, announce } = await setup()
    await land(50)
    await vi.advanceTimersByTimeAsync(2999)
    expect(ring.shown.value).toBe(false)

    await vi.advanceTimersByTimeAsync(1)
    expect([ring.shown.value, ring.labelOpen.value]).toEqual([true, true])
    expect(announce).toHaveBeenCalledExactlyOnceWith(50)

    await vi.advanceTimersByTimeAsync(4000)
    expect([ring.shown.value, ring.labelOpen.value]).toEqual([true, false])
  })

  it('waits for 100 where the browser keeps storage', async () => {
    const { ring, land } = await setup({ persisted: true })
    await land(99)
    await vi.advanceTimersByTimeAsync(3000)
    expect(ring.shown.value).toBe(false)

    await land(100)
    await vi.advanceTimersByTimeAsync(3000)
    expect(ring.shown.value).toBe(true)
  })

  it('waits while more beads land, and while something is open', async () => {
    const { ring, land, busy } = await setup()
    await land(50)
    await vi.advanceTimersByTimeAsync(2000)
    await land(60)
    await vi.advanceTimersByTimeAsync(2000)
    expect(ring.shown.value).toBe(false)

    busy.value = true
    await vi.advanceTimersByTimeAsync(5000)
    expect(ring.shown.value).toBe(false)

    busy.value = false
    await nextTick()
    expect([ring.shown.value, ring.labelOpen.value]).toEqual([true, true])
  })

  it('opens the label again at every further 100 beads, not on its way back', async () => {
    const { ring, land, announce } = await setup()
    await land(50)
    await vi.advanceTimersByTimeAsync(7000)
    await land(149)
    await vi.advanceTimersByTimeAsync(7000)
    expect(announce).toHaveBeenCalledTimes(1)

    await land(150)
    await vi.advanceTimersByTimeAsync(3000)
    expect(ring.labelOpen.value).toBe(true)
    await vi.advanceTimersByTimeAsync(4000)
    await land(140)
    await land(150)
    await vi.advanceTimersByTimeAsync(7000)
    expect(announce).toHaveBeenCalledTimes(2)
  })

  it('hides once a Project file is saved', async () => {
    const { ring, land } = await setup()
    await land(50)
    await vi.advanceTimersByTimeAsync(3000)
    await land(0)

    expect([ring.shown.value, ring.labelOpen.value]).toEqual([false, false])
  })

  it('shows at once for a Project opening past the threshold, opening the label only when its last file is 7 days old', async () => {
    const recent = await setup({ since: { beads: 80, lastFileAt: Date.now() - 1000 } })
    expect([recent.ring.shown.value, recent.ring.labelOpen.value]).toEqual([true, false])

    const behind = await setup({ since: { beads: 80, lastFileAt: Date.now() - STALE_FILE_MS } })
    expect([behind.ring.shown.value, behind.ring.labelOpen.value]).toEqual([true, true])
  })

  it('keeps the label open while held, and closes it 1 s after', async () => {
    const { ring, land } = await setup()
    await land(50)
    await vi.advanceTimersByTimeAsync(3000)
    ring.hold(true)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(ring.labelOpen.value).toBe(true)

    ring.hold(false)
    await vi.advanceTimersByTimeAsync(999)
    expect(ring.labelOpen.value).toBe(true)
    await vi.advanceTimersByTimeAsync(1)
    expect(ring.labelOpen.value).toBe(false)
  })

  it('shows nothing with no Project open', async () => {
    const { ring, project } = await setup({ since: { beads: 80 } })
    project.value = undefined
    await nextTick()

    expect(ring.shown.value).toBe(false)
  })
})
