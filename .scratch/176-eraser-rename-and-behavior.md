# 176: Eraser: rename, single-bead erase by default; Delete all → Clear pattern

**What to build:** Rename the "Erase" tool to "Eraser" and change its primary press/tap behavior from flood-erase to single-bead erase (matching today's right-click behavior), so it works on touch/phone without needing a right-click. Rename "Delete all" to "Clear pattern" to avoid a naming clash with the Eraser rename.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tool labeled "Eraser" (was "Erase") in UI and i18n (EN/RU)
- [ ] Primary press/tap with Eraser erases a single bead under the pointer, not a flood region
- [ ] Decide and document whether right-click erase stays as-is or becomes redundant now that it's the tool's default behavior
- [ ] "Delete all" control relabeled "Clear pattern" everywhere (UI, i18n, EN/RU)
- [ ] Confirmation modal for Clear pattern still requires explicit confirm
