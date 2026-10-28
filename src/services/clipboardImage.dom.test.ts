import { afterEach, describe, expect, it, vi } from 'vitest'
import { readClipboardImage } from './clipboardImage'

afterEach(() => vi.unstubAllGlobals())

const clipboard = (read: () => Promise<unknown>) => vi.stubGlobal('navigator', { clipboard: { read } })

describe('readClipboardImage', () => {
  it('hands back the first picture on the clipboard as a file', async () => {
    clipboard(async () => [
      { types: ['text/plain'], getType: async () => new Blob(['hi']) },
      { types: ['image/png'], getType: async () => new Blob(['png'], { type: 'image/png' }) },
    ])
    const file = await readClipboardImage()
    expect(file).toMatchObject({ name: 'pasted.png', type: 'image/png' })
  })

  it('hands back nothing for a clipboard with no picture, a refused read or no API', async () => {
    clipboard(async () => [{ types: ['text/plain'], getType: async () => new Blob(['hi']) }])
    expect(await readClipboardImage()).toBeUndefined()
    clipboard(() => Promise.reject(new Error('NotAllowedError')))
    expect(await readClipboardImage()).toBeUndefined()
    vi.stubGlobal('navigator', {})
    expect(await readClipboardImage()).toBeUndefined()
  })
})
