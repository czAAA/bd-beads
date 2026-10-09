# Languages: typed dictionaries, left-to-right only, and `Intl` from the third language

**Status: accepted.** Tickets 03, 209, 229. Code catches up in ticket 368 (more languages, `Intl`).

- **The app's text lives in typed dictionaries**, one per language (`src/i18n/en.ts`, `ru.ts`), with no i18n library: every language must have every key, and a missing one is a type error. One language switcher serves the whole app, the Overview included, with one saved choice per device; a device that never picked one starts in English.
- **Words for domain concepts come from CONTEXT.md's Language section** in every language (Russian: "проект" for Project, "схема" for Pattern), never retranslated.
- **More languages come before the public release**: Chinese, Spanish and Polish first, then others, all **left to right**. Arabic and other right-to-left languages are out for now: the shell would need mirroring, and its CSS uses physical `left`/`right` in over 200 places. New CSS uses logical properties (`inline-start`, `inline-end`), so that cost stops growing.
- **Numbers and plurals move to `Intl`** (`Intl.NumberFormat`, `Intl.PluralRules`) when the third language lands. Today `formatNumber` groups thousands with a no-break space in both languages and `plural.ts` knows English's and Russian's forms; hand-rolling every language's rules doesn't scale past two.
- **Bundled fonts cover Latin and Cyrillic.** Chinese uses the device's system font: every supported phone, tablet and desktop has a good one, and a CJK web font is megabytes even subset, against the offline, no-third-party-request rule of [ADR 0021](0021-visual-language-follows-design-md.md).
- The Text fit check (`docs/testing.md`) runs every language at every width, so a longer translation that overflows fails the pull request.

**Considered options**: an i18n library such as vue-i18n (rejected: typed dictionaries already give complete-keys checking, with no runtime or bundle cost); right-to-left in the first set (rejected for now, above); bundling a CJK font (rejected: size, above).
