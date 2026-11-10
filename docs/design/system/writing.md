# Writing

How the app talks in English and Russian: the voice, sentence patterns, one glossary, and how numbers, units and dates are written.

## Voice

- Plain and short: say what happened or what to do, in the fewest words that are still a full thought. No "please", no "oops", no exclamation marks, no emoji, no blame ("Enter a height.", not "You forgot the height!").
- Name things with the app's nouns (the glossary below) and the button's own words: "Export Pattern", not "use the export feature".
- English is US English: color, gray, canceled. Sentence case everywhere; product nouns keep their capital (Pattern, Bead, Palette, Technique, Row progress).
- Russian: product nouns are lowercase like any noun (схема, бисер, палитра); a button quoted in a sentence goes in «ёлочки»; ё is always written (сохранённые, всё).
- Labels and meta are lowercased by style, never in the string (as today).
- **No em dashes**, in either language: use a colon, a comma, brackets or two sentences. Russian rewrites the sentence instead of the dash between subject and predicate ("Эти размеры приблизительные.", not a dash before "оценка").

## Sentence patterns

| Kind | Formula | English | Russian |
| --- | --- | --- | --- |
| Error | What happened. What to do. | This file can't be converted. Use PNG, JPEG, GIF or WebP. | Этот файл нельзя сконвертировать. Подойдут PNG, JPEG, GIF или WebP. |
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

