# Writing

How the app talks in English and Russian: the voice, sentence patterns, one glossary, and how numbers, units and dates are written.

## Voice

- Plain and short: say what happened or what to do, in the fewest words that are still a full thought. No "please", no "oops", no exclamation marks, no emoji, no blame ("Enter a height.", not "You forgot the height!").
- Name things with the app's nouns (the glossary below) and the button's own words: "Export Pattern", not "use the export feature".
- English is US English: color, gray, canceled. Sentence case everywhere; product nouns keep their capital (Bead, Palette, Technique, Row progress); the crafter's word "pattern" stays lower case (ticket 0989).
- Russian: product nouns are lowercase like any noun (схема, бисер, палитра); a button quoted in a sentence goes in «ёлочки»; ё is always written (сохранённые, всё).
- Labels and meta are lowercased by style, never in the string (as today).
- **No em dashes**, in either language: use a colon, a comma, brackets or two sentences. Russian rewrites the sentence instead of the dash between subject and predicate ("Эти размеры приблизительные.", not a dash before "оценка").
- **One colon rule for labels** (ticket 0853): a key before its value takes a colon ("name: Moth", "maker:", "codes: {count}"); a section header never does ("project", "frame", "export", "this Project"), in every language, the Chinese full-width colon too.
- **A help line fits the device in hand** (ticket 0846): one rule for every line that says how to do something. Touch (the main pointer is a finger and the key chips are hidden) gets finger words and no keys or shortcut digits ("two fingers", "pinch", "take a photo", nothing to drop); a keyboard on an Apple device gets ⌘ ("⌘V", no plus); any other keyboard gets Ctrl ("Ctrl+V"). The key is a blank (`{pasteKey}`) filled by the app, never written into the string. Keyboard shortcuts (ShortcutsHelp) lists every key on every device, and it and the key chips write them for the keyboard (ticket 0993): ⌘ and ⌫ on an Apple device, Shift before ⌘ ("Shift+⌘Z"), Ctrl and Del on any other.

## Sentence patterns

| Kind | Formula | English | Russian |
| --- | --- | --- | --- |
| Error | What happened. What to do. | This file can't be converted. Use PNG, JPEG, GIF, or WebP. | Этот файл нельзя сконвертировать. Подойдут PNG, JPEG, GIF или WebP. |
| Field error | What to enter. | Enter a height. | Укажите высоту. |
| Empty | What is missing. What to do next. | No Patterns saved yet | Пока нет сохранённых схем |
| Result | Label: number, or one word. | Patterns imported: 3 · Saved | Схем импортировано: 3 · Сохранено |
| Loading | Doing what · to what. | Converting the picture · 62% | Конвертируем изображение · 62 % |
| Confirm | Title as the question; what changes; can it be undone; button repeats the title. | Delete all? … This can be undone. [Cancel] [Delete all] | Очистить всё? … Это действие можно отменить. [Отмена] [Очистить всё] |

## Plurals and length

- Prefer "Label: number" so no plural is needed: "Patterns imported: 3" / «Схем импортировано: 3».
- Where a count sits inside a sentence, use `Intl.PluralRules`: English has one and other, Russian, Ukrainian, Belarusian and Polish one, few and many, Spanish one, many and other, Chinese other only (1 бисеринка, 2 бисеринки, 5 бисеринок; 1 цвет, 2 цвета, 5 цветов).
- Russian runs about a quarter longer: buttons and tabs are sized for the Russian string, text wraps rather than truncates; only Pattern names may end in an ellipsis, with the full name in the tooltip.

## Fitting longer text

Checked on the real layouts in Russian. The rules apply to both languages: see the LongerText card and the Responsive section.

