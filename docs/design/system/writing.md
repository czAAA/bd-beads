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
| Technique | техника плетения | Loom / ткачество, Peyote / мозаичное плетение, Brick stitch / кирпичное плетение, Square stitch / квадратное плетение |
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
| Canvas · Hand · Rulers | Полотно · Рука · Линейки | The drawing area, the tool that moves it, the row and column numbers |
| Export · Import | Экспорт · Импорт | Buttons use the verb: Экспортировать схему |
| Convert image | Конвертировать изображение | A Project made from a picture |
| Pixel to bead ratio | соотношение пикселей и бисерин | Picture pixels : beads, one side always 1 ("2:1"); the label reads «пиксели изображения : бисерины» (ticket 0646) |

## Ukrainian, Belarusian, Chinese, Spanish and Polish (ticket 368)

The same voice and sentence patterns in each language; domain words are never retranslated (ADR 0039). Ukrainian and Belarusian follow the Russian column (same sentence patterns, «ялинки» for quoted buttons, one, few and many plurals); Belarusian is in the official orthography. Chinese is Simplified, drawn by the device's own font. Spanish and Polish address the reader as "tú" / "ty", in the imperative.

| English | Ukrainian | Belarusian |
| --- | --- | --- |
| Project | проєкт | праект |
| Schema | схема | схема |
| Bead / beads | бісерина / бісер | бісерына / бісер |
| Technique | техніка плетіння | тэхніка пляцення |
| Loom · Peyote · Brick stitch · Square stitch | Ткацтво · Мозаїчне плетіння · Цегляне плетіння · Квадратне плетіння | Ткацтва · Мазаічнае пляценне · Цаглянае пляценне · Квадратнае пляценне |
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
| Loom · Peyote · Brick stitch · Square stitch | 织机 · 佩奥 · 砖形 · 方形针 | Telar · Peyote · Punto ladrillo · Punto cuadrado | Krosno · Peyote · Ścieg ceglasty · Ścieg kwadratowy |
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

The Canvas color control (Russian "Цвет полотна") offers five backgrounds in light and five in dark (ticket 0554). The accessible name of each swatch is "{name}, {n} of {count}" (Russian "{name}, {n} из {count}").

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

The Homepage and the header menu, as signed off. The same rules: plain and short, sentence case, product nouns capitalized, no exclamation marks, emoji, em dashes or "please". The Homepage's slogan, its "save. count. export" line and its handwritten notes are the one place with a lighter, drawn voice; the Russian line uses "we" so it reads as "on us".

### Header menu and Homepage

| English | Russian |
| --- | --- |
| Menu | Меню |
| Homepage (menu link) | Главная |
| open + beads · draw · joy · weave · create · art · canvas · possibility · play · wonder · pattern · ideas (the rolling slogan, ticket 550) | the same, not translated: it is the brand |
| save. count. export | сохраним. посчитаем. экспортируем |
| on us (note) | это мы |
| Make your first Pattern · Open the editor | Сделать первую схему · Открыть редактор |
| Patterns saved: 3 | Схем сохранено: 3 |
| What's inside | Что внутри |
| Techniques: Loom, peyote and brick stitch, each drawn the way its beads sit. | Техники плетения: Ткачество, мозаичное и кирпичное плетение: каждая рисуется так, как ложится бисер. |
| Pattern editing: Paint, Fill and Eraser, copy and paste, and Undo for every step. | Редактирование схемы: Кисть, заливка и ластик, копирование и вставка, отмена любого шага. |
| Convert image: Turn a picture into a Pattern in up to 14 colors. | Конвертировать изображение: Превращает картинку в схему, до 14 цветов. |
| Row progress: Mark rows done as you weave and pick up where you stopped. | Прогресс по рядам: Отмечайте готовые ряды и продолжайте с того места, где остановились. |
| Beads needed: Every color counted, with Estimated weight in grams. | Нужно бисера: Подсчёт по каждому цвету и примерный вес в граммах. |
| Exports: PDF for printing, PNG image and the Pattern file. | Экспорт: PDF для печати, PNG и файл схемы. |
| Saved Patterns: Kept on this device. No account needed. | Сохранённые схемы: Хранятся на этом устройстве. Аккаунт не нужен. |
| Previous feature · Next feature (arrow labels) | Предыдущая возможность · Следующая возможность |
| Made by one family | Одна семья |
| bd-beads is made by one family, bead by bead, and it's free. If it saved you an evening of counting, a coffee says thanks. | bd-beads делает одна семья, бисеринка за бисеринкой, и он бесплатный. Если он сэкономил вам вечер подсчётов, кофе будет лучшим спасибо. |
| Buy me a coffee | Угостить кофе |
| plans · Three ways to use it | тарифы · Три способа работать |
| Accounts and Pro aren't open yet. Everything works without them. | Аккаунты и Pro пока не открыты. Всё работает и без них. |
| you are here (note) | вы здесь |
| No account · Free · no sign-up · Draw, count and weave on this device. Nothing to sign up for. · Open the editor | Без аккаунта · Бесплатно · без регистрации · Рисуйте, считайте и плетите на этом устройстве. Регистрироваться не нужно. · Открыть редактор |
| Free account · Free · coming later · The same app, with your Patterns on every device you use. · Create free account | Бесплатный аккаунт · Бесплатно · появится позже · То же приложение, а схемы на всех ваших устройствах. · Создать бесплатный аккаунт |
| Pro · Price later · coming later · For makers who teach, sell or print a lot. · Coming later | Pro · Цена позже · появится позже · Для тех, кто учит, продаёт или много печатает. · Появится позже |
| what you get · everything without an account, plus · everything in Free account, plus | что входит · всё без аккаунта, плюс · всё из бесплатного аккаунта, плюс |

