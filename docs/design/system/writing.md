# Writing

How the app talks in English and Russian: the voice, sentence patterns, one glossary, and how numbers, units and dates are written.

## Voice

- Plain and short: say what happened or what to do, in the fewest words that are still a full thought. No "please", no "oops", no exclamation marks, no emoji, no blame ("Enter a height.", not "You forgot the height!").
- Name things with the app's nouns (the glossary below) and the button's own words: "Export Pattern", not "use the export feature".
- English is US English: color, gray, canceled. Sentence case everywhere; product nouns keep their capital (Pattern, Bead, Palette, Technique, Row progress).
- Russian: product nouns are lowercase like any noun (схема, бисер, палитра); a button quoted in a sentence goes in «ёлочки»; ё is always written (сохранённые, всё).
- Labels and meta are lowercased by style, never in the string (as today).
- **No em dashes**, in either language: use a colon, a comma, brackets or two sentences. Russian rewrites the sentence instead of the dash between subject and predicate ("Эти размеры приблизительные.", not a dash before "оценка").
- **One colon rule for labels** (ticket 0853): a key before its value takes a colon ("name: Moth", "maker:", "codes: {count}"); a section header never does ("project", "frame", "export", "this Project"), in every language, the Chinese full-width colon too.
- **A help line fits the device in hand** (ticket 0846): one rule for every line that says how to do something. Touch (the main pointer is a finger and the key chips are hidden) gets finger words and no keys or shortcut digits ("two fingers", "pinch", "take a photo", nothing to drop); a keyboard on an Apple device gets ⌘ ("⌘V", no plus); any other keyboard gets Ctrl ("Ctrl+V"). The key is a blank (`{pasteKey}`) filled by the app, never written into the string. Keyboard shortcuts (ShortcutsHelp) lists every key on every device.

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