| English | Russian | Note |
| --- | --- | --- |
| Project | проект | Saved Projects / Сохранённые проекты; New Project / Новый проект |
| Schema | схема | The beads inside the Frame; Schema rotated / Схема повёрнута (ADR 0050) |
| Bead / beads | бисеринка / бисер | One bead is бисеринка; the material and amounts are бисер |
| Technique | техника плетения | Loom / ткачество, Peyote / мозаичное плетение, Brick stitch / кирпичное плетение |
| Palette | палитра |  |
| Row progress | прогресс по рядам | Row done / Ряд готов; Row not done / Ряд не готов |
| Beads needed | Нужно бисера | Its count column: Beads / Бисеринок |
| Clear | Очистить; confirm Очистить? | Empties the cells; the Schema stays. Not «Очистить всё», which was Delete all |
| Save Project | Сохранить проект | The SaveBox button; the name field's Save stays Сохранить |
| Delete all | Очистить всё | Empties the cells; the Schema stays |
| Mirror | Отражение | Estimated size / Примерный размер |
| Frame | рамка | Set Frame / Задать рамку; no Frame / без рамки (v16, in Size's place) |
| Piece | кусочек | Beads that touch; 1 кусочек, 2 кусочка, 5 кусочков |
| Folded beads | свёрнутые бисерины | The Frame's own beads beyond its edge, out of sight (ADR 0066); proposed, ticket 0641 |
| Canvas · Hand · Rulers | Холст · Рука · Линейки | The drawing area, the tool that moves it, the row and column numbers |
| Export · Import | Экспорт · Импорт | Buttons use the verb: Экспортировать схему |
| Convert image | Конвертировать изображение | A Project made from a picture |

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

## Numbers, units and dates

| What | English | Russian | Rule |
| --- | --- | --- | --- |
| Counts | 1 424 | 1 424 | Group thousands from four digits (`Intl.NumberFormat`, ticket 368). English, Russian, Ukrainian, Belarusian and Polish use a no-break space (the rule DESIGN.md set); Spanish writes 1.424 and Chinese 1,424. |
| Decimals | 9.6 | 9,6 | The language's own decimal sign (a comma in Russian, Ukrainian, Belarusian, Spanish and Polish; a period in English and Chinese); at most one decimal for sizes. |
| Grid size | 60×80 | 60×80 | Beads across × down with ×, no spaces. |
| Measured size | 9.6 × 10.4 cm | 9,6 × 10,4 см | × with spaces, one unit for both sides, cm from 10 mm up (as the app does). The "64×48 mm" in older mockups follows this rule from now on. |
| Units | 12 mm · 10 MB | 12 мм · 10 МБ | A no-break space between number and unit. |
| Weight | ≈ 24 g · 3.9 g | ≈ 24 г · 3,9 г | Grams rounded up to 0.1, trailing .0 dropped, with ≈ where it is an estimate. |
| Percent | 62% | 62 % | Russian puts a no-break space before %. |
| Ranges | 2–14 colors | 2–14 цветов | En dash, no spaces. |
| Dates | Sep 26, 2026 | 26 сент. 2026 г. | `Intl.DateTimeFormat` with the app's language, month short. |
| Bead names | TOHO Round 11/0 | TOHO Round 11/0 | As the maker writes them; never translated. |

## Strings to fix in the app

| Where | Now | Proposed | Why |
| --- | --- | --- | --- |
| en storage.saveFailedMessage | Couldn't save on this device, then a dash: your latest change… | Couldn't save on this device. Your latest change is only on screen. | No em dashes |
| ru storage.saveFailedMessage | Не удалось сохранить на этом устройстве, затем тире: последние изменения… | Не удалось сохранить на этом устройстве. Последние изменения есть только на экране. | No em dashes |
| en convertImage.errors.tooLarge, tooManyPixels | That file is too big, then a dash: at most {maxSizeMb} MB. | That file is too big: at most {maxSizeMb} MB. (tooManyPixels the same way) | No em dashes |
| ru convertImage.errors.tooLarge, tooManyPixels | Файл слишком большой, затем тире: не больше {maxSizeMb} МБ. | Файл слишком большой: не больше {maxSizeMb} МБ. (tooManyPixels так же) | No em dashes |
| ru size.estimateWarning | Эти размеры, затем тире: оценка. | Эти размеры приблизительные. | No em dashes |
| en rowProgress.previousButton | Previous row | Row not done | DESIGN.md: never "Previous row" |
| ru rowProgress.previousButton | Предыдущий ряд | Ряд не готов | The same rule, pairs with «Ряд готов» |
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
| For the picture. The printable chart is drawn in lines and stays sharp at any zoom. | Для картинки. Схема для печати нарисована линиями и остаётся чёткой при любом увеличении. |
| High is {n} DPI in the picture on this device. | На этом устройстве «Высокое» для картинки — {n} DPI. |
| Beads needed: {n} colors · {beads} beads · ≈ {g} · see page {p} | Нужно бисера: цветов — {n} · {beads} бисеринок · ≈ {g} · см. страницу {p} |
| Specification · Color key · To buy · {n} × 5 g | Спецификация · Ключ цветов · Купить · {n} × 5 г |
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

## Copy added in v15

The Homepage and the header menu, as signed off. The same rules: plain and short, sentence case, product nouns capitalized, no exclamation marks, emoji, em dashes or "please". The Homepage's slogan and its handwritten note are the one place with a lighter, drawn voice.

### Header menu and Homepage

| English | Russian |
| --- | --- |
| Menu | Меню |
| Homepage (menu link) | Главная |
| open + beads · draw · joy · weave · create · art · canvas · possibility · play · wonder · pattern · ideas (the rolling slogan, ticket 550) | the same, not translated: it is the brand |
| Make your first Pattern · Open the editor | Сделать первую схему · Открыть редактор |
| Patterns saved: 3 | Схем сохранено: 3 |
| What's inside | Что внутри |
| Made by one family | Делает одна семья |
| openbeads stays free and fully local, with no ads and no tracking. If it helps your work, you can support its development through Buy Me a Coffee. | openbeads остаётся бесплатным и полностью локальным, без рекламы и отслеживания. Если приложение вам помогает, поддержать его развитие можно через Buy Me a Coffee. |
| A star on GitHub helps too. · View the source | Звезда на GitHub тоже помогает. · Исходный код |
| Buy me a coffee | Угостить кофе |
| Three ways to use it (the "plans" label is gone, ticket 0739) | Три способа работать |
| Accounts and Pro aren't open yet. Everything works without them. | Аккаунты и Pro пока не открыты. Всё работает и без них. |
| you are here (note) | вы здесь |
| No account · Free · no sign-up · Draw, count and weave on this device. Nothing to sign up for. · Open the editor | Без аккаунта · Бесплатно · без регистрации · Рисуйте, считайте и плетите на этом устройстве. Регистрироваться не нужно. · Открыть редактор |
| Free account · Free · Same as No account, plus more · Create free account (ticket 0740: no "coming later", no list) | Бесплатный аккаунт · Бесплатно · Всё, что без аккаунта, и больше · Создать бесплатный аккаунт |
| Pro · Price later · Same as Free account, plus more · Coming later (ticket 0740: no "coming later" beside the price, no list) | Pro · Цена позже · Всё, что в бесплатном аккаунте, и больше · Появится позже |
| COMING SOON (the stamp on Free account and Pro; its image name "Coming soon") | СКОРО (название картинки «Скоро») |
| forever free: (No account's list; "what you get" and the two "everything in …, plus" lines are gone, ticket 0740) | бесплатно навсегда: |

Free account and Pro list nothing until their features are known: the stamp stands where the list was.

The "save. count. export" line with its "on us" note, and the carousel's seven lines and its arrow labels, went with ticket 0797.

### What's inside (ticket 0797)

The cards and the list of What's inside (Homepage card). Every shipped language has them. The names in braces come from the app, never typed in: `{menu}`, `{help}` and `{shortcuts}` the Menu's own labels (the Canvas strip's Menu, the Menu's Help section, its Keyboard shortcuts row), `{brands}` the Color catalogs' brands joined as a list, `{max}` the most colors Convert image makes.

| English | Russian |
| --- | --- |
| Yours, on this device · Runs in your browser. No account, nothing to install. (ticket 0819: "and offline" went to its own promise) | Ваше, на вашем устройстве · Работает в браузере. Без аккаунта и установки. |
| Works offline · Once open, it keeps working without a connection. (ticket 0819) | Работает офлайн · Однажды открытое, работает и без интернета. |
| No ads or tracking · Nothing is sold to you, and nothing records what you do. (ticket 0819) | Без рекламы и слежки · Вам ничего не продают, и никто не записывает, что вы делаете. |
| For iPad and Pencil · Pen mode, Pencil hover and big buttons for your finger. | Для iPad и Pencil · Режим пера, наведение Pencil и крупные кнопки под палец. |
| Free forever · All you need is free, and nothing is paid for now. Professional extras will come later. | Бесплатно навсегда · Всё нужное бесплатно, платного сейчас нет. Позже появятся профессиональные дополнения. |
| Keyboard shortcuts · Every edit has its own key. Find them all in {menu} → {help} → {shortcuts}. | Горячие клавиши · У каждой правки есть своя клавиша. Все они в {menu} → {help} → {shortcuts}. |
| Canvas and Frame · Draw anywhere: the Canvas has no edges. A Frame sets the size, the exports and the bead count. | Полотно и рамка · Рисуйте где угодно: у полотна нет краёв. Рамка задаёт размер, экспорт и количество бисерин. |
| Techniques · Loom, peyote and brick stitch, each drawn the way its beads sit. | Техники плетения · Ткачество, мозаичное и кирпичное плетение: каждая рисуется так, как ложится бисер. |
| Project editing · Paint, fill, erase, select, copy, paste, undo. | Правка проекта · Кисть, заливка, ластик, выделение, копирование, вставка, отмена. |
| Mirror · Draw one side, the other follows. | Отражение · Рисуете одну сторону, вторая повторяет. |
| Reference image · A picture under the beads: draw a new piece over it. | Подложка · Картинка под бисером: рисуйте по ней новую работу. |
| Convert image · A picture into a Schema, in up to {max} colors. | Из картинки · Превращает картинку в схему, до {max} цветов. |
| Colors built in · {brands}, and a Palette of your own. | Цвета внутри · {brands} и ваша собственная палитра. |
| Letters · Each color its letter, on the beads and on the chart. | Буквы · У каждого цвета своя буква, на бисере и на схеме. |
| Starters · From the Frame panel: a ready design becomes your Frame. | Стартеры · Из панели «Рамка»: готовый дизайн становится вашей рамкой. |
| Row progress · Mark rows done as you weave. | Прогресс по рядам · Отмечайте готовые ряды, пока плетёте. |
| Beads needed · Every color counted, in grams too. | Нужно бисера · По каждому цвету и в граммах. |
| Exports · PDF ready to print, PNG ready to share, and the Project file. | Экспорт · PDF для печати, PNG, чтобы поделиться, и файл проекта. |
| Saved Projects · Kept in this browser, on this device. | Сохранённые проекты · Хранятся в этом браузере, на этом устройстве. |
| What's inside: the editor (the editor's region, for screen readers) | Что внутри: редактор |
| Ring · Heart · Bracelet (the demo's Projects; Ring replaced Kaleidoscope, ticket 0819) | Кольцо · Сердце · Браслет |

Since ticket 0819 the cards above are the coffee screen's promises, in this order: Yours, on this device · Works offline · No ads or tracking · For iPad and Pencil · Free forever · Keyboard shortcuts (left out on a phone). The rows were What's inside's tabs (ticket 0819); since ticket 0830 they play under four chapters, the caption showing the playing row's name and line, and a phone lists them. Ticket 0830 also moved Starters up to fifth, after Mirror.

### The Homepage rework (ticket 0819)

| English | Russian |
| --- | --- |
| {i} / 13 (What's inside's caption, the playing row's place) | {i} / 13 |
| More below (the hint on the section bar's edge) | Ниже ещё |
| Next · {section} (a phone section's last line; `{section}` the next section's heading) | Дальше · {section} |
| Projects library, {n} (the phone strip's library button, for screen readers) | Библиотека проектов, {n} |
| What's new · Every change | Что нового · Все изменения |
| Open source · All of openbeads is public under the AGPL-3.0 licence. Read the code, report a bug or suggest a change. · View the source · A star on GitHub helps too. | Открытый код · Весь openbeads открыт по лицензии AGPL-3.0. Читайте код, сообщайте об ошибках, предлагайте изменения. · Исходный код · Звезда на GitHub тоже помогает. |
| Say hello · A bug, an idea, a pattern you made: send it to the family. It's also in {menu} → {feedback}. · Send feedback | Напишите нам · Ошибка, идея, ваша работа: отправьте семье. Это есть и в {menu} → {feedback}. · Отправить отзыв |
| Coming soon (a phone's chip in place of the stamp) · you are here (its chip) | Скоро · вы здесь |
| Show all {n} (a phone's free list, past its first six rows) | Показать все {n} |

`{menu}` and `{feedback}` are the Menu's own labels (the Canvas strip's Menu, its Send feedback row), never typed in. What's new's lines are the release notes', in the language shown, each with its date in the language's short form ("Nov 7", "7 нояб."). A release note is added to `src/data/releaseNotes.ts` when a user-facing change ships: one short line in every language, no full stop.

The scroll story (ticket 0739): the Progress bar's words.

| English | Russian |
| --- | --- |
| Sections (the track's name) · Back · Next | Разделы · Назад · Дальше |
| This is the first section. · This is the last section. (why Back or Next is off) | Это первый раздел. · Это последний раздел. |
| Go to {section} (a step's name for screen readers, ticket 0743; `{section}` is the section's heading, as on its step) | Перейти: {section} |

The free list (ticket 0740), one row each, in this order. It names the app's features in the words the app uses for them; every shipped language has it. `{n}` and the names in braces come from the app (Homepage card, The free list), never typed in: `{techniques}` the Techniques' names, `{brands}` the Color catalogs' brands, `{codes}` their codes added up, `{categories}` the Starters' categories, each joined as a list in the language. The 0739 list ("23 · free", the window's and the curl's names, the 23 rows) is gone with the window and the roll.

| English | Russian |
| --- | --- |
| Runs in your browser, and your work stays on your device | Работает в браузере, а ваши работы остаются на вашем устройстве |
| An open Canvas: draw anywhere, it has no edges | Открытое полотно: рисуйте где угодно, у него нет краёв |
| {n} Techniques: {techniques} (a counted word: one Technique, many Techniques) | {n} техника / техники / техник: {techniques} |
| As many Projects as you like | Сколько угодно проектов |
| Turn a picture into beads | Картинка превращается в бисер |
| One Frame per Project, for the piece you'll weave | Одна рамка в проекте, для того, что будете плести |
| Many Schemas in one Project | Много схем в одном проекте |
| Row progress: mark rows done as you weave | Прогресс по рядам: отмечайте готовые ряды, пока плетёте |
| The whole editor: paint, fill, erase, select, copy, paste, undo | Весь редактор: кисть, заливка, ластик, выделение, копирование, вставка, отмена |
| PDF, ready to print | PDF, готовый к печати |
| PNG, ready to share | PNG, чтобы поделиться |
| Beads needed, counted per color, in grams too | Нужно бисера: по каждому цвету и в граммах |
| {brands} colors built in, {codes} of them | Цвета {brands} уже внутри, {codes} штук |
| Your Projects as an .openbeads file | Ваши проекты в файле .openbeads |
| Word chart: the Schema written out row by row | Ряд за рядом: схема, расписанная словами |
| Mirror: draw one side, the other follows | Отражение: рисуете одну сторону, вторая повторяет |
| {n} Starters for {categories} (a counted word) | {n} стартер / стартера / стартеров: {categories} |
| More on the way (muted, with a plus) | Скоро будет больше |

The names are joined as the language joins a list (`formatList`): English with a serial comma, "loom, peyote, and brick stitch". The counted rows take the language's counted forms (ticket 0742; the Russian rows had an em dash, which the Russian copy never uses).

"An open Canvas" is the owner's wording for the Homepage only; everywhere else the copy says Canvas, never "open canvas" (ADR 0050).

### Welcome first (ticket 0830)

The Homepage's first section and What's inside's chapters (Homepage card). English and Russian here; the other shipped languages are written when it is built, and read by a native speaker as theirs always are. `{codes}`, `{brands}` and `{n}` come from the app as the free list's do, never typed in; `{technique}` is the Technique's own name and `{size}` the grid size in the app's form ("36×7").

| English | Russian |
| --- | --- |
| Welcome (the section's step on the Progress bar; its heading is a sentence, too long for a step) | Начало |
| Bead patterns, drawn the way the beads sit. (the heading) | Схемы для бисера, нарисованные так, как ложится бисер. |
| For loom, peyote and brick stitch. (the three Techniques, lowercase in a sentence as in the Techniques row) | Для ткачества, мозаичного и кирпичного плетения. |
| See how it works (turns to What's inside) | Как это работает |
| {codes} {brands} colors · {n} Starters ("3 817 TOHO and Miyuki colors · 15 Starters"; counted words) | {codes} цвет / цвета / цветов {brands} · {n} стартер / стартера / стартеров |
| {technique} · {size} (the piece's caption: "Peyote · 48×23") | {technique} · {size} |
| Peacock feather eyes, in peyote (the piece, an image's name for screen readers) | Павлиньи перья, мозаичное плетение |
| Draw · Start from something · Real bead colors · Weave and keep (What's inside's chapters) | Рисуйте · Начните с готового · Настоящие цвета бисера · Плетите и сохраняйте |
| Pause · Play (the tour) | Пауза · Продолжить |
| Try it yourself | Попробуйте сами |
| Expand · Collapse (the demo's width) | Развернуть · Свернуть |

The way in (Make your first Project, Open the editor, Projects library · {n}) and the three promises (Yours, on this device · Works offline · Free forever, with their lines) are the strings the Homepage already has. A phone's "Next · What's inside" is "Next · {section}". A chapter is described to screen readers by its rows' names, joined as the language joins a list.

## Copy added in v16

The open canvas and the Frame. The action is always "Set Frame"; "Frame" alone names the thing, the Toolbox row and the Dock button. Frame is a product noun and is capitalized. The English is as signed off in the mockups; the Russian is proposed and not yet reviewed.

| English | Russian |
| --- | --- |
| Frame · Set Frame | Рамка · Задать рамку |
| not set · no Frame | не задана · без рамки |
| Fit to drawing · Remove Frame · Done | По рисунку · Убрать рамку · Готово |
| Set Frame to export | Задайте рамку для экспорта |
| The Frame marks which beads become the Pattern. Beads outside it stay on the canvas. | Рамка отмечает, какие бисеринки войдут в схему. Бисеринки за рамкой остаются на холсте. |
| Set Frame to count beads. | Задайте рамку, чтобы посчитать бисер. |
| Row progress · Set Frame to start | Прогресс по рядам · Задайте рамку, чтобы начать |
| Canvas · 3 pieces · no Frame | Холст · 3 фрагмента · без рамки |
| 3 pieces · setting Frame | 3 фрагмента · задаётся рамка |
| Frame 1, bring it into view | Рамка 1, показать на экране |
| Rotate, Set Frame first | Повернуть: сначала задайте рамку |
| Pattern rotated. 1 piece was in the way and moved outside the Frame. · Undo | Схема повёрнута. 1 фрагмент мешал и сдвинут за рамку. · Отменить |
| Hand · Rulers | Рука · Линейки |
| scroll or space drag to move · scroll to zoom | прокрутка или пробел и перетаскивание: сдвиг · прокрутка: масштаб |
| Frame (optional) | Рамка (необязательно) |
| Leave it empty to draw anywhere. Set Frame later, before you export. | Оставьте пустым, чтобы рисовать где угодно. Рамку можно задать позже, перед экспортом. |
| A picture needs a Frame size. It becomes the first piece, and you can still draw outside it. | Для картинки нужен размер рамки. Она станет первым фрагментом, а рисовать можно и за рамкой. |

## Menu and Project (spec 0440)

Product nouns are capitalized in English ("New Project", "Saved Projects", "Delete this Project"); the Russian is lowercase.

| English | Русский |
|---|---|
| Menu · Project · Projects · New Project · Import · Export all · Saved Projects · Delete all Projects | Меню · Проект · Проекты · Новый проект · Импорт · Экспортировать все · Сохранённые проекты · Удалить все проекты |
| Preferences · Language · Theme · Tools position · Input · Pen · Mouse | Настройки · Язык · Тема · Положение инструментов · Ввод · Перо · Мышь |
| Left · Top · Right · Bottom · Light · Dark · System · High contrast | Слева · Сверху · Справа · Снизу · Светлая · Тёмная · Как в системе · Высокий контраст |
| Help · Keyboard shortcuts · Homepage · About · Source code · Version | Справка · Сочетания клавиш · Главная · О приложении · Исходный код · Версия |
| Rename {name} · Technique · Bead: · Replace bead · Canvas | Переименовать «{name}» · Техника · Бисер: · Заменить бисер · Холст |
| saved · this device · unsaved changes · Not saved. {reason} · Try again | сохранено · на этом устройстве · есть несохранённые изменения · Не сохранено. {reason} · Повторить |
| Save Project · Export · PNG · PDF · Project file | Сохранить проект · Экспорт · PNG · PDF · Файл проекта |
| Name on exports · Your name · Printed on this Project's PDF and PNG exports. | Имя на экспорте · Ваше имя · Печатается на PDF и PNG этого проекта. |
| Duplicate · Duplicate Project · Name · Everything is copied, including Row progress, so the copy works as a snapshot. · Suggested: the current name and the next free number. | Дублировать · Дублировать проект · Название · Копируется всё, включая прогресс по рядам, так что копия работает как снимок. · Предложено: текущее название и следующий свободный номер. |
| Delete all Projects? · Every Project is removed from this device. This can't be undone. Export all first if you want to keep copies. · Clear this Project | Удалить все проекты? · Все проекты будут удалены с этого устройства. Это нельзя отменить. Сначала нажмите «Экспортировать все», если хотите сохранить копии. · Очистить этот проект |
| Delete this Project · Delete {name}? · {name} and its Row progress are removed from this device. This can't be undone. Export it first if you want to keep a copy. · Delete Project | Удалить этот проект · Удалить «{name}»? · «{name}» и прогресс по рядам будут удалены с этого устройства. Это нельзя отменить. Сначала экспортируйте проект, если хотите сохранить копию. · Удалить проект |
| A Project needs a name. · Enter saves · Escape cancels | У проекта должно быть название. · Enter сохраняет · Esc отменяет |
| The canvas stays white in high contrast. | В режиме высокой контрастности холст остаётся белым. |

Russian here is a proposal for review. The Technique explanation in Project is the app's existing note.

## Copy added in ticket 0473

The Frame panel, the Move handle and the edit pencil (Frame card). The Russian is proposed and not yet reviewed.

| English | Russian |
| --- | --- |
| Frame (the Canvas strip button and the bar's label) | Рамка |
| Edit Frame (the pencil) | Править рамку |
| Move Frame (the Move handle's name) | Переместить рамку |
| Drag to move the Frame together with its beads. | Перетащите, чтобы переместить рамку вместе с бисером. |
| Rotate Frame | Повернуть рамку |
| Remove Frame · Remove Frame? | Убрать рамку · Убрать рамку? |
| 24 × 30 beads | 24 × 30 бисерин |
| Frame size, width × height (the size field's name) | Размер рамки, ширина × высота |
| Top · Bottom · Left · Right (the edge cells) | Верх · Низ · Слева · Справа |
| Top edge: add one row · Top edge: remove one row | Верхний край: добавить ряд · Верхний край: убрать ряд |
| Left edge: add one column · Left edge: remove one column | Левый край: добавить столбец · Левый край: убрать столбец |
| The Frame can’t get any smaller on this side. | Рамку нельзя сделать меньше с этой стороны. |

## Copy changed in ticket 0489

Remove Frame? names what goes (Frame card, ConfirmDialogs card). The Russian is the approved confirm pattern (Confirm in Sentence patterns).

| English | Russian |
| --- | --- |
| The Frame goes, and its beads go with it. Rows marked as done are cleared too. This can be undone. | Рамка уйдёт, и её бусины вместе с ней. Отмеченные готовыми ряды сотрутся тоже. Это действие можно отменить. |

## Template copy (ticket 0493)

The gallery's section label is "Start from". A Template is a card with a name and one short description; the spec line is "width × height · Technique" and is not translated beyond the Technique's name. Product names are common nouns, so Russian, Ukrainian and Belarusian write them lowercase in a sentence and capitalized as a card name. The note under a locked side says "This side is fixed." No em dashes.

| English | Russian |
| --- | --- |
| Start from | Начать с |
| Blank canvas: Draw freely and set a Frame later. | Чистый холст: Рисуйте свободно, рамку задайте потом. |
| Gerdan: A woven collar necklace. | Гердан: Плетёное ожерелье-воротник. |
| Bracelet: A narrow band for the wrist. | Браслет: Узкая лента на запястье. |
| Earrings: A pair of drops, each a narrow strip. | Серьги: Пара подвесок, каждая узкой полосой. |
| Bag: A small purse or pouch panel. | Сумка: Небольшая сумочка или кошелёк. |
| Custom scheme: Any size, in any Technique. | Своя схема: Любой размер и любая техника. |
| Usual sizes | Обычные размеры |
| This side is fixed. | Эта сторона не меняется. |

## Starter gallery copy (ticket 0595)

The copy of the two-step Starter gallery (StarterGallery card). Option and category names are card names, capitalized; counts sit before the noun in English and after a colon in Russian where the noun would need a plural ("кругов: 10"), and take `Intl.PluralRules` where they lead a phrase ("165 бисеринок"). The section labels and the unit lines are lowercased by style.

| English | Russian |
| --- | --- |
| Starter · Each Starter is a finished design for one Frame. Use it as it is, or start with its shape empty. | Стартер · Стартер даёт готовый дизайн для одной рамки. Используйте его как есть или начните с пустой формы. |
| Shapes · Earrings · Rings · Bands | Фигуры · Серьги · Кольца · Браслеты |
| {n} shapes · {n} fringe styles · {n} motifs | фигур: {n} · видов бахромы: {n} · узоров: {n} |
| Triangle · Warped Square · Kite · Star · Kaleidocycle | Треугольник · Изогнутый квадрат · Воздушный змей · Звезда · Калейдоцикл |
| Straight fringe · V fringe | Прямая бахрома · V-образная бахрома |
| Stripes · Chevrons · Diamonds · Plaid | Полосы · Шевроны · Ромбы · Клетка |
| Each design is made for one size. Every Shape is woven in panels joined at seams. | Каждый дизайн сделан для одного размера. Каждая фигура сплетена из частей, соединённых швами. |
| A brick-stitch top with a strand under each base bead. Each design is made for one size. | Верх кирпичным плетением и нить бахромы под каждой бисеринкой нижнего ряда. Каждый дизайн сделан для одного размера. |
| Each design is made for one width and one ring size. · Each design is made for one width and one wrist. | Каждый дизайн сделан для одной ширины и одного размера кольца. · Каждый дизайн сделан для одной ширины и одного запястья. |
| {n} rounds · {n} rows · part size {n} · {w} wide · eu {size} · wrist {n} cm | кругов: {n} · рядов: {n} · размер части {n} · ширина {w} · eu {size} · запястье {n} см |
| {n} beads · ≈ {n} beads · {n} beads each · {n} for the pair | {n} бисеринок · ≈ {n} бисеринок · {n} на серьгу · {n} на пару |
| design · Use design · Start empty · design size | дизайн · Использовать дизайн · Пустая рамка · размер дизайна |
| The design is made for {size}. Set it back to turn the design on. · Choose it again to turn the design on. | Дизайн сделан для {size}. Верните это значение, чтобы включить дизайн. · Выберите его снова, чтобы включить дизайн. |
| Start empty keeps the shape and its seams and leaves every Bead blank. | Пустая рамка сохраняет форму и швы, а все бисеринки оставляет пустыми. |
| Rounds · Rows · Part size · Width · Top rows · Fringe style · Fringe length · Size system · Ring size · Wrist · Fit | Круги · Ряды · Размер части · Ширина · Ряды верха · Вид бахромы · Длина бахромы · Система размеров · Размер кольца · Запястье · Посадка |
| from the centre · from the point · beads per arm · rounds a triangle · beads in the base row · one bead fewer each · beads, longest strand · cm, measured snug · mm round the finger · us size | от центра · от острия · бисеринок на луч · кругов в треугольнике · бисеринок в нижнем ряду · каждый на бисеринку короче · бисеринок в самой длинной нити · см, обхват вплотную · мм по кругу пальца · размер us |
| EU, mm round · US · Snug · Comfortable · Loose | EU, мм по кругу · US · Плотно · Удобно · Свободно |
| ø {d} mm inside · {w} mm wide · {n} rows round · 1.5 cm left for the clasp | ø {d} мм внутри · ширина {w} мм · рядов по кругу: {n} · 1,5 см на застёжку |
| Create Project · Add Frame · Replace Frame | Создать проект · Добавить рамку · Заменить рамку |
| Back to Starter · Back to {category} | Назад к стартерам · Назад: {category} |

Russian here is a proposal for review, like the section below.

## Panels redesign (tickets 0553 to 0555)

`.openbeads` is named wherever a project file is read or written (Import a project, Export all projects, Project file, the file picker's Tooltip, the import error). The `project:`, `frame:`, `name:` and `maker:` labels are lowercase in every language, like the section labels.

| English | Русский |
|---|---|
| Projects library · Import a project · Export all projects · Delete all projects | Библиотека проектов · Импортировать проект · Экспортировать все проекты · Удалить все проекты |
| No projects yet · Projects you make are kept on this device. Import a .openbeads file to bring one in. | Проектов пока нет · Проекты хранятся на этом устройстве. Импортируйте файл .openbeads, чтобы добавить проект. |
| {n} pieces · {n} unnamed · Frame {w} × {h} beads | Частей: {n} · без названия: {n} · Рамка {w} × {h} бусин |
| Writing hand · Right · Left · Buy me a coffee | Рабочая рука · Правая · Левая · Угостить кофе |
| project: · name: · maker: · Add your name for exports · Change the maker's name | проект: · название: · автор: · Добавьте имя для экспорта · Изменить имя автора |
| Saved in local browser · Not saved yet · Saved in openbeads cloud · Not in openbeads cloud: sign in to sync | Сохранено в браузере · Ещё не сохранено · Сохранено в облаке openbeads · Не в облаке openbeads: войдите, чтобы синхронизировать |
| Brand · Type · Size | Бренд · Тип · Размер |
| Project file · Picture · Printable chart · Clear all beads · Delete project | Файл проекта · Картинка · Схема для печати · Очистить все бусины · Удалить проект |
| frame: · Name this frame · Rename the frame · Frame from template · Fit a frame to the drawing · A frame sets the size, the exports and the bead count. | рамка: · Назовите рамку · Переименовать рамку · Рамка из шаблона · Рамка по рисунку · Рамка задаёт размер, экспорт и подсчёт бусин. |
| Estimated size · An estimate. · Rows are marked done. Remove the frame to change the size. · Show all {n} colours | Примерный размер · Это оценка. · Ряды отмечены как готовые. Уберите рамку, чтобы изменить размер. · Показать все цвета ({n}) |
| Stone · Fog · Pebble · Slate | Камень · Туман · Галька · Сланец |

Russian here is a proposal for review; the other five languages follow it in the app change.

## Replace bead? per layer (ticket 0687)

The confirmation asked from a layer's panel (ConfirmDialogs card): the layer, its Bead's size in mm before and after, then for the Frame its Estimated size, always in mm. Following the Confirm pattern: what changes, then that it can be undone. The other five languages say the same in the app.

| English | Русский |
|---|---|
| The Canvas's Bead changes from {old} to {new}. The Canvas will look different in proportion, but your design and its bead count stay exactly the same. You can undo this. | Бисер холста меняется с {old} на {new}. Пропорции холста будут выглядеть иначе, но рисунок и число бисерин останутся точно такими же. Это действие можно отменить. |
| The Frame's Bead changes from {old} to {new}, so the Frame will be about {newSize} instead of {oldSize}. It will look different in proportion, but your design and its bead count stay exactly the same. You can undo this. | Бисер рамки меняется с {old} на {new}, поэтому рамка будет примерно {newSize} вместо {oldSize}. Её пропорции будут выглядеть иначе, но рисунок и число бисерин останутся точно такими же. Это действие можно отменить. |

## Convert image wizard copy (ticket 0646)

The popup of spec 0645 (ConvertImage, ValueSlider and FoundColorRow cards; ticket 0747 replaced the ratio and By size copy with the weave, Width and Colors rows). Errors and the Finish names on Bead colors keep the app's existing strings. Grid sizes follow Numbers and units ("32×24 beads"); a count with a noun in Russian, Ukrainian and Polish takes the "Label: number" form ("цветов: 8"); after a grid size the noun is the genitive plural, as with "1920×1080 пикселей". Belarusian, Spanish and Chinese were written with the build (ticket 0649) and live in `src/i18n/`.

| English | Русский | Українська | Polski |
|---|---|---|---|
| Convert image · Close | Конвертировать изображение · Закрыть | Конвертувати зображення · Закрити | Konwertuj obraz · Zamknij |
| Picture · Bead & Technique · Size · Colors · Review | Изображение · Бисер и техника · Размер · Цвета · Проверка | Зображення · Бісер і техніка · Розмір · Кольори · Перевірка | Obraz · Koralik i technika · Rozmiar · Kolory · Podsumowanie |
| rail: picture · bead · size · colors · review | изображение · бисер · размер · цвета · итог | зображення · бісер · розмір · кольори · підсумок | obraz · koralik · rozmiar · kolory · podsumowanie |
| Add a picture first | Сначала добавьте изображение | Спочатку додайте зображення | Najpierw dodaj obraz |
| Choose file · Paste · Take photo · Turn 90° · Flip · replace | Выбрать файл · Вставить · Сфотографировать · Повернуть на 90° · Отразить · заменить | Вибрати файл · Вставити · Сфотографувати · Повернути на 90° · Віддзеркалити · замінити | Wybierz plik · Wklej · Zrób zdjęcie · Obróć o 90° · Odbij · zamień |
| Drop a picture anywhere on the app, choose a file or paste one with Ctrl+V. PNG, JPEG, GIF or WebP, up to 10 MB and 16 megapixels. | Перетащите изображение в любое место приложения, выберите файл или вставьте его через Ctrl+V. PNG, JPEG, GIF или WebP, до 10 МБ и 16 мегапикселей. | Перетягніть зображення будь-куди в застосунок, виберіть файл або вставте його через Ctrl+V. PNG, JPEG, GIF або WebP, до 10 МБ і 16 мегапікселів. | Upuść obraz w dowolnym miejscu aplikacji, wybierz plik albo wklej go przez Ctrl+V. PNG, JPEG, GIF lub WebP, do 10 MB i 16 megapikseli. |
| (touch) Choose a file, paste a picture or take a photo. PNG, JPEG, GIF or WebP, up to 10 MB and 16 megapixels. | Выберите файл, вставьте изображение или сфотографируйте. PNG, JPEG, GIF или WebP, до 10 МБ и 16 мегапикселей. | Виберіть файл, вставте зображення або сфотографуйте. PNG, JPEG, GIF або WebP, до 10 МБ і 16 мегапікселів. | Wybierz plik, wklej obraz albo zrób zdjęcie. PNG, JPEG, GIF lub WebP, do 10 MB i 16 megapikseli. |
| Drop a picture here · or paste one with Ctrl+V · or choose a file below | Перетащите изображение сюда · или вставьте его через Ctrl+V · или выберите файл ниже | Перетягніть зображення сюди · або вставте його через Ctrl+V · або виберіть файл нижче | Upuść obraz tutaj · albo wklej go przez Ctrl+V · albo wybierz plik poniżej |
| Drop to use this picture · Drop to convert image · PNG, JPEG, GIF or WebP · up to 10 MB | Отпустите, чтобы взять это изображение · Отпустите, чтобы конвертировать изображение · PNG, JPEG, GIF или WebP · до 10 МБ | Відпустіть, щоб узяти це зображення · Відпустіть, щоб конвертувати зображення · PNG, JPEG, GIF або WebP · до 10 МБ | Upuść, aby użyć tego obrazu · Upuść, aby skonwertować obraz · PNG, JPEG, GIF lub WebP · do 10 MB |
| weave · Whole picture · A part | плести · Всё изображение · Часть | плести · Усе зображення · Частину | wyplatać · Cały obraz · Część |
| Drag on the preview to draw the part to weave, drag inside it to move it, or pull its handles to adjust it. | Проведите по превью, чтобы выбрать часть для плетения; тяните внутри неё, чтобы сдвинуть, или за маркеры, чтобы изменить. | Проведіть по прев’ю, щоб вибрати частину для плетіння; тягніть усередині неї, щоб посунути, або за маркери, щоб змінити. | Przeciągnij po podglądzie, aby narysować część do wyplatania; przeciągnij wewnątrz niej, aby ją przesunąć, albo za uchwyty, aby ją zmienić. |
| Colors follow the part. Width and height stay as set, and drop only when the part has fewer pixels than they allow. | Цвета берутся по части. Ширина и высота остаются прежними и уменьшаются, только если в части меньше пикселей, чем они допускают. | Кольори беруться за частиною. Ширина й висота лишаються попередніми й зменшуються, лише якщо в частині менше пікселів, ніж вони дозволяють. | Kolory idą za częścią. Szerokość i wysokość zostają, jakie były, i maleją tylko wtedy, gdy część ma mniej pikseli, niż pozwalają. |
| slide in · beads · mm | единицы · бисер · мм | одиниці · бісер · мм | jednostka · koraliki · mm |
| Width · {n} beads · {n} mm · max {value} | Ширина · бисерин: {n} · {n} мм · макс. {value} | Ширина · бісерин: {n} · {n} мм · макс. {value} | Szerokość · koralików: {n} · {n} mm · maks. {value} |
| marks: {n}×{n} px · ×2 · ×4 | {n}×{n} px · ×2 · ×4 | {n}×{n} px · ×2 · ×4 | {n}×{n} px · ×2 · ×4 |
| Max: one bead per picture pixel. On a mark, one bead covers a whole n × n pixels. | Максимум: одна бисерина на пиксель. На отметке одна бисерина равна ровно n × n пикселям. | Максимум: одна бісерина на піксель. На позначці одна бісерина дорівнює рівно n × n пікселям. | Maksimum: jeden koralik na piksel. Na znaczniku jeden koralik to dokładnie n × n pikseli. |
| Linked · Unlinked (the chain between Width and Height) | Связаны · Не связаны | Пов’язані · Не пов’язані | Połączone · Rozłączone |
| Linked: the picture's shape is kept; width and height change together, following the picture's proportions. | Связаны: форма изображения сохраняется; ширина и высота меняются вместе, следуя пропорциям изображения. | Пов’язані: форма зображення зберігається; ширина й висота змінюються разом, дотримуючись пропорцій зображення. | Połączone: kształt obrazu zostaje; szerokość i wysokość zmieniają się razem, zgodnie z proporcjami obrazu. |
| Unlinked: width and height are set separately, so the picture stretches. | Не связаны: ширина и высота задаются отдельно, поэтому изображение растягивается. | Не пов’язані: ширина й висота задаються окремо, тому зображення розтягується. | Rozłączone: szerokość i wysokość ustawia się osobno, więc obraz się rozciąga. |
| Colors · {n} colors · Each color is a bead to buy. Max {n}: every color the picture has. | Цвета · цветов: {n} · Каждый цвет — это бисер, который нужно купить. Макс. {n}: все цвета изображения. | Кольори · кольорів: {n} · Кожен колір — це бісер, який треба купити. Макс. {n}: усі кольори зображення. | Kolory · kolorów: {n} · Każdy kolor to koraliki do kupienia. Maks. {n}: wszystkie kolory obrazu. |
| Color by color · {n} colors · {n} empty | Цвет за цветом · цветов: {n} · пустых: {n} | Колір за кольором · кольорів: {n} · порожніх: {n} | Kolor po kolorze · kolorów: {n} · pustych: {n} |
| Crop: top edge · Crop: top-left corner (each edge and corner, named for it) | Обрезка: верхний край · Обрезка: верхний левый угол | Обрізання: верхній край · Обрізання: верхній лівий кут | Kadrowanie: górna krawędź · Kadrowanie: lewy górny róg |
| Large Schema: more than 300 beads on a side. Converting and drawing take longer. | Большая схема: больше 300 бисерин по стороне. Конвертация и отрисовка займут больше времени. | Велика схема: понад 300 бісерин на бік. Конвертація й малювання триватимуть довше. | Duży schemat: ponad 300 koralików na bok. Konwersja i rysowanie potrwają dłużej. |
| 1 px = {n} × {n} beads (an enlarging mark's result) | 1 px = {n} × {n} бисерин | 1 px = {n} × {n} бісерин | 1 px = {n} × {n} koralików |
| result · {w}×{h} beads · 1 bead = {n} × {n} px · 1 bead ≈ {x} × {y} px · {n} colors | получится · {w}×{h} бисерин · 1 бисерина = {n} × {n} px · 1 бисерина ≈ {x} × {y} px · цветов: {n} | вийде · {w}×{h} бісерин · 1 бісерина = {n} × {n} px · 1 бісерина ≈ {x} × {y} px · кольорів: {n} | wynik · {w}×{h} koralików · 1 koralik = {n} × {n} px · 1 koralik ≈ {x} × {y} px · kolorów: {n} |
| match to · {Bead} palette (the Bead as the Bead colors entry names it, no finish) · Default Palette · Exact | подбирать из · Палитра {Bead} · Палитра по умолчанию · Точные | підбирати з · Палітра {Bead} · Типова палітра · Точні | dopasuj do · Paleta {Bead} · Domyślna paleta · Dokładne |
| Each color in the picture is matched to the closest color in {Bead}’s catalog. (under the Bead’s palette only) | Каждый цвет изображения подбирается к ближайшему цвету из каталога {Bead}. | Кожен колір зображення підбирається до найближчого кольору з каталогу {Bead}. | Każdy kolor obrazu jest dopasowywany do najbliższego koloru z katalogu {Bead}. |
| codes in {size}: {n} | кодов в {size}: {n} | кодів у {size}: {n} | kodów w {size}: {n} |
| colors found · Treat as empty (a switch in the Colors step) | найдено цветов · Считать пустым | знайдено кольорів · Вважати порожнім | znalezione kolory · Traktuj jako puste |
| From picture · Becomes · Beads · Change · Empty (the found-colors table's heading) | Из картинки · Станет · Бисерин · Изменить · Пусто | Із картинки · Стане · Бісерин · Змінити · Порожньо | Z obrazu · Wynik · Koraliki · Zmień · Puste |
| Keep exact (in the Change picker's head) · Change · Empty · No bead · Kept exact · Remapped · Custom color | Оставить точный · Изменить · Пусто · Без бисерины · Точный цвет · Заменён · Свой цвет | Залишити точний · Змінити · Порожньо · Без бісерини · Точний колір · Замінено · Власний колір | Zachowaj dokładny · Zmień · Puste · Bez koralika · Dokładny kolor · Zamieniony · Własny kolor |
| Picture color · palette of the new Project · In the Palette · Leave the wheel to take the color. | Цвет изображения · палитра нового проекта · В палитре · Цвет берётся, когда уходите с круга. | Колір зображення · палітра нового проєкту · У палітрі · Колір береться, коли залишаєте коло. | Kolor obrazu · paleta nowego projektu · W palecie · Kolor zostaje wybrany po opuszczeniu koła. |
| ≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares. | ≈ 200 Delica 11/0 в грамме, с округлением вверх. Купите примерно на 10 % больше про запас. | ≈ 200 Delica 11/0 у грамі, з округленням угору. Купіть приблизно на 10 % більше про запас. | ≈ 200 Delica 11/0 na gram, w górę. Kup około 10% więcej na zapas. |
| There is no picture to paste. Copy one first. · Steps (the step rail's name) | В буфере обмена нет изображения. Сначала скопируйте его. · Шаги | У буфері обміну немає зображення. Спочатку скопіюйте його. · Кроки | W schowku nie ma obrazu. Najpierw go skopiuj. · Kroki |
| No picture yet · Create Project | Изображения пока нет · Создать проект | Зображення ще немає · Створити проєкт | Brak obrazu · Utwórz projekt |
| Leave the converter? · Everything you set up here will be lost. · Leave · Back to converter · Back · Next · Go to {step} | Выйти из конвертера? · Всё, что вы здесь настроили, будет потеряно. · Выйти · Вернуться к конвертеру · Назад · Дальше · Перейти: {step} | Вийти з конвертера? · Усе, що ви тут налаштували, буде втрачено. · Вийти · Повернутися до конвертера · Назад · Далі · Перейти: {step} | Wyjść z konwertera? · Wszystko, co tu ustawiono, zostanie utracone. · Wyjdź · Wróć do konwertera · Wstecz · Dalej · Przejdź do: {step} |
| Preview: {size}, {colors} · Preview: no picture yet | Превью: {size}, {colors} · Превью: изображения пока нет | Прев’ю: {size}, {colors} · Прев’ю: зображення ще немає | Podgląd: {size}, {colors} · Podgląd: brak obrazu |

Russian, Ukrainian and Polish here are proposals for review with the build.

Ticket 0778 replaces this table's step names, the weave row's A part, the chain (Linked, Unlinked and their Tooltips) and Treat as empty; the table below has their words.

## Convert image redesign copy (ticket 0778)

The redesigned page (ConvertImage and ProgressBar cards): one scrolling pane, Background, the preview's floating bar and its band. Strings this table does not list keep the 0646 table's words. Tool names reuse the editor's where the tool is the editor's (Select).

| English | Русский | Українська | Polski |
|---|---|---|---|
| Picture & bead · Background · Size · Colors · Review | Изображение и бисер · Фон · Размер · Цвета · Проверка | Зображення і бісер · Тло · Розмір · Кольори · Перевірка | Obraz i koralik · Tło · Rozmiar · Kolory · Podsumowanie |
| bar: picture & bead · background · size · colors · review | изображение и бисер · фон · размер · цвета · итог | зображення і бісер · тло · розмір · кольори · підсумок | obraz i koralik · tło · rozmiar · kolory · podsumowanie |
| Replace (a menu: Choose file · Paste) | Заменить | Замінити | Zamień |
| Whole picture · Every part of the picture becomes beads. | Всё изображение · Всё изображение станет бисером. | Усе зображення · Усе зображення стане бісером. | Cały obraz · Cały obraz zamieni się w koraliki. |
| A part of the picture · Crop the picture with Select before it becomes beads. The rest of the picture is left out. | Часть изображения · Обрежьте изображение Выделением, прежде чем оно станет бисером. Остальное не войдёт. | Частина зображення · Обріжте зображення Виділенням, перш ніж воно стане бісером. Решта не ввійде. | Część obrazu · Przytnij obraz Zaznaczeniem, zanim zamieni się w koraliki. Reszta zostanie pominięta. |
| Remove background · Takes away what is round the subject, so the table or the wall is not woven. You see what is found first. · Turn it off to keep the whole picture. | Убрать фон · Убирает то, что вокруг главного, чтобы не вплетать стол или стену. Сначала вы видите, что найдено. · Выключите, чтобы оставить всё изображение. | Прибрати тло · Прибирає те, що довкола головного, щоб не вплітати стіл чи стіну. Спершу ви бачите, що знайдено. · Вимкніть, щоб лишити все зображення. | Usuń tło · Usuwa to, co wokół głównego motywu, by nie wplatać stołu ani ściany. Najpierw widzisz, co znaleziono. · Wyłącz, by zachować cały obraz. |
| Find · Remove (the two stages) | Найти · Убрать | Знайти · Прибрати | Znajdź · Usuń |
| The hatched beads are the background found: {n}% of the picture. Check it on the preview before you remove it. | Заштрихованные бисерины — найденный фон: {n}% изображения. Проверьте его на превью, прежде чем убирать. | Заштриховані бісерини — знайдене тло: {n}% зображення. Перевірте його на прев’ю, перш ніж прибирати. | Zakreskowane koraliki to znalezione tło: {n}% obrazu. Sprawdź je na podglądzie, zanim je usuniesz. |
| Tolerance · only the edge color · more | Допуск · только цвет края · больше | Допуск · лише колір краю · більше | Tolerancja · tylko kolor krawędzi · więcej |
| Remove what was found · Background removed · {n} beads left out, shown as empty places on the preview. · Show what was found | Убрать найденное · Фон убран · Убрано бисерин: {n}, на превью это пустые места. · Показать найденное | Прибрати знайдене · Тло прибрано · Прибрано бісерин: {n}, на прев’ю це порожні місця. · Показати знайдене | Usuń znalezione · Tło usunięte · Pominięto koralików: {n}, na podglądzie to puste miejsca. · Pokaż znalezione |
| Keep the picture's shape · Width and height change together, so the picture is never squashed. · Width and height are set apart, so the picture stretches. | Сохранять форму изображения · Ширина и высота меняются вместе, изображение не сплющивается. · Ширина и высота задаются отдельно, изображение растягивается. | Зберігати форму зображення · Ширина й висота змінюються разом, зображення не сплющується. · Ширина й висота задаються окремо, зображення розтягується. | Zachowaj kształt obrazu · Szerokość i wysokość zmieniają się razem, obraz się nie spłaszcza. · Szerokość i wysokość ustawiasz osobno, obraz się rozciąga. |
| Turn 90° · Flip · Select · Make empty · Compare (the floating bar) | Повернуть на 90° · Отразить · Выделение · Сделать пустым · Сравнить | Повернути на 90° · Віддзеркалити · Виділення · Зробити порожнім · Порівняти | Obróć o 90° · Odbij · Zaznacz · Opróżnij · Porównaj |
| Select: drag on the beads to keep only a part · Select: crop the picture · Make empty: tap a color to leave its beads out · Hold to see the original picture (Tooltips) | Выделение: проведите по бисеру, чтобы оставить только часть · Выделение: обрезать изображение · Сделать пустым: нажмите на цвет, чтобы убрать его бисер · Удерживайте, чтобы увидеть исходное изображение | Виділення: проведіть по бісеру, щоб лишити лише частину · Виділення: обрізати зображення · Зробити порожнім: торкніться кольору, щоб прибрати його бісер · Утримуйте, щоб побачити вихідне зображення | Zaznacz: przeciągnij po koralikach, by zostawić tylko część · Zaznacz: przytnij obraz · Opróżnij: dotknij koloru, by pominąć jego koraliki · Przytrzymaj, by zobaczyć oryginalny obraz |
| band: {w}×{h} beads · {w} × {h} cm · {n} colors · keeping {w}×{h} · Keep all | {w}×{h} бисерин · {w} × {h} см · цветов: {n} · оставляем {w}×{h} · Оставить всё | {w}×{h} бісерин · {w} × {h} см · кольорів: {n} · лишаємо {w}×{h} · Лишити все | {w}×{h} koralików · {w} × {h} cm · kolorów: {n} · zostaje {w}×{h} · Zostaw wszystko |
| band: background found · {n}% · background removed · tap a color to leave it out · drag on the beads to keep only a part · drag to crop the picture · original picture · let go to see the beads | найден фон · {n}% · фон убран · нажмите на цвет, чтобы убрать его · проведите по бисеру, чтобы оставить часть · проведите, чтобы обрезать · исходное изображение · отпустите, чтобы увидеть бисер | знайдено тло · {n}% · тло прибрано · торкніться кольору, щоб прибрати його · проведіть по бісеру, щоб лишити частину · проведіть, щоб обрізати · вихідне зображення · відпустіть, щоб побачити бісер | znaleziono tło · {n}% · tło usunięte · dotknij koloru, by go pominąć · przeciągnij po koralikach, by zostawić część · przeciągnij, by przyciąć · oryginalny obraz · puść, by zobaczyć koraliki |
| result: {w}×{h} beads · kept from {W}×{H} | {w}×{h} бисерин · из {W}×{H} | {w}×{h} бісерин · з {W}×{H} | {w}×{h} koralików · z {W}×{H} |
| To leave a color out, pick Make empty under the preview and tap that color. | Чтобы убрать цвет, выберите «Сделать пустым» под превью и нажмите на этот цвет. | Щоб прибрати колір, виберіть «Зробити порожнім» під прев’ю і торкніться цього кольору. | Aby pominąć kolor, wybierz „Opróżnij” pod podglądem i dotknij tego koloru. |

Russian, Ukrainian and Polish here are proposals for review with the build; Belarusian, Spanish and Chinese come with it.

Built by ticket 0780. The Russian, Ukrainian and Polish proposals were reviewed with the build and kept, with these changes: the found line has no dash ("Заштрихованные бисерины: найденный фон, {n}% изображения.", "Заштриховані бісерини: знайдене тло, {n}% зображення."), as the Russian copy uses no em dash; Remove's count leads with its word ("Убрано бисерин: {n}"), so it needs no counted forms; and the line under the result box while a crop is woven says the crop ("по обрезке", "за обрізанням", "przycięciem"). Belarusian, Spanish and Chinese:

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Picture & bead · Background · Size · Colors · Review | Выява і бісер · Фон · Памер · Колеры · Праверка | Imagen y cuenta · Fondo · Tamaño · Colores · Revisión | 图片与珠子 · 背景 · 尺寸 · 颜色 · 检查 |
| Replace | Замяніць | Cambiar | 替换 |
| Whole picture · A part of the picture | Уся выява · Частка выявы | Toda la imagen · Una parte de la imagen | 整张图片 · 图片的一部分 |
| Remove background · Find · Remove · Tolerance | Прыбраць фон · Знайсці · Прыбраць · Допуск | Quitar el fondo · Buscar · Quitar · Tolerancia | 去除背景 · 查找 · 去除 · 容差 |
| Remove what was found · Background removed · Show what was found | Прыбраць знойдзенае · Фон прыбраны · Паказаць знойдзенае | Quitar lo encontrado · Fondo quitado · Mostrar lo encontrado | 去除找到的部分 · 背景已去除 · 显示找到的部分 |
| Keep the picture's shape | Захоўваць форму выявы | Mantener la forma de la imagen | 保持图片形状 |
| Make empty · Compare (Select is the editor's) | Зрабіць пустым · Параўнаць | Dejar vacío · Comparar | 设为空 · 对比 |
| keeping {w}×{h} · Keep all | пакідаем {w}×{h} · Пакінуць усё | te quedas con {w}×{h} · Quedarse con todo | 保留 {w}×{h} · 全部保留 |

## Margin sheet copy (ticket 0655)

The Frame's margin as a drafting sheet (MarginSheet card). The tools on the sheet keep their existing names, Tooltips and confirmations (Rotate Frame, Edit Frame, Export, Remove Frame, Move Frame, Row done, Row not done, Turn row direction, Reset progress, Row highlight, Letters, Technique, by {maker}, Name this frame, Your name, Custom color). The margin is "поля" in Russian and Ukrainian, as the margins of a sheet of paper, and "margines" in Polish. Belarusian, Spanish and Chinese are written with the build (tickets 0656 to 0658).

| English | Русский | Українська | Polski |
|---|---|---|---|
| margin (the Frame panel's section) · auto (its summary) | поля · авто | поля · авто | margines · auto |
| Margin color (picker, button and Tooltip) · margin color (popover label) | Цвет полей · цвет полей | Колір полів · колір полів | Kolor marginesu · kolor marginesu |
| Auto · Auto, one step off the Canvas color (its accessible name) | Авто · Авто, на шаг от цвета холста | Авто · Авто, на крок від кольору полотна | Auto · Auto, o krok od koloru płótna |
| {color}, the Canvas color (the swatch equal to it) | {color}, цвет холста | {color}, колір полотна | {color}, kolor płótna |
| Name and size on the margin | Имя и размер на полях | Назва й розмір на полях | Nazwa i rozmiar na marginesie |
| The margin is 4 beads on every side. Nothing can be placed in it, and exports never show it. | Поля — 4 бусины с каждой стороны. На них ничего нельзя поставить, и в экспорт они не попадают. | Поля — 4 бісеринки з кожного боку. На них нічого не можна поставити, і в експорт вони не потрапляють. | Margines ma 4 koraliki z każdej strony. Nie można na nim nic umieścić i nie trafia do eksportu. |
| Fold the title block · Show the title block | Свернуть штамп · Показать штамп | Згорнути штамп · Показати штамп | Zwiń tabliczkę · Pokaż tabliczkę |
| Change Technique (the title block's pencil) | Сменить технику | Змінити техніку | Zmień technikę |
| Frame tools (the folded form's ··· menu) | Инструменты рамки | Інструменти рамки | Narzędzia ramki |

Built by ticket 0656 (the Frame panel's margin section), in Belarusian, Spanish and Chinese:

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Margin · Margin color | Палі · Колер палёў | Margen · Color del margen | 边距 · 边距颜色 |
| Auto · Auto, one step off the Canvas color | Аўта · Аўта, на крок ад колеру палатна | Auto · Auto, un paso por encima o por debajo del color del lienzo | 自动 · 自动，比画布颜色深浅差一级 |
| {color}, the Canvas color | {color}, колер палатна | {color}, el color del lienzo | {color}，画布颜色 |
| The margin is 4 beads on every side. Nothing can be placed in it, and exports never show it. | Палі шырынёй 4 бісерыны з кожнага боку. На іх нічога нельга паставіць, і ў экспарт яны не трапляюць. | El margen mide 4 cuentas por cada lado. No se puede poner nada en él y las exportaciones nunca lo muestran. | 边距每边宽 4 颗珠子。其中不能放置任何东西，导出时也不会显示。 |

Built by ticket 0657 (the title block), in Belarusian, Spanish and Chinese:

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Name and size on the margin | Імя і памер на палях | Nombre y tamaño en el margen | 在边距上显示名称和尺寸 |
| Change Technique | Змяніць тэхніку | Cambiar técnica | 更换编织技法 |

Built by ticket 0658 (the zoom forms and folding), in Belarusian, Spanish and Chinese:

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Fold the title block · Show the title block | Згарнуць штамп · Паказаць штамп | Plegar el cajetín · Mostrar el cajetín | 收起标题栏 · 显示标题栏 |
| Frame tools | Інструменты рамкі | Herramientas del marco | 边框工具 |
| Show the title block: {name} (the tab's accessible name) | Паказаць штамп: {name} | Mostrar el cajetín: {name} | 显示标题栏：{name} |

The tab's accessible name in Russian, Ukrainian and Polish follows the rows above: "Показать штамп: {name}", "Показати штамп: {name}", "Pokaż tabliczkę: {name}".

Built by ticket 0698 (a Technique's settings in the title block): each setting's value in short, and its pencil's name round the setting's own label ("Drop", «Дроп», «每针珠数»).

| English | Русский | Українська | Беларуская | Polski | Español | 中文 |
|---|---|---|---|---|---|---|
| {count}-drop (Drop, in short) | {count}-дроп | {count}-дроп | {count}-дроп | {count}-drop | {count}-drop | 每针{count}珠 |
| Change {setting} (the setting's pencil) | Изменить «{setting}» | Змінити «{setting}» | Змяніць «{setting}» | Zmień: {setting} | Cambiar {setting} | 更改{setting} |

The Russian and Ukrainian line is built without the dash ("Поля шириной 4 бусины…", "Поля завширшки 4 бісеринки…"): the Russian file uses no em dash.

Russian, Ukrainian and Polish here are proposals for review with the build. "Штамп" is the title block of a Russian and Ukrainian drawing sheet; "tabliczka" the Polish one.

## Layer settings copy (ticket 0670)

The one section that sets a layer (LayerSettings card). Its controls keep their names (Technique, Drop, Brand, Type, Size, Canvas color, Frame background); two words are new, and the Replace bead? choice of layer ("Where to replace the bead", Frame, Canvas) is gone.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Settings (the Frame panel's section) | Настройки | Налаштування | Налады | 设置 | Ajustes | Ustawienia |
| Background (the heading over the picker) | Фон | Фон | Фон | 背景 | Fondo | Tło |

"Bead" over the pickers is the Project panel's existing section word.

## Bead colors filters (ticket 0713)

The two filter rows of the Bead colors list (BeadColors card) and its empty state. A value's name is "{name}, {count}" in every language (Chinese with its own comma). `{filters}` is the on values as the language lists them (`Intl.ListFormat`, "matte or luster"), Finishes in lowercase first, then families; `{sizes}` is a list with "and". The word is "filter", never "facet".

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Color (the row) | Цвет | Колір | Колер | 颜色 | Color | Kolor |
| Finish (the row) | Покрытие | Покриття | Пакрыццё | 表面处理 | Acabado | Wykończenie |
| Clear filters | Сбросить фильтры | Скинути фільтри | Скінуць фільтры | 清除筛选 | Quitar filtros | Wyczyść filtry |
| No code matches {query}. | Нет кодов по запросу {query}. | Немає кодів за запитом {query}. | Няма кодаў па запыце {query}. | 没有编号匹配 {query}。 | Ningún código coincide con {query}. | Żaden kod nie pasuje do {query}. |
| No {filters} codes match {query}. | Нет кодов по запросу {query} с фильтрами: {filters}. | Немає кодів за запитом {query} з фільтрами: {filters}. | Няма кодаў па запыце {query} з фільтрамі: {filters}. | 在{filters}中没有编号匹配 {query}。 | Ningún código coincide con {query} con los filtros: {filters}. | Żaden kod nie pasuje do {query} przy filtrach: {filters}. |
| No {filters} codes. | Нет кодов с фильтрами: {filters}. | Немає кодів з фільтрами: {filters}. | Няма кодаў з фільтрамі: {filters}. | {filters}中没有编号。 | Ningún código con los filtros: {filters}. | Żaden kod nie pasuje do filtrów: {filters}. |
| {code} exists in {sizes}, not in {size}. | {code} есть в {sizes}, но не в {size}. | {code} є в {sizes}, але не в {size}. | {code} ёсць у {sizes}, але не ў {size}. | {code} 有 {sizes}，没有 {size}。 | {code} existe en {sizes}, no en {size}. | {code} istnieje w {sizes}, nie w {size}. |

## The Bead's palette (ticket 0745)

The BeadColors list made wider and quieter. The entry button is named for the Bead whose colors it lists: "Palette {bead}", where `{bead}` is the Bead's label (Brand, Form factor and size, a literal in every language: "Miyuki Delica 11/0"). It stays "Palette" with the Bead's name after it, so it reads as that Bead's own palette and not the Project's Palette; the Project's Palette keeps its words ("In the Palette", "Add {code} to the Palette"). The counts take the "Label: number" form in every language, so they need no plural. The two notes now in the Info button's Tooltip keep their existing words ("Approximate colors: …", "A color that comes out the same …"), and so do Clear filters and the empty-state sentences above. The entry's old name "Bead colors" (Convert image's match-to choice keeps it) and "Showing the first {count}. Search to narrow the list." are gone. Russian, Ukrainian, Belarusian, Chinese, Spanish and Polish are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Palette {bead} (the entry button) | Палитра {bead} | Палітра {bead} | Палітра {bead} | {bead} 调色板 | Paleta {bead} | Paleta {bead} |
| About these colors (the Info button's name) | Об этих цветах | Про ці кольори | Пра гэтыя колеры | 关于这些颜色 | Sobre estos colores | O tych kolorach |
| codes: {count} (the count line) | кодов: {count} | кодів: {count} | кодаў: {count} | 色号：{count} | códigos: {count} | kodów: {count} |
| first {count} shown | показаны первые {count} | показано перші {count} | паказаны першыя {count} | 显示前 {count} 个 | se muestran los primeros {count} | pokazano pierwsze {count} |
| Filters (the narrow layout's button) | Фильтры | Фільтри | Фільтры | 筛选 | Filtros | Filtry |
| Filters, {count} on (its name while values are on) | Фильтры, включено: {count} | Фільтри, увімкнено: {count} | Фільтры, уключана: {count} | 筛选，已开启 {count} 个 | Filtros, activos: {count} | Filtry, włączone: {count} |

## Schema tag copy (ticket 0721)

An unframed Schema's name as a tag, opening into a paper tag (SchemaTag card). Rename, Frame and Close keep their existing words. The counts use `Intl.PluralRules` (Plurals and length): «96 бисеринок · 3 цвета», «1 бисеринка · 1 цвет».

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| {name}, show details (a tag's accessible name) | {name}, показать подробности | {name}, показати подробиці | {name}, паказаць падрабязнасці | {name}，显示详情 | {name}, ver detalles | {name}, pokaż szczegóły |
| Click for the size and colors. (the Tooltip's body, a tag with dots) | Нажмите, чтобы увидеть размер и цвета. | Натисніть, щоб побачити розмір і кольори. | Націсніце, каб убачыць памер і колеры. | 点击查看尺寸和颜色。 | Pulsa para ver el tamaño y los colores. | Kliknij, aby zobaczyć rozmiar i kolory. |
| schema (the paper tag's label) | схема | схема | схема | 图样 | esquema | schemat |
| {w} × {h} beads · ≈ {x} × {y} mm | {w} × {h} бисерин · ≈ {x} × {y} мм | {w} × {h} бісерин · ≈ {x} × {y} мм | {w} × {h} бісерын · ≈ {x} × {y} мм | {w} × {h} 颗珠子 · ≈ {x} × {y} 毫米 | {w} × {h} cuentas · ≈ {x} × {y} mm | {w} × {h} koralików · ≈ {x} × {y} mm |
| {n} beads · {n} colors | {n} бисеринок · {n} цветов | {n} бісерин · {n} кольорів | {n} бісерын · {n} колераў | {n} 颗珠子 · {n} 种颜色 | {n} cuentas · {n} colores | {n} koralików · {n} kolorów |
| Schema names (the tags' Tab stop) | Названия схем | Назви схем | Назвы схем | 图样名称 | Nombres de esquemas | Nazwy schematów |

The size line's "beads" stays in the many form whatever the numbers, as a measure («11 × 11 бисерин»). Russian, Ukrainian, Belarusian, Spanish, Polish and Chinese are proposals for review with the build.

## Feedback sheet copy (ticket 0700)

The FeedbackSheet card's words, with the Menu's Send feedback and Report a translation problem and the Bead colors list's Wrong or missing color?. The Report is "отчёт" in Russian (not «репорт»), "звіт", "справаздача", 报告, "informe", "zgłoszenie"; a general Report is "feedback" / «отзыв». `{minutes}` and `{seconds}` are the Worker's wait with a unit abbreviation, so no plural is needed. Cancel and optional keep their existing words. Russian, Ukrainian, Belarusian, Chinese, Spanish and Polish are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Send feedback | Отправить отзыв | Надіслати відгук | Адправіць водгук | 发送反馈 | Enviar comentarios | Wyślij opinię |
| Report a translation problem | Сообщить об ошибке перевода | Повідомити про помилку перекладу | Паведаміць пра памылку перакладу | 报告翻译问题 | Informar de un problema de traducción | Zgłoś błąd tłumaczenia |
| Wrong or missing color? | Не тот цвет или его нет? | Не той колір або його немає? | Не той колер або яго няма? | 颜色不对或缺少颜色？ | ¿Color equivocado o que falta? | Zły kolor albo go brak? |
| Send feedback | Отправить отзыв | Надіслати відгук | Адправіць водгук | 发送反馈 | Enviar comentarios | Wyślij opinię |
| Report a translation problem | Сообщить об ошибке перевода | Повідомити про помилку перекладу | Паведаміць пра памылку перакладу | 报告翻译问题 | Informar de un problema de traducción | Zgłoś błąd tłumaczenia |
| Report a bead color | Сообщить о цвете бисера | Повідомити про колір бісеру | Паведаміць пра колер бісеру | 报告珠子颜色 | Informar de un color de cuenta | Zgłoś kolor koralików |
| Say what works, what doesn't, or what you miss. It goes to the person who makes openbeads. | Расскажите, что работает, что нет и чего не хватает. Это прочитает тот, кто делает openbeads. | Розкажіть, що працює, що ні і чого бракує. Це прочитає той, хто робить openbeads. | Раскажыце, што працуе, што не і чаго не хапае. Гэта прачытае той, хто робіць openbeads. | 说说哪里好用、哪里不好用、还缺什么。制作 openbeads 的人会读到。 | Cuenta qué funciona, qué no y qué echas en falta. Lo lee quien hace openbeads. | Napisz, co działa, co nie i czego brakuje. Przeczyta to osoba, która tworzy openbeads. |
| Copy the words as the app shows them, and say what they should be. | Скопируйте слова так, как их показывает приложение, и напишите, как должно быть. | Скопіюйте слова так, як їх показує застосунок, і напишіть, як має бути. | Скапіруйце словы так, як іх паказвае праграма, і напішыце, як павінна быць. | 按应用显示的样子复制文字，并写出应该是什么。 | Copia las palabras tal como las muestra la app y escribe cómo deberían ser. | Skopiuj słowa tak, jak pokazuje je aplikacja, i napisz, jak powinny brzmieć. |
| Say which code is drawn in the wrong color, or which code is missing. | Укажите, какой код нарисован не тем цветом или какого кода не хватает. | Вкажіть, який код намальовано не тим кольором або якого коду бракує. | Пазначце, які код намаляваны не тым колерам або якога кода не хапае. | 说明哪个编号的颜色画错了，或者缺少哪个编号。 | Di qué código se dibuja con un color equivocado o qué código falta. | Napisz, który kod ma zły kolor albo którego kodu brakuje. |
| Message | Сообщение | Повідомлення | Паведамленне | 留言 | Mensaje | Wiadomość |
| Language | Язык | Мова | Мова | 语言 | Idioma | Język |
| Text as shown | Текст в приложении | Текст у застосунку | Тэкст у праграме | 显示的文字 | Texto tal como aparece | Tekst w aplikacji |
| Should say | Должно быть | Має бути | Павінна быць | 应为 | Debería decir | Powinno być |
| Note | Примечание | Примітка | Заўвага | 备注 | Nota | Uwaga |
| Problem | Проблема | Проблема | Праблема | 问题 | Problema | Problem |
| Wrong color | Не тот цвет | Не той колір | Не той колер | 颜色不对 | Color equivocado | Zły kolor |
| Missing color | Нет цвета | Немає кольору | Няма колеру | 缺少颜色 | Falta el color | Brak koloru |
| Brand and catalog | Бренд и каталог | Бренд і каталог | Брэнд і каталог | 品牌和色卡 | Marca y catálogo | Marka i katalog |
| Code | Код | Код | Код | 编号 | Código | Kod |
| Looks like | Как выглядит | Як виглядає | Як выглядае | 看起来像 | Se ve como | Wygląda jak |
| In words or as a hex, such as dark teal or #1d5c63. | Словами или в hex, например тёмно-бирюзовый или #1d5c63. | Словами або в hex, наприклад темно-бірюзовий або #1d5c63. | Словамі або ў hex, напрыклад цёмна-бірузовы або #1d5c63. | 用文字或 hex 描述，例如深青色或 #1d5c63。 | Con palabras o en hex, como verde azulado oscuro o #1d5c63. | Słowami lub w hex, np. ciemny morski albo #1d5c63. |
| Email | Эл. почта | Ел. пошта | Эл. пошта | 电子邮件 | Correo | E-mail |
| Only to ask you about this report. | Только чтобы задать вопрос об этом отчёте. | Лише щоб поставити запитання про цей звіт. | Толькі каб задаць пытанне пра гэтую справаздачу. | 仅用于就此报告向你提问。 | Solo para preguntarte sobre este informe. | Tylko po to, by zapytać cię o to zgłoszenie. |
| Write a message. | Напишите сообщение. | Напишіть повідомлення. | Напішыце паведамленне. | 写下留言。 | Escribe un mensaje. | Napisz wiadomość. |
| Enter the text as it shows. | Укажите текст так, как он показан. | Вкажіть текст так, як його показано. | Пазначце тэкст так, як ён паказаны. | 按显示的样子填写文字。 | Escribe el texto tal como aparece. | Wpisz tekst tak, jak jest pokazany. |
| Enter an email such as name@example.com. | Укажите почту, например name@example.com. | Вкажіть пошту, наприклад name@example.com. | Пазначце пошту, напрыклад name@example.com. | 填写电子邮件，例如 name@example.com。 | Escribe un correo como name@example.com. | Wpisz e-mail, np. name@example.com. |
| Also sent | Также отправляется | Також надсилається | Таксама адпраўляецца | 一并发送 | También se envía | Wysyłane też |
| Nothing from your Projects, and nothing that identifies this device. | Ничего из ваших проектов и ничего, что указывает на это устройство. | Нічого з ваших проєктів і нічого, що вказує на цей пристрій. | Нічога з вашых праектаў і нічога, што паказвае на гэтую прыладу. | 不含你的项目，也不含可识别此设备的信息。 | Nada de tus proyectos ni nada que identifique este dispositivo. | Nic z twoich projektów i nic, co wskazuje na to urządzenie. |
| Version | Версия | Версія | Версія | 版本 | Versión | Wersja |
| App language | Язык приложения | Мова застосунку | Мова праграмы | 应用语言 | Idioma de la app | Język aplikacji |
| Browser | Браузер | Браузер | Браўзер | 浏览器 | Navegador | Przeglądarka |
| System | Система | Система | Сістэма | 系统 | Sistema | System |
| Window size | Размер окна | Розмір вікна | Памер акна | 窗口大小 | Tamaño de ventana | Rozmiar okna |
| Language | Язык | Мова | Мова | 语言 | Idioma | Język |
| Brand | Бренд | Бренд | Брэнд | 品牌 | Marca | Marka |
| Catalog | Каталог | Каталог | Каталог | 色卡 | Catálogo | Katalog |
| Code | Код | Код | Код | 编号 | Código | Kod |
| Stored hex | Сохранённый hex | Збережений hex | Захаваны hex | 存储的 hex | Hex guardado | Zapisany hex |
| Swatch letter | Буква цвета | Літера кольору | Літара колеру | 颜色字母 | Letra del color | Litera koloru |
| Send | Отправить | Надіслати | Адправіць | 发送 | Enviar | Wyślij |
| Sending… | Отправляем… | Надсилаємо… | Адпраўляем… | 正在发送… | Enviando… | Wysyłanie… |
| Copy report | Скопировать отчёт | Скопіювати звіт | Скапіраваць справаздачу | 复制报告 | Copiar informe | Kopiuj zgłoszenie |
| Report copied. | Отчёт скопирован. | Звіт скопійовано. | Справаздачу скапіравана. | 报告已复制。 | Informe copiado. | Zgłoszenie skopiowane. |
| The browser refused to copy. Select the text and copy it yourself. | Браузер не дал скопировать. Выделите текст и скопируйте его сами. | Браузер не дав скопіювати. Виділіть текст і скопіюйте його самі. | Браўзер не даў скапіраваць. Вылучыце тэкст і скапіруйце яго самі. | 浏览器拒绝复制。选中文字后自行复制。 | El navegador no dejó copiar. Selecciona el texto y cópialo tú. | Przeglądarka nie pozwoliła skopiować. Zaznacz tekst i skopiuj go sam. |
| Sending reports is switched off for now. Try again in {minutes} min. | Отправка отчётов пока выключена. Попробуйте через {minutes} мин. | Надсилання звітів поки вимкнено. Спробуйте за {minutes} хв. | Адпраўка справаздач пакуль выключана. Паспрабуйце праз {minutes} хв. | 报告发送暂时关闭。{minutes} 分钟后再试。 | El envío de informes está desactivado por ahora. Vuelve a intentarlo en {minutes} min. | Wysyłanie zgłoszeń jest na razie wyłączone. Spróbuj za {minutes} min. |
| You are offline. Your report stays here: send it once you are back online, or copy it. | Нет сети. Отчёт останется здесь: отправьте его, когда сеть появится, или скопируйте. | Немає мережі. Звіт залишиться тут: надішліть його, коли мережа з’явиться, або скопіюйте. | Няма сеткі. Справаздача застанецца тут: адпраўце яе, калі сетка з’явіцца, або скапіруйце. | 你已离线。报告会留在这里：联网后发送，或复制下来。 | Estás sin conexión. Tu informe se queda aquí: envíalo cuando vuelvas a tener conexión o cópialo. | Jesteś offline. Zgłoszenie zostaje tutaj: wyślij je, gdy wrócisz do sieci, albo je skopiuj. |
| Too many reports at once. Try again in {seconds} s. | Слишком много отчётов сразу. Попробуйте через {seconds} с. | Забагато звітів одразу. Спробуйте за {seconds} с. | Занадта шмат справаздач адразу. Паспрабуйце праз {seconds} с. | 报告太多。{seconds} 秒后再试。 | Demasiados informes a la vez. Vuelve a intentarlo en {seconds} s. | Za dużo zgłoszeń naraz. Spróbuj za {seconds} s. |
| The report could not be sent. Try again later, or copy it. | Отчёт не отправился. Попробуйте позже или скопируйте его. | Звіт не надіслано. Спробуйте пізніше або скопіюйте його. | Справаздачу не адпраўлена. Паспрабуйце пазней або скапіруйце яе. | 报告未能发送。稍后再试，或复制下来。 | No se pudo enviar el informe. Inténtalo más tarde o cópialo. | Nie udało się wysłać zgłoszenia. Spróbuj później albo je skopiuj. |
| Thanks, your report was sent | Спасибо, отчёт отправлен | Дякуємо, звіт надіслано | Дзякуй, справаздачу адпраўлена | 谢谢，报告已发送 | Gracias, tu informe se ha enviado | Dziękujemy, zgłoszenie wysłane |

## Fill reach copy (ticket 0715)

The two toasts (Message card, info tone) after a Fill tool press on the Canvas that Fill reach refuses: what happened, then what to do, as the Error pattern. The Selection bar's Fill is the way to fill a chosen area, so both name selecting.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Nothing encloses this spot. Select an area to fill it. | Это место ничем не окружено. Выделите область, чтобы залить её. | Це місце нічим не оточене. Виділіть область, щоб залити її. | Гэта месца нічым не акружана. Вылучыце вобласць, каб заліць яе. | 这里没有被围住。选择一个区域即可填充。 | Nada rodea este punto. Selecciona un área para rellenarla. | Nic nie otacza tego miejsca. Zaznacz obszar, aby go wypełnić. |
| Too big to fill. Zoom in, or select an area. | Слишком большая область для заливки. Увеличьте масштаб или выделите область. | Завелика область для заливки. Збільште масштаб або виділіть область. | Завялікая вобласць для заліўкі. Павялічце маштаб або вылучыце вобласць. | 区域太大，无法填充。放大画布，或选择一个区域。 | Demasiado grande para rellenar. Acerca la vista o selecciona un área. | Za duży obszar do wypełnienia. Powiększ widok lub zaznacz obszar. |

## First-run welcome copy (tickets 0725, 0738, 0795, 0798)

The welcome over an empty Project (FirstRunHints card): two lines, and the path after them. It is not new copy for the path: it is the Project panel's own labels, `Project › Export › Save Project file`, in chips. The bar's "Select to set a Frame" and the CanvasHint keep their existing strings. Ticket 0798 took the captions beside the controls away, so nothing else is written over an empty Project.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Your Projects are saved only in this browser, on this device. (welcome, lead) | Ваши проекты сохранены только в этом браузере, на этом устройстве. | Ваші проєкти збережено лише в цьому браузері, на цьому пристрої. | Вашы праекты захаваны толькі ў гэтым браўзеры, на гэтай прыладзе. | 你的项目只保存在这台设备的浏览器里。 | Tus proyectos se guardan solo en este navegador, en este dispositivo. | Twoje projekty są zapisane tylko w tej przeglądarce, na tym urządzeniu. |
| If the browser's data is cleared, they go with it. Keep a file of each one you don't want to lose: (welcome) | Если данные браузера очистятся, проекты исчезнут вместе с ними. Сохраните в файл те, что вам дороги: | Якщо дані браузера очистяться, проєкти зникнуть разом із ними. Збережіть у файл ті, що вам дорогі: | Калі даныя браўзера ачысцяцца, праекты знікнуць разам з імі. Захавайце ў файл тыя, што вам дарагія: | 浏览器数据一旦被清除，项目也会随之消失。请把不想丢失的项目存成文件： | Si se borran los datos del navegador, se van con ellos. Guarda un archivo de cada uno que no quieras perder: | Jeśli dane przeglądarki zostaną wyczyszczone, znikną razem z nimi. Zapisz do pliku te, których nie chcesz stracić: |

English was approved on the canvas "openbeads first-run: decluttered welcome" (board A), the captions of which are gone (ticket 0798); the other languages are proposals for review with the build. The welcome's two lines are ticket 0795's: they say the risk of losing a Project plainly, as a fact and what to do about it, without alarm words ("without warning", "delete").

## A Project that won't open copy (ticket 0716)

The notice row after a load that found the safe start's note still set (Message card, warning tone), the question before a Project over the size gate opens (ConfirmDialogs card), the Projects library's rows for a sealed Project and a count not yet in (MenuPanel card), and the Homepage's second button, which is the Menu row's own name and the count ("Projects library · 3"), so it needs no string of its own. The size warning gives the count in millions: Russian, Ukrainian, Belarusian and Polish write «млн» / "mln", which takes no plural form after a number.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| “{name}” didn't open last time. | Проект «{name}» не открылся в прошлый раз. | Проєкт «{name}» не відкрився минулого разу. | Праект «{name}» не адкрыўся ў мінулы раз. | “{name}”上次没有打开。 | «{name}» no se abrió la última vez. | Projekt „{name}” nie otworzył się ostatnim razem. |
| Remove · Export | Удалить · Экспортировать | Видалити · Експортувати | Выдаліць · Экспартаваць | 移除 · 导出 | Quitar · Exportar | Usuń · Eksportuj |
| Open “{name}”? | Открыть «{name}»? | Відкрити «{name}»? | Адкрыць «{name}»? | 打开“{name}”？ | ¿Abrir «{name}»? | Otworzyć „{name}”? |
| {count} million beads. Opening may be slow or fail. | {count} млн бисеринок. Открытие может быть медленным или не удаться. | {count} млн бісеринок. Відкриття може бути повільним або не вдатися. | {count} млн бісерынак. Адкрыццё можа быць павольным або не атрымацца. | {count} 百万颗珠子。打开可能很慢或失败。 | {count} millones de cuentas. Abrirlo puede ser lento o fallar. | {count} mln koralików. Otwieranie może być wolne lub się nie udać. |
| Open anyway · Cancel | Всё равно открыть · Отмена | Однаково відкрити · Скасувати | Усё адно адкрыць · Скасаваць | 仍然打开 · 取消 | Abrir igualmente · Cancelar | Otwórz mimo to · Anuluj |
| too big to count | слишком много, чтобы посчитать | забагато, щоб порахувати | зашмат, каб палічыць | 太多，无法计数 | demasiado para contar | za dużo, by policzyć |
| Counting pieces | Считаем части | Рахуємо частини | Лічым часткі | 正在计数小块 | Contando trozos | Liczenie kawałków |
| {count} beads | {count} бисеринка / бисеринки / бисеринок | {count} бісеринка / бісеринки / бісеринок | {count} бісерынка / бісерынкі / бісерынак | {count} 颗珠子 | {count} cuenta / cuentas | {count} koralik / koraliki / koralików |
| made {created} · saved {saved} | создан {created} · сохранён {saved} | створено {created} · збережено {saved} | створаны {created} · захаваны {saved} | 创建于 {created} · 保存于 {saved} | creado {created} · guardado {saved} | utworzono {created} · zapisano {saved} |

Russian, Ukrainian, Belarusian, Spanish, Polish and Chinese are proposals for review with the build.

## Reference image copy (ticket 0790)

The Project's one picture to bead over (ReferenceImage card). Russian and Ukrainian call it the underlay a tracer puts under the paper, «подложка» and «підкладка»; Polish «obraz pomocniczy». The Canvas is «полотно» / «полотно» / «płótno» (ADR 0050). Belarusian, Spanish and Chinese were written with the build, below the first table; all are draft words, to be checked by a speaker of each.

| English | Русский | Українська | Polski |
|---|---|---|---|
| Reference image (strip button name) | Подложка | Підкладка | Obraz pomocniczy |
| Add a reference image (Tooltip) · Add reference image (Project row) | Добавить подложку | Додати підкладку | Dodaj obraz pomocniczy |
| Show reference image · Hide reference image | Показать подложку · Скрыть подложку | Показати підкладку · Сховати підкладку | Pokaż obraz pomocniczy · Ukryj obraz pomocniczy |
| reference image (section) · shown · hidden (its summary) | подложка · видна · скрыта | підкладка · видно · сховано | obraz pomocniczy · widoczny · ukryty |
| PNG, JPEG, GIF or WebP, up to 10 MB. Kept with this Project and in its .openbeads file, never printed. Large pictures are made smaller to fit. | PNG, JPEG, GIF или WebP, до 10 МБ. Хранится с этим проектом и в его файле .openbeads, не печатается. Большие картинки уменьшаются. | PNG, JPEG, GIF або WebP, до 10 МБ. Зберігається з цим проєктом і в його файлі .openbeads, не друкується. Великі зображення зменшуються. | PNG, JPEG, GIF lub WebP, do 10 MB. Zapisany z tym projektem i w jego pliku .openbeads, nigdy nie drukowany. Duże obrazy są zmniejszane. |
| Opacity | Непрозрачность | Непрозорість | Krycie |
| Adjust on canvas · move · resize · turn | Настроить на полотне · сдвиг · размер · поворот | Налаштувати на полотні · зсув · розмір · поворот | Dopasuj na płótnie · przesuń · rozmiar · obróć |
| Replace image · Remove image (Replace image also on the Adjust bar, ticket 0799; on a phone the name of its icon button) | Заменить картинку · Убрать картинку | Замінити зображення · Прибрати зображення | Zamień obraz · Usuń obraz |
| Remove the reference image? · The picture is taken off this Project. Your beads stay as they are. · Remove | Убрать подложку? · Картинка будет убрана из проекта. Бусины останутся как есть. · Убрать | Прибрати підкладку? · Зображення буде прибрано з проєкту. Бісеринки залишаться як є. · Прибрати | Usunąć obraz pomocniczy? · Obraz zostanie usunięty z projektu. Koraliki zostaną bez zmian. · Usuń |
| This file can't be used: {reason} | Этот файл не подходит: {reason} | Цей файл не підходить: {reason} | Tego pliku nie można użyć: {reason} |
| Preparing the picture… | Готовим картинку… | Готуємо зображення… | Przygotowujemy obraz… |
| Fit to Canvas · Fit (phone) · Done | Вписать в полотно · Вписать · Готово | Вписати в полотно · Вписати · Готово | Dopasuj do płótna · Dopasuj · Gotowe |
| Resize from the top-left corner (and the other three) · Turn · Turned {n}° | Изменить размер за левый верхний угол · Повернуть · Повёрнуто на {n}° | Змінити розмір за лівий верхній кут · Повернути · Повернуто на {n}° | Zmień rozmiar z lewego górnego rogu · Obróć · Obrócono o {n}° |
| Reference image not saved on this device | Подложка не сохранена на этом устройстве | Підкладку не збережено на цьому пристрої | Obraz pomocniczy nie jest zapisany na tym urządzeniu |
| not a picture · over {maxSizeMb} MB · over {maxMegapixels} megapixels · it couldn't be read (the refusal's reasons) | это не картинка · больше {maxSizeMb} МБ · больше {maxMegapixels} мегапикселей · его не удалось прочитать | це не зображення · більше {maxSizeMb} МБ · більше {maxMegapixels} мегапікселів · його не вдалося прочитати | to nie jest obraz · ponad {maxSizeMb} MB · ponad {maxMegapixels} megapikseli · nie udało się go odczytać |
| browsers can't read HEIC pictures · SVG pictures can't be used | картинки HEIC браузер не читает · картинки SVG не подходят | зображення HEIC браузер не читає · зображення SVG не підходять | przeglądarki nie odczytują obrazów HEIC · obrazów SVG nie można użyć |
| Reference image, {opacity}%, turned {angle}° (Adjust, to a screen reader) · Moved · Resized | Подложка, {opacity}%, повёрнута на {angle}° · Сдвинуто · Размер изменён | Підкладка, {opacity}%, повернута на {angle}° · Зсунуто · Розмір змінено | Obraz pomocniczy, {opacity}%, obrócony o {angle}° · Przesunięto · Zmieniono rozmiar |
| {count} KB (the stored size) | {count} КБ | {count} КБ | {count} KB |

Belarusian, Spanish and Chinese, written with the build (ticket 0790):

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Reference image | Падкладка | Imagen de referencia | 参考图 |
| Add a reference image · Add reference image | Дадаць падкладку | Añadir una imagen de referencia · Añadir imagen de referencia | 添加参考图 |
| Show reference image · Hide reference image | Паказаць падкладку · Схаваць падкладку | Mostrar la imagen de referencia · Ocultar la imagen de referencia | 显示参考图 · 隐藏参考图 |
| reference image · shown · hidden | падкладка · бачная · схаваная | imagen de referencia · visible · oculta | 参考图 · 显示中 · 已隐藏 |
| PNG, JPEG, GIF or WebP, up to 10 MB. Kept with this Project and in its .openbeads file, never printed. Large pictures are made smaller to fit. | PNG, JPEG, GIF або WebP, да 10 МБ. Захоўваецца з гэтым праектам і ў яго файле .openbeads, не друкуецца. Вялікія выявы памяншаюцца. | PNG, JPEG, GIF o WebP, hasta 10 MB. Se guarda con este proyecto y en su archivo .openbeads, nunca se imprime. Las imágenes grandes se reducen. | PNG、JPEG、GIF 或 WebP，最大 10 MB。随此项目保存，也存在其 .openbeads 文件中，不会打印。较大的图片会被缩小。 |
| Opacity | Непразрыстасць | Opacidad | 不透明度 |
| Adjust on canvas · move · resize · turn | Наладзіць на палатне · зрух · памер · паварот | Ajustar en el lienzo · mover · tamaño · girar | 在画布上调整 · 移动 · 缩放 · 旋转 |
| Replace image · Remove image | Замяніць выяву · Прыбраць выяву | Reemplazar imagen · Quitar imagen | 替换图片 · 移除图片 |
| Remove the reference image? · The picture is taken off this Project. Your beads stay as they are. · Remove | Прыбраць падкладку? · Выява будзе прыбрана з праекта. Бісерыны застануцца як ёсць. · Прыбраць | ¿Quitar la imagen de referencia? · La imagen se quita de este proyecto. Tus cuentas quedan como están. · Quitar | 移除参考图？ · 图片将从此项目中移除。你的珠子保持不变。 · 移除 |
| This file can't be used: {reason} | Гэты файл не падыходзіць: {reason} | Este archivo no se puede usar: {reason} | 此文件无法使用：{reason} |
| not a picture · over {maxSizeMb} MB · over {maxMegapixels} megapixels · it couldn't be read | гэта не выява · больш за {maxSizeMb} МБ · больш за {maxMegapixels} мегапікселяў · яго не ўдалося прачытаць | no es una imagen · más de {maxSizeMb} MB · más de {maxMegapixels} megapíxeles · no se pudo leer | 不是图片 · 超过 {maxSizeMb} MB · 超过 {maxMegapixels} 百万像素 · 无法读取 |
| browsers can't read HEIC pictures · SVG pictures can't be used | выявы HEIC браўзер не чытае · выявы SVG не падыходзяць | los navegadores no leen imágenes HEIC · las imágenes SVG no se pueden usar | 浏览器无法读取 HEIC 图片 · SVG 图片无法使用 |
| Preparing the picture… | Рыхтуем выяву… | Preparando la imagen… | 正在准备图片… |
| Fit to Canvas · Fit · Done | Упісаць у палатно · Упісаць · Гатова | Ajustar al lienzo · Ajustar · Listo | 适合画布 · 适合 · 完成 |
| Resize from the top-left corner · Turn · Turned {n}° | Змяніць памер за левы верхні кут · Павярнуць · Павернута на {n}° | Cambiar el tamaño desde la esquina superior izquierda · Girar · Girada {n}° | 从左上角调整大小 · 旋转 · 已旋转 {n}° |
| Reference image, {opacity}%, turned {angle}° · Moved · Resized | Падкладка, {opacity}%, павернута на {angle}° · Зрушана · Памер зменены | Imagen de referencia, {opacity}%, girada {angle}° · Movida · Tamaño cambiado | 参考图，{opacity}%，旋转 {angle}° · 已移动 · 已调整大小 |
| Reference image not saved on this device | Падкладка не захавана на гэтай прыладзе | Imagen de referencia no guardada en este dispositivo | 参考图未保存在此设备上 |

## Save reminder copy (ticket 0796)

The ring at the drawing area's top-right that offers to save a Project file (SaveReminder card). The words stay calm: they say where the work is and what keeps it, never "lost" or "deleted". "Beads since last file: {count}" is a Label: number, so no plural is needed; the button's accessible name is "Save a copy" with the count line as its description for the same reason. `{when}` is `Intl.RelativeTimeFormat` with `numeric: "auto"` in the app's language. Every language but English and Russian is a draft, to be checked by a speaker.

| English | Русский | Українська | Polski |
|---|---|---|---|
| Save a copy (label, Tooltip name, accessible name) | Сохранить копию | Зберегти копію | Zapisz kopię |
| The browser keeps your work but can clear it. A Project file stays. (Tooltip body) | Браузер хранит работу, но может её очистить. Файл проекта останется. | Браузер зберігає роботу, але може її очистити. Файл проєкту залишиться. | Przeglądarka przechowuje twoją pracę, ale może ją wyczyścić. Plik projektu zostanie. |
| Beads since last file: {count} | Бисеринок с последнего файла: {count} | Бісеринок з останнього файлу: {count} | Koralików od ostatniego pliku: {count} |
| Last file: {when} · No Project file yet | Последний файл: {when} · Файла проекта ещё нет | Останній файл: {when} · Файлу проєкту ще немає | Ostatni plik: {when} · Nie ma jeszcze pliku projektu |
| Beads since last file: {count}. Save a copy to keep them. (live region) | Бисеринок с последнего файла: {count}. Сохраните копию, чтобы они остались. | Бісеринок з останнього файлу: {count}. Збережіть копію, щоб вони залишилися. | Koralików od ostatniego pliku: {count}. Zapisz kopię, żeby je zachować. |
| Saved: {file} (toast) | Сохранено: {file} | Збережено: {file} | Zapisano: {file} |
| Save Project file · Save Project file as… (Project panel rows, the Save and Save as actions; they replace the row "Project file") | Сохранить файл проекта · Сохранить файл проекта как… | Зберегти файл проєкту · Зберегти файл проєкту як… | Zapisz plik projektu · Zapisz plik projektu jako… |

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Save a copy | Захаваць копію | Guardar una copia | 保存副本 |
| The browser keeps your work but can clear it. A Project file stays. | Браўзер захоўвае працу, але можа яе ачысціць. Файл праекта застанецца. | El navegador guarda tu trabajo, pero puede borrarlo. Un archivo de proyecto se queda. | 浏览器会保存你的作品，但可能会清除它。项目文件会一直保留。 |
| Beads since last file: {count} | Бісерын з апошняга файла: {count} | Cuentas desde el último archivo: {count} | 自上次保存文件后的珠子：{count} |
| Last file: {when} · No Project file yet | Апошні файл: {when} · Файла праекта яшчэ няма | Último archivo: {when} · Aún no hay archivo de proyecto | 上次文件：{when} · 还没有项目文件 |
| Beads since last file: {count}. Save a copy to keep them. | Бісерын з апошняга файла: {count}. Захавайце копію, каб яны засталіся. | Cuentas desde el último archivo: {count}. Guarda una copia para conservarlas. | 自上次保存文件后的珠子：{count}。保存副本以留住它们。 |
| Saved: {file} | Захавана: {file} | Guardado: {file} | 已保存：{file} |
| Save Project file · Save Project file as… | Захаваць файл праекта · Захаваць файл праекта як… | Guardar archivo de proyecto · Guardar archivo de proyecto como… | 保存项目文件 · 项目文件另存为… |
