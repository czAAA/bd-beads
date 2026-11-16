import { inject, provide, type InjectionKey } from 'vue'

/** What a docked converter's sheet hands the setting laid out in it (ConvertImage card DS-4, ticket 0919). */
export interface ConvertSheetContext {
  /** Closes the sheet and gives focus back to the setting that opened it. */
  close: () => void
}

const CONVERT_SHEET: InjectionKey<ConvertSheetContext> = Symbol('convert-sheet')

/** The sheet names itself to its content, which then draws the sheet's head as its own (ticket 0919). */
export function provideConvertSheet(sheet: ConvertSheetContext): void {
  provide(CONVERT_SHEET, sheet)
}

/** The sheet this setting is laid out in, or none in the Desktop's popover, which keeps its own title row. */
export function useConvertSheet(): ConvertSheetContext | undefined {
  return inject(CONVERT_SHEET, undefined)
}