Plan contents are placeholders until paid features exist.

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
| Rounds · Rows · Part size · Top width · Top rows · Fringe style · Fringe length · Width · Size system · Ring size · Wrist · Fit | Круги · Ряды · Размер части · Ширина верха · Ряды верха · Вид бахромы · Длина бахромы · Ширина · Система размеров · Размер кольца · Запястье · Посадка |
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
| Bead shape · Symmetric · Real · Brand · Type · Size | Форма бусины · Симметричная · Реальная · Бренд · Тип · Размер |
| Project file · Picture · Printable chart · Clear all beads · Delete project | Файл проекта · Картинка · Схема для печати · Очистить все бусины · Удалить проект |
| frame: · Name this frame · Rename the frame · Frame from template · Fit a frame to the drawing · A frame sets the size, the exports and the bead count. | рамка: · Назовите рамку · Переименовать рамку · Рамка из шаблона · Рамка по рисунку · Рамка задаёт размер, экспорт и подсчёт бусин. |
| Estimated size · An estimate. · Rows are marked done. Remove the frame to change the size. · Show all {n} colours | Примерный размер · Это оценка. · Ряды отмечены как готовые. Уберите рамку, чтобы изменить размер. · Показать все цвета ({n}) |
| Stone · Fog · Pebble · Slate | Камень · Туман · Галька · Сланец |

Russian here is a proposal for review; the other five languages follow it in the app change.

## Convert image wizard copy (ticket 0646)

