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
| Canvas · Hand · Rulers | Полотно · Рука · Линейки | The drawing area, the tool that moves it, the row and column numbers |
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

The Canvas color button (Russian "Цвет полотна") offers five backgrounds in light and six in dark. The accessible name of each swatch is "{name}, {n} of {count}" (Russian "{name}, {n} из {count}").

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

The Overview and the header menu, as signed off. The same rules: plain and short, sentence case, product nouns capitalized, no exclamation marks, emoji, em dashes or "please". The Overview's slogan, its "save. count. export" line and its handwritten notes are the one place with a lighter, drawn voice; the Russian line uses "we" so it reads as "on us".

### Header menu and Overview

| English | Russian |
| --- | --- |
| Menu | Меню |
| Overview (menu link) | Обзор |
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
| Made by one person | Один человек |
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
| Help · Keyboard shortcuts · Overview · About · Source code · Version | Справка · Сочетания клавиш · Обзор · О приложении · Исходный код · Версия |
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
