import { projectKeyedStore, type ProjectKeyedStore } from './deviceDatabase'

// Where reference images' pictures are kept on the device (ADR 0089, ticket 0790): IndexedDB beside the library, one
// Blob per Project id.

/** The pictures kept per Project. */
export type PictureStore = ProjectKeyedStore<Blob>

export const browserPictureStore: PictureStore = projectKeyedStore('reference-images', (value): value is Blob => value instanceof Blob)
