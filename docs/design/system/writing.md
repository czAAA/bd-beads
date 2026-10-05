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
- Where a count sits inside a sentence, use `Intl.PluralRules`: English has one and other, Russian one, few and many (1 бисеринка, 2 бисеринки, 5 бисеринок; 1 цвет, 2 цвета, 5 цветов).
- Russian runs about a quarter longer: buttons and tabs are sized for the Russian string, text wraps rather than truncates; only Pattern names may end in an ellipsis, with the full name in the tooltip.

## Fitting longer text

Checked on the real layouts in Russian. The rules apply to both languages: see the LongerText card and the Responsive section.

| Where | In Russian | Fix (for both languages) |
| --- | --- | --- |
| Header at 1440px (MacBook Air) | Needs 1 690px: "Импортировать файл", "Импортировать QR-код", "Заменить бисер", "Новая схема" are a third longer. English already fits with 0px to spare. | **The header fits by priority, not by breakpoint.** When it does not fit: 1) Import a file and Import QR code become icon buttons (name as tooltip and `aria-label`); 2) the Pattern name is cut with an ellipsis; 3) the imports move into More. In Russian at 1440px step 1 applies. 
| New Pattern → Technique | "Мозаичное плетение", "Кирпичное плетение" do not fit three segments in 262px (need 436px). | **SegmentedControl labels may wrap to two lines**; the control grows to 48px and every segment keeps the same height. Never cut or shrink the text. 
| Selection ContextBar (phone) | "Удалить выделенный ряд/столбец" (the app's string) breaks the bar; on the paste bar "Отмена" is cut. | **The ContextBar drops labels right to left** when it does not fit: Remove line, then Rotate, then Copy become icon buttons with their names as `aria-label`. Cancel keeps its label. 
| Saved Patterns names | Names such as "Панно с логотипом" wrap and run into their neighbours. | **Thumbnail names are one line**, cut with an ellipsis at 58px, the full name in the tooltip (as the writing rules say for Pattern names). 
| Mirror summary | "l–r 1 · t–b 0" has no good Russian short form. | Use arrows in both languages: **"↔ 1 · ↕ 0"**. 
| Toolbox tabs, Dock, BottomToolbar, menus, modals, forms, messages, Progress bar | "Заливка", "Выделение", "Отражение", "Инструменты" fit with 2–4px to spare; long hints and errors wrap as designed. | Dock and BottomToolbar buttons share the width equally (no fixed 56–60px), so the label may use all of it. 
| PDF and PNG | "Ткачество" is longer than "Loom"; Cyrillic falls back to Source Serif 4 italic for the word and name; color names and grams fit the 48 mm column; the grams note wraps to three lines. | The Beads needed note may wrap; nothing else changes. 
| Copy found on the way | Cards used British "Colour", "Colours", "Custom colour" in UI labels. | US English in the app: **Color, Colors, Custom color** (cards corrected). 

## Glossary

| English | Russian | Note |
| --- | --- | --- |
| Pattern | схема | Saved Patterns / Сохранённые схемы; New Pattern / Новая схема |
| Bead / beads | бисеринка / бисер | One bead is бисеринка; the material and amounts are бисер |
| Technique | техника плетения | Loom / ткачество, Peyote / мозаичное плетение, Brick stitch / кирпичное плетение |
| Palette | палитра |  |
| Row progress | прогресс по рядам | Row done / Ряд готов; Row not done / Ряд не готов |
| Beads needed | Нужно бисера | Its count column: Beads / Бисеринок |
| Clear | Очистить; confirm Очистить? | Empties the cells; the Pattern stays. Not «Очистить всё», which was Delete all |
| Save Project | Сохранить проект | The SaveBox button; the name field's Save stays Сохранить |
| Delete all | Очистить всё | Empties the cells; the Pattern stays |
| Mirror | Отражение | Estimated size / Примерный размер |
| Frame | рамка | Set Frame / Задать рамку; no Frame / без рамки (v16, in Size's place) |
| piece | фрагмент | Beads that touch; 1 фрагмент, 2 фрагмента, 5 фрагментов |
| Canvas · Hand · Rulers | Холст · Рука · Линейки | The open drawing area, the tool that moves it, the row and column numbers |
| Export · Import | Экспорт · Импорт | Buttons use the verb: Экспортировать схему |
| Convert image | Конвертировать изображение | Image colors / Цвета изображения |

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

The Canvas color button (Russian "Цвет холста") offers five backgrounds in light and six in dark. The accessible name of each swatch is "{name}, {n} of {count}" (Russian "{name}, {n} из {count}").

| Choice | Light (EN / RU) | Dark (EN / RU) |
| --- | --- | --- |
| 1 | Studio / Студия | Night / Ночь |
| 2 | Linen / Лён | Ink / Тушь |
| 3 | Sage / Шалфей | Midnight / Полночь |
| 4 | Mist / Дымка | Olive / Олива |
| 5 | Blush / Румянец | Umber / Умбра |
| 6 | n/a | Ash / Пепел |

## Numbers, units and dates

| What | English | Russian | Rule |
| --- | --- | --- | --- |
| Counts | 1 424 | 1 424 | Group thousands with a no-break space in both languages (the rule DESIGN.md set). |
| Decimals | 9.6 | 9,6 | The language's own decimal sign; at most one decimal for sizes. |
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
| Scan it with Import QR code on another device. | Отсканируйте его через «Импортировать QR-код» на другом устройстве. |
| Make one with New Pattern on the left, open a Saved Pattern, or import a file. | Создайте её кнопкой «Новая схема» слева, откройте сохранённую схему или импортируйте файл. |
| Opening {Pattern} · {size} | Открываем {Pattern} · {size} |
| Converting the picture · {percent} | Конвертируем изображение · {percent} |
| No image colors: this Pattern was not converted from a picture. | Цветов изображения нет: эта схема сделана не из картинки. |
| Skip to Pattern | Перейти к схеме |
| High contrast | Высокий контраст |
| More · Tools | Ещё · Инструменты |
| Row 13 of 30 | Ряд 13 из 30 |
| Undone: Fill · Redone: Fill | Отменено: заливка · Повторено: заливка |
| Technique · Bead · Size · Colors | Техника плетения · Бисеринка · Размер · Цветов |
| {maker} · {date} · {time} | {maker} · {date} · {time} (Мария Ковалева · 26 сент. 2026 г. · 14:32) |
| Dashed: the chart parts, by page. Read across, then down. Row 1 is at the top. | Пунктиром показаны части схемы по страницам. Читайте слева направо, затем сверху вниз. Ряд 1 вверху. |
| Continues right on page {n}, below on page {m} → · Last part · chart from page 2 → | Продолжение справа на странице {n}, ниже на странице {m} → · Последняя часть · схема со страницы 2 → |
| No. · Custom | № · Свой цвет |
| Match device · Light · Dark · High contrast | Как на устройстве · Светлая · Тёмная · Высокий контраст |
| Name on exports · Not set · Change · Add | Имя на экспорте · Не указано · Изменить · Добавить |
| arrows move · space paints · esc leaves | стрелки двигают · пробел рисует · esc выход |
| Row {r}, column {c}, {color} · Painted {color} | Ряд {r}, столбец {c}, {color} · Закрашено: {color} |
| Your name | Ваше имя |
| beads · grams | бисеринок · граммов |
| {n} beads · ≈ {g} | {n} бисеринок · ≈ {g} |
| ≈ {n} {bead} a gram, rounded up. | ≈ {n} {bead} в грамме, с округлением вверх. |
| Buy about 10% more for spares. | Возьмите примерно на 10 % больше про запас. |
| Printed on your PDF and PNG exports. Stays on this device. | Печатается на PDF и PNG. Хранится только на этом устройстве. |
| made by · by {maker} | автор · автор: {maker} |

## Copy added in v15

The Overview, the header menu and the Tour, as signed off. The same rules: plain and short, sentence case, product nouns capitalized, no exclamation marks, emoji, em dashes or "please". The Overview's slogan, its "save. count. export" line and its handwritten notes are the one place with a lighter, drawn voice; the Russian line uses "we" so it reads as "on us".

### Header menu and Overview

| English | Russian |
| --- | --- |
| Menu | Меню |
| Overview · Take the tour (menu links) | Обзор · Пройти обучение |
| Draw. Joy. Weave. | Рисуйте. Наслаждайтесь. Создавайте. |
| save. count. export | сохраним. посчитаем. экспортируем |
| you · on us (notes) | вы · это мы |
| Make your first Pattern · Open the editor | Сделать первую схему · Открыть редактор |
| Patterns saved: 3 | Схем сохранено: 3 |
| eleven small steps (note) | одиннадцать коротких шагов |
| you'll make this (note) | её вы и сделаете |
| What's inside | Что внутри |
| Techniques: Loom, peyote and brick stitch, each drawn the way its beads sit. | Техники плетения: Ткачество, мозаичное и кирпичное плетение: каждая рисуется так, как ложится бисер. |
| Pattern editing: Paint, Fill and Eraser, copy and paste, and Undo for every step. | Редактирование схемы: Кисть, заливка и ластик, копирование и вставка, отмена любого шага. |
| Convert image: Turn a picture into a Pattern in up to 14 colors. | Конвертировать изображение: Превращает картинку в схему, до 14 цветов. |
| Row progress: Mark rows done as you weave and pick up where you stopped. | Прогресс по рядам: Отмечайте готовые ряды и продолжайте с того места, где остановились. |
| Beads needed: Every color counted, with Estimated weight in grams. | Нужно бисера: Подсчёт по каждому цвету и примерный вес в граммах. |
| Exports: PDF for printing, PNG image, QR code and the Pattern file. | Экспорт: PDF для печати, PNG, QR-код и файл схемы. |
| Saved Patterns: Kept on this device. No account needed. | Сохранённые схемы: Хранятся на этом устройстве. Аккаунт не нужен. |
| Previous feature · Next feature (arrow labels) | Предыдущая возможность · Следующая возможность |
| Made by one person | Сделано в одиночку |
| bd-beads is made by one person, bead by bead, and it's free. If it saved you an evening of counting, a coffee says thanks. | bd-beads делает один человек, бисеринка за бисеринкой, и он бесплатный. Если он сэкономил вам вечер подсчётов, кофе будет лучшим спасибо. |
| Buy me a coffee | Угостить кофе |
| plans · Three ways to use it | тарифы · Три способа работать |
| Accounts and Pro aren't open yet. Everything works without them. | Аккаунты и Pro пока не открыты. Всё работает и без них. |
| you are here (note) | вы здесь |
| No account · Free · no sign-up · Draw, count and weave on this device. Nothing to sign up for. · Open the editor | Без аккаунта · Бесплатно · без регистрации · Рисуйте, считайте и плетите на этом устройстве. Регистрироваться не нужно. · Открыть редактор |
| Free account · Free · coming later · The same app, with your Patterns on every device you use. · Create free account | Бесплатный аккаунт · Бесплатно · появится позже · То же приложение, а схемы на всех ваших устройствах. · Создать бесплатный аккаунт |
| Pro · Price later · coming later · For makers who teach, sell or print a lot. · Coming later | Pro · Цена позже · появится позже · Для тех, кто учит, продаёт или много печатает. · Появится позже |
| what you get · everything without an account, plus · everything in Free account, plus | что входит · всё без аккаунта, плюс · всё из бесплатного аккаунта, плюс |

Plan contents are placeholders until paid features exist.

### The Tour (11 steps)

| Step | Tool · key | English | Russian |
| --- | --- | --- | --- |
| 1 | New Pattern | **Start a Pattern** Every Pattern starts here. Give yours a name, then try a Technique, a Bead and the units: the size updates as you go. Button: Back to loom for your first Pattern. Then: Loom, the default Bead and 10×75 beads, with your name kept. Now press Create Pattern. | **Начните схему** Любая схема начинается здесь. Дайте ей имя, затем попробуйте технику плетения, бисеринку и единицы: размер пересчитывается сразу. Кнопка: Вернуться к ткачеству для первой схемы. Затем: Ткачество, бисеринка по умолчанию и 10×75, имя сохранено. Теперь нажмите «Создать схему». |
| 2 | Fill · 2 | **Fill the background** Fill colors a whole area of one color at once. Choose Fill and black, then fill the Pattern. | **Залейте фон** Заливка закрашивает всю область одного цвета сразу. Выберите «Заливку» и чёрный, затем залейте схему. |
| 3 | Paint · 1 | **Paint the outline** Paint places one bead at a time. Choose Paint and yellow, then paint the 22 marked beads: the outline of the first rhombus. | **Нарисуйте контур** Кисть ставит по одной бисеринке. Выберите «Кисть» и жёлтый, затем закрасьте 22 отмеченные бисеринки: контур первого ромба. |
| 4 | Fill · 2 | **Fill the rhombus** Fill stops at the outline, so only the inside changes. Keep yellow, choose Fill and fill inside the rhombus. | **Залейте ромб** Заливка останавливается на контуре, поэтому меняется только середина. Оставьте жёлтый, выберите «Заливку» и залейте ромб внутри. |
| 5 | Paint · 1 | **Paint the eye** Choose Paint and black, then paint the 16 marked beads inside: a small ring and its centre. | **Нарисуйте глазок** Выберите «Кисть» и чёрный, затем закрасьте 16 отмеченных бисеринок внутри: маленькое кольцо и его середину. |
| 6 | Select · 3 | **Copy the rhombus** Select draws a frame around beads you want to reuse. Select the rhombus, press Copy, then paste it into each of the four outlines below. | **Скопируйте ромб** «Выделение» обводит бисеринки, которые нужно повторить. Выделите ромб, нажмите «Копировать» и вставьте его в каждый из четырёх контуров ниже. |
| 7 | Undo · Ctrl/Cmd+Z | **We'll finish the rest** The small gold beads between the rhombuses and the rounded ends go in as one change, so one Undo would take them all back. Press Next to watch. | **Остальное доделаем мы** Золотые бисеринки между ромбами и скруглённые концы добавятся одним изменением: одна отмена убрала бы их все. Нажмите «Далее» и смотрите. |
| 8 | Eraser · Del | **Erase the stray bead** Eraser empties a bead. One bead sits outside the rounded corner: choose Eraser and remove it. | **Сотрите лишнюю бисеринку** Ластик убирает бисеринку. Одна осталась за скруглённым углом: выберите «Ластик» и сотрите её. |
| 9 | Remove line | **Remove a line** Remove line takes out a whole row or column. Remove any one, then press Undo to bring it back. | **Удалите линию** «Удалить линию» убирает целый ряд или столбец. Удалите любой, затем нажмите «Отменить», чтобы вернуть его. |
| 10 | Size | **Change the size** Size adds or removes rows and columns at the edge. Press − or + next to Columns, look at the Pattern, then press Undo. | **Измените размер** «Размер» добавляет или убирает ряды и столбцы с края. Нажмите − или + у столбцов, посмотрите на схему, затем нажмите «Отменить». |
| 11 | Row progress · P | **Track your rows** Row progress keeps your place while you weave. Turn it on, press Row done three times, then Row not done once to open row 3 again. | **Отмечайте ряды** Прогресс по рядам запоминает, где вы остановились. Включите его, трижды нажмите «Ряд готов», затем один раз «Ряд не готов», чтобы вернуть ряд 3. |
| final | Export | **Your first Pattern is ready** Take it to the loom: Export makes a PDF to print, a PNG, a QR code or the Pattern file. To walk through again, open the menu and choose Take the tour. [Keep editing] [Export] | **Ваша первая схема готова** Пора за станок: «Экспорт» сделает PDF для печати, PNG, QR-код или файл схемы. Чтобы пройти шаги снова, откройте меню и выберите «Пройти обучение». [Продолжить] [Экспортировать] |
| card | | {n} of 11 · Next · Skip tour | {n} из 11 · Далее · Пропустить обучение |
| fallback | | This control isn't on screen. Next does this step for you. | Этого элемента сейчас нет на экране. «Далее» сделает шаг за вас. |
| Skip toast | | Tour put aside for now. Pick it up from the menu any time. | Обучение отложено на потом. Вернуться к нему можно из меню в любой момент. |
| screen reader | | Tour, step {n} of 11: {title} · Next: {control}, in {place}. | Обучение, шаг {n} из 11: {title} · Далее: {control}, в «{place}». |

Tour words: the Tour / обучение (lowercase in Russian, like any noun); rhombus / ромб; eye / глазок; Remove line / «Удалить линию».

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
| Frame set. 1 bead was in the margin and moved outside it. · Undo | Рамка задана. 1 бисеринка была в поле рамки и перемещена за его пределы. · Отменить |
| Hand · Rulers | Рука · Линейки |
| scroll or space drag to move · scroll to zoom | прокрутка или пробел и перетаскивание: сдвиг · прокрутка: масштаб |
| Frame (optional) | Рамка (необязательно) |
| Leave it empty to draw anywhere. Set Frame later, before you export. | Оставьте пустым, чтобы рисовать где угодно. Рамку можно задать позже, перед экспортом. |
| A picture needs a Frame size. It becomes the first piece, and you can still draw outside it. | Для картинки нужен размер рамки. Она станет первым фрагментом, а рисовать можно и за рамкой. |
