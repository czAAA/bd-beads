import type { DecodeImage } from '../domain/imageConversion'
import { downloadFile, type DownloadFile } from './fileDownload'
import { decodeImageFile } from './imageDecode'
import { readClipboardImage } from './clipboardImage'
import { browserLibraryStore, type LibraryStore } from './libraryStore'
import { browserDevicePreferences, type DevicePreferences } from './devicePreferences'
import { browserAppUpdates, type AppUpdates } from './offlineShell'
import { browserPersistentStorage, type PersistentStorage } from './persistentStorage'
import { browserFeedback, type FeedbackService } from './feedback'
import { browserOpeningNote, type OpeningNoteStore } from './openingNote'
import { takeOpeningAddress } from './openingAddress'
import { browserPictureStore, type PictureStore } from './pictureStore'
import { drawablePicture, preparePicture, type DrawablePicture, type PreparedPicture } from './referencePicture'
import type { OpeningAddress } from '../domain/openingAddress'

// Everything reaching outside the page's memory (ADR 0020), as one bundle for the app shell; a test fakes the fields it
// cares about.
export interface Services {
  libraryStore: LibraryStore
  downloadFile: DownloadFile
  decodeImage: DecodeImage
  /** The picture on the clipboard, for Convert image's Paste (spec 0645). */
  readClipboardImage: () => Promise<File | undefined>
  devicePreferences: DevicePreferences
  appUpdates: AppUpdates
  persistentStorage: PersistentStorage
  /** Sending a Report from the Feedback sheet, and Copy report (ADR 0081). */
  feedback: FeedbackService
  /** The safe start's "opening Project X" note (ticket 0716). */
  openingNote: OpeningNoteStore
  /** What the address the editor opened at asks for, read once (ticket 0716). */
  openingAddress: () => OpeningAddress
  /** Where reference images' pictures are kept, and how a picked one is made ready and a kept one read (ADR 0089). */
  pictureStore: PictureStore
  preparePicture: (file: File) => Promise<PreparedPicture>
  drawablePicture: (blob: Blob) => Promise<DrawablePicture>
}

export const browserServices: Services = {
  libraryStore: browserLibraryStore,
  downloadFile,
  decodeImage: decodeImageFile,
  readClipboardImage,
  devicePreferences: browserDevicePreferences,
  appUpdates: browserAppUpdates,
  persistentStorage: browserPersistentStorage,
  feedback: browserFeedback,
  openingNote: browserOpeningNote,
  openingAddress: takeOpeningAddress,
  pictureStore: browserPictureStore,
  preparePicture,
  drawablePicture,
}
