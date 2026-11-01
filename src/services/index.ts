import type { CutOutService } from '../domain/cutOutModel'
import type { DecodeImage } from '../domain/imageConversion'
import { browserCutOut } from './cutOutService'
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
import type { OpeningAddress } from '../domain/openingAddress'

// Everything reaching outside the page's memory (ADR 0020), as one bundle for the app shell; a test fakes the fields it
// cares about.
export interface Services {
  libraryStore: LibraryStore
  downloadFile: DownloadFile
  decodeImage: DecodeImage
  /** The picture on the clipboard, for Convert image's Paste (spec 0645). */
  readClipboardImage: () => Promise<File | undefined>
  /** Convert image's Cut out with AI: the model on the device (ticket 0767, ADR 0087). */
  cutOutService: CutOutService
  devicePreferences: DevicePreferences
  appUpdates: AppUpdates
  persistentStorage: PersistentStorage
  /** Sending a Report from the Feedback sheet, and Copy report (ADR 0081). */
  feedback: FeedbackService
  /** The safe start's "opening Project X" note (ticket 0716). */
  openingNote: OpeningNoteStore
  /** What the address the editor opened at asks for, read once (ticket 0716). */
  openingAddress: () => OpeningAddress
}

export const browserServices: Services = {
  libraryStore: browserLibraryStore,
  downloadFile,
  decodeImage: decodeImageFile,
  readClipboardImage,
  cutOutService: browserCutOut,
  devicePreferences: browserDevicePreferences,
  appUpdates: browserAppUpdates,
  persistentStorage: browserPersistentStorage,
  feedback: browserFeedback,
  openingNote: browserOpeningNote,
  openingAddress: takeOpeningAddress,
}
