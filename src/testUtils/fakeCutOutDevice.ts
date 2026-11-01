import type { CutOutDevice, CutOutRecord } from '../domain/cutOutModel'

/** A device record a test reads and seeds by hand (ticket 0768), with the memory and free space it reports: by default
 * nothing known, nothing reported, so nothing is warned. */
export function fakeCutOutDevice(options: { record?: Partial<CutOutRecord>; memoryGb?: number; freeBytes?: number } = {}) {
  let record: CutOutRecord = { running: false, stopped: false, ...options.record }
  const device: CutOutDevice = {
    read: () => record,
    write: (next) => (record = next),
    memoryGb: () => options.memoryGb,
    freeBytes: () => Promise.resolve(options.freeBytes),
  }
  return {
    device,
    /** What the device keeps now. */
    record: () => record,
  }
}