| Where | In Russian | Fix (for both languages) |
| --- | --- | --- |
| Header at 1440px (MacBook Air) | Needs 1 690px: "Импортировать файл", "Заменить бисер", "Новая схема" are a third longer. English already fits with 0px to spare. | **The header fits by priority, not by breakpoint.** When it does not fit: 1) Import a file becomes an icon button (name as tooltip and `aria-label`); 2) the Pattern name is cut with an ellipsis; 3) the import moves into More. In Russian at 1440px step 1 applies. 
| New Pattern → Technique | "Мозаичное плетение", "Кирпичное плетение" do not fit three segments in 262px (need 436px). | **SegmentedControl labels may wrap to two lines**; the control grows to 48px and every segment keeps the same height. Never cut or shrink the text. 
| Selection ContextBar (phone) | "Удалить выделенный ряд/столбец" (the app's string) breaks the bar; on the paste bar "Отмена" is cut. | **The ContextBar drops labels right to left** when it does not fit: Remove line, then Rotate, then Copy become icon buttons with their names as `aria-label`. Cancel keeps its label. 
| Saved Patterns names | Names such as "Панно с логотипом" wrap and run into their neighbours. | **Thumbnail names are one line**, cut with an ellipsis at 58px, the full name in the tooltip (as the writing rules say for Pattern names). 
| Mirror summary | "l–r 1 · t–b 0" has no good Russian short form. | Use arrows in both languages: **"↔ 1 · ↕ 0"**. 
| Toolbox tabs, menus, modals, forms, messages, Progress bar | "Заливка", "Выделение", "Отражение", "Инструменты" fit with 2–4px to spare; long hints and errors wrap as designed. | Dock and BottomToolbar buttons share the width equally (no fixed 56–60px), so the label may use all of it. 
| PDF and PNG | "Ткачество" is longer than "Loom"; Cyrillic falls back to Source Serif 4 italic for the word and name; color names and grams fit the 48 mm column; the grams note wraps to three lines. | The Beads needed note may wrap; nothing else changes. 
| Copy found on the way | Cards used British "Colour", "Colours", "Custom colour" in UI labels. | US English in the app: **Color, Colors, Custom color** (cards corrected). 

## Glossary

The one glossary of the words the app shows, in every language: CONTEXT.md and the Glossary card point here (ticket 0989). A line a stranger reads before they have a Frame uses the crafter's word, pattern; the model's nouns (Piece, Schema, Frame) are for the places where they act.

| English | Russian | Note |
| --- | --- | --- |
| Project | проект | Saved Projects / Сохранённые проекты; New Project / Новый проект |
| pattern | схема | The crafter's word, lower case, for what they are making, in lines read before there is a Frame: Turn a picture into a bead pattern. (ticket 0989) |
| Schema | схема | A Piece that has a Frame or a name (ADR 0050). Shown in English only in the Schema tag and the Piece-naming hint, which define it (ticket 0989) |
| Bead / beads | бисеринка / бисер | One bead is бисеринка everywhere, never бусина or бисерина («4 бисеринки», «Бисеринок»); the material and amounts are бисер (ticket 0864) |
| Technique | техника плетения | Loom / ткачество, Peyote / мозаичное плетение, Brick stitch / кирпичное плетение |
| Palette | палитра |  |
| Row progress | прогресс по рядам | Row done / Ряд готов; Back a row / Назад на ряд (ticket 0972, was Row not done / Ряд не готов); never a bare «Готово», which reads as closing something. Where a pair has no room in the Progress bar it becomes Следующий / Предыдущий (ticket 0864) |
| Beads needed | Нужно бисера | Its count column: Beads / Бисеринок |
| Clear | Очистить; confirm Очистить? | Empties the cells; the Schema stays. Not «Очистить всё», which was Delete all |
| Save Project | Сохранить проект | The SaveBox button; the name field's Save stays Сохранить |
| in this browser | в этом браузере | Where Projects are kept, said one way everywhere (ticket 0992): Saved in this browser, Kept by this browser, removed from this browser, Couldn't save in this browser. Never "local browser" or "this device" for where the work lives |
| Delete all | Очистить всё | Empties the cells; the Schema stays |
| Mirror | Отражение | Estimated size / Примерный размер |
| Frame | рамка | Set Frame / Задать рамку; no Frame / без рамки (v16, in Size's place). Defined in the Frame button's Tooltip: The Frame marks the part you export and weave. (ticket 0989) |
| Piece | кусочек | Beads that touch; 1 кусочек, 2 кусочка, 5 кусочков |
| Folded beads | свёрнутые бисеринки | The Frame's own beads beyond its edge, out of sight (ADR 0066); proposed, ticket 0641 |
| Canvas · Hand · Rulers | Холст · Рука · Линейки | The drawing area, the tool that moves it, the row and column numbers; the Canvas is холст everywhere, never полотно (ticket 0864) |
| Export · Import | Экспорт · Импорт | Buttons use the verb: Экспортировать схему |
| Convert image | Конвертировать изображение | A Project made from a picture |
| Maker | автор | The name on exports: Имя автора, автор: {maker}, Изменить имя автора; never мастер (ticket 0864) |
| The Frame's edges | Сверху · Снизу · Слева · Справа | The edge cells of the Frame panel's size; a word with no room moves to its glyph's Tooltip (ticket 0864) |

## Ukrainian, Belarusian, Chinese, Spanish and Polish (ticket 368)

The same voice and sentence patterns in each language; domain words are never retranslated (ADR 0039). Ukrainian and Belarusian follow the Russian column (same sentence patterns, «ялинки» for quoted buttons, one, few and many plurals); Belarusian is in the official orthography. Chinese is Simplified, drawn by the device's own font. Spanish and Polish address the reader as "tú" / "ty", in the imperative.

| English | Ukrainian | Belarusian |
| --- | --- | --- |
| Project | проєкт | праект |
| Schema | схема | схема |
| Bead / beads | бісерина / бісер | бісерына / бісер |
| Technique | техніка плетіння | тэхніка пляцення |
| Loom · Peyote · Brick stitch | Ткацтво · Мозаїчне плетіння · Цегляне плетіння | Ткацтва · Мазаічнае пляценне · Цаглянае пляценне |
| Palette | палітра | палітра |
| Row progress | прогрес за рядами | прагрэс па радках |
| Beads needed | Потрібно бісеру | Патрэбна бісеру |
| Frame | рамка | рамка |
| Piece | шматочок | кавалачак |
| Canvas · Hand · Rulers | Полотно · Рука · Лінійки | Палатно · Рука · Лінейкі |
| Mirror | Відображення | Адлюстраванне |
| Convert image | Конвертувати зображення | Канвертаваць выяву |
| Row done · Back a row | Ряд готовий · Назад на ряд; by columns Наступний · Назад на стовпець (ticket 0972) | Рад гатовы · Назад на рад; Слупок гатовы · Назад на слупок |
| The Frame's edges | Зверху · Знизу · Зліва · Справа | Верх · Ніз · Злева · Справа |

| English | Chinese | Spanish | Polish |
| --- | --- | --- | --- |
| Project | 项目 | proyecto | projekt |
| Schema | 图样 | esquema | schemat |
| Bead / beads | 珠子 | cuenta / cuentas | koralik / koraliki |
| Technique | 编织技法 | técnica | technika |
| Loom · Peyote · Brick stitch | 织机 · 佩奥 · 砖形 | Telar · Peyote · Punto ladrillo | Krosno · Peyote · Ścieg ceglasty |
| Palette | 调色板 | paleta | paleta |
| Row progress | 行进度 | progreso por filas | postęp rzędów |
| Beads needed | 所需珠子 | Cuentas necesarias | Potrzebne koraliki |
| Frame | 边框 | marco | ramka |
| Piece | 小块 | trozo | kawałek |
| Canvas · Hand · Rulers | 画布 · 抓手 · 标尺 | Lienzo · Mano · Reglas | Płótno · Ręka · Linijki |
| Mirror | 镜像 | Espejo | Odbicie |
| Convert image | 转换图片 | Convertir imagen | Konwertuj obraz |

Each noun has one word in each language, in every string (ticket 0994): a bead is бісерина in Ukrainian, never намистина or бісеринка; the Frame is 边框 in Chinese, never 画框.

## Color names

| Palette color | English | Russian |
| --- | --- | --- |
| `black` | Black | Чёрный |
| `white` | White | Белый |
| `red` | Red | Красный |
| `orange` | Orange | Оранжевый |
| `yellow` | Yellow | Жёлтый |
| `green` | Green | Зелёный |
| `teal` | Teal | Бирюзовый |
| `blue` | Blue | Синий |
| `purple` | Purple | Фиолетовый |
| `pink` | Pink | Розовый |
| `brown` | Brown | Коричневый |
| `grey` | Gray | Серый |
| `custom` | Custom | Свой цвет |

## Canvas color names

The Canvas color control (Russian "Цвет холста") offers five backgrounds in light and five in dark (ticket 0554). The accessible name of each swatch is "{name}, {n} of {count}" (Russian "{name}, {n} из {count}").

| Choice | Light (EN / RU) | Dark (EN / RU) |
| --- | --- | --- |
| 1 | Studio / Студия | Night / Ночь |
| 2 | Linen / Лён | Ink / Тушь |
| 3 | Stone / Камень | Midnight / Полночь |
| 4 | Fog / Туман | Ash / Пепел |
| 5 | Pebble / Галька | Slate / Сланец |

**Three per theme (ticket 1000; wins over the table above):** 1 Studio / Студия and Night / Ночь, 2 Stone / Камень and Ink / Тушь, 3 Pebble / Галька and Slate / Сланец, named "{name}, {n} of 3". Linen, Fog, Midnight and Ash have left every language.

## Numbers, units and dates

| What | English | Russian | Rule |
| --- | --- | --- | --- |
| Counts | 1 424 | 1 424 | Group thousands from four digits (`Intl.NumberFormat`, ticket 368). English, Russian, Ukrainian, Belarusian and Polish use a no-break space (the rule DESIGN.md set); Spanish writes 1.424 and Chinese 1,424. |
| Decimals | 9.6 | 9,6 | The language's own decimal sign (a comma in Russian, Ukrainian, Belarusian, Spanish and Polish; a period in English and Chinese); at most one decimal for sizes. |
| Grid size | 60×80 | 60×80 | Beads across × down with ×, no spaces. |
| Measured size | 9.6 × 10.4 cm | 9,6 × 10,4 см | × with spaces, one unit for both sides, cm from 10 mm up (as the app does). The same size reads in the same unit in a panel and on the Canvas: the Frame panel's Estimated size too (ticket 0992). Only Replace bead? stays in mm, as it sets two Beads' sizes side by side (ticket 0687). The "64×48 mm" in older mockups follows this rule from now on. |
| Units | 12 mm · 10 MB | 12 мм · 10 МБ | A no-break space between number and unit. |
| Weight | ≈ 24 g · 3.9 g | ≈ 24 г · 3,9 г | Grams rounded up to 0.1, trailing .0 dropped, with ≈ where it is an estimate. |
| Percent | 62% | 62 % | Russian puts a no-break space before %. |
| Ranges | 2–14 colors | 2–14 цветов | En dash, no spaces. |
| Dates | Sep 26, 2026 | 26 сент. 2026 г. | `Intl.DateTimeFormat` with the app's language, month short. |
| Bead names | TOHO Round 11/0 | TOHO Round 11/0 | As the maker writes them; never translated. |

## Strings to fix in the app

| Where | Now | Proposed | Why |
| --- | --- | --- | --- |
| en storage.saveFailedMessage | Couldn't save on this device, then a dash: your latest change… | Couldn't save in this browser. Your latest change is only on screen. | No em dashes |
| ru storage.saveFailedMessage | Не удалось сохранить на этом устройстве, затем тире: последние изменения… | Не удалось сохранить в этом браузере. Последние изменения есть только на экране. | No em dashes |
| en convertImage.errors.tooLarge, tooManyPixels | That file is too big, then a dash: at most {maxSizeMb} MB. | That file is too big: at most {maxSizeMb} MB. (tooManyPixels the same way) | No em dashes |
| ru convertImage.errors.tooLarge, tooManyPixels | Файл слишком большой, затем тире: не больше {maxSizeMb} МБ. | Файл слишком большой: не больше {maxSizeMb} МБ. (tooManyPixels так же) | No em dashes |
| ru size.estimateWarning | Эти размеры, затем тире: оценка. | Эти размеры приблизительные. | No em dashes |
| en rowProgress.previousButton | Previous row | Row not done, then Back a row (ticket 0972) | DESIGN.md: never "Previous row" |
| ru rowProgress.previousButton | Предыдущий ряд | Ряд не готов, then Назад на ряд (ticket 0972) | The same rule, pairs with «Ряд готов» |
| ru transfer.pdfCountHeading | Бисер | Бисеринок | Matches the Beads needed box |
| Beads needed counts, PDF | 1424 | 1 424 | Group thousands |
| formatSizeMm (ru) | 9.6 × 10.4 см | 9,6 × 10,4 см | Russian decimal comma |
| Accessible names (Phase C) | "… 2 colours …", "Color 1, brick red" | "… 2 colors …", "Color 1, red" | US spelling; Palette names from the table above |

## Russian for the copy approved in Phases A–D

| English | Russian |
| --- | --- |
| Make one with New Pattern on the left, open a Saved Pattern, or import a file. | Создайте её кнопкой «Новая схема» слева, откройте сохранённую схему или импортируйте файл. |
| Opening {Pattern} · {size} | Открываем {Pattern} · {size} |
| Converting the picture · {percent} | Конвертируем изображение · {percent} |
| High contrast | Высокий контраст |
| More · Tools | Ещё · Инструменты |
| Row 13 of 30 | Ряд 13 из 30 |
| Undone: Fill · Redone: Fill | Отменено: заливка · Повторено: заливка |
| Technique · Bead · Size · Colors | Техника плетения · Бисеринка · Размер · Цветов |
| {maker} · {date} · {time} | {maker} · {date} · {time} (Мария Ковалева · 26 сент. 2026 г. · 14:32) |
| Lines: the chart parts, each on its own page with every row and column numbered. | Линии: части схемы, каждая на своей странице; все ряды и столбцы пронумерованы. |
| Colors on this page | Цвета на этой странице |
| Row by row {from}–{to} | Ряд за рядом {from}–{to} |
| Rows {from}–{to} on page {n} → | Ряды {from}–{to} на странице {n} → |
| Row 1 is at the top of the picture. All rows read left to right; 3D is three beads of D. | Ряд 1 вверху картинки. Все ряды читаются слева направо; 3D — три бисеринки D. |
| PNG ≈ {size} · {n} files · PDF ≈ {size} · {n} pages · < 0.1 MB | PNG ≈ {size} · файлов: {n} · PDF ≈ {size} · страниц: {n} · < 0,1 МБ |
| High is {n} DPI in the picture on this device. | На этом устройстве «Высокое» для картинки — {n} DPI. |
| Beads needed: {n} colors · {beads} beads · ≈ {g} · see page {p} | Нужно бисера: цветов — {n} · {beads} бисеринок · ≈ {g} · см. страницу {p} |
| Color key | Ключ цветов |
| Continues right on page {n}, below on page {m} → · Last part · chart from page 2 → | Продолжение справа на странице {n}, ниже на странице {m} → · Последняя часть · схема со страницы 2 → |
| No. · Custom | № · Свой цвет |
| Match device · Light · Dark · High contrast | Как на устройстве · Светлая · Тёмная · Высокий контраст |
| Name on exports · Your name · Printed on this Project's PDF and PNG exports. | Имя на экспорте · Ваше имя · Печатается на PDF и PNG этого проекта. |
| arrows move · space paints · esc leaves | стрелки двигают · пробел рисует · esc выход |
| Row {r}, column {c}, {color} · Painted {color} | Ряд {r}, столбец {c}, {color} · Закрашено: {color} |
| Your name | Ваше имя |
| beads · grams | бисеринок · граммов |
| {n} beads · ≈ {g} | {n} бисеринок · ≈ {g} |
| ≈ {n} {bead} a gram, rounded up. | ≈ {n} {bead} в грамме, с округлением вверх. |
| Buy about 10% more for spares. | Возьмите примерно на 10 % больше про запас. |
| Printed on this Project's PDF and PNG exports. | Печатается на PDF и PNG этого проекта. |
| made by · by {maker} | автор · автор: {maker} |

## Where a ticket's approved copy goes

This file holds the rules. The copy approved for a ticket, in every language, goes at the end of its area's file in [`copy/`](copy), never here: the area its strings are in (`src/i18n/translations/<area>.ts`, ticket 1135), so tickets on different screens edit different files. The areas, each named after its screen:

- [`shell`](copy/shell.md): the app around the Canvas, New Project's form and fields, the header, theme and language, storage, opening a Project, "Update ready"
- [`homepage`](copy/homepage.md): the Homepage and What's new
- [`account`](copy/account.md): signing in, the privacy policy, the Feedback sheet
- [`tools`](copy/tools.md): the Tool pill, Mirror, the tools, the Toolbox and Radial toolbox, the ContextBar, Keyboard shortcuts, Tooltips
- [`colors`](copy/colors.md): the Palette, its color names, the Bead colors list, Replace bead
- [`panels`](copy/panels.md): the Menu and Project panels, Techniques and their settings, Layer settings, the Schema tag
- [`projects`](copy/projects.md): the Projects library, Starters, saving, the Save reminder, Project files
- [`canvas`](copy/canvas.md): the Canvas, its hints, Row progress, removing a line
- [`print`](copy/print.md): what the PDF and PNG print, Beads needed
- [`frame`](copy/frame.md): the Frame, its panel, its margin and its export section
- [`convert`](copy/convert.md): Convert image
- [`reference`](copy/reference.md): the Reference image

A section that names strings of several areas goes in the area most of its rows' strings are in.
