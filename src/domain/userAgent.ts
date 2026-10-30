// A browser's user agent string reduced to what a Report attaches (spec 0698): the browser's and the system's names,
// never the version numbers or the device model, which say more about the person than the bug needs.

/** Browsers in the order a user agent must be tested: each later one's token also appears in the earlier ones' strings
 * (Edge and Opera say Chrome, Chrome says Safari). */
const BROWSERS: ReadonlyArray<[RegExp, string]> = [
  [/Edg(e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/SamsungBrowser\//, 'Samsung Internet'],
  [/Firefox\/|FxiOS\//, 'Firefox'],
  [/Chrome\/|CriOS\/|Chromium\//, 'Chrome'],
  [/Safari\//, 'Safari'],
]

/** Systems in test order: Android says Linux, an iPad on iPadOS 13 or later says Macintosh. */
const SYSTEMS: ReadonlyArray<[RegExp, string]> = [
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/CrOS/, 'ChromeOS'],
  [/Windows/, 'Windows'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/Linux/, 'Linux'],
]

const UNKNOWN = 'Other'

function firstMatch(text: string, table: ReadonlyArray<[RegExp, string]>): string {
  return table.find(([pattern]) => pattern.test(text))?.[1] ?? UNKNOWN
}

/** The browser and system a user agent names (`Firefox`, `Android`), `Other` for one it doesn't. */
export function browserAndSystem(userAgent: string): { browser: string; os: string } {
  return { browser: firstMatch(userAgent, BROWSERS), os: firstMatch(userAgent, SYSTEMS) }
}
