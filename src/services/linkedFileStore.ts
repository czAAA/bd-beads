import { projectKeyedStore, type ProjectKeyedStore } from './deviceDatabase'
import type { PickedFile } from './fileWriter'

// Each Project's Linked file (ADR 0090, ticket 0796): the handle of the file its Save writes into, kept in IndexedDB beside
// the reference images, never in the library, the Project file or Undo.

/** The Linked files kept per Project. */
export type LinkedFileStore = ProjectKeyedStore<PickedFile>

const isHandle = (value: unknown): value is PickedFile => typeof FileSystemFileHandle !== 'undefined' && value instanceof FileSystemFileHandle

export const browserLinkedFileStore: LinkedFileStore = projectKeyedStore('linked-files', isHandle)
