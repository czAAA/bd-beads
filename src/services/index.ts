import type { DecodeImage } from '../domain/imageConversion'
import { downloadFile, type DownloadFile } from './fileDownload'
import { decodeImageFile } from './imageDecode'
import { readClipboardImage } from './clipboardImage'
import { browserLibraryStore, type LibraryStore } from './libraryStore'
import { browserDevicePreferences, type DevicePreferences } from './devicePreferences'
import { browserAppUpdates, type AppUpdates } from './offlineShell'
import { browserPersistentStorage, type PersistentStorage } from './persistentStorage'
import { browserFeedback, type FeedbackService } from './feedback'

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
}
