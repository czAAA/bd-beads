import type { DecodeImage } from '../domain/imageConversion'
import { downloadFile, type DownloadFile } from './fileDownload'
import { decodeImageFile } from './imageDecode'
import { browserAddedColorsStore, type AddedColorsStore } from './addedColorsStore'
import { browserLibraryStore, type LibraryStore } from './libraryStore'
import { browserLocaleStore, type LocaleStore } from './localeStore'
import { browserMakerNameStore, type MakerNameStore } from './makerNameStore'
import { browserThemePickStore, type ThemePickStore } from './themeStore'
import { browserTourStore, type TourStore } from './tourStore'

/**
 * Everything that reaches outside the page's own memory (ADR 0020), as one bundle for the app shell to wire into the
 * composables. Each field is a small interface with a browser implementation; a test hands over a fake for the ones it
 * cares about.
 */
export interface Services {
  libraryStore: LibraryStore
  downloadFile: DownloadFile
  decodeImage: DecodeImage
  makerNameStore: MakerNameStore
  addedColorsStore: AddedColorsStore
  themePickStore: ThemePickStore
  localeStore: LocaleStore
  tourStore: TourStore
}

export const browserServices: Services = {
  libraryStore: browserLibraryStore,
  downloadFile,
  decodeImage: decodeImageFile,
  makerNameStore: browserMakerNameStore,
  addedColorsStore: browserAddedColorsStore,
  themePickStore: browserThemePickStore,
  localeStore: browserLocaleStore,
  tourStore: browserTourStore,
}
