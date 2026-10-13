import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadFile, sharesFromTap } from './fileDownload'

const IPAD_UA = 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'

function stubBrowser(userAgent: string, share?: { share: () => Promise<void>; canShare: () => boolean }) {
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints: 5, ...share })
}

describe('downloadFile', () => {
  let linkClicks: string[]

  function stubLinkDownload() {
    linkClicks = []
    vi.stubGlobal('URL', { ...URL, createObjectURL: () => 'blob:1', revokeObjectURL: () => {} })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      linkClicks.push(this.download)
    })
  }

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('downloads through a link by default', () => {
    stubLinkDownload()
    stubBrowser('Mozilla/5.0 (X11; Linux x86_64) Chrome/120')

    downloadFile('a.json', '{}')

    expect(linkClicks).toEqual(['a.json'])
  })

  it('offers the file to the share sheet on an iPad that can share it', () => {
    stubLinkDownload()
    const share = vi.fn().mockResolvedValue(undefined)
    stubBrowser(IPAD_UA, { share, canShare: () => true })

    downloadFile('a.json', '{}')

    expect(share).toHaveBeenCalledOnce()
    expect(share.mock.calls[0]![0].files[0].name).toBe('a.json')
    expect(linkClicks).toEqual([])
  })

  it('treats an iPad that reports itself as a Mac like any other iPad', () => {
    stubLinkDownload()
    const share = vi.fn().mockResolvedValue(undefined)
    stubBrowser('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15', {
      share,
      canShare: () => true,
    })

    downloadFile('a.json', '{}')

    expect(share).toHaveBeenCalledOnce()
  })

  it('downloads through a link when the browser cannot share the file', () => {
    stubLinkDownload()
    stubBrowser(IPAD_UA, { share: vi.fn(), canShare: () => false })

    downloadFile('a.json', '{}')

    expect(linkClicks).toEqual(['a.json'])
  })

  it('falls back to a link when sharing fails, but not when the person closes the sheet', async () => {
    stubLinkDownload()
    const failing = vi.fn().mockRejectedValue(new DOMException('no', 'NotAllowedError'))
    stubBrowser(IPAD_UA, { share: failing, canShare: () => true })
    downloadFile('a.json', '{}')
    await vi.waitFor(() => expect(linkClicks).toEqual(['a.json']))

    linkClicks.length = 0
    const dismissed = vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError'))
    stubBrowser(IPAD_UA, { share: dismissed, canShare: () => true })
    downloadFile('a.json', '{}')
    await Promise.resolve()
    await Promise.resolve()
    expect(linkClicks).toEqual([])
  })

  it('does not share on a desktop that offers a share dialog', () => {
    stubLinkDownload()
    const share = vi.fn()
    vi.stubGlobal('navigator', { userAgent: 'Mozilla/5.0 (Windows NT 10.0) Chrome/120', maxTouchPoints: 0, share, canShare: () => true })

    downloadFile('a.json', '{}')

    expect(share).not.toHaveBeenCalled()
    expect(linkClicks).toEqual(['a.json'])
  })
})

describe('sharesFromTap', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('is true only on an iPad that can share the file', () => {
    stubBrowser(IPAD_UA, { share: vi.fn().mockResolvedValue(undefined), canShare: () => true })
    expect(sharesFromTap('a.png', 'image/png')).toBe(true)

    stubBrowser(IPAD_UA, { share: vi.fn().mockResolvedValue(undefined), canShare: () => false })
    expect(sharesFromTap('a.png', 'image/png')).toBe(false)

    stubBrowser('Mozilla/5.0 (X11; Linux x86_64) Chrome/120', { share: vi.fn().mockResolvedValue(undefined), canShare: () => true })
    expect(sharesFromTap('a.png', 'image/png')).toBe(false)
  })
})
