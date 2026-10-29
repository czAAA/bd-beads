/** Paste in Convert image (spec 0645): the first picture on the clipboard as a file, through the async Clipboard API
 * where the browser grants it; nothing when it holds none, the API is missing or reading is refused. */
export async function readClipboardImage(): Promise<File | undefined> {
  if (typeof navigator === 'undefined' || !navigator.clipboard?.read) return undefined
  try {
    for (const item of await navigator.clipboard.read()) {
      const type = item.types.find((each) => each.startsWith('image/'))
      if (type) return new File([await item.getType(type)], `pasted.${type.slice('image/'.length)}`, { type })
    }
  } catch {
    return undefined
  }
  return undefined
}
