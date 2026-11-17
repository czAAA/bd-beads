/** The Build's Version and build mark as one text, "1.0.0 · 090fe59" (ticket 1045, spec 1043): what About and a Report
 * show. vite.config.ts sets both from the release record, the Release notes and git (vite.version.ts). */
export const BUILD_VERSION = __APP_VERSION__
export const BUILD_MARK = __BUILD_MARK__
export const BUILD_TEXT = `${BUILD_VERSION} · ${BUILD_MARK}`
