import { vi } from 'vitest'

/** Doubles for what localStorage does to a write (ticket 55): counting writes, and refusing them.
 * Both spy on Storage.prototype, so a test needs `vi.restoreAllMocks()` afterwards. */

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

/** Makes localStorage refuse writes like a browser out of quota (ticket 55), only `key` when given.
 * Returns the spy so a test can restore real writes mid-run and watch the app recover. */
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
