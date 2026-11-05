// Writing a Project file into a file the person picked (ADR 0090, ticket 0796): the File System Access API, Chromium on
// desktop. Elsewhere `available` is false and every save hands the file over as before (fileDownload.ts). Never throws.

/** A picked file: the browser's handle, kept on the device as the Project's Linked file. */
export type PickedFile = FileSystemFileHandle

/** What a pick came to: the file, the person closing the dialog, or the browser refusing to open it. */
type PickOutcome = { kind: 'picked'; file: PickedFile } | { kind: 'cancelled' } | { kind: 'failed' }

/** How a Project file is written into a picked file (ADR 0090); the browser's by default, a fake in tests. */
export interface FileWriter {
  /** Whether this browser can write into a picked file. */
  available: boolean
  /** Opens the system Save dialog with `suggestedName`. */
  pick(suggestedName: string): Promise<PickOutcome>
  /** Whether the file may be written now and is still there, asking the browser's permission in the press if needed. */
  ready(file: PickedFile): Promise<boolean>
  /** Writes the contents whole; false when it failed, the last good file then left in place. */
  write(file: PickedFile, contents: BlobPart): Promise<boolean>
}

/** The parts of the File System Access API the DOM types don't carry yet. */
interface PermissionedHandle {
  queryPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>
  requestPermission?: (descriptor: { mode: 'readwrite' }) => Promise<PermissionState>
}
type SavePicker = (options: { suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }) => Promise<FileSystemFileHandle>

const savePicker = (): SavePicker | undefined => (typeof window === 'undefined' ? undefined : (window as unknown as { showSaveFilePicker?: SavePicker }).showSaveFilePicker)

export const browserFileWriter: FileWriter = {
  available: typeof savePicker() === 'function',
  async pick(suggestedName) {
    try {
      const file = await savePicker()!({ suggestedName, types: [{ description: 'openbeads', accept: { 'application/json': ['.openbeads'] } }] })
      return { kind: 'picked', file }
    } catch (error) {
      return error instanceof DOMException && error.name === 'AbortError' ? { kind: 'cancelled' } : { kind: 'failed' }
    }
  },
  async ready(file) {
    try {
      const handle = file as FileSystemFileHandle & PermissionedHandle
      const asked = { mode: 'readwrite' } as const
      if ((await handle.queryPermission?.(asked)) !== 'granted' && (await handle.requestPermission?.(asked)) !== 'granted') return false
      // A file moved or deleted since it was linked throws NotFoundError here.
      await file.getFile()
      return true
    } catch {
      return false
    }
  },
  async write(file, contents) {
    try {
      const writable = await file.createWritable()
      await writable.write(new Blob([contents]))
      await writable.close()
      return true
    } catch {
      return false
    }
  },
}
