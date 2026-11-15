/** The print and PDF code (`printCode.ts`, ticket 0991), as the Export rows and the exports ask for it. */
export type PrintCode = typeof import('./printCode')

/** Fetches the print code the first time, and hands over the same module every time after. */
export const loadPrintCode = (): Promise<PrintCode> => import('./printCode')
