// Hands a page-built file to the person (ADR 0001). On iPhone/iPad the share sheet is preferred ("Save to Files"; in-
// app browsers ignore download links); elsewhere, or if sharing fails, a download link. Sharing must start in the
// click, so nothing awaits before `navigator.share`. A share refused for want of a fresh tap is reported (ticket 523).

const JSON_TYPE = 'application/json'

function isIosFamily(): boolean {
  // iPadOS 13+ reports itself as a Mac, so a Mac with a touch screen is an iPad.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

// The link must be in the document for Firefox to act on the click, and the blob URL must outlive it for Safari: revoke
// on the next tick.
function downloadViaLink(fileName: string, contents: BlobPart, type: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url))
}

/** What came of handing a file over: `'refused'` when the share sheet needed a fresh tap and got a stale one, `'cancelled'` when the person closed it. */
type HandOver = 'handed' | 'refused' | 'cancelled'

/** How a file is handed over (ADR 0020); downloadFile is the browser's, and a test supplies its own. */
export type DownloadFile = (fileName: string, contents: BlobPart, type?: string) => HandOver | Promise<HandOver> | void

// Hands over a file: a Project file by default, or a picture or document built in the page (ticket 73, 74) when the
// type says so.
export const downloadFile: DownloadFile = (fileName, contents, type = JSON_TYPE) => {
  if (isIosFamily() && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([contents], fileName, { type })
    if (navigator.canShare({ files: [file] })) {
      return navigator.share({ files: [file] }).then(
        (): HandOver => 'handed',
        (error: unknown): HandOver => {
          // Closing the share sheet is the person's choice, not a failure; a stale tap is the caller's to ask again
          // for; anything else falls back to a download.
          if (error instanceof DOMException && error.name === 'NotAllowedError') {
            return 'refused'
          }
          if (error instanceof DOMException && error.name === 'AbortError') {
            return 'cancelled'
          }
          downloadViaLink(fileName, contents, type)
          return 'handed'
        },
      )
    }
  }

  downloadViaLink(fileName, contents, type)
  return 'handed'
}
