import { flushPromises } from '@vue/test-utils'

/** Waits for a picked file to be read: unpacking a gzip runs on streams, which one flushPromises doesn't outwait (ticket 392). */
export async function settleImport(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 30))
  await flushPromises()
}
