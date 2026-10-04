/**
 * Hands a file built in the page to the person, since there is no backend to fetch it from (ADR 0001).
 *
 * On iPhone and iPad the share sheet is preferred where the browser can share a file: it offers "Save to Files", and
 * in-app browsers such as Telegram's often ignore a download link altogether. Everywhere else, and whenever sharing
 * isn't possible or fails, a download link does the job. Sharing has to start inside the click that asked for it, so
 * nothing here awaits before calling `navigator.share`.
 */

const JSON_TYPE = 'application/json'

function isIosFamily(): boolean {
  // iPadOS 13+ reports itself as a Mac, so a Mac with a touch screen is an iPad.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
}

/**
 * The link has to be in the document for Firefox to act on the click, and the blob URL has to outlive the click for
 * Safari to finish reading it — hence revoking on the next tick rather than immediately.
 */
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

/** How a file is handed over (ADR 0020); downloadFile is the browser's, and a test supplies its own. */
export type DownloadFile = (fileName: string, contents: BlobPart, type?: string) => void

/** Hands over a file: a Project file by default, or a picture or document built in the page (ticket 73, 74) when the type says so. */
export const downloadFile: DownloadFile = (fileName, contents, type = JSON_TYPE) => {
  if (isIosFamily() && typeof navigator.share === 'function' && typeof navigator.canShare === 'function') {
    const file = new File([contents], fileName, { type })
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file] }).catch((error: unknown) => {
        // Closing the share sheet is the person's choice, not a failure; anything else falls back to a download.
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          downloadViaLink(fileName, contents, type)
        }
      })
      return
    }
  }

  downloadViaLink(fileName, contents, type)
}
