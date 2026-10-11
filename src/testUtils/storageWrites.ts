import { vi } from 'vitest'

/**
 * Test doubles for what localStorage does to a write, for the ticket-55 saving behavior: how many writes a gesture
 * makes, and what the app does when one is refused. Both spy on Storage.prototype, so a test using either needs
 * `vi.restoreAllMocks()` afterwards.
 */

/** A spy over every localStorage write, for counting them; pass `key` to count only that key's writes. */
export function spyOnStorageWrites(key?: string) {
  const setItem = vi.spyOn(Storage.prototype, 'setItem')
  setItem.mockClear()

  return {
    /** How many writes have landed since this spy was installed. */
    get count(): number {
      return setItem.mock.calls.filter(([writtenKey]) => key === undefined || writtenKey === key).length
    },
  }
}

/**
 * Makes localStorage refuse writes the way a browser out of quota does — the failure mode ticket 55 exists for.
 * Refuses only `key` when one is given, so a test can leave unrelated keys (the saved language, say) working, and
 * returns the spy so a test can restore real writes mid-run and watch the app recover.
 */
export function refuseStorageWrites(key?: string) {
  const realSetItem = Storage.prototype.setItem

  return vi
    .spyOn(Storage.prototype, 'setItem')
    .mockImplementation(function (this: Storage, writtenKey: string, value: string) {
      if (key === undefined || writtenKey === key) {
        throw new DOMException('exceeded the quota', 'QuotaExceededError')
      }
      realSetItem.call(this, writtenKey, value)
    })
}
