import type { DecodeImage } from '../domain/imageConversion'
import { downloadFile, type DownloadFile } from './fileDownload'
import { decodeImageFile } from './imageDecode'
import { browserLibraryStore, type LibraryStore } from './libraryStore'
import { browserDevicePreferences, type DevicePreferences } from './devicePreferences'
import { browserAppUpdates, type AppUpdates } from './offlineShell'
import { browserPersistentStorage, type PersistentStorage } from './persistentStorage'
import { browserTourStore, type TourStore } from './tourStore'

// Everything reaching outside the page's memory (ADR 0020), as one bundle for the app shell; a test fakes the fields it
// cares about.
export interface Services {
  libraryStore: LibraryStore
  downloadFile: DownloadFile
  decodeImage: DecodeImage
  devicePreferences: DevicePreferences
  tourStore: TourStore
  appUpdates: AppUpdates
  persistentStorage: PersistentStorage
}

export const browserServices: Services = {
  libraryStore: browserLibraryStore,
  downloadFile,
  decodeImage: decodeImageFile,
  devicePreferences: browserDevicePreferences,
  tourStore: browserTourStore,
  appUpdates: browserAppUpdates,
  persistentStorage: browserPersistentStorage,
}