| English | Russian | Note |
| --- | --- | --- |
| Project | проект | Saved Projects / Сохранённые проекты; New Project / Новый проект |
| Schema | схема | The beads inside the Frame; Schema rotated / Схема повёрнута (ADR 0050) |
| Bead / beads | бисеринка / бисер | One bead is бисеринка everywhere, never бусина («4 бисеринки», «Бисеринок»); the material and amounts are бисер (ticket 0864) |
| Technique | техника плетения | Loom / ткачество, Peyote / мозаичное плетение, Brick stitch / кирпичное плетение |
| Palette | палитра |  |
| Row progress | прогресс по рядам | Row done / Ряд готов; Row not done / Ряд не готов; never a bare «Готово», which reads as closing something. Where a pair has no room in the Progress bar it becomes Следующий / Предыдущий (ticket 0864) |
| Beads needed | Нужно бисера | Its count column: Beads / Бисеринок |
| Clear | Очистить; confirm Очистить? | Empties the cells; the Schema stays. Not «Очистить всё», which was Delete all |
| Save Project | Сохранить проект | The SaveBox button; the name field's Save stays Сохранить |
| Delete all | Очистить всё | Empties the cells; the Schema stays |
| Mirror | Отражение | Estimated size / Примерный размер |
| Frame | рамка | Set Frame / Задать рамку; no Frame / без рамки (v16, in Size's place) |
| Piece | кусочек | Beads that touch; 1 кусочек, 2 кусочка, 5 кусочков |
| Folded beads | свёрнутые бисерины | The Frame's own beads beyond its edge, out of sight (ADR 0066); proposed, ticket 0641 |
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
| Row done · Row not done | Ряд готовий · Ряд не готовий; by columns Наступний · Попередній, as «Стовпець не готовий» has no room at 320px (ticket 0864) | Рад гатовы · Рад не гатовы; Слупок гатовы · Слупок не гатовы |
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

**Three per theme (ticket 1000; approved 2026-11-14, not yet in the app):** 1 Studio / Night, 2 Stone / Ink, 3 Pebble / Slate, named "{name}, {n} of 3". Linen, Fog, Midnight and Ash leave every language with that ticket.

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
| Color key · To buy · {n} × 5 g | Ключ цветов · Купить · {n} × 5 г |
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
| Make your first Project · Open the editor | Сделать первый проект · Открыть редактор |
| Patterns saved: 3 | Схем сохранено: 3 |
| What's inside | Что внутри |
| Made by one family | Делает одна семья |
| openbeads stays free and fully local, with no ads and no tracking. If it helps your work, you can support its development through Buy Me a Coffee. | openbeads остаётся бесплатным и полностью локальным, без рекламы и отслеживания. Если приложение вам помогает, поддержать его развитие можно через Buy Me a Coffee. |
| View the source | Исходный код |
| Buy me a coffee | Угостить кофе |
| Three ways to use it (the "plans" label is gone, ticket 0739) | Три способа работать |
| Accounts and Pro aren't open yet. Everything works without them. | Аккаунты и Pro пока не открыты. Всё работает и без них. |
| you are here (note) | вы здесь |
| No account · Free · no sign-up · Draw, count and weave on this device. Nothing to sign up for. · Open the editor | Без аккаунта · Бесплатно · без регистрации · Рисуйте, считайте и плетите на этом устройстве. Регистрироваться не нужно. · Открыть редактор |
| Free account · Free · Same as No account, plus more · Create free account (ticket 0740: no "coming later", no list) | Бесплатный аккаунт · Бесплатно · Всё, что без аккаунта, и больше · Создать бесплатный аккаунт |
| Pro · Price later · Same as Free account, plus more · Coming later (ticket 0740: no "coming later" beside the price, no list) | Pro · Цена позже · Всё, что в бесплатном аккаунте, и больше · Появится позже |
| COMING SOON (the stamp on Free account and Pro; its image name "Coming soon") | СКОРО (название картинки «Скоро») |
| forever free: (No account's list; "what you get" and the two "everything in …, plus" lines are gone, ticket 0740) | бесплатно навсегда: |
| Free to use · Accounts and Pro come later; everything works without them. (a new visitor's plans: No account alone, its heading and the line in the reason's place, ticket 0871) | Бесплатно · Аккаунты и Pro появятся позже; всё работает и без них. |

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
| Canvas and Frame · Draw anywhere: the Canvas has no edges. A Frame sets the size, the exports and the bead count. | Холст и рамка · Рисуйте где угодно: у холста нет краёв. Рамка задаёт размер, экспорт и количество бисерин. |
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
| Open source · All of openbeads is public under the AGPL-3.0 licence. Read the code, report a bug or suggest a change. (the chip's line, for screen readers) · View the source | Открытый код · Весь openbeads открыт по лицензии AGPL-3.0. Читайте код, сообщайте об ошибках, предлагайте изменения. · Исходный код |
| Say hello · A bug, an idea, a pattern you made: send it to the family. It's also in {menu} → {feedback}. (the chip's line, for screen readers) · Send feedback | Напишите нам · Ошибка, идея, ваша работа: отправьте семье. Это есть и в {menu} → {feedback}. · Отправить отзыв |
| Coming soon (a phone's chip in place of the stamp) · you are here (its chip) | Скоро · вы здесь |
| Show all {n} (a phone's free list, past its first six rows) | Показать все {n} |

`{menu}` and `{feedback}` are the Menu's own labels (the Canvas strip's Menu, its Send feedback row), never typed in. What's new's lines are the release notes', in the language shown, each with its date in the language's short form ("Nov 7", "7 нояб."). A release note is added as its own file, `src/data/releaseNotes/YYYY-MM-DD-NNNN.json`, when a user-facing change ships: one short line in every language, no full stop.

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
| An open Canvas: draw anywhere, it has no edges | Открытый холст: рисуйте где угодно, у него нет краёв |
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
| Open editor from here (into the editor on a copy of the demo's Project) | Открыть редактор отсюда |
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
| The Frame marks which beads become the Pattern. Beads outside it stay on the Canvas. | Рамка отмечает, какие бисеринки войдут в схему. Бисеринки за рамкой остаются на холсте. |
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
| Left · Top · Right · Bottom · Light · Dark · Match device · High contrast | Слева · Сверху · Справа · Снизу · Светлая · Тёмная · Как на устройстве · Высокий контраст |
| Help · Keyboard shortcuts · Homepage · About · Source code · Version | Справка · Сочетания клавиш · Главная · О приложении · Исходный код · Версия |
| Rename {name} · Technique · Bead: · Replace bead · Canvas | Переименовать «{name}» · Техника · Бисер: · Заменить бисер · Холст |
| saved · this device · unsaved changes · Not saved. {reason} · Try again | сохранено · на этом устройстве · есть несохранённые изменения · Не сохранено. {reason} · Повторить |
| Save Project · Export · PNG · PDF · Project file | Сохранить проект · Экспорт · PNG · PDF · Файл проекта |
| Name on exports · Your name · Printed on this Project's PDF and PNG exports. | Имя на экспорте · Ваше имя · Печатается на PDF и PNG этого проекта. |
| Duplicate · Duplicate Project · Name · Everything is copied, including Row progress. The copy opens; the original stays as it is now. · Suggested: the current name and the next free number. | Дублировать · Дублировать проект · Название · Копируется всё, включая прогресс по рядам. Откроется копия, а оригинал останется таким, как сейчас. · Предложено: текущее название и следующий свободный номер. |
| Delete all Projects? · Every Project is removed from this device. This can't be undone. Export all first if you want to keep copies. · Clear this Project | Удалить все проекты? · Все проекты будут удалены с этого устройства. Это нельзя отменить. Сначала нажмите «Экспортировать все», если хотите сохранить копии. · Очистить этот проект |
| Delete this Project · Delete “{name}”? · “{name}” and its Row progress are removed from this device. This can't be undone. Save its Project file first if you want to keep it. · Save Project file · Delete Project | Удалить этот проект · Удалить «{name}»? · «{name}» и прогресс по рядам будут удалены с этого устройства. Это нельзя отменить. Если хотите оставить его себе, сначала сохраните файл проекта. · Сохранить файл проекта · Удалить проект |
| A Project needs a name. · Enter saves · Escape cancels | У проекта должно быть название. · Enter сохраняет · Esc отменяет |
| The Canvas stays white in high contrast. | В режиме высокой контрастности холст остаётся белым. |

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
| Top · Bottom · Left · Right (the edge cells) | Сверху · Снизу · Слева · Справа |
| Top edge: add one row · Top edge: remove one row | Верхний край: добавить ряд · Верхний край: убрать ряд |
| Left edge: add one column · Left edge: remove one column | Левый край: добавить столбец · Левый край: убрать столбец |
| The Frame can’t get any smaller on this side. | Рамку нельзя сделать меньше с этой стороны. |

## Copy changed in ticket 0489

Remove Frame? names what goes (Frame card, ConfirmDialogs card). The Russian is the approved confirm pattern (Confirm in Sentence patterns).

| English | Russian |
| --- | --- |
| Rows marked done will be cleared with the Frame. Its beads stay on the Canvas. This can be undone. | Ряды, отмеченные как готовые, сотрутся вместе с рамкой. Её бисеринки останутся на холсте. Это действие можно отменить. |

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

`.openbeads` is named wherever a project file is read or written (Open Project file, Save all Projects to a Project file, Save Project file, the file picker's Tooltip, the error for a file that isn't one). The file has one name, "Project file": "Save Project file" out and "Open Project file" in, never Import, Export, Save a copy or File ready (ticket 0859; Project file copy). The `project`, `frame`, `name:` and `maker:` labels are lowercased by style in every language, like the section labels; `project` and `frame` are section headers, so they take no colon (ticket 0853).

| English | Русский |
|---|---|
| Projects library · Open Project file · Save all Projects to a Project file · Delete all Projects | Библиотека проектов · Открыть файл проекта · Сохранить всё в файл проекта · Удалить все проекты |
| No Projects yet · Projects you make are kept on this device. Open a Project file to bring one in. | Проектов пока нет · Проекты хранятся на этом устройстве. Откройте файл проекта, чтобы добавить проект. |
| {n} pieces · {n} unnamed · Frame {w} × {h} beads | Частей: {n} · без названия: {n} · Рамка {w} × {h} бисеринок |
| Writing hand · Right · Left · Buy me a coffee | Рабочая рука · Правая · Левая · Угостить кофе |
| Project · name: · maker: · Add your name for exports · Change the maker's name | проект · название: · автор: · Добавьте имя для экспорта · Изменить имя автора |
| Saved in local browser · Not saved yet · Saved in openbeads cloud · Not in openbeads cloud: sign in to sync | Сохранено в браузере · Ещё не сохранено · Сохранено в облаке openbeads · Не в облаке openbeads: войдите, чтобы синхронизировать |
| Brand · Type · Size | Бренд · Тип · Размер |
| Project file · Picture · Printable chart · Clear all beads · Delete Project | Файл проекта · Картинка · Схема для печати · Очистить все бисеринки · Удалить проект |
| Frame · Name this Frame · Rename Frame · Frame from template · Fit a Frame to the drawing · A Frame sets the size, the exports and the bead count. | рамка · Назовите рамку · Переименовать рамку · Рамка из шаблона · Рамка по рисунку · Рамка задаёт размер, экспорт и подсчёт бисеринок. |
| Estimated size · An estimate. · Rows are marked done. Reset progress to change the size. · Show all colors ({n}) | Примерный размер · Это оценка. · Ряды отмечены как готовые. Сбросьте прогресс, чтобы изменить размер. · Показать все цвета ({n}) |
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
| Drop a picture anywhere on the app, choose a file or paste one with ⌘V (Ctrl+V off Apple devices). PNG, JPEG, GIF, or WebP, up to 10 MB and 16 megapixels. | Перетащите изображение в любое место приложения, выберите файл или вставьте его через ⌘V / Ctrl+V. PNG, JPEG, GIF или WebP, до 10 МБ и 16 мегапикселей. | Перетягніть зображення будь-куди в застосунок, виберіть файл або вставте його через ⌘V / Ctrl+V. PNG, JPEG, GIF або WebP, до 10 МБ і 16 мегапікселів. | Upuść obraz w dowolnym miejscu aplikacji, wybierz plik albo wklej go przez ⌘V / Ctrl+V. PNG, JPEG, GIF lub WebP, do 10 MB i 16 megapikseli. |
| (touch) Choose a file, paste a picture or take a photo. PNG, JPEG, GIF, or WebP, up to 10 MB and 16 megapixels. | Выберите файл, вставьте изображение или сфотографируйте. PNG, JPEG, GIF или WebP, до 10 МБ и 16 мегапикселей. | Виберіть файл, вставте зображення або сфотографуйте. PNG, JPEG, GIF або WebP, до 10 МБ і 16 мегапікселів. | Wybierz plik, wklej obraz albo zrób zdjęcie. PNG, JPEG, GIF lub WebP, do 10 MB i 16 megapikseli. |
| Drop a picture here · or paste one with ⌘V (Ctrl+V off Apple devices) | Перетащите изображение сюда · или вставьте его через ⌘V / Ctrl+V | Перетягніть зображення сюди · або вставте його через ⌘V / Ctrl+V | Upuść obraz tutaj · albo wklej go przez ⌘V / Ctrl+V |
| Drop to use this picture · Drop to convert image · PNG, JPEG, GIF, or WebP · up to 10 MB | Отпустите, чтобы взять это изображение · Отпустите, чтобы конвертировать изображение · PNG, JPEG, GIF или WebP · до 10 МБ | Відпустіть, щоб узяти це зображення · Відпустіть, щоб конвертувати зображення · PNG, JPEG, GIF або WebP · до 10 МБ | Upuść, aby użyć tego obrazu · Upuść, aby skonwertować obraz · PNG, JPEG, GIF lub WebP · do 10 MB |
| convert · Whole picture · A part (ticket 0863; it was weave) | конвертировать · Всё изображение · Часть | конвертувати · Усе зображення · Частину | konwertuj · Cały obraz · Część |
| Drag on the preview to draw the part to weave, drag inside it to move it, or pull its handles to adjust it. | Проведите по превью, чтобы выбрать часть для плетения; тяните внутри неё, чтобы сдвинуть, или за маркеры, чтобы изменить. | Проведіть по прев’ю, щоб вибрати частину для плетіння; тягніть усередині неї, щоб посунути, або за маркери, щоб змінити. | Przeciągnij po podglądzie, aby narysować część do wyplatania; przeciągnij wewnątrz niej, aby ją przesunąć, albo za uchwyty, aby ją zmienić. |
| Colors follow the part. Width and height stay as set, and drop only when the part has fewer pixels than they allow. | Цвета берутся по части. Ширина и высота остаются прежними и уменьшаются, только если в части меньше пикселей, чем они допускают. | Кольори беруться за частиною. Ширина й висота лишаються попередніми й зменшуються, лише якщо в частині менше пікселів, ніж вони дозволяють. | Kolory idą za częścią. Szerokość i wysokość zostają, jakie były, i maleją tylko wtedy, gdy część ma mniej pikseli, niż pozwalają. |
| units · beads · mm (ticket 0863; it was slide in) | единицы · бисер · мм | одиниці · бісер · мм | jednostki · koraliki · mm |
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
| The codes are real {Bead} beads. Their colors are approximate, made from the color family and the finish. (under the Bead’s palette only; ticket 0884, in the words of the Palette popover’s Approximate colors note) | Коды настоящие, это бисер {Bead}. Цвета приблизительные, собраны из семейства цвета и покрытия. | Коди справжні, це бісер {Bead}. Кольори приблизні, складені з родини кольору та покриття. | Kody to prawdziwe koraliki {Bead}. Kolory są przybliżone, powstają z rodziny koloru i wykończenia. |
| codes in {size}: {n} | кодов в {size}: {n} | кодів у {size}: {n} | kodów w {size}: {n} |
| colors found · Treat as empty (a switch in the Colors step) | найдено цветов · Считать пустым | знайдено кольорів · Вважати порожнім | znalezione kolory · Traktuj jako puste |
| From picture · Becomes · Beads · Change · Empty (the found-colors table's heading) | Из картинки · Станет · Бисерин · Изменить · Пусто | Із картинки · Стане · Бісерин · Змінити · Порожньо | Z obrazu · Wynik · Koraliki · Zmień · Puste |
| Keep exact (in the Change picker's head) · Change · Empty · No bead · Kept exact · Remapped · Custom color | Оставить точный · Изменить · Пусто · Без бисерины · Точный цвет · Заменён · Свой цвет | Залишити точний · Змінити · Порожньо · Без бісерини · Точний колір · Замінено · Власний колір | Zachowaj dokładny · Zmień · Puste · Bez koralika · Dokładny kolor · Zamieniony · Własny kolor |
| Picture color · Palette of the new Project · In the Palette · Leave the wheel to take the color. | Цвет изображения · палитра нового проекта · В палитре · Цвет берётся, когда уходите с круга. | Колір зображення · палітра нового проєкту · У палітрі · Колір береться, коли залишаєте коло. | Kolor obrazu · paleta nowego projektu · W palecie · Kolor zostaje wybrany po opuszczeniu koła. |
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

## Convert image beginner copy (ticket 0863)

The converter in a beginner's words (ConvertImage and FoundColorRow cards; UX audit F-03-09, F-03-11, F-03-13, F-03-17, F-03-19). These rows replace the 0646 and 0778 tables' "weave", "slide in", the two stages, Tolerance's ends and the errors. The picture formats are never typed in: the app joins them as the language says "or" (`formatList`), so English takes the serial comma, as every English list does ("PNG, JPEG, GIF, or WebP"), and the other languages their own word (или, або, ці, o, lub, 或). English follows the audit; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| convert (over Whole picture · A part of the picture) | конвертировать | конвертувати | канвертаваць | 转换 | convertir | konwertuj |
| units (beside beads · mm) | единицы | одиниці | адзінкі | 单位 | unidades | jednostki |
| Step 1 of 2: check what was found · Step 2 of 2: check what is left | Шаг 1 из 2: проверьте, что найдено · Шаг 2 из 2: проверьте, что осталось | Крок 1 з 2: перевірте, що знайдено · Крок 2 з 2: перевірте, що залишилося | Крок 1 з 2: праверце, што знойдзена · Крок 2 з 2: праверце, што засталося | 第 1 步，共 2 步：检查找到的部分 · 第 2 步，共 2 步：检查剩下的部分 | Paso 1 de 2: revisa lo que se encontró · Paso 2 de 2: revisa lo que queda | Krok 1 z 2: sprawdź, co znaleziono · Krok 2 z 2: sprawdź, co zostało |
| Tolerance · only close colors · more colors | Допуск · только близкие цвета · больше цветов | Допуск · лише близькі кольори · більше кольорів | Допуск · толькі блізкія колеры · больш колераў | 容差 · 仅相近颜色 · 更多颜色 | Tolerancia · solo colores cercanos · más colores | Tolerancja · tylko bliskie kolory · więcej kolorów |
| Plain named colors, no brand. (under Default Palette) | Простые цвета с названиями, без бренда. | Прості кольори з назвами, без бренду. | Простыя колеры з назвамі, без брэнда. | 有名称的普通颜色，不属于任何品牌。 | Colores sencillos con nombre, sin marca. | Proste nazwane kolory, bez marki. |
| Keeps the picture's own colors. These are not beads from a shop. (under Exact) | Оставляет собственные цвета изображения. Это не бисер из магазина. | Залишає власні кольори зображення. Це не бісер із крамниці. | Пакідае ўласныя колеры выявы. Гэта не бісер з крамы. | 保留图片自身的颜色。这些不是商店里卖的珠子。 | Mantiene los colores propios de la imagen. No son cuentas de una tienda. | Zachowuje własne kolory obrazu. To nie są koraliki ze sklepu. |
| Each color is one bead color. Max {n}: every color the picture has. (the Colors hint under Exact; the capped one ends as before) | Каждый цвет станет одним цветом бисера. Макс. {n}: все цвета изображения. | Кожен колір стане одним кольором бісеру. Макс. {n}: усі кольори зображення. | Кожны колер стане адным колерам бісеру. Макс. {n}: усе колеры выявы. | 每种颜色就是一种珠子颜色。最大 {n}：图片的全部颜色。 | Cada color es un color de cuenta. Máx. {n}: todos los colores de la imagen. | Każdy kolor to jeden kolor koralików. Maks. {n}: wszystkie kolory obrazu. |
| This file can't be converted. Use {formats}. | Этот файл нельзя сконвертировать. Подойдут {formats}. | Цей файл не можна сконвертувати. Підійдуть {formats}. | Гэты файл нельга сканвертаваць. Падыдуць {formats}. | 该文件无法转换。请使用 {formats}。 | Este archivo no se puede convertir. Usa {formats}. | Tego pliku nie można przekonwertować. Użyj {formats}. |
| SVG files can't be converted. Save it as PNG first. | Файлы SVG нельзя сконвертировать. Сначала сохраните картинку в PNG. | Файли SVG не можна сконвертувати. Спочатку збережіть зображення в PNG. | Файлы SVG нельга сканвертаваць. Спачатку захавайце выяву ў PNG. | SVG 文件无法转换。请先另存为 PNG。 | Los archivos SVG no se pueden convertir. Guárdalo antes como PNG. | Plików SVG nie można przekonwertować. Najpierw zapisz go jako PNG. |
| Browsers can't read HEIC pictures. Save it as PNG or JPEG and try again. · That picture couldn't be read. The file may be damaged. (English only: "can't", "couldn't") | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged |

"{n} colors" in the Colors step's summary, Color by color's summary and the preview's name counts the bead colors after the match, one per row of Color by color, so it is the count Beads needed lists; the Colors slider's own value is still what it asks for.

## Quiet converter copy (ticket 0895)

The quiet converter of DS-1 (ConvertImage card's first section; tickets 0896, 0897, 0898). Strings the table does not list keep their words from the tables above; "Keep exact", "Turn 90°", "keeping {columns}×{rows}", "Keep all", "Add to Canvas", "Add a picture first.", "Reading the picture" and "no picture yet" are reused as they are, "More for the picture" is the reference image's (ticket 0883), and the crop's size chip is that ticket's resize chip without "· shape kept". An Info button's body is the sentence it replaces, unchanged. Counts take the "Label: number" form, as above. English is from the design; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| picture · bead and technique (the column's labels) | изображение · бисер и техника | зображення · бісер і техніка | выява · бісер і тэхніка | 图片 · 珠子和技法 | imagen · cuenta y técnica | obraz · koralik i technika |
| More for the size · More for the colors (the buttons beside Width and Colors) | Ещё для размера · Ещё для цветов | Ще для розміру · Ще для кольорів | Яшчэ для памеру · Яшчэ для колераў | 尺寸的更多选项 · 颜色的更多选项 | Más opciones del tamaño · Más opciones de los colores | Więcej dla rozmiaru · Więcej dla kolorów |
| matched to the {bead} palette · matched to the default palette · the picture's own colors (under Colors) | подобрано по палитре {bead} · подобрано по палитре по умолчанию · собственные цвета изображения | підібрано з палітри {bead} · підібрано з типової палітри · власні кольори зображення | падабрана з палітры {bead} · падабрана з тыповай палітры · уласныя колеры выявы | 按 {bead} 色板匹配 · 按默认色板匹配 · 图片自身的颜色 | ajustado a la paleta {bead} · ajustado a la paleta predeterminada · los colores propios de la imagen | dopasowane do palety {bead} · dopasowane do domyślnej palety · własne kolory obrazu |
| Size (the popover's title) | Размер | Розмір | Памер | 尺寸 | Tamaño | Rozmiar |
| What Width and Height do (Info) | Что делают Ширина и Высота | Що роблять Ширина й Висота | Што робяць Шырыня і Вышыня | 宽度和高度的作用 | Qué hacen Ancho y Alto | Co robią Szerokość i Wysokość |
| What {name} does (Info: Colors, Keep the picture's shape, Remove background) | Что делает «{name}» | Що робить «{name}» | Што робіць «{name}» | {name}的作用 | Qué hace {name} | Co robi {name} |
| Where colors come from (Info beside match to) | Откуда берутся цвета | Звідки беруться кольори | Адкуль бяруцца колеры | 颜色从哪里来 | De dónde salen los colores | Skąd biorą się kolory |
| What pictures work (Info beside Drop a picture here) | Какие изображения подходят | Які зображення підходять | Якія выявы падыходзяць | 支持哪些图片 | Qué imágenes sirven | Jakie obrazy pasują |
| found · {pct}% of the picture | найдено · {pct}% изображения | знайдено · {pct}% зображення | знойдзена · {pct}% выявы | 已找到 · 图片的 {pct}% | encontrado · {pct}% de la imagen | znaleziono · {pct}% obrazu |
| {n} beads left out | Убрано бисерин: {n} | Прибрано бісерин: {n} | Прыбрана бісерын: {n} | 已去掉 {n} 颗珠子 | Cuentas quitadas: {n} | Pominięto koralików: {n} |
| Flip left to right (the ··· menu) | Отразить слева направо | Віддзеркалити зліва направо | Адлюстраваць злева направа | 左右翻转 | Voltear de izquierda a derecha | Odbij w poziomie |
| project · adds to (the foot's label) | проект · добавить в | проєкт · додати до | праект · дадаць у | 项目 · 添加到 | proyecto · añadir a | projekt · dodaj do |
| goes where the picture lies on the Canvas | встанет там, где на холсте лежит картинка | стане там, де на полотні лежить зображення | стане там, дзе на палатне ляжыць выява | 放在画布上图片所在的位置 | va donde está la imagen en el lienzo | trafi tam, gdzie na płótnie leży obraz |
| {n} colors · kept from {size} (the result's second line) | цветов: {n} · из {size} | кольорів: {n} · з {size} | колераў: {n} · з {size} | {n} 种颜色 · 取自 {size} | {n} colores · de {size} | kolorów: {n} · z {size} |

"800×977 px" drops "· jpg" (the name says it) and "{file} · {size}" under Reading the picture has no words to translate. Gone with ticket 0896, in every language: the step titles and summaries, "add a picture first" as a summary, "convert" with Whole picture and A part of the picture, the counter, Back and Next on this page, the band's drag lines, "To leave a color out, pick Make empty …", "To fix what was found, pick Background …", "Turn it off to keep the whole picture." and "Colors follow the crop. …"; with ticket 0897, Name, Maker's name and "optional" on this page.

## Colors that are real beads copy (ticket 0899)

DS-2's Colors part (ConvertImage card, "Colors that are real beads"; tickets 0901 to 0905 and 0918). Strings the table does not list keep their words from the tables above: Finish and the nine Finish names, Clear filters, Filters, Find a code or color, Discontinued, match to, Default Palette, Exact, Keep exact, Change, Empty, Palette {bead}, Cancel. The neighbours' captions are the app's `colorsCount` plural ("13 цветов"), and "40+" has no words. Counts take the "Label: number" form, as above. English is from the design; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| {bead} · {finishes} · {bead} · {n} finishes (the line under Colors; was "matched to the {bead} palette") | {bead} · {finishes} · {bead} · покрытий: {n} | {bead} · {finishes} · {bead} · покриттів: {n} | {bead} · {finishes} · {bead} · пакрыццяў: {n} | {bead} · {finishes} · {bead} · {n} 种表面处理 | {bead} · {finishes} · {bead} · {n} acabados | {bead} · {finishes} · {bead} · wykończeń: {n} |
| Finish, {count} on (the Finish button's name) | Покрытие, включено: {count} | Покриття, увімкнено: {count} | Пакрыццё, уключана: {count} | 表面处理，已开启 {count} 个 | Acabado, activos: {count} | Wykończenie, włączone: {count} |
| Default Palette colors have no Finish. · Exact keeps the picture's own colors. (Finish off) | У цветов палитры по умолчанию нет покрытия. · «Точные» оставляют собственные цвета изображения. | Кольори типової палітри не мають покриття. · «Точні» залишають власні кольори зображення. | У колераў тыповай палітры няма пакрыцця. · «Дакладныя» пакідаюць уласныя колеры выявы. | 默认调色板的颜色没有表面处理。 · 原色保留图片自身的颜色。 | Los colores de la paleta predeterminada no tienen acabado. · Exactos mantiene los colores propios de la imagen. | Kolory domyślnej palety nie mają wykończenia. · Dokładne zachowują własne kolory obrazu. |
| Only {n} codes left: {n} colors, not {asked}. | Осталось кодов: {n}, поэтому цветов {n}, а не {asked}. | Залишилося кодів: {n}, тож кольорів {n}, а не {asked}. | Засталося кодаў: {n}, таму колераў {n}, а не {asked}. | 只剩 {n} 个色号：{n} 种颜色，而不是 {asked} 种。 | Solo quedan {n} códigos: {n} colores, no {asked}. | Zostało kodów: {n}, więc kolorów {n}, nie {asked}. |
| {n} colors (only {n} codes left) · {n} colors (your list has {n}) (the result's second line) | цветов: {n} (осталось кодов: {n}) · цветов: {n} (в вашем списке {n}) | кольорів: {n} (залишилося кодів: {n}) · кольорів: {n} (у вашому списку {n}) | колераў: {n} (засталося кодаў: {n}) · колераў: {n} (у вашым спісе {n}) | {n} 种颜色（只剩 {n} 个色号） · {n} 种颜色（你的清单里有 {n} 个） | {n} colores (solo quedan {n} códigos) · {n} colores (tu lista tiene {n}) | kolorów: {n} (zostało kodów: {n}) · kolorów: {n} (na twojej liście jest {n}) |
| codes in {size}: {n} · {m} measured · codes in my beads: {n} · {m} measured · codes: {n} · {m} measured | кодов в {size}: {n} · измерено: {m} · кодов в моём бисере: {n} · измерено: {m} · кодов: {n} · измерено: {m} | кодів у {size}: {n} · виміряно: {m} · кодів у моєму бісері: {n} · виміряно: {m} · кодів: {n} · виміряно: {m} | кодаў у {size}: {n} · вымерана: {m} · кодаў у маім бісеры: {n} · вымерана: {m} · кодаў: {n} · вымерана: {m} | {size} 的色号：{n} · 已测量 {m} 个 · 我的珠子的色号：{n} · 已测量 {m} 个 · 色号：{n} · 已测量 {m} 个 | códigos en {size}: {n} · medidos: {m} · códigos en mis cuentas: {n} · medidos: {m} · códigos: {n} · medidos: {m} | kodów w {size}: {n} · zmierzonych: {m} · kodów w moich koralikach: {n} · zmierzonych: {m} · kodów: {n} · zmierzonych: {m} |
| My beads (a product noun) · my beads · {n} codes (under Colors) | Мой бисер · мой бисер · кодов: {n} | Мій бісер · мій бісер · кодів: {n} | Мой бісер · мой бісер · кодаў: {n} | 我的珠子 · 我的珠子 · {n} 个色号 | Mis cuentas · mis cuentas · {n} códigos | Moje koraliki · moje koraliki · kodów: {n} |
| My beads: only the codes you ticked as yours, and only those made in {size}. (Where colors come from) | Мой бисер: только коды, отмеченные как ваши, и только те, что выпускаются в {size}. | Мій бісер: лише коди, позначені як ваші, і лише ті, що випускаються в {size}. | Мой бісер: толькі коды, адзначаныя як вашы, і толькі тыя, што выпускаюцца ў {size}. | 我的珠子：只用你勾选为自己拥有的色号，且只用 {size} 有的。 | Mis cuentas: solo los códigos que marcaste como tuyos, y solo los que existen en {size}. | Moje koraliki: tylko kody zaznaczone jako twoje i tylko te, które są w rozmiarze {size}. |
| Finish: keeps the match to the Finishes you tick. (Where colors come from) | Покрытие: подбор только среди отмеченных покрытий. | Покриття: добір лише серед позначених покриттів. | Пакрыццё: падбор толькі сярод адзначаных пакрыццяў. | 表面处理：只在你勾选的表面处理中匹配。 | Acabado: el ajuste se limita a los acabados que marques. | Wykończenie: dopasowanie tylko do zaznaczonych wykończeń. |
| Edit My beads · Choose My beads (match to's last item) | Изменить «Мой бисер» · Выбрать «Мой бисер» | Змінити «Мій бісер» · Вибрати «Мій бісер» | Змяніць «Мой бісер» · Выбраць «Мой бісер» | 编辑我的珠子 · 选择我的珠子 | Editar Mis cuentas · Elegir Mis cuentas | Edytuj Moje koraliki · Wybierz Moje koraliki |
| {n} codes · no codes yet | кодов: {n} · кодов пока нет | кодів: {n} · кодів ще немає | кодаў: {n} · кодаў пакуль няма | {n} 个色号 · 还没有色号 | {n} códigos · aún no hay códigos | kodów: {n} · jeszcze brak kodów |
| Back to Colors | Назад к цветам | Назад до кольорів | Назад да колераў | 返回颜色 | Volver a Colores | Wróć do kolorów |
| What My beads is (Info) | Что такое «Мой бисер» | Що таке «Мій бісер» | Што такое «Мой бісер» | 什么是我的珠子 | Qué es Mis cuentas | Czym są Moje koraliki |
| The codes you own, one list for each color catalog. Tick them here or paste a list. The list stays on this device and is never sent. (its body) | Коды, которые у вас есть: один список на каждый каталог цветов. Отметьте их здесь или вставьте список. Список хранится на этом устройстве и никуда не отправляется. | Коди, які у вас є: один список на кожен каталог кольорів. Позначте їх тут або вставте список. Список зберігається на цьому пристрої й нікуди не надсилається. | Коды, якія ў вас ёсць: адзін спіс на кожны каталог колераў. Адзначце іх тут або ўстаўце спіс. Спіс захоўваецца на гэтай прыладзе і нікуды не адпраўляецца. | 你拥有的色号，每个色卡一份清单。在这里勾选，或粘贴一份清单。清单只保存在这台设备上，不会发送出去。 | Los códigos que tienes, una lista por cada catálogo de colores. Márcalos aquí o pega una lista. La lista se queda en este dispositivo y nunca se envía. | Kody, które masz: jedna lista na każdy katalog kolorów. Zaznacz je tutaj albo wklej listę. Lista zostaje na tym urządzeniu i nigdy nie jest wysyłana. |
| color catalog · {catalog} | каталог цветов · {catalog} | каталог кольорів · {catalog} | каталог колераў · {catalog} | 色卡 · {catalog} | catálogo de colores · {catalog} | katalog kolorów · {catalog} |
| No codes yet. Tick the codes you own, or paste a list of them. | Кодов пока нет. Отметьте коды, которые у вас есть, или вставьте их список. | Кодів ще немає. Позначте коди, які у вас є, або вставте їх список. | Кодаў пакуль няма. Адзначце коды, якія ў вас ёсць, або ўстаўце іх спіс. | 还没有色号。勾选你拥有的色号，或粘贴一份色号清单。 | Aún no hay códigos. Marca los códigos que tienes o pega una lista. | Jeszcze brak kodów. Zaznacz kody, które masz, albo wklej ich listę. |
| All codes (the switch beside My beads) | Все коды | Усі коди | Усе коды | 全部色号 | Todos los códigos | Wszystkie kody |
| {code} {name}, in My beads · {code} in My beads (names) | {code} {name}, в «Моём бисере» · {code} в «Моём бисере» | {code} {name}, у «Моєму бісері» · {code} у «Моєму бісері» | {code} {name}, у «Маім бісеры» · {code} у «Маім бісеры» | {code} {name}，在我的珠子中 · {code} 在我的珠子中 | {code} {name}, en Mis cuentas · {code} en Mis cuentas | {code} {name}, w Moich koralikach · {code} w Moich koralikach |
| Paste codes · paste codes (label) · Add codes | Вставить коды · вставьте коды · Добавить коды | Вставити коди · вставте коди · Додати коди | Уставіць коды · устаўце коды · Дадаць коды | 粘贴色号 · 粘贴色号 · 添加色号 | Pegar códigos · pega códigos · Añadir códigos | Wklej kody · wklej kody · Dodaj kody |
| {n} added · {n} already in the list · {n} not known: {codes} | Добавлено: {n} · Уже в списке: {n} · Неизвестны ({n}): {codes} | Додано: {n} · Уже в списку: {n} · Невідомі ({n}): {codes} | Дададзена: {n} · Ужо ў спісе: {n} · Невядомыя ({n}): {codes} | 已添加 {n} 个 · {n} 个已在清单中 · {n} 个未知：{codes} | Añadidos: {n} · Ya en la lista: {n} · Desconocidos ({n}): {codes} | Dodano: {n} · Już na liście: {n} · Nieznane ({n}): {codes} |
| discontinued, never matched (after the family and Finish) | снят с производства, не подбирается | знято з виробництва, не добирається | знята з вытворчасці, не падбіраецца | 已停产，不参与匹配 | descatalogado, nunca se usa | wycofany, nigdy nie dopasowywany |
| Clear list · Clear all {n} codes? | Очистить список · Убрать все коды ({n})? | Очистити список · Прибрати всі коди ({n})? | Ачысціць спіс · Прыбраць усе коды ({n})? | 清空清单 · 清除全部 {n} 个色号？ | Vaciar la lista · ¿Quitar los {n} códigos? | Wyczyść listę · Usunąć wszystkie kody ({n})? |
| Number of colors · type a number · 1 to 256 (the neighbours' card) | Число цветов · введите число · от 1 до 256 | Кількість кольорів · введіть число · від 1 до 256 | Колькасць колераў · увядзіце лік · ад 1 да 256 | 颜色数量 · 输入数字 · 1 到 256 | Número de colores · escribe un número · de 1 a 256 | Liczba kolorów · wpisz liczbę · od 1 do 256 |
| no fewer · no more | меньше нельзя · больше нельзя | менше не можна · більше не можна | менш нельга · больш нельга | 不能更少 · 不能更多 | no hay menos · no hay más | mniej się nie da · więcej się nie da |
| approximate (the legend) | приблизительный | приблизний | прыблізны | 近似 | aproximado | przybliżony |
| Approximate color · Made from the color family and the Finish. The real bead may look different. | Приблизительный цвет · Собран из семейства цвета и покрытия. Настоящий бисер может выглядеть иначе. | Приблизний колір · Складено з родини кольору й покриття. Справжній бісер може виглядати інакше. | Прыблізны колер · Складзены з сямейства колеру і пакрыцця. Сапраўдны бісер можа выглядаць інакш. | 近似颜色 · 由色系和表面处理生成。真实的珠子可能看起来不同。 | Color aproximado · Hecho con la familia de color y el acabado. La cuenta real puede verse distinta. | Kolor przybliżony · Powstał z rodziny koloru i wykończenia. Prawdziwy koralik może wyglądać inaczej. |
| Measured color · Read from a photo of this bead. | Измеренный цвет · Снят с фотографии этого бисера. | Виміряний колір · Знято з фотографії цього бісеру. | Вымераны колер · Зняты з фатаграфіі гэтага бісеру. | 实测颜色 · 从这种珠子的照片中读取。 | Color medido · Leído de una foto de esta cuenta. | Kolor zmierzony · Odczytany ze zdjęcia tego koralika. |
| , approximate color (added to a name) · · measured (after the family and Finish) | , приблизительный цвет · · измерен | , приблизний колір · · виміряно | , прыблізны колер · · вымерана | ，近似颜色 · · 已测量 | , color aproximado · · medido | , kolor przybliżony · · zmierzony |

## Before and after and Clean up copy (ticket 0900)

The photo helpers and Compare of DS-3 (ConvertImage card, "Before and after, and Clean up"; tickets 0906, 0907, 0908, 0909). "Clean up stray beads" and "Auto-fix lighting" keep spec 0761's names. Counts take the language's plural forms as the app's other counts do; where a language puts the number last ("Убрано одиночных бисерин: {n}") it avoids the plural. Proposals for review with the build, as with the earlier copy tables.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Auto-fix lighting (the picture section's row and its switch) | Автокоррекция освещения | Автокорекція освітлення | Аўтакарэкцыя асвятлення | 自动修正光线 | Corregir la luz automáticamente | Automatyczna korekta światła |
| More for the lighting (the sun button) | Ещё для освещения | Ще для освітлення | Яшчэ для асвятлення | 光线的更多选项 | Más opciones de la luz | Więcej dla światła |
| Lighting (the popover's title) | Освещение | Освітлення | Асвятленне | 光线 | Luz | Światło |
| What the lighting sliders do (Info) | Что делают ползунки освещения | Що роблять повзунки освітлення | Што робяць паўзункі асвятлення | 光线滑块的作用 | Qué hacen los controles de luz | Co robią suwaki światła |
| Brightness, Contrast and Saturation change the picture before it becomes beads, after Auto-fix lighting if it is on. At 0 they change nothing. (its body) | Яркость, контраст и насыщенность меняют изображение до того, как оно станет бисером, после автокоррекции освещения, если она включена. На 0 они ничего не меняют. | Яскравість, контраст і насиченість змінюють зображення до того, як воно стане бісером, після автокорекції освітлення, якщо її ввімкнено. На 0 вони нічого не змінюють. | Яркасць, кантраст і насычанасць мяняюць выяву да таго, як яна стане бісерам, пасля аўтакарэкцыі асвятлення, калі яна ўключана. На 0 яны нічога не мяняюць. | 亮度、对比度和饱和度会在图片变成珠子之前调整图片；如果打开了自动修正光线，则在它之后调整。为 0 时不做任何改变。 | Brillo, Contraste y Saturación cambian la imagen antes de que se convierta en cuentas, después de Corregir la luz si está activado. En 0 no cambian nada. | Jasność, kontrast i nasycenie zmieniają obraz, zanim stanie się koralikami, po automatycznej korekcie światła, jeśli jest włączona. Na 0 nic nie zmieniają. |
| Brightness · Contrast · Saturation | Яркость · Контраст · Насыщенность | Яскравість · Контраст · Насиченість | Яркасць · Кантраст · Насычанасць | 亮度 · 对比度 · 饱和度 | Brillo · Contraste · Saturación | Jasność · Kontrast · Nasycenie |
| darker / lighter · softer / stronger · greyer / brighter colors (the sliders' ends) | темнее / светлее · мягче / сильнее · серее / ярче цвета | темніше / світліше · м'якше / сильніше · сіріше / яскравіші кольори | цямней / святлей · мякчэй / мацней · шарэй / ярчэйшыя колеры | 更暗 / 更亮 · 更柔和 / 更强 · 更灰 / 颜色更鲜艳 | más oscuro / más claro · más suave / más fuerte · más gris / colores más vivos | ciemniej / jaśniej · łagodniej / mocniej · szarzej / żywsze kolory |
| Reset {slider} (each reset) | Сбросить: {slider} | Скинути: {slider} | Скінуць: {slider} | 重置{slider} | Restablecer {slider} | Resetuj: {slider} |
| Already at 0. (a reset's off reason) | Уже на 0. | Уже на 0. | Ужо на 0. | 已经是 0。 | Ya está en 0. | Już na 0. |
| brightness +10 · contrast +18 (the line under the switch: the moved sliders, lowercase) | яркость +10 · контраст +18 | яскравість +10 · контраст +18 | яркасць +10 · кантраст +18 | 亮度 +10 · 对比度 +18 | brillo +10 · contraste +18 | jasność +10 · kontrast +18 |
| Clean up (the popover's title; the button's name begins "Clean up: ") | Очистка | Очищення | Ачыстка | 清理 | Limpieza | Czyszczenie |
| What Clean up does (Info) | Что делает очистка | Що робить очищення | Што робіць ачыстка | 清理的作用 | Qué hace la limpieza | Co robi czyszczenie |
| Clean up stray beads gives a bead that stands alone the color most of the beads round it have, so you don't change thread for one bead. Two beads in a line stay. Small colors join gives a color used by fewer beads than the number to the nearest color, so you don't buy a tube for a few beads. (its body; the second half is the body of What Small colors join does) | «Убрать одиночные бисерины» даёт бисерине, стоящей одна, цвет, который есть у большинства бисерин вокруг, чтобы не менять нить ради одной бисерины. Две бисерины в линию остаются. «Слияние малых цветов» отдаёт цвет, которым набрано меньше бисерин, чем это число, ближайшему цвету, чтобы не покупать тубу ради нескольких бисерин. | «Прибрати поодинокі бісерини» дає бісерині, що стоїть сама, колір, який має більшість бісерин навколо, щоб не міняти нитку заради однієї бісерини. Дві бісерини в лінію лишаються. «Злиття малих кольорів» віддає колір, яким набрано менше бісерин, ніж це число, найближчому кольору, щоб не купувати тубу заради кількох бісерин. | «Прыбраць адзінкавыя бісерыны» дае бісерыне, што стаіць адна, колер, які мае большасць бісерын вакол, каб не мяняць нітку дзеля адной бісерыны. Дзве бісерыны ў лінію застаюцца. «Зліццё малых колераў» аддае колер, якім набрана менш бісерын, чым гэты лік, бліжэйшаму колеру, каб не купляць тубу дзеля некалькіх бісерын. | “清理零散珠子”让孤立的珠子取周围大多数珠子的颜色，这样就不必为一颗珠子换线。连成一行的两颗珠子会保留。“合并少量颜色”把用到的珠子少于这个数的颜色并入最接近的颜色，这样就不必为几颗珠子买一管。 | Limpiar cuentas sueltas da a una cuenta que está sola el color que tienen la mayoría de las cuentas a su alrededor, para no cambiar de hilo por una cuenta. Dos cuentas en línea se quedan. Unir colores pequeños pasa un color usado por menos cuentas que el número al color más cercano, para no comprar un tubo por unas pocas cuentas. | „Usuń pojedyncze koraliki” daje koralikowi, który stoi sam, kolor, jaki ma większość koralików wokół, by nie zmieniać nici dla jednego koralika. Dwa koraliki w linii zostają. „Łączenie małych kolorów” oddaje kolor użyty przez mniej koralików niż ta liczba najbliższemu kolorowi, by nie kupować tuby dla kilku koralików. |
| Clean up stray beads (the switch) | Убрать одиночные бисерины | Прибрати поодинокі бісерини | Прыбраць адзінкавыя бісерыны | 清理零散珠子 | Limpiar cuentas sueltas | Usuń pojedyncze koraliki |
| strength · Light · Medium · Strong | сила · Слабо · Средне · Сильно | сила · Слабко · Середньо · Сильно | сіла · Слаба · Сярэдне · Моцна | 强度 · 轻 · 中 · 强 | intensidad · Suave · Media · Fuerte | siła · Słabo · Średnio · Mocno |
| Turn on Clean up stray beads first. (the steps' off reason) | Сначала включите «Убрать одиночные бисерины». | Спершу ввімкніть «Прибрати поодинокі бісерини». | Спачатку ўключыце «Прыбраць адзінкавыя бісерыны». | 请先打开“清理零散珠子”。 | Activa primero Limpiar cuentas sueltas. | Najpierw włącz „Usuń pojedyncze koraliki”. |
| {n} stray beads cleaned · no stray beads | Убрано одиночных бисерин: {n} · одиночных бисерин нет | Прибрано поодиноких бісерин: {n} · поодиноких бісерин немає | Прыбрана адзінкавых бісерын: {n} · адзінкавых бісерын няма | 已清理 {n} 颗零散珠子 · 没有零散珠子 | {n} cuentas sueltas limpiadas · no hay cuentas sueltas | Usunięto pojedynczych koralików: {n} · brak pojedynczych koralików |
| {n} small color joined / {n} small colors joined (the button's second line) | Слито малых цветов: {n} | Злито малих кольорів: {n} | Злучана малых колераў: {n} | 已合并 {n} 种少量颜色 | {n} color pequeño unido / {n} colores pequeños unidos | Połączono małych kolorów: {n} |
| Off · {n} stray beads left | Выключено · Осталось одиночных бисерин: {n} | Вимкнено · Залишилося поодиноких бісерин: {n} | Выключана · Засталося адзінкавых бісерын: {n} | 已关闭 · 剩余 {n} 颗零散珠子 | Desactivado · Quedan {n} cuentas sueltas | Wyłączone · Zostało pojedynczych koralików: {n} |
| Off for pixel art · every pixel stays a bead | Выключено для пиксель-арта · каждый пиксель остаётся бисериной | Вимкнено для піксель-арту · кожен піксель лишається бісериною | Выключана для піксель-арту · кожны піксель застаецца бісерынай | 像素画不清理 · 每个像素都保留为一颗珠子 | Desactivado para pixel art · cada píxel sigue siendo una cuenta | Wyłączone dla pixel artu · każdy piksel zostaje koralikiem |
| pixel art · every pixel stays a bead (the popover's line) | пиксель-арт · каждый пиксель остаётся бисериной | піксель-арт · кожен піксель лишається бісериною | піксель-арт · кожны піксель застаецца бісерынай | 像素画 · 每个像素都保留为一颗珠子 | pixel art · cada píxel sigue siendo una cuenta | pixel art · każdy piksel zostaje koralikiem |
| {n} single beads kept | Оставлено одиночных бисерин: {n} | Залишено поодиноких бісерин: {n} | Пакінута адзінкавых бісерын: {n} | 保留了 {n} 颗单独的珠子 | {n} cuentas sueltas conservadas | Zachowano pojedynczych koralików: {n} |
| Small colors join · What Small colors join does (Info) | Слияние малых цветов · Что делает слияние малых цветов | Злиття малих кольорів · Що робить злиття малих кольорів | Зліццё малых колераў · Што робіць зліццё малых колераў | 合并少量颜色 · 合并少量颜色的作用 | Unir colores pequeños · Qué hace Unir colores pequeños | Łączenie małych kolorów · Co robi łączenie małych kolorów |
| under · off (the stepper's label and lowest step) | меньше · выкл. | менше · вимк. | менш · выкл. | 少于 · 关 | menos de · no | poniżej · wył. |
| Least beads a color needs · Fewer · More (the stepper's names) | Наименьшее число бисерин у цвета · Меньше · Больше | Найменша кількість бісерин у кольору · Менше · Більше | Найменшая колькасць бісерын у колеру · Менш · Больш | 每种颜色至少需要的珠子数 · 更少 · 更多 | Cuentas mínimas por color · Menos · Más | Najmniej koralików na kolor · Mniej · Więcej |
| {n} color joined · {m} beads / {n} colors joined · {m} beads | Слито цветов: {n} · бисерин: {m} | Злито кольорів: {n} · бісерин: {m} | Злучана колераў: {n} · бісерын: {m} | 已合并 {n} 种颜色 · {m} 颗珠子 | {n} color unido · {m} cuentas / {n} colores unidos · {m} cuentas | Połączono kolorów: {n} · koralików: {m} |
| every color stays | все цвета остаются | усі кольори лишаються | усе колеры застаюцца | 所有颜色都保留 | se quedan todos los colores | wszystkie kolory zostają |
| picture · beads (the chips over Compare's halves) | изображение · бисер | зображення · бісер | выява · бісер | 图片 · 珠子 | imagen · cuentas | obraz · koraliki |
| Show the picture beside the beads. Hold to see it in their place. (Compare's Tooltip, wide) | Показать изображение рядом с бисером. Удерживайте, чтобы увидеть его на месте бисера. | Показати зображення поруч із бісером. Утримуйте, щоб побачити його на місці бісеру. | Паказаць выяву побач з бісерам. Утрымлівайце, каб убачыць яе на месцы бісеру. | 在珠子旁显示图片。按住可在珠子的位置查看图片。 | Muestra la imagen junto a las cuentas. Mantén pulsado para verla en su lugar. | Pokaż obraz obok koralików. Przytrzymaj, by zobaczyć go w ich miejscu. |
| Beads · Picture · Show (the narrow bar's choices and their group) | Бисер · Изображение · Показать | Бісер · Зображення · Показати | Бісер · Выява · Паказаць | 珠子 · 图片 · 显示 | Cuentas · Imagen · Mostrar | Koraliki · Obraz · Pokaż |
| picture · let go to see the beads (changed from "original picture · let go to see the beads") | изображение · отпустите, чтобы увидеть бисер | зображення · відпустіть, щоб побачити бісер | выява · адпусціце, каб убачыць бісер | 图片 · 松开即可看到珠子 | imagen · suelta para ver las cuentas | obraz · puść, by zobaczyć koraliki |
| The picture and the beads side by side: {grid} beads, {colors} · The picture as it becomes beads (the preview's names) | Изображение и бисер рядом: {grid} бисерин, {colors} · Изображение, из которого получается бисер | Зображення і бісер поруч: {grid} бісерин, {colors} · Зображення, з якого виходить бісер | Выява і бісер побач: {grid} бісерын, {colors} · Выява, з якой атрымліваецца бісер | 图片和珠子并排：{grid} 颗珠子，{colors} · 将变成珠子的图片 | La imagen y las cuentas lado a lado: {grid} cuentas, {colors} · La imagen tal como se convierte en cuentas | Obraz i koraliki obok siebie: {grid} koralików, {colors} · Obraz, z którego powstają koraliki |

## Converter on a phone copy (ticket 0910)

The converter on a phone and a portrait tablet (DS-4; ConvertImage card, "On a phone and a tablet"; tickets 0911 and 0919). Every other string on these screens is DS-1's, DS-2's or DS-3's as they are. The five settings' names keep to 9 letters in every language, so they fit a fifth of a 360 px page under their icon (Russian "Картинка", not "Изображение"). English is from the design; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Picture (the setting, and the Picture sheet's title) | Картинка | Картинка | Выява | 图片 | Imagen | Obraz |
| Bead (the setting; its sheet keeps "Bead and Technique") | Бисер | Бісер | Бісер | 珠子 | Cuenta | Koralik |
| {setting}: {value} (each setting's accessible name, "Width: 60 beads") | {setting}: {value} | {setting}: {value} | {setting}: {value} | {setting}：{value} | {setting}: {value} | {setting}: {value} |
| {w}×{h} beads · {cm} · {n} colors (the phone dock's first line: DS-1's first two result lines joined) | {w}×{h} бисерин · {cm} · цветов: {n} | {w}×{h} бісерин · {cm} · кольорів: {n} | {w}×{h} бісерын · {cm} · колераў: {n} | {w}×{h} 颗珠子 · {cm} · {n} 种颜色 | {w}×{h} cuentas · {cm} · {n} colores | {w}×{h} koralików · {cm} · kolorów: {n} |
| brand · type · size · technique · drop (labels above the pickers in the Bead and Technique sheet: the New Project form's own names, lowercased by style) | бренд · тип · размер · техника плетения · дроп | бренд · тип · розмір · техніка плетіння · дроп | брэнд · тып · памер · тэхніка пляцення · дроп | 品牌 · 类型 · 尺寸 · 编织技法 · 每针珠数 | marca · tipo · tamaño · técnica · drop | marka · typ · rozmiar · technika · drop |
| Back to the number of colors (the Colors list's back arrow) | Назад к числу цветов | Назад до кількості кольорів | Назад да колькасці колераў | 返回颜色数量 | Volver al número de colores | Wróć do liczby kolorów |

Left out under 600 px wide, in every language (no new words): the strip's "Convert image" (the page's accessible name keeps it), the words of the bar's Background and Make empty (their accessible names and Tooltips keep them), DS-1's "project · {name}" line, DS-2's "type a number" (the field is "Number of colors") and DS-1's "goes where the picture lies on the Canvas" (Add to Canvas's Tooltip instead). "tap or drag over beads to keep them or take them away" moves from the Background sheet into the tool's chip on the beads, unchanged.

## Margin sheet copy (ticket 0655)

The Frame's margin as a drafting sheet (MarginSheet card). The tools on the sheet keep their existing names, Tooltips and confirmations (Rotate Frame, Edit Frame, Export, Remove Frame, Move Frame, Row done, Row not done, Turn row direction, Reset progress, Row highlight, Letters, Technique, by {maker}, Name this Frame, Your name, Custom color). The margin is "поля" in Russian and Ukrainian, as the margins of a sheet of paper, and "margines" in Polish. Belarusian, Spanish and Chinese are written with the build (tickets 0656 to 0658).

| English | Русский | Українська | Polski |
|---|---|---|---|
| margin (the Frame panel's section) · auto (its summary) | поля · авто | поля · авто | margines · auto |
| Margin color (picker, button and Tooltip) · margin color (popover label) | Цвет полей · цвет полей | Колір полів · колір полів | Kolor marginesu · kolor marginesu |
| Auto · Auto, one step off the Canvas color (its accessible name) | Авто · Авто, на шаг от цвета холста | Авто · Авто, на крок від кольору полотна | Auto · Auto, o krok od koloru płótna |
| {color}, the Canvas color (the swatch equal to it) | {color}, цвет холста | {color}, колір полотна | {color}, kolor płótna |
| Name and size on the margin | Имя и размер на полях | Назва й розмір на полях | Nazwa i rozmiar na marginesie |
| The margin is 4 beads on every side. Nothing can be placed in it, and exports never show it. | Поля — 4 бисеринки с каждой стороны. На них ничего нельзя поставить, и в экспорт они не попадают. | Поля — 4 бісеринки з кожного боку. На них нічого не можна поставити, і в експорт вони не потрапляють. | Margines ma 4 koraliki z każdej strony. Nie można na nim nic umieścić i nie trafia do eksportu. |
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

The Russian and Ukrainian line is built without the dash ("Поля шириной 4 бисеринки…", "Поля завширшки 4 бісеринки…"): the Russian file uses no em dash.

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
| If the browser's data is cleared, they go with it. Save a Project file of each one you don't want to lose: (welcome; two lines, broken after the first sentence in every language, ticket 0839; "Project file" since ticket 0859) | Если данные браузера очистятся, проекты исчезнут вместе с ними. Сохраните файл проекта для каждого, который вам дорог: | Якщо дані браузера очистяться, проєкти зникнуть разом із ними. Збережіть файл проєкту для кожного, який вам дорогий: | Калі даныя браўзера ачысцяцца, праекты знікнуць разам з імі. Захавайце файл праекта для кожнага, які вам дарагі: | 浏览器数据一旦被清除，项目也会随之消失。请为每个不想丢失的项目保存项目文件： | Si se borran los datos del navegador, se van con ellos. Guarda un archivo de proyecto de cada uno que no quieras perder: | Jeśli dane przeglądarki zostaną wyczyszczone, znikną razem z nimi. Zapisz plik projektu każdego, którego nie chcesz stracić: |

English was approved on the canvas "openbeads first-run: decluttered welcome" (board A), the captions of which are gone (ticket 0798); the other languages are proposals for review with the build. The welcome's two lines are ticket 0795's: they say the risk of losing a Project plainly, as a fact and what to do about it, without alarm words ("without warning", "delete").

## A Project that won't open copy (ticket 0716)

The notice row after a load that found the safe start's note still set (Message card, warning tone), the question before a Project over the size gate opens (ConfirmDialogs card), the Projects library's rows for a sealed Project and a count not yet in (MenuPanel card), and the Homepage's second button, which is the Menu row's own name and the count ("Projects library · 3"), so it needs no string of its own. The size warning gives the count in millions: Russian, Ukrainian, Belarusian and Polish write «млн» / "mln", which takes no plural form after a number.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| “{name}” didn't open last time. | Проект «{name}» не открылся в прошлый раз. | Проєкт «{name}» не відкрився минулого разу. | Праект «{name}» не адкрыўся ў мінулы раз. | “{name}”上次没有打开。 | «{name}» no se abrió la última vez. | Projekt „{name}” nie otworzył się ostatnim razem. |
| Remove · Save Project file (the Project panel's own words since ticket 0859) | Удалить · Сохранить файл проекта | Видалити · Зберегти файл проєкту | Выдаліць · Захаваць файл праекта | 移除 · 保存项目文件 | Quitar · Guardar archivo de proyecto | Usuń · Zapisz plik projektu |
| Open “{name}”? | Открыть «{name}»? | Відкрити «{name}»? | Адкрыць «{name}»? | 打开“{name}”？ | ¿Abrir «{name}»? | Otworzyć „{name}”? |
| {count} million beads. Opening may be slow or fail. | {count} млн бисеринок. Открытие может быть медленным или не удаться. | {count} млн бісеринок. Відкриття може бути повільним або не вдатися. | {count} млн бісерынак. Адкрыццё можа быць павольным або не атрымацца. | {count} 百万颗珠子。打开可能很慢或失败。 | {count} millones de cuentas. Abrirlo puede ser lento o fallar. | {count} mln koralików. Otwieranie może być wolne lub się nie udać. |
| Open anyway · Cancel | Всё равно открыть · Отмена | Однаково відкрити · Скасувати | Усё адно адкрыць · Скасаваць | 仍然打开 · 取消 | Abrir igualmente · Cancelar | Otwórz mimo to · Anuluj |
| too big to count | слишком много, чтобы посчитать | забагато, щоб порахувати | зашмат, каб палічыць | 太多，无法计数 | demasiado para contar | za dużo, by policzyć |
| Counting pieces | Считаем части | Рахуємо частини | Лічым часткі | 正在计数小块 | Contando trozos | Liczenie kawałków |
| {count} beads | {count} бисеринка / бисеринки / бисеринок | {count} бісеринка / бісеринки / бісеринок | {count} бісерынка / бісерынкі / бісерынак | {count} 颗珠子 | {count} cuenta / cuentas | {count} koralik / koraliki / koralików |
| made {created} · saved {saved} | создан {created} · сохранён {saved} | створено {created} · збережено {saved} | створаны {created} · захаваны {saved} | 创建于 {created} · 保存于 {saved} | creado {created} · guardado {saved} | utworzono {created} · zapisano {saved} |

Russian, Ukrainian, Belarusian, Spanish, Polish and Chinese are proposals for review with the build.

## Reference image copy (ticket 0790)

The Project's one picture to bead over (ReferenceImage card). Russian and Ukrainian call it the underlay a tracer puts under the paper, «подложка» and «підкладка»; Polish «obraz pomocniczy». The Canvas is «холст» / «полотно» / «płótno» (ADR 0050; Russian since ticket 0864). Belarusian, Spanish and Chinese were written with the build, below the first table; all are draft words, to be checked by a speaker of each.

| English | Русский | Українська | Polski |
|---|---|---|---|
| Reference image (strip button name) | Подложка | Підкладка | Obraz pomocniczy |
| Add a reference image (Tooltip) · Add reference image (Project row) | Добавить подложку | Додати підкладку | Dodaj obraz pomocniczy |
| Show reference image · Hide reference image | Показать подложку · Скрыть подложку | Показати підкладку · Сховати підкладку | Pokaż obraz pomocniczy · Ukryj obraz pomocniczy |
| reference image (section) · shown · hidden (its summary) | подложка · видна · скрыта | підкладка · видно · сховано | obraz pomocniczy · widoczny · ukryty |
| PNG, JPEG, GIF or WebP, up to 10 MB. Kept with this Project and in its .openbeads file, never printed. Large pictures are made smaller to fit. | PNG, JPEG, GIF или WebP, до 10 МБ. Хранится с этим проектом и в его файле .openbeads, не печатается. Большие картинки уменьшаются. | PNG, JPEG, GIF або WebP, до 10 МБ. Зберігається з цим проєктом і в його файлі .openbeads, не друкується. Великі зображення зменшуються. | PNG, JPEG, GIF lub WebP, do 10 MB. Zapisany z tym projektem i w jego pliku .openbeads, nigdy nie drukowany. Duże obrazy są zmniejszane. |
| Opacity | Непрозрачность | Непрозорість | Krycie |
| Adjust on Canvas · move · resize · turn | Настроить на полотне · сдвиг · размер · поворот | Налаштувати на полотні · зсув · розмір · поворот | Dopasuj na płótnie · przesuń · rozmiar · obróć |
| Replace image · Remove image (Replace image also on the Adjust bar, ticket 0799; on a phone the name of its icon button) | Заменить картинку · Убрать картинку | Замінити зображення · Прибрати зображення | Zamień obraz · Usuń obraz |
| Remove the reference image? · The picture is taken off this Project. Your beads stay as they are. · Remove | Убрать подложку? · Картинка будет убрана из проекта. Бисеринки останутся как есть. · Убрать | Прибрати підкладку? · Зображення буде прибрано з проєкту. Бісеринки залишаться як є. · Прибрати | Usunąć obraz pomocniczy? · Obraz zostanie usunięty z projektu. Koraliki zostaną bez zmian. · Usuń |
| This file can't be used: {reason} | Этот файл не подходит: {reason} | Цей файл не підходить: {reason} | Tego pliku nie można użyć: {reason} |
| Preparing the picture… | Готовим картинку… | Готуємо зображення… | Przygotowujemy obraz… |
| Fit to Canvas · Fit (phone) · Done | Вписать в холст · Вписать · Готово | Вписати в полотно · Вписати · Готово | Dopasuj do płótna · Dopasuj · Gotowe |
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
| Adjust on Canvas · move · resize · turn | Наладзіць на палатне · зрух · памер · паварот | Ajustar en el lienzo · mover · tamaño · girar | 在画布上调整 · 移动 · 缩放 · 旋转 |
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

### The picture bar, Set Frame around the picture and Convert to beads (ticket 0883)

The picture bar on the reference image and its two actions (ReferenceImage card). "match to", "Colors", the Note under Exact and "Preview: {size} beads, {colors} colors" are Convert image's own strings, reused. Draft words, written with the design, to be checked by a speaker of each. Counted words give their plural forms (one / few / many).

| English | Русский | Українська | Polski |
|---|---|---|---|
| Move the picture · Drag to move the reference image. (the Move grip's name and Tooltip) | Сдвинуть картинку · Перетащите, чтобы сдвинуть подложку. | Зсунути зображення · Перетягніть, щоб зсунути підкладку. | Przesuń obraz · Przeciągnij, aby przesunąć obraz pomocniczy. |
| More for the picture · Close (··· and its pressed face) | Ещё для картинки · Закрыть | Ще для зображення · Закрити | Więcej dla obrazu · Zamknij |
| Replace · Remove (the bar's short labels) | Заменить · Убрать | Замінити · Прибрати | Zamień · Usuń |
| Set Frame around the picture (name and Tooltip) | Рамка вокруг картинки | Рамка навколо зображення | Ramka wokół obrazu |
| A {size} Frame where the picture lies. Replaces the Frame you have. · A {size} Frame where the picture lies. | Рамка {size} там, где лежит картинка. Заменит вашу рамку. · Рамка {size} там, где лежит картинка. | Рамка {size} там, де лежить зображення. Замінить вашу рамку. · Рамка {size} там, де лежить зображення. | Ramka {size} tam, gdzie leży obraz. Zastąpi Twoją ramkę. · Ramka {size} tam, gdzie leży obraz. |
| new Frame · {size} (the preview's tag) | новая рамка · {size} | нова рамка · {size} | nowa ramka · {size} |
| {size} beads · ≈ {measure} · shape kept (the resize chip; {size} is a Grid size, "28×19", {measure} the Bead's measure, "4.2 × 2.9 cm", in mm under a centimetre as every estimate is) | {size} бисеринок · ≈ {measure} · пропорции сохранены | {size} бісеринок · ≈ {measure} · пропорції збережено | {size} koralików · ≈ {measure} · proporcje zachowane |
| Convert to beads (name, Tooltip, popover title, Undo step) | Перевести в бисер | Перетворити на бісер | Zamień na koraliki |
| Turns the picture into {size} beads, the size it has on the Canvas, in its own colors. | Делает из картинки бисер {size}, по её размеру на холсте, в её собственных цветах. | Робить із зображення бісер {size}, за його розміром на полотні, у його власних кольорах. | Zamienia obraz na koraliki {size}, w rozmiarze, jaki ma na płótnie, w jego własnych kolorach. |
| size · Where the size comes from · The picture's size on the Canvas. Drag a corner of the picture to change it. | размер · Откуда размер · Размер картинки на холсте. Потяните за угол картинки, чтобы его изменить. | розмір · Звідки розмір · Розмір зображення на полотні. Потягніть за кут зображення, щоб його змінити. | rozmiar · Skąd ten rozmiar · Rozmiar obrazu na płótnie. Przeciągnij róg obrazu, aby go zmienić. |
| {count} of {max} (the colors' count) | {count} из {max} | {count} з {max} | {count} z {max} |
| One color fewer · One color more (the Colors stepper's − and +, written with the build) | На один цвет меньше · На один цвет больше | На один колір менше · На один колір більше | O jeden kolor mniej · O jeden kolor więcej |
| Hide the picture after | Потом скрыть картинку | Потім сховати зображення | Potem ukryj obraz |
| All settings · Add to Canvas (Convert image's last button when opened from here) | Все настройки · Добавить на холст | Усі налаштування · Додати на полотно | Wszystkie ustawienia · Dodaj na płótno |
| Convert {n} beads (one: Convert {n} bead) | Перевести {n} бисеринку / бисеринки / бисеринок | Перетворити {n} бісеринку / бісеринки / бісеринок | Zamień {n} koralik / koraliki / koralików |
| Replaces {n} beads already there. | Заменит {n} бисеринку / бисеринки / бисеринок, которые уже там. | Замінить {n} бісеринку / бісеринки / бісеринок, що вже там. | Zastąpi {n} koralik / koraliki / koralików, które już tam są. |
| preview (the preview's pill) | превью | перегляд | podgląd |
| {n} beads made from the picture, {colors} colors. (one color: "…, 1 color."; Spanish likewise "1 color.") · The picture is hidden: show it from the Canvas strip. · Undo | Из картинки сделано бисеринок: {n}, цветов: {colors}. · Картинка скрыта: показать её можно на панели холста. · Отменить | Із зображення зроблено бісеринок: {n}, кольорів: {colors}. · Зображення сховано: показати його можна на панелі полотна. · Скасувати | Z obrazu zrobiono koralików: {n}, kolorów: {colors}. · Obraz jest ukryty: pokaż go z paska płótna. · Cofnij |
| The picture is too small to bead. Make it bigger first. · Too big to convert here. Use Convert image. (why Convert to beads is off) | Картинка слишком мала для бисера. Сначала увеличьте её. · Слишком большая для этого. Используйте «Из картинки». | Зображення замале для бісеру. Спершу збільште його. · Завелике для цього. Скористайтеся «З картинки». | Obraz jest za mały na koraliki. Najpierw go powiększ. · Za duży, by zamienić go tutaj. Użyj „Konwertuj obraz”. |

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Move the picture · Drag to move the reference image. | Зрушыць выяву · Перацягніце, каб зрушыць падкладку. | Mover la imagen · Arrastra para mover la imagen de referencia. | 移动图片 · 拖动以移动参考图。 |
| More for the picture · Close | Яшчэ для выявы · Закрыць | Más opciones de la imagen · Cerrar | 图片的更多操作 · 关闭 |
| Replace · Remove | Замяніць · Прыбраць | Reemplazar · Quitar | 替换 · 移除 |
| Set Frame around the picture | Рамка вакол выявы | Marco alrededor de la imagen | 给图片加画框 |
| A {size} Frame where the picture lies. Replaces the Frame you have. · A {size} Frame where the picture lies. | Рамка {size} там, дзе ляжыць выява. Заменіць вашу рамку. · Рамка {size} там, дзе ляжыць выява. | Un marco de {size} donde está la imagen. Sustituye tu marco actual. · Un marco de {size} donde está la imagen. | 在图片所在处放一个 {size} 的画框。会替换你现有的画框。 · 在图片所在处放一个 {size} 的画框。 |
| new Frame · {size} | новая рамка · {size} | marco nuevo · {size} | 新画框 · {size} |
| {size} beads · ≈ {measure} · shape kept | {size} бісерын · ≈ {measure} · прапорцыі захаваны | {size} cuentas · ≈ {measure} · forma mantenida | {size} 颗珠子 · ≈ {measure} · 保持比例 |
| Convert to beads | Перавесці ў бісер | Convertir en cuentas | 转换为珠子 |
| Turns the picture into {size} beads, the size it has on the Canvas, in its own colors. | Робіць з выявы бісер {size}, па яе памеры на палатне, у яе ўласных колерах. | Convierte la imagen en {size} cuentas, al tamaño que tiene en el lienzo, con sus propios colores. | 按图片在画布上的大小，用它自己的颜色，把它变成 {size} 的珠子。 |
| size · Where the size comes from · The picture's size on the Canvas. Drag a corner of the picture to change it. | памер · Адкуль памер · Памер выявы на палатне. Пацягніце за кут выявы, каб яго змяніць. | tamaño · De dónde sale el tamaño · El tamaño de la imagen en el lienzo. Arrastra una esquina de la imagen para cambiarlo. | 尺寸 · 尺寸从哪里来 · 图片在画布上的大小。拖动图片的一角来更改。 |
| {count} of {max} | {count} з {max} | {count} de {max} | {count} / {max} |
| One color fewer · One color more | На адзін колер менш · На адзін колер больш | Un color menos · Un color más | 少一种颜色 · 多一种颜色 |
| Hide the picture after | Потым схаваць выяву | Ocultar la imagen después | 之后隐藏图片 |
| All settings · Add to Canvas | Усе налады · Дадаць на палатно | Todos los ajustes · Añadir al lienzo | 全部设置 · 添加到画布 |
| Convert {n} beads | Перавесці {n} бісерыну / бісерыны / бісерын | Convertir {n} cuenta / cuentas | 转换 {n} 颗珠子 |
| Replaces {n} beads already there. | Заменіць {n} бісерыну / бісерыны / бісерын, што ўжо там. | Sustituye {n} cuenta / cuentas que ya hay ahí. | 将替换那里已有的 {n} 颗珠子。 |
| preview | папярэдні прагляд | vista previa | 预览 |
| {n} beads made from the picture, {colors} colors. · The picture is hidden: show it from the Canvas strip. · Undo | З выявы зроблена бісерын: {n}, колераў: {colors}. · Выява схавана: паказаць яе можна на панэлі палатна. · Адмяніць | {n} cuentas hechas con la imagen, {colors} colores. · La imagen está oculta: muéstrala desde la barra del lienzo. · Deshacer | 已用图片做出 {n} 颗珠子，{colors} 种颜色。 · 图片已隐藏：可在画布栏中显示。 · 撤销 |
| The picture is too small to bead. Make it bigger first. · Too big to convert here. Use Convert image. | Выява занадта малая для бісеру. Спачатку павялічце яе. · Занадта вялікая для гэтага. Скарыстайцеся «З малюнка». | La imagen es demasiado pequeña para cuentas. Hazla más grande primero. · Demasiado grande para convertirla aquí. Usa Convertir imagen. | 图片太小，无法做成珠子。请先放大。 · 太大，无法在这里转换。请使用“转换图片”。 |

## Save reminder copy (ticket 0796)

The ring at the drawing area's top-right that offers to save a Project file (SaveReminder card). The words stay calm: they say where the work is and what keeps it, never "lost" or "deleted". "Beads since last file: {count}" is a Label: number, so no plural is needed; the button's accessible name is "Save Project file" (ticket 0859; it was "Save a copy") with the count line as its description for the same reason. `{when}` is `Intl.RelativeTimeFormat` with `numeric: "auto"` in the app's language. Every language but English and Russian is a draft, to be checked by a speaker.

| English | Русский | Українська | Polski |
|---|---|---|---|
| Save Project file (label, Tooltip name, accessible name) | Сохранить файл проекта | Зберегти файл проєкту | Zapisz plik projektu |
| The browser keeps your work but can clear it. A Project file stays. (Tooltip body) | Браузер хранит работу, но может её очистить. Файл проекта останется. | Браузер зберігає роботу, але може її очистити. Файл проєкту залишиться. | Przeglądarka przechowuje twoją pracę, ale może ją wyczyścić. Plik projektu zostanie. |
| Beads since last file: {count} | Бисеринок с последнего файла: {count} | Бісеринок з останнього файлу: {count} | Koralików od ostatniego pliku: {count} |
| Last file: {when} · No Project file yet | Последний файл: {when} · Файла проекта ещё нет | Останній файл: {when} · Файлу проєкту ще немає | Ostatni plik: {when} · Nie ma jeszcze pliku projektu |
| Beads since last file: {count}. Save a Project file to keep them. (live region) | Бисеринок с последнего файла: {count}. Сохраните файл проекта, чтобы они остались. | Бісеринок з останнього файлу: {count}. Збережіть файл проєкту, щоб вони залишилися. | Koralików od ostatniego pliku: {count}. Zapisz plik projektu, żeby je zachować. |
| Saved: {file} (toast) | Сохранено: {file} | Збережено: {file} | Zapisano: {file} |
| Save Project file · Save Project file as… (Project panel rows, the Save and Save as actions; they replace the row "Project file") | Сохранить файл проекта · Сохранить файл проекта как… | Зберегти файл проєкту · Зберегти файл проєкту як… | Zapisz plik projektu · Zapisz plik projektu jako… |
| {count} beads since the last file (the label's count, a counted word, ticket 0858; one: {count} bead since the last file) | {count} бисеринка / бисеринки / бисеринок с последнего файла | {count} бісеринка / бісеринки / бісеринок з останнього файлу | {count} koralik / koraliki / koralików od ostatniego pliku |
| Project: {name} (the strip's Project button, its accessible name and Tooltip name, ticket 0858) | Проект: {name} | Проєкт: {name} | Projekt: {name} |

| English | Беларуская | Español | 中文 |
|---|---|---|---|
| Save Project file | Захаваць файл праекта | Guardar archivo de proyecto | 保存项目文件 |
| The browser keeps your work but can clear it. A Project file stays. | Браўзер захоўвае працу, але можа яе ачысціць. Файл праекта застанецца. | El navegador guarda tu trabajo, pero puede borrarlo. Un archivo de proyecto se queda. | 浏览器会保存你的作品，但可能会清除它。项目文件会一直保留。 |
| Beads since last file: {count} | Бісерын з апошняга файла: {count} | Cuentas desde el último archivo: {count} | 自上次保存文件后的珠子：{count} |
| Last file: {when} · No Project file yet | Апошні файл: {when} · Файла праекта яшчэ няма | Último archivo: {when} · Aún no hay archivo de proyecto | 上次文件：{when} · 还没有项目文件 |
| Beads since last file: {count}. Save a Project file to keep them. | Бісерын з апошняга файла: {count}. Захавайце файл праекта, каб яны засталіся. | Cuentas desde el último archivo: {count}. Guarda un archivo de proyecto para conservarlas. | 自上次保存文件后的珠子：{count}。保存项目文件以留住它们。 |
| Saved: {file} | Захавана: {file} | Guardado: {file} | 已保存：{file} |
| Save Project file · Save Project file as… | Захаваць файл праекта · Захаваць файл праекта як… | Guardar archivo de proyecto · Guardar archivo de proyecto como… | 保存项目文件 · 项目文件另存为… |
| {count} beads since the last file | {count} бісерынка / бісерынкі / бісерынак з апошняга файла | {count} cuenta / cuentas / de cuentas desde el último archivo | 自上次文件后 {count} 颗珠子 |
| Project: {name} | Праект: {name} | Proyecto: {name} | 项目：{name} |

## Keep Projects copy (ticket 0839)

The Keep note (glossary), asked at the first Project file or export, and the browser's answer said back (Message card), with the Menu row that asks again (MenuPanel card). "Not now" says the question can come back from the Menu; "Skip" read as "don't keep my Projects". The Message's button reuses the Project panel's "Save Project file".

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Ask the browser to keep your Projects? (title) | Попросить браузер хранить ваши проекты? | Попросити браузер зберігати ваші проєкти? | Папрасіць браўзер захоўваць вашы праекты? | 请浏览器保留你的项目？ | ¿Pedir al navegador que conserve tus proyectos? | Poprosić przeglądarkę o zachowanie projektów? |
| When the device runs short on space, the browser can clear this app's data. If the browser asks, choose Allow. | Когда на устройстве мало места, браузер может удалить данные этого приложения. Если браузер спросит, выберите «Разрешить». | Коли на пристрої бракує місця, браузер може видалити дані цього застосунку. Якщо браузер запитає, виберіть «Дозволити». | Калі на прыладзе мала месца, браўзер можа выдаліць даныя гэтай праграмы. Калі браўзер спытае, абярыце «Дазволіць». | 设备空间不足时，浏览器可能会清除此应用的数据。如果浏览器询问，请选择允许。 | Cuando el dispositivo se queda sin espacio, el navegador puede borrar los datos de esta app. Si el navegador pregunta, elige Permitir. | Gdy na urządzeniu brakuje miejsca, przeglądarka może usunąć dane tej aplikacji. Jeśli przeglądarka zapyta, wybierz Zezwól. |
| Not now · Keep Projects | Не сейчас · Хранить проекты | Не зараз · Зберігати проєкти | Не зараз · Захоўваць праекты | 以后再说 · 保留项目 | Ahora no · Conservar proyectos | Nie teraz · Zachowaj projekty |
| This browser will keep your Projects. (toast) | Этот браузер будет хранить ваши проекты. | Цей браузер зберігатиме ваші проєкти. | Гэты браўзер будзе захоўваць вашы праекты. | 此浏览器会保留你的项目。 | Este navegador conservará tus proyectos. | Ta przeglądarka zachowa Twoje projekty. |
| The browser didn't agree to keep Projects. Save a Project file of each one you care about. (Message) | Браузер не согласился хранить проекты. Сохраните файл проекта для каждого, который вам дорог. | Браузер не погодився зберігати проєкти. Збережіть файл проєкту для кожного, який вам дорогий. | Браўзер не пагадзіўся захоўваць праекты. Захавайце файл праекта для кожнага, які вам дарагі. | 浏览器未同意保留项目。请为每个你在意的项目保存项目文件。 | El navegador no aceptó conservar los proyectos. Guarda un archivo de proyecto de cada uno que te importe. | Przeglądarka nie zgodziła się zachować projektów. Zapisz plik projektu każdego, na którym Ci zależy. |
| Keep Projects on this device · On · Off (Menu row and its value) | Хранить проекты на устройстве · Вкл · Выкл | Зберігати проєкти на пристрої · Увімк. · Вимк. | Захоўваць праекты на прыладзе · Укл. · Выкл. | 在此设备上保留项目 · 开 · 关 | Conservar proyectos en el dispositivo · Sí · No | Zachowaj projekty na urządzeniu · Wł. · Wył. |

English follows the audit's proposal (F-05-06, F-05-07); the other languages are proposals for review with the build.

## Field placeholders copy (ticket 0854)

What an empty field says goes in it (TextField card, Placeholder, value and limit): a few words, no full stop, never a value. The maker's name reuses "Your name" (the Bead Master placeholder is gone), the colour's hex its label "Hex color", the Bead colors search "Find a code or color". `{max}` is the name limit, 40.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Project name (Rename, Duplicate) | Название проекта | Назва проєкту | Назва праекта | 项目名称 | Nombre del proyecto | Nazwa projektu |
| Frame name | Название рамки | Назва рамки | Назва рамкі | 边框名称 | Nombre del marco | Nazwa ramki |
| Piece name | Название кусочка | Назва шматочка | Назва кавалачка | 小块名称 | Nombre del trozo | Nazwa kawałka |
| Your message (Feedback: Message) | Ваше сообщение | Ваше повідомлення | Ваша паведамленне | 你的留言 | Tu mensaje | Twoja wiadomość |
| The words as the app shows them (Text as shown) | Слова, как их показывает приложение | Слова, як їх показує застосунок | Словы, як іх паказвае праграма | 应用中显示的文字 | El texto tal como lo muestra la app | Tekst tak, jak pokazuje go aplikacja |
| The words it should use (Should say) | Как должно быть написано | Як має бути написано | Як павінна быць напісана | 应该写成什么 | Lo que debería decir | Jak powinno być |
| Catalog code (Code) | Код по каталогу | Код за каталогом | Код па каталогу | 目录编号 | Código del catálogo | Kod z katalogu |
| A color name or a hex (Looks like) | Название цвета или HEX | Назва кольору або HEX | Назва колеру або HEX | 颜色名称或十六进制值 | Nombre del color o hexadecimal | Nazwa koloru lub kod szesnastkowy |
| Anything else (Note) | Что-нибудь ещё | Щось іще | Нешта яшчэ | 其他补充 | Algo más | Coś jeszcze |
| Your email (Email) | Ваша эл. почта | Ваша ел. пошта | Ваша эл. пошта | 你的电子邮件 | Tu correo | Twój e-mail |
| Use {max} characters or fewer. (a name edited in place, refused) | Не больше {max} символов. | Не більше {max} символів. | Не больш за {max} сімвалаў. | 最多 {max} 个字符。 | Usa {max} caracteres o menos. | Użyj najwyżej {max} znaków. |

English follows the audit's proposal (F-01-28, F-05-18); the other languages are proposals for review with the build.

## Project file copy (ticket 0859)

The file that holds a Project has one name, **Project file**: "Save Project file" takes it out of the app and "Open Project file" brings it in, in every button, row, dialog and toast; the row for every Project takes the same words. "Export" is the PNG and the PDF only. Every file that reaches the device, Project file, PNG or PDF, says so in one toast naming it (Message card); a file that won't open says what it is and what to do (ImportResult card). English follows the audit (F-05-08, F-05-14, F-05-15, F-02-08); the other languages are proposals for review with the build. Russian, Ukrainian, Belarusian, Spanish and Polish say "all" without "Projects" in the row for every Project («Сохранить всё в файл проекта», "Guardar todo en un archivo de proyecto"), so it stays one line on a 320px phone.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Open Project file (Projects library row, the empty Canvas's icon) | Открыть файл проекта | Відкрити файл проєкту | Адкрыць файл праекта | 打开项目文件 | Abrir archivo de proyecto | Otwórz plik projektu |
| Save all Projects to a Project file (Projects library row) | Сохранить всё в файл проекта | Зберегти все у файл проєкту | Захаваць усё ў файл праекта | 将所有项目保存到项目文件 | Guardar todo en un archivo de proyecto | Zapisz wszystko w pliku projektu |
| Projects added: {count} (Open's result) | Проектов добавлено: {count} | Проєктів додано: {count} | Праектаў дададзена: {count} | 已添加的项目：{count} | Proyectos añadidos: {count} | Dodane projekty: {count} |
| This isn't a Project file. Choose a file ending in .openbeads. | Это не файл проекта. Выберите файл, который заканчивается на .openbeads. | Це не файл проєкту. Виберіть файл, що закінчується на .openbeads. | Гэта не файл праекта. Выберыце файл, які заканчваецца на .openbeads. | 这不是项目文件。请选择以 .openbeads 结尾的文件。 | Esto no es un archivo de proyecto. Elige un archivo que termine en .openbeads. | To nie jest plik projektu. Wybierz plik z końcówką .openbeads. |
| This is a picture. Use Convert image to turn it into beads. | Это картинка. Чтобы превратить её в бисер, воспользуйтесь «Из картинки». | Це картинка. Щоб перетворити її на бісер, скористайтеся «З картинки». | Гэта малюнак. Каб ператварыць яго ў бісер, скарыстайцеся «З малюнка». | 这是一张图片。用“转换图片”把它变成珠子。 | Esto es una imagen. Usa Convertir imagen para convertirla en cuentas. | To jest obraz. Użyj „Konwertuj obraz”, aby zamienić go na koraliki. |
| This Project file is damaged and can't be opened. | Этот файл проекта повреждён, его не удаётся открыть. | Цей файл проєкту пошкоджено, його не вдається відкрити. | Гэты файл праекта пашкоджаны, яго не ўдаецца адкрыць. | 此项目文件已损坏，无法打开。 | Este archivo de proyecto está dañado y no se puede abrir. | Ten plik projektu jest uszkodzony i nie da się go otworzyć. |
| Saved: {file} (the one saved-file toast; it replaces PNG ready, PDF ready and File ready) | Сохранено: {file} | Збережено: {file} | Захавана: {file} | 已保存：{file} | Guardado: {file} | Zapisano: {file} |
| Ready to save: {file} · Save (a share that needs a fresh tap) | Готов к сохранению: {file} · Сохранить | Готовий до збереження: {file} · Зберегти | Гатовы да захавання: {file} · Захаваць | 可以保存：{file} · 保存 | Listo para guardar: {file} · Guardar | Gotowy do zapisania: {file} · Zapisz |
| Make one with New Project, open one from the Projects library, or open a Project file. (empty Canvas) | Создайте его кнопкой «Новый проект», откройте проект из библиотеки проектов или из файла проекта. | Створіть його кнопкою «Новий проєкт», відкрийте проєкт із бібліотеки проєктів або з файлу проєкту. | Стварыце яго кнопкай «Новы праект», адкрыйце праект з бібліятэкі праектаў або з файла праекта. | 用“新建项目”创建一个，从项目库打开一个，或打开项目文件。 | Crea uno con Nuevo proyecto, abre uno de la biblioteca de proyectos o abre un archivo de proyecto. | Utwórz projekt przyciskiem Nowy projekt, otwórz projekt z biblioteki projektów albo z pliku projektu. |
| Couldn't save on this device. Your latest change is only on screen. Free up space in the browser, or save a Project file to keep it. (notice; its button is Save Project file) | Не удалось сохранить на этом устройстве. Последние изменения есть только на экране. Освободите место в браузере или сохраните файл проекта, чтобы не потерять изменения. | Не вдалося зберегти на цьому пристрої. Останні зміни є лише на екрані. Звільніть місце в браузері або збережіть файл проєкту, щоб не втратити зміни. | Не атрымалася захаваць на гэтай прыладзе. Апошнія змены ёсць толькі на экране. Вызваліце месца ў браўзеры або захавайце файл праекта, каб не страціць змены. | 无法保存到此设备。你最近的修改只在屏幕上。请释放浏览器空间，或保存项目文件以保留修改。 | No se pudo guardar en este dispositivo. Tu último cambio solo está en pantalla. Libera espacio en el navegador o guarda un archivo de proyecto para conservarlo. | Nie udało się zapisać na tym urządzeniu. Twoja ostatnia zmiana jest tylko na ekranie. Zwolnij miejsce w przeglądarce albo zapisz plik projektu, żeby jej nie stracić. |
| … Save all Projects to a Project file first if you want to keep copies. (Delete all Projects?) | … Сначала нажмите «Сохранить всё в файл проекта», если хотите сохранить копии. | … Спершу натисніть «Зберегти все у файл проєкту», якщо хочете зберегти копії. | … Спачатку націсніце «Захаваць усё ў файл праекта», калі хочаце захаваць копіі. | …如需保留副本，请先点击“将所有项目保存到项目文件”。 | … Antes, pulsa «Guardar todo en un archivo de proyecto» si quieres conservar copias. | … Najpierw kliknij „Zapisz wszystko w pliku projektu”, jeśli chcesz zachować kopie. |

## Help lines by device copy (ticket 0846)

The touch words of the help lines (Voice, A help line fits the device in hand): the Canvas hint (CanvasHint card), the empty Canvas's pan sentence (EmptyCanvas card) and the converter's empty preview (ConvertImage card). With a keyboard each keeps its key words, its key read off the device.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| two fingers to move · pinch to zoom | два пальца: сдвиг · сведение пальцев: масштаб | два пальці: зсув · зведення пальців: масштаб | два пальцы: зрух · звядзенне пальцаў: маштаб | 双指移动 · 双指捏合缩放 | dos dedos para mover · pellizca para hacer zoom | dwa palce, aby przesunąć · uszczypnij, aby powiększyć |
| Drag the Canvas around with two fingers. | Двигайте холст двумя пальцами. | Переміщуйте полотно двома пальцями. | Перасоўвайце палатно двума пальцамі. | 用两根手指拖动画布。 | Mueve el lienzo arrastrando con dos dedos. | Przesuwaj płótno dwoma palcami. |
| Your picture shows here · Choose a file, paste or take a photo | Здесь появится ваше изображение · Выберите файл, вставьте или сфотографируйте | Тут з’явиться ваше зображення · Виберіть файл, вставте або сфотографуйте | Тут з’явіцца ваша выява · Выберыце файл, устаўце або сфатаграфуйце | 你的图片会显示在这里 · 选择文件、粘贴或拍照 | Tu imagen se verá aquí · Elige un archivo, pega o haz una foto | Tu pojawi się twój obraz · Wybierz plik, wklej albo zrób zdjęcie |

English follows the audit's proposal (F-01-10, F-03-15); the other languages are proposals for review with the build.

## Library actions copy (ticket 0860)

Opening, duplicating and switching Projects say what happened and ask only when something can be lost. A Project file whose name the library already holds comes in under Duplicate's rule (the next free number), so no two rows share a name, and the question after Open says so in one sentence. It asks whether to open what came in: the name in the title, a plain "Open" and "Stay here", as a 40-character name doesn't fit a button. After Duplicate a toast says which Project is open now. A pick in the Projects library opens at once; "Switch Project?" is asked only while the last save failed (its message is the import question's "not saved" one). English follows the audit (F-05-10, F-05-11, F-05-12); the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Open “{imported}”? (the question after Open Project file, with a Project open) | Открыть «{imported}»? | Відкрити «{imported}»? | Адкрыць «{imported}»? | 打开“{imported}”？ | ¿Abrir “{imported}”? | Otworzyć „{imported}”? |
| “{imported}” is now in the Projects library. Your progress on “{current}” is saved. | Проект «{imported}» добавлен в библиотеку проектов. Ваш прогресс в проекте «{current}» сохранён. | Проєкт «{imported}» додано до бібліотеки проєктів. Ваш прогрес у проєкті «{current}» збережено. | Праект «{imported}» дададзены ў бібліятэку праектаў. Ваш прагрэс у праекце «{current}» захаваны. | “{imported}”已添加到项目库。你在“{current}”中的进度已保存。 | “{imported}” está ahora en la biblioteca de proyectos. Tu avance en “{current}” está guardado. | Dodano „{imported}” do biblioteki projektów. Twój postęp w „{current}” jest zapisany. |
| “{taken}” is already in the Projects library, so the file came in as “{imported}”. | «{taken}» уже есть в библиотеке проектов, поэтому файл добавлен как «{imported}». | «{taken}» уже є в бібліотеці проєктів, тому файл додано як «{imported}». | «{taken}» ужо ёсць у бібліятэцы праектаў, таму файл дададзены як «{imported}». | 项目库中已有“{taken}”，因此该文件以“{imported}”的名称添加。 | “{taken}” ya está en la biblioteca de proyectos, así que el archivo entró como “{imported}”. | „{taken}” jest już w bibliotece projektów, więc plik dodano jako „{imported}”. |
| {count} Projects are now in the Projects library. Your progress on “{current}” is saved. | Добавлено проектов в библиотеку: {count}. Ваш прогресс в проекте «{current}» сохранён. | Додано проєктів до бібліотеки: {count}. Ваш прогрес у проєкті «{current}» збережено. | Дададзена праектаў у бібліятэку: {count}. Ваш прагрэс у праекце «{current}» захаваны. | 已向项目库添加 {count} 个项目。你在“{current}”中的进度已保存。 | Se añadieron {count} proyectos a la biblioteca de proyectos. Tu avance en “{current}” está guardado. | Dodano projekty do biblioteki: {count}. Twój postęp w „{current}” jest zapisany. |
| {count} Projects are now in the Projects library. Names already in the library got the next free number. | Добавлено проектов в библиотеку: {count}. Названия, которые уже были заняты, получили следующий свободный номер. | Додано проєктів до бібліотеки: {count}. Назви, які вже були зайняті, отримали наступний вільний номер. | Дададзена праектаў у бібліятэку: {count}. Назвы, якія ўжо былі занятыя, атрымалі наступны вольны нумар. | 已向项目库添加 {count} 个项目。已被占用的名称获得了下一个可用编号。 | Se añadieron {count} proyectos a la biblioteca de proyectos. Los nombres que ya estaban recibieron el siguiente número libre. | Dodano projekty do biblioteki: {count}. Nazwy, które już były zajęte, dostały następny wolny numer. |
| Open · Stay here (its buttons) | Открыть · Остаться здесь | Відкрити · Залишитися тут | Адкрыць · Застацца тут | 打开 · 留在这里 | Abrir · Quedarme aquí | Otwórz · Zostań tutaj |
| Now in “{copy}”. “{original}” stays as it was. (the toast after Duplicate) | Теперь открыт «{copy}». «{original}» остался как был. | Тепер відкрито «{copy}». «{original}» залишився як був. | Цяпер адкрыты «{copy}». «{original}» застаўся як быў. | 现在打开的是“{copy}”。“{original}”保持原样。 | Ahora estás en “{copy}”. “{original}” se queda como estaba. | Teraz otwarty jest „{copy}”. „{original}” zostaje bez zmian. |
| Everything is copied, including Row progress. The copy opens; the original stays as it is now. (Duplicate's note) | Копируется всё, включая прогресс по рядам. Откроется копия, а оригинал останется таким, как сейчас. | Копіюється все, зокрема прогрес за рядами. Відкриється копія, а оригінал залишиться таким, як зараз. | Капіруецца ўсё, у тым ліку прагрэс па радах. Адкрыецца копія, а арыгінал застанецца такім, як зараз. | 所有内容都会被复制，包括行进度。复制后打开副本，原项目保持现状。 | Se copia todo, incluido el progreso por filas. Se abre la copia; el original se queda como está ahora. | Kopiowane jest wszystko, także postęp rzędów. Otworzy się kopia, a oryginał zostanie taki, jak teraz. |
| Copy this Project and open the copy. (Duplicate's Tooltip) | Скопировать проект и открыть копию. | Скопіювати проєкт і відкрити копію. | Скапіраваць праект і адкрыць копію. | 复制此项目并打开副本。 | Copia este proyecto y abre la copia. | Skopiuj ten projekt i otwórz kopię. |

## Unnamed Project copy (ticket 0866)

A Project left unnamed is "Project 1", then the next free number as Duplicate counts ("Project 2" once "Project 1" is taken), never the Bead's name, which belongs in the Bead row. The same words are New Project's Name placeholder, so the grey text is the name the Project gets. The number always ends the name, after a space, in every language.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Project {number} (an unnamed Project's name and New Project's Name placeholder) | Проект {number} | Проєкт {number} | Праект {number} | 项目 {number} | Proyecto {number} | Projekt {number} |

## Kaleidocycle face copy (ticket 0876)

A Kaleidocycle's Frame is one of the piece's four faces, six of its 24 triangles. The Starter card, the setup's estimate, Beads needed, Row progress and the Word chart say so, and give the face's count with the whole piece's beside it. What the counts cover (the triangles only) and that another face is a Frame of its own sit behind an Info button beside the counts. The numbers are blanks filled from the shape; `{then}` is the Tooltip's Go to row sentence, after the face's. English is the ticket's; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| one face of {faces}: {parts} of {total} triangles (the face line on the card and in the setup) | одна грань из {faces}: {parts} из {total} треугольников | одна грань із {faces}: {parts} із {total} трикутників | адна грань з {faces}: {parts} з {total} трохвугольнікаў | {faces} 面之一：{total} 个三角形中的 {parts} 个 | una cara de {faces}: {parts} de {total} triángulos | jedna ściana z {faces}: {parts} z {total} trójkątów |
| {count} beads a face (its count) | {count} на грань | {count} на грань | {count} на грань | 每面 {count} 颗 | {count} por cara | {count} na ścianę |
| {count} for the whole piece (the whole piece's, in the setup) | {count} на всё изделие | {count} на весь виріб | {count} на ўвесь выраб | 整件 {count} 颗 | {count} la pieza entera | {count} na całą pracę |
| What the counts cover (the Info button's name) | Что входит в подсчёт | Що входить у підрахунок | Што ўваходзіць у падлік | 计数包括哪些 | Qué cuentan las cifras | Co obejmuje liczenie |
| A Kaleidocycle is {total} triangles, {faces} faces of {parts}, and this Frame is one face. The whole piece counts every face beaded like this one. To give another face its own design, make a Frame for it. Only the triangles are counted, not the edge, tip or hinge beads. (the Info button's body) | Калейдоцикл собирается из {total} треугольников: {faces} грани по {parts}. Эта рамка показывает одну грань. Всё изделие считается так, будто каждая грань сплетена как эта. Чтобы дать другой грани свой дизайн, сделайте для неё отдельную рамку. Считаются только треугольники, без бисеринок края, кончиков и шарниров. | Калейдоцикл складається з {total} трикутників: {faces} грані по {parts}. Ця рамка показує одну грань. Увесь виріб рахується так, ніби кожну грань сплетено як цю. Щоб дати іншій грані власний дизайн, зробіть для неї окрему рамку. Рахуються лише трикутники, без бісерин краю, кінчиків і шарнірів. | Калейдацыкл складаецца з {total} трохвугольнікаў: {faces} грані па {parts}. Гэтая рамка паказвае адну грань. Увесь выраб лічыцца так, быццам кожная грань сплецена як гэтая. Каб даць іншай грані свой дызайн, зрабіце для яе асобную рамку. Лічацца толькі трохвугольнікі, без бісерын краю, кончыкаў і шарніраў. | 万花筒环由 {total} 个三角形组成，共 {faces} 面，每面 {parts} 个。此边框是其中一面。整件按每一面都像这一面来计算。若要给另一面单独的图案，请为它新建一个边框。只计三角形，不含边缘、尖端和铰链处的珠子。 | Un caleidociclo tiene {total} triángulos, {faces} caras de {parts}, y este marco es una cara. La pieza entera cuenta cada cara tejida como esta. Para dar a otra cara su propio diseño, haz un marco para ella. Solo se cuentan los triángulos, no las cuentas del borde, de las puntas ni de las bisagras. | Kalejdocykl to {total} trójkątów: {faces} ściany po {parts}. Ta ramka to jedna ściana. Cała praca liczy każdą ścianę wyplecioną tak jak ta. Aby dać innej ścianie własny wzór, zrób dla niej osobną ramkę. Liczone są tylko trójkąty, bez koralików brzegu, czubków i zawiasów. |
| These counts are one face of {faces}. Whole piece: {count} (under Beads needed) | Это подсчёт для одной грани из {faces}. Всё изделие: {count} | Це підрахунок для однієї грані з {faces}. Увесь виріб: {count} | Гэта падлік для адной грані з {faces}. Увесь выраб: {count} | 这些是 {faces} 面中一面的数量。整件：{count} | Estas cifras son de una cara de {faces}. Pieza entera: {count} | To liczby dla jednej ściany z {faces}. Cała praca: {count} |
| Each triangle here is beaded for this face, {parts} of the piece's {total}. {then} (first in the Go to row counter's Tooltip) | Каждый треугольник здесь плетётся для этой грани: {parts} из {total} в изделии. {then} | Кожен трикутник тут плететься для цієї грані: {parts} із {total} у виробі. {then} | Кожны трохвугольнік тут пляцецца для гэтай грані: {parts} з {total} у вырабе. {then} | 这里的每个三角形都属于这一面：整件 {total} 个中的 {parts} 个。{then} | Cada triángulo de aquí se teje para esta cara: {parts} de los {total} de la pieza. {then} | Każdy trójkąt tutaj plecie się dla tej ściany: {parts} z {total} w całej pracy. {then} |
| This chart is one face: {parts} of the Kaleidocycle's {total} triangles. Make a Frame for each other face to chart its design. (a note of the Word chart) | Эта схема показывает одну грань: {parts} из {total} треугольников калейдоцикла. Для каждой другой грани сделайте свою рамку. | Ця схема показує одну грань: {parts} із {total} трикутників калейдоцикла. Для кожної іншої грані зробіть свою рамку. | Гэтая схема паказвае адну грань: {parts} з {total} трохвугольнікаў калейдацыкла. Для кожнай іншай грані зрабіце сваю рамку. | 此图样只是一面：万花筒环 {total} 个三角形中的 {parts} 个。其他每一面请各建一个边框。 | Este esquema es una cara: {parts} de los {total} triángulos del caleidociclo. Haz un marco para cada una de las otras caras. | Ten schemat to jedna ściana: {parts} z {total} trójkątów kalejdocyklu. Dla każdej innej ściany zrób osobną ramkę. |

## Star front and back copy (ticket 0875)

A Star's Frame is its finished face, and its back is beaded as the face's mirror, so its counts are the whole star: each face bead twice, the five tip beads once. The setup's estimate and the Starter card say so after the count, and Beads needed says so under its rows. English is the ticket's; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| {count} beads, front and back (the count on the card and in the setup) | {count} бисеринок на обе стороны | {count} бісеринок на обидва боки | {count} бісерынак на абодва бакі | 正反两面共 {count} 颗珠子 | {count} cuentas, anverso y reverso | {count} koralików, przód i tył |
| These counts are the whole star, front and back. (under Beads needed) | Это подсчёт для всей звезды, на обе стороны. | Це підрахунок для всієї зірки, на обидва боки. | Гэта падлік для ўсёй зоркі, на абодва бакі. | 这些是整颗星星正反两面的数量。 | Estas cifras son de la estrella entera, anverso y reverso. | To liczby dla całej gwiazdy, przód i tył. |

## Kaleidocycle joins and the whole piece's beads (ticket 0877)

A Kaleidocycle's Row progress ends with the joins of the Kali Primer, named in its words: Strip, Tetra, Mirror pair, Hinge Pins, ring. A triangle of the face is zipped into its Strip of four and closed into a Tetra; the face's triangles are hinged in Mirror pairs, laced with Hinge Pins; the three ring joins are named by the two Mirror pairs each joins, never by a gap, since they are made on triangles of other faces. Beads needed and the setup's estimate count the beads of the joins: the whole piece's count is the face's Bead (triangles, Edge Beads, Hinge Beads), and the 15/0s, another bead size, get their own count as "15/0: {count}". "15/0" is a bead size, written as the maker writes it, never translated. The 0876 rows "These counts are one face of {faces}. Whole piece: {count}" and the Info body's last sentence ("Only the triangles are counted, …") are replaced by the rows below. English is the ticket's; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Strip and Tetra {parts} (a triangle's join step) | Полоса и тетраэдр {parts} | Смуга й тетраедр {parts} | Паласа і тэтраэдр {parts} | 条带与四面体 {parts} | Tira y tetraedro {parts} | Pasek i czworościan {parts} |
| Mirror pair {parts}, Hinge Pins (a hinged gap's join step) | Зеркальная пара {parts}, штифты шарнира | Дзеркальна пара {parts}, шпильки шарніра | Люстраная пара {parts}, шпількі шарніра | 镜像对 {parts}，铰链销 | Par espejo {parts}, pasadores de bisagra | Para lustrzana {parts}, sworznie zawiasu |
| Ring: pairs {first} and {second} (a ring join step) | Кольцо: пары {first} и {second} | Кільце: пари {first} і {second} | Кальцо: пары {first} і {second} | 环：{first} 对与 {second} 对 | Anillo: pares {first} y {second} | Pierścień: pary {first} i {second} |
| These counts are one face of {faces}. Whole piece: {count} · 15/0: {small} (under Beads needed) | Это подсчёт для одной грани из {faces}. Всё изделие: {count} · 15/0: {small} | Це підрахунок для однієї грані з {faces}. Увесь виріб: {count} · 15/0: {small} | Гэта падлік для адной грані з {faces}. Увесь выраб: {count} · 15/0: {small} | 这些是 {faces} 面中一面的数量。整件：{count} · 15/0：{small} | Estas cifras son de una cara de {faces}. Pieza entera: {count} · 15/0: {small} | To liczby dla jednej ściany z {faces}. Cała praca: {count} · 15/0: {small} |
| 15/0: {count} (the setup's estimate, after the whole piece) | 15/0: {count} | 15/0: {count} | 15/0: {count} | 15/0：{count} | 15/0: {count} | 15/0: {count} |
| Triangles (a whole-piece line) | Треугольники | Трикутники | Трохвугольнікі | 三角形 | Triángulos | Trójkąty |
| Edge Beads | Бисеринки края | Бісерини краю | Бісерыны краю | 边缘珠 | Cuentas del borde | Koraliki brzegu |
| Hinge Beads | Бисеринки шарниров | Бісерини шарнірів | Бісерыны шарніраў | 铰链珠 | Cuentas de bisagra | Koraliki zawiasów |
| Triangle Tips (shown "Triangle Tips · 15/0") | Кончики треугольников | Кінчики трикутників | Кончыкі трохвугольнікаў | 三角形尖端 | Puntas de triángulo | Czubki trójkątów |
| Hinge Pins (shown "Hinge Pins · 15/0") | Штифты шарниров | Шпильки шарнірів | Шпількі шарніраў | 铰链销 | Pasadores de bisagra | Sworznie zawiasów |
| The whole piece also counts the beads that join the triangles: Edge Beads, Hinge Beads, and the 15/0 Triangle Tips and Hinge Pins. (the Info body's last sentence) | Всё изделие учитывает и бисер соединений: бисеринки края, бисеринки шарниров, а также 15/0 на кончиках треугольников и штифты шарниров. | Увесь виріб ураховує й бісер з’єднань: бісерини краю, бісерини шарнірів, а також 15/0 на кінчиках трикутників і шпильки шарнірів. | Увесь выраб улічвае і бісер злучэнняў: бісерыны краю, бісерыны шарніраў, а таксама 15/0 на кончыках трохвугольнікаў і шпількі шарніраў. | 整件还计入连接三角形的珠子：边缘珠、铰链珠，以及三角形尖端和铰链销用的 15/0。 | La pieza entera cuenta también las cuentas que unen los triángulos: las del borde, las de las bisagras y las 15/0 de las puntas y de los pasadores de bisagra. | Cała praca liczy też koraliki łączeń: koraliki brzegu, koraliki zawiasów oraz 15/0 na czubkach trójkątów i sworznie zawiasów. |

## Print choices copy (ticket 0916)

The Printable chart's two switches in the Export panel and the Frame panel's export section (ExportPanel card), each with its Info button. "Row by row" is the Word chart's own title in every language, so the switch and the pages it adds share a name. Letters no longer changes the PDF, so its Info body says what it does now. The page count reuses "{count} page" / "{count} pages"; no new copy. English is the ticket's; the other languages are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Large beads (the switch under Printable chart) | Крупные бисеринки | Великі намистини | Буйныя бісерынкі | 大珠子 | Cuentas grandes | Duże koraliki |
| What Large beads does (its Info button's name) | Что делают Крупные бисеринки | Що роблять Великі намистини | Што робяць Буйныя бісерынкі | 大珠子的作用 | Para qué sirven las Cuentas grandes | Do czego służą Duże koraliki |
| Every bead on the chart is 3 mm or more, easier to read. A big piece takes more pages. (its Info button's body) | Каждая бисеринка на схеме не меньше 3 мм, так её легче читать. Большое изделие займёт больше страниц. | Кожна намистина на схемі щонайменше 3 мм, так її легше читати. Великий виріб займе більше сторінок. | Кожная бісерынка на схеме не меншая за 3 мм, так яе лягчэй чытаць. Вялікі выраб зойме больш старонак. | 图样上每颗珠子至少 3 毫米，更易看清。大作品会多占几页。 | Cada cuenta del esquema mide 3 mm o más, para leerlo mejor. Una pieza grande ocupa más páginas. | Każdy koralik na schemacie ma co najmniej 3 mm, łatwiej go odczytać. Duża praca zajmie więcej stron. |
| Row by row (the switch; the Word chart's own title) | Ряд за рядом | Рядок за рядком | Рад за радам | 逐行说明 | Fila por fila | Rząd po rzędzie |
| What Row by row does (its Info button's name) | Что делает Ряд за рядом | Що робить Рядок за рядком | Што робіць Рад за радам | 逐行说明的作用 | Para qué sirve Fila por fila | Do czego służy Rząd po rzędzie |
| Adds pages that write out each row as counts of letters, with a box to tick as you finish it. (its Info button's body) | Добавляет страницы, где каждый ряд расписан буквами и числами, с квадратиком, чтобы отметить готовый ряд. | Додає сторінки, де кожен рядок розписано літерами й числами, з квадратиком, щоб позначити готовий рядок. | Дадае старонкі, дзе кожны рад распісаны літарамі і лічбамі, з квадрацікам, каб адзначыць гатовы рад. | 添加几页，把每一行写成字母和数量，并附一个方框，完成后打勾。 | Añade páginas que escriben cada fila con letras y números, con una casilla para marcarla al terminarla. | Dodaje strony, na których każdy rząd jest rozpisany literami i liczbami, z polem do odhaczenia gotowego rzędu. |
| Show each color's letter on its beads, so colors can be told apart on screen. Printed charts always have the letters. (Letters' Info body; replaces "Print each color's letter on its beads, …") | Показывать букву цвета на каждой бисеринке, чтобы цвета различались на экране. На печатной схеме буквы есть всегда. | Показувати літеру кольору на кожній намистині, щоб кольори розрізнялися на екрані. На друкованій схемі літери є завжди. | Паказваць літару колеру на кожнай бісерынцы, каб колеры адрозніваліся на экране. На друкаванай схеме літары ёсць заўсёды. | 在每颗珠子上显示颜色字母，方便在屏幕上区分颜色。打印的图样总是带有字母。 | Muestra la letra de cada color en sus cuentas, para distinguir los colores en pantalla. Los esquemas impresos siempre llevan las letras. | Pokazuj literę koloru na każdym koraliku, by kolory dało się odróżnić na ekranie. Drukowany schemat zawsze ma litery. |

## Converter settings as a label and a value (ticket 0894)

Under a converter control stand only a result or an error (ConvertImage card). What a setting does is read once, so it sits behind the setting's Info button, its body the sentence it replaces, unchanged; what the preview shows needs no words. The Info buttons' names are DS-1's (Quiet converter copy, above), built here ahead of ticket 0896:

| Line | Now |
|---|---|
| "Fewer beads, bigger blocks, …" (under Width) | Width's Info, "What Width and Height do" |
| "About {x} × {y} px of your picture = 1 bead" and its exact and enlarging forms (the result box) | Width's Info, after the line above |
| "Colors follow the crop. …" (under the result box with A part of the picture) | Width's Info, between the two above |
| "Width and height change together, …" / "… set apart, so the picture stretches." | Keep the picture's shape's Info, "What {name} does", for the state in hand |
| "Each color is a bead to buy. …" and its three other forms (under Colors) | Colors' Info, "What {name} does" |
| "The codes are real {Bead} beads. …" · "Plain named colors, no brand." · "Keeps the picture's own colors. …" (under match to) | match to's Info, "Where colors come from", for the choice in hand |
| "Takes away what is round the subject, …" (under Remove background) | Remove background's Info, "What {name} does" |
| "Turn it off to keep the whole picture." | gone: the switch says it |
| "To leave a color out, pick Make empty …" | gone: the tool is on the bar under the preview |
| "Every part of the picture becomes beads." · "Crop the picture with Select …" (in the convert cards) | gone: the preview and its band show it |

Gone strings are removed from every language. "To fix what was found, pick Background …" stays until ticket 0896 removes it with the step pane.

## Grid focus copy (ticket 1002)

The Canvas strip's Grid focus toggle (CanvasStrip card; BeadBoard card, Grid focus). Approved 2026-11-14, not yet in the app. "Grid" is the glossary's Grid; in Russian «сетка», a word the app's copy has not used before, so the Russian is a draft for the owner to check. The other languages are written with the build, as draft words to be checked by a speaker of each.

| English | Русский |
|---|---|
| Grid focus (strip button name, shortcuts row) | Фокус сетки |
| Keeps the grid clear around your work and calmer everywhere else. (Tooltip) | Сетка чёткая вокруг вашей работы и спокойнее на остальном холсте. |
| There is no work to focus on yet. (disabled reason) | Пока нет работы, вокруг которой держать фокус. |