The popup of spec 0645 (ConvertImage, PixelToBeadRatio and FoundColorRow cards). Errors, the slow-framing warning, Colors at most, the drag hint and the Finish names on Bead colors keep the app's existing strings. Grid sizes follow Numbers and units ("32×24 beads"); a count with a noun in Russian, Ukrainian and Polish takes the "Label: number" form ("цветов: 8"); after a grid size the noun is the genitive plural, as with "1920×1080 пикселей". Belarusian, Spanish and Chinese follow in the build.

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
| Starts from the New Project form. Cancel leaves the form as it was. | Взято из формы нового проекта. «Отмена» оставит форму без изменений. | Узято з форми нового проєкту. «Скасувати» залишить форму без змін. | Wzięte z formularza nowego projektu. „Anuluj” zostawi formularz bez zmian. |
| By Pixel to bead ratio · By size | По соотношению пикселей и бисерин · По размеру | За співвідношенням пікселів і бісерин · За розміром | Według proporcji pikseli do koralików · Według rozmiaru |
| picture pixels : beads · Custom · Custom ratio (its name) · pixels per bead · beads per pixel | пиксели изображения : бисерины · Своё · Своё соотношение · пикселей на бисерину · бисерин на пиксель | пікселі зображення : бісерини · Власне · Власне співвідношення · пікселів на бісерину · бісерин на піксель | piksele obrazu : koraliki · Własne · Własna proporcja · pikseli na koralik · koralików na piksel |
| Every {n} × {n} pixel block is one bead. · Every pixel is one bead. · Every pixel is {n} × {n} beads. | Каждый блок {n} × {n} пикселей становится одной бисериной. · Каждый пиксель становится одной бисериной. · Каждый пиксель становится блоком {n} × {n} бисерин. | Кожен блок {n} × {n} пікселів стає однією бісериною. · Кожен піксель стає однією бісериною. · Кожен піксель стає блоком {n} × {n} бісерин. | Każdy blok {n} × {n} pikseli to jeden koralik. · Każdy piksel to jeden koralik. · Każdy piksel to {n} × {n} koralików. |
| {n} × {n} px · 1 px · 1 bead · {n} × {n} beads | {n} × {n} px · 1 px · 1 бисерина · {n} × {n} бисерин | {n} × {n} px · 1 px · 1 бісерина · {n} × {n} бісерин | {n} × {n} px · 1 px · 1 koralik · {n} × {n} koralików |
| Drag the handles on the preview to crop. They snap to whole blocks. | Потяните маркеры на превью, чтобы обрезать. Они цепляются за целые блоки. | Потягніть маркери на прев’ю, щоб обрізати. Вони чіпляються за цілі блоки. | Przeciągnij uchwyty na podglądzie, aby przyciąć. Przyciągają się do całych bloków. |
| unit · beads · mm · cm · Width · Height · Keep picture proportions · picture zoom | единицы · бисер · мм · см · Ширина · Высота · Сохранять пропорции изображения · масштаб изображения | одиниці · бісер · мм · см · Ширина · Висота · Зберігати пропорції зображення · масштаб зображення | jednostka · koraliki · mm · cm · Szerokość · Wysokość · Zachowaj proporcje obrazu · powiększenie obrazu |
| Large Schema: more than 300 beads on a side. Converting and drawing take longer. | Большая схема: больше 300 бисерин по стороне. Конвертация и отрисовка займут больше времени. | Велика схема: понад 300 бісерин на бік. Конвертація й малювання триватимуть довше. | Duży schemat: ponad 300 koralików na bok. Konwersja i rysowanie potrwają dłużej. |
| result · {w}×{h} beads · 1 bead = {n} × {n} px · 1 bead ≈ {x} × {y} px · {n} colors | получится · {w}×{h} бисерин · 1 бисерина = {n} × {n} px · 1 бисерина ≈ {x} × {y} px · цветов: {n} | вийде · {w}×{h} бісерин · 1 бісерина = {n} × {n} px · 1 бісерина ≈ {x} × {y} px · кольорів: {n} | wynik · {w}×{h} koralików · 1 koralik = {n} × {n} px · 1 koralik ≈ {x} × {y} px · kolorów: {n} |
| match to · Bead colors · Default Palette · Exact | подбирать из · Цвета бисера · Палитра по умолчанию · Точные | підбирати з · Кольори бісеру · Типова палітра · Точні | dopasuj do · Kolory koralików · Domyślna paleta · Dokładne |
| Matches each color to the nearest of the Bead’s {n} default colors. | Подбирает каждому цвету ближайший из {n} цветов бисера по умолчанию. | Підбирає кожному кольору найближчий із {n} типових кольорів бісеру. | Dopasowuje każdy kolor do najbliższego z {n} domyślnych kolorów koralika. |
| Keeps the picture’s own colors. Each joins the Palette as a Custom color. | Оставляет цвета изображения как есть. Каждый попадёт в палитру как свой цвет. | Залишає кольори зображення як є. Кожен потрапить у палітру як власний колір. | Zachowuje własne kolory obrazu. Każdy trafi do palety jako własny kolor. |
| codes in {size}: {n} | кодов в {size}: {n} | кодів у {size}: {n} | kodów w {size}: {n} |
| colors found · Treat as empty · Tap a color on the preview to make it empty | найдено цветов · Считать пустым · Нажмите на цвет на превью, чтобы сделать его пустым | знайдено кольорів · Вважати порожнім · Торкніться кольору на прев’ю, щоб зробити його порожнім | znalezione kolory · Traktuj jako puste · Dotknij koloru na podglądzie, aby był pusty |
| Keep exact · Remap · Empty · No bead · Kept exact · Remapped · Custom color | Оставить точный · Заменить · Пусто · Без бисерины · Точный цвет · Заменён · Свой цвет | Залишити точний · Замінити · Порожньо · Без бісерини · Точний колір · Замінено · Власний колір | Zachowaj dokładny · Zamień · Puste · Bez koralika · Dokładny kolor · Zamieniony · Własny kolor |
| Picture colors · used here | Цвета изображения · уже используются | Кольори зображення · уже використано | Kolory obrazu · już użyte |
| size · colors · beads needed · estimated weight · to buy · Show details · Hide details | размер · цвета · нужно бисера · примерный вес · купить · Подробнее · Свернуть | розмір · кольори · потрібно бісеру · приблизна вага · купити · Докладніше · Згорнути | rozmiar · kolory · potrzebne koraliki · szacunkowa waga · do kupienia · Szczegóły · Zwiń |
| ≈ 200 Delica 11/0 a gram, rounded up. Buy about 10% more for spares. | ≈ 200 Delica 11/0 в грамме, с округлением вверх. Купите примерно на 10 % больше про запас. | ≈ 200 Delica 11/0 у грамі, з округленням угору. Купіть приблизно на 10 % більше про запас. | ≈ 200 Delica 11/0 na gram, w górę. Kup około 10% więcej na zapas. |
| No picture yet · Create Project | Изображения пока нет · Создать проект | Зображення ще немає · Створити проєкт | Brak obrazu · Utwórz projekt |
| Discard conversion? · The picture and every setting here will be lost. The New Project form stays as it was. · Cancel · Discard | Сбросить конвертацию? · Изображение и все настройки здесь пропадут. Форма нового проекта останется как была. · Отмена · Сбросить | Скинути конвертацію? · Зображення й усі налаштування тут зникнуть. Форма нового проєкту залишиться як була. · Скасувати · Скинути | Odrzucić konwersję? · Obraz i wszystkie ustawienia tutaj przepadną. Formularz nowego projektu zostanie bez zmian. · Anuluj · Odrzuć |
| Preview: {size}, {colors} · Preview: no picture yet | Превью: {size}, {colors} · Превью: изображения пока нет | Прев’ю: {size}, {colors} · Прев’ю: зображення ще немає | Podgląd: {size}, {colors} · Podgląd: brak obrazu |

Russian, Ukrainian and Polish here are proposals for review with the build.
