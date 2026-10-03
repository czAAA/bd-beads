# 229: Visual check that no text overflows its box, in Russian and English

**What to build:** A browser check that opens the app in each language at the supported screen sizes, walks through every screen, menu, sheet and dialog, and fails when any piece of text runs past the edge of its box, is cut off (ellipsis or hidden overflow), or wraps onto more lines than it should. A developer running `npm run visual` finds out that a Russian (or any future language's) string is too long while building it, not after it ships. The check is layout measurement, not a reference screenshot: it needs no committed images and no `visual:update` step.

Research for this ticket (Chromium, production build, fixture loom Pattern, 1900, 1280, 1024, 768, 390, 360 and 320 px wide) found 14 places where Russian text overflows or wraps and English does not; see the findings below. The check starts with those listed as pending, so it lands green, and tickets 230 and 231 each delete their entries. When the list is empty the check is strict.

**Blocked by:** None (can start immediately)

**Status:** done

## How the check decides

For every visible piece of text on the page it measures the text's own box against the box that is meant to hold it:
- the text pokes out past an ancestor that clips (overflow hidden/scroll/ellipsis), past its own box, or past the viewport's edge;
- an element with ellipsis or hidden overflow has more content than room (content wider than its box);
- the text breaks onto two or more lines in a control that is meant to be one line (buttons, tabs, labels, pills, headings, table headings); running paragraphs are exempt.

Ignore: what is off-screen on purpose (the closed drawer at tablet width, carousel cards not yet scrolled to, visually hidden text, the screen-reader-only table heading), and text the user typed (a long Pattern name legitimately ends in an ellipsis). Report each failure with the screen it was found on, the screen width, the language, the element, its text and by how many pixels it overflows, so the fix is obvious from the failure.

## Where it looks

- Both languages, so an English change can't regress either (a failure that also shows in English is still a failure, just not a translation problem).
- Screen widths 1900, 1280, 1024, 768, 390, 360 and 320 px (all five screen sizes and the narrow phones below them).
- The editor as it opens; the left column's Toolbox, Colors, Edit and Size groups; the drawer at tablet width; the phone Dock and its sheets (Tools, Colors, Edit, Size, Pattern); the header menu and each of its items (Overview, Take the tour, Shortcuts, Theme, Name on exports); the Export menu and each of its items; Name on exports dialog; Change size dialog; Clear pattern confirmation; Image colors; the New Pattern form (also with Convert image); weight and size info popovers; the keyboard shortcuts overlay; the Overview page and its carousel; the Tour steps, including the "back to loom" button.
- A state that can't be reached at some width (the control isn't shown there) is skipped, not failed.

## Pending findings the check starts with

(Elements and widths where Russian overflows and English does not. Each entry is removed by the ticket named.)

| Place | Russian today | Fails at | Fixed by |
| --- | --- | --- | --- |
| Image colors button label | Цвета изображения | 1900, 1280, 1024, 768 (and the phone sheet) | 230 |
| Save button | Сохранить схему | 1900, 1280, 1024, 768, 390, 360 | 231 |
| Tour "back to loom" button | Вернуться к ткачеству для первой схемы | 1900 to 768, 360, 320 | 230 |
| New Pattern: Peyote and Brick buttons | Мозаичное плетение, Кирпичное плетение | 1024, 390 (two lines), 320 | 230 and 231 |
| Remove line (toolbox and phone sheet) | Удалить линию | 1024, 768 (two lines), 320 | 230 |
| Clear pattern (toolbox and phone sheet) | Очистить схему | 1024, 768, 320 (two lines) | 230 |
| Saved Patterns box heading | Сохранённые схемы | 1024, 768 (two lines) | 230 |
| New Pattern: Convert image file label | Конвертировать изображение | 1024, 320 (two lines) | 230 |
| Weight estimate popover | Вес считаем как число бисеринок × … | 1900, 1280, 1024, 768 (cut by the left column by 67px) | 231 |
| Name on exports dialog, Save button | Сохранить | 360, 320 (dialog footer 8 to 48px past the screen) | 231 |
| Overview carousel tab, Convert image | Конвертировать изображение | 1900, 1280, 1024 (two lines) | 230 |
| Overview carousel tab, Techniques line | Ткачество, мозаичное и кирпичное плетение: каждая… | 1900, 1280, 1024 (three lines) | 230 |
| Overview coffee tile title | Сделано одним человеком | 390, 360 (two lines) | 230 |

## Acceptance criteria

- [x] `npm run visual` includes the new check, and it runs in CI with the rest of the visual suite
- [x] Run against a deliberately too-long label (done once while building, not committed), it fails and names the screen, width, language, element, text and overflow in pixels
- [x] Each of the pending findings above is detected by the check (so removing its entry makes the check fail until it is fixed); nothing else fails
- [x] A pending entry that has stopped overflowing makes the check fail, so a fixed entry can't be forgotten in the list
- [x] Passes on the current app with the pending list in place, in English and Russian, at all seven widths
- [x] Does not flag the intended truncations (a long user-typed Pattern name, off-screen drawer and carousel cards, screen-reader-only text)
- [x] Adding a third language to the app is picked up by the check by adding it to one list
- [x] Runs in a reasonable time on the CI machine; states are driven by the app's own controls like the other visual checks
- [x] Short note in CONTEXT.md or the visual check's docs on what the check measures and how to add a screen to it
- [x] Overview and Tour question (CLAUDE.md): asked of the user; answer: neither the Overview (77) nor the Tour (80)

## As built

- `e2e/visual/textFit.spec.ts` (screens and the language and width lists), `e2e/support/textFit.ts` (the in-browser measurement), `e2e/support/textFitPending.ts` (the pending list); how to use and extend: CONTEXT.md, "Text fit check".
- The ticket's table was research from before 230 merged and missed places. The pending list was rebuilt from what the check measures on the app as it is after 230, 36 entries; every entry is data, see the file. Beyond the table:
  - **Fails in English too** (`fixedBy: 'unassigned'`, nobody owns these yet): dialogs wider than the phone screen at 390, 360 and 320 (Clear pattern, Change size, Keyboard shortcuts, Name on exports, QR code), the Export menu opening off-screen at 768 (drawer), the weight popover cut by the left column at every width (the ticket had it at 1900 to 768), "Custom color" and "Image colors" cut by an ellipsis at 1024 and 768 and in the phone Colors sheet at 320, the Tour's last step "Row done" button at 1024 and 768, "Save Pattern" at 320, a "+" stepper in Convert image at 320, the Overview's "Made by one person" at 320.
  - **Russian only, not in the table** (`fixedBy: '231'`): Overview plan names and the "Create free account" button, "Три способа работать", Saved Patterns' "Экспортировать все" up to 768, the Tour's "Увеличить" tooltip and a step title at 320, the Overview example paper's "Ткачество".
  - **Not in the English baseline but in the table, now fixed by 230:** Image colors button, Tour back-to-loom button, Remove line, Clear pattern, Saved Patterns heading, Convert image label and carousel tab, coffee tile title (no entry).
- Judgement calls: the segmented control's options and the Overview tab line are allowed two lines (the English ones wrap that way by design); the backdrop word, ruler numbers, drawn Pattern and the Overview's example paper are not measured (artwork and intentionally clipped); a state that can't be reached at a width is skipped, so the Export menu items at 768 are measured from the menu's own screen only.
