# Panels copy

The copy approved for the Panels area's strings (`panels`, `techniques`, `weaveSettings`, `layerSettings`, `schemaTag`, `pieceName`: `src/i18n/translations/panels.ts` and each language's `panels.ts`), ticket by ticket in the order it was approved. The rules it follows are in [`writing.md`](../writing.md). A new ticket's approved copy goes at the end of this file.

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
| Delete all Projects? · Every Project is removed from this browser. This can't be undone. Export all first if you want to keep copies. · Clear this Project | Удалить все проекты? · Все проекты будут удалены из этого браузера. Это нельзя отменить. Сначала нажмите «Экспортировать все», если хотите сохранить копии. · Очистить этот проект |
| Delete this Project · Delete “{name}”? · “{name}” and its Row progress are removed from this browser. Save its Project file first if you want to keep it. · Save Project file · Delete Project | Удалить этот проект · Удалить «{name}»? · «{name}» и прогресс по рядам будут удалены из этого браузера. Если хотите оставить его себе, сначала сохраните файл проекта. · Сохранить файл проекта · Удалить проект |
| A Project needs a name. · Enter saves · Escape cancels | У проекта должно быть название. · Enter сохраняет · Esc отменяет |
| The Canvas stays white in high contrast. | В режиме высокой контрастности холст остаётся белым. |

Russian here is a proposal for review. The Technique explanation in Project is the app's existing note.

## Panels redesign (tickets 0553 to 0555)

`.openbeads` is named wherever a project file is read or written (Open Project file, Save all Projects to a Project file, Save Project file, the file picker's Tooltip, the error for a file that isn't one). The file has one name, "Project file": "Save Project file" out and "Open Project file" in, never Import, Export, Save a copy or File ready (ticket 0859; Project file copy). The `project`, `frame`, `name:` and `maker:` labels are lowercased by style in every language, like the section labels; `project` and `frame` are section headers, so they take no colon (ticket 0853).

| English | Русский |
|---|---|
| Projects library · Open Project file · Save all Projects to a Project file · Delete all Projects | Библиотека проектов · Открыть файл проекта · Сохранить всё в файл проекта · Удалить все проекты |
| No Projects yet · Projects you make are kept in this browser. Open a Project file to bring one in. | Проектов пока нет · Проекты хранятся в этом браузере. Откройте файл проекта, чтобы добавить проект. |
| {n} pieces · {n} unnamed · Frame {w} × {h} beads | Частей: {n} · без названия: {n} · Рамка {w} × {h} бисеринок |
| Writing hand · Right · Left · Buy me a coffee | Рабочая рука · Правая · Левая · Угостить кофе |
| Project · name: · maker: · Add your name for exports · Change the maker's name | проект · название: · автор: · Добавьте имя для экспорта · Изменить имя автора |
| Saved in this browser · Not saved yet · Saved in openbeads cloud · Not in openbeads cloud: sign in to sync | Сохранено в этом браузере · Ещё не сохранено · Сохранено в облаке openbeads · Не в облаке openbeads: войдите, чтобы синхронизировать |
| Brand · Type · Size | Бренд · Тип · Размер |
| Project file · Picture · Printable chart · Clear all beads · Delete Project | Файл проекта · Картинка · Схема для печати · Очистить все бисеринки · Удалить проект |
| Frame · Name this Frame · Rename Frame · Frame from template · Fit a Frame to the drawing · A Frame sets the size, the exports and the bead count. | рамка · Назовите рамку · Переименовать рамку · Рамка из шаблона · Рамка по рисунку · Рамка задаёт размер, экспорт и подсчёт бисеринок. |
| Estimated size · An estimate. · Rows are marked done. Reset progress to change the size. · Show all colors ({n}) | Примерный размер · Это оценка. · Ряды отмечены как готовые. Сбросьте прогресс, чтобы изменить размер. · Показать все цвета ({n}) |
| Stone · Pebble · Slate | Камень · Галька · Сланец |

Russian here is a proposal for review; the other five languages follow it in the app change.

## Layer settings copy (ticket 0670)

The one section that sets a layer (LayerSettings card). Its controls keep their names (Technique, Drop, Brand, Type, Size, Canvas color, Frame background); two words are new, and the Replace bead? choice of layer ("Where to replace the bead", Frame, Canvas) is gone.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Settings (the Frame panel's section) | Настройки | Налаштування | Налады | 设置 | Ajustes | Ustawienia |
| Background (the heading over the picker) | Фон | Фон | Фон | 背景 | Fondo | Tło |

"Bead" over the pickers is the Project panel's existing section word.

## Schema tag copy (ticket 0721)

An unframed Schema's name as a tag, opening into a paper tag (SchemaTag card). Rename, Frame and Close keep their existing words. The counts use `Intl.PluralRules` (Plurals and length): «96 бисеринок · 3 цвета», «1 бисеринка · 1 цвет».

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| {name}, show details (a tag's accessible name) | {name}, показать подробности | {name}, показати подробиці | {name}, паказаць падрабязнасці | {name}，显示详情 | {name}, ver detalles | {name}, pokaż szczegóły |
| Click for the size and colors. (the Tooltip's body, a tag with dots) | Нажмите, чтобы увидеть размер и цвета. | Натисніть, щоб побачити розмір і кольори. | Націсніце, каб убачыць памер і колеры. | 点击查看尺寸和颜色。 | Pulsa para ver el tamaño y los colores. | Kliknij, aby zobaczyć rozmiar i kolory. |
| schema (the paper tag's label) | схема | схема | схема | 图样 | esquema | schemat |
| {w} × {h} beads · ≈ {x} × {y} mm | {w} × {h} бисеринок · ≈ {x} × {y} мм | {w} × {h} бісерин · ≈ {x} × {y} мм | {w} × {h} бісерын · ≈ {x} × {y} мм | {w} × {h} 颗珠子 · ≈ {x} × {y} 毫米 | {w} × {h} cuentas · ≈ {x} × {y} mm | {w} × {h} koralików · ≈ {x} × {y} mm |
| {n} beads · {n} colors | {n} бисеринок · {n} цветов | {n} бісерин · {n} кольорів | {n} бісерын · {n} колераў | {n} 颗珠子 · {n} 种颜色 | {n} cuentas · {n} colores | {n} koralików · {n} kolorów |
| Schema names (the tags' Tab stop) | Названия схем | Назви схем | Назвы схем | 图样名称 | Nombres de esquemas | Nazwy schematów |

The size line's "beads" stays in the many form whatever the numbers, as a measure («11 × 11 бисеринок»). Russian, Ukrainian, Belarusian, Spanish, Polish and Chinese are proposals for review with the build.

## Keep Projects copy (tickets 0839, 0936)

The browser is asked at the first Project file or export with no question of the app's first (ticket 0936; the Keep note and its "The browser didn't agree" Message were dropped). Its yes is said back (Message card); a no says nothing, as the Save reminder already carries the advice. The Menu row states the browser's answer as a fact, with the reason behind an Info button (MenuPanel card).

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| This browser will keep your Projects. (toast) | Этот браузер будет хранить ваши проекты. | Цей браузер зберігатиме ваші проєкти. | Гэты браўзер будзе захоўваць вашы праекты. | 此浏览器会保留你的项目。 | Este navegador conservará tus proyectos. | Ta przeglądarka zachowa Twoje projekty. |
| Kept by this browser · Yes · No (Menu row and its value) | Браузер хранит проекты · Да · Нет | Браузер зберігає проєкти · Так · Ні | Браўзер захоўвае праекты · Так · Не | 此浏览器保留项目 · 是 · 否 | Este navegador conserva los proyectos · Sí · No | Przeglądarka zachowuje projekty · Tak · Nie |
| About keeping Projects (the row's Info button) | О хранении проектов | Про зберігання проєктів | Пра захоўванне праектаў | 关于保留项目 | Sobre conservar proyectos | O zachowywaniu projektów |
| When the device runs short on space, the browser can clear this app's data, unless it keeps your Projects. The browser decides this by itself, so save a Project file of each one you care about. (its Tooltip) | Когда на устройстве мало места, браузер может удалить данные этого приложения, если он не хранит ваши проекты. Браузер решает это сам, поэтому сохраните файл проекта для каждого, который вам дорог. | Коли на пристрої мало місця, браузер може видалити дані цього застосунку, якщо він не зберігає ваші проєкти. Браузер вирішує це сам, тож збережіть файл проєкту для кожного, який вам дорогий. | Калі на прыладзе мала месца, браўзер можа выдаліць даныя гэтай праграмы, калі ён не захоўвае вашы праекты. Браўзер вырашае гэта сам, таму захавайце файл праекта для кожнага, які вам дарагі. | 设备空间不足时，浏览器可能会清除此应用的数据，除非它保留你的项目。这由浏览器自行决定，所以请为每个你在意的项目保存项目文件。 | Cuando el dispositivo se queda sin espacio, el navegador puede borrar los datos de esta app, salvo que conserve tus proyectos. El navegador lo decide por su cuenta, así que guarda un archivo de proyecto de cada uno que te importe. | Gdy na urządzeniu brakuje miejsca, przeglądarka może usunąć dane tej aplikacji, chyba że zachowuje Twoje projekty. Przeglądarka decyduje o tym sama, więc zapisz plik projektu każdego, na którym Ci zależy. |

English follows the audit's proposal (UX-019); the other languages are proposals for review with the build.

## Frame stays copy (ticket 0935)

The Project panel's canvas section says which layer it sets while a Frame is on the Canvas, and the toast after a change there that leaves the Frame on another Technique or Bead (Message card). `{canvas}` and `{frame}` are a Technique's name or a Bead's label.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Canvas, outside the Frame (section header) | Холст вне рамки | Полотно поза рамкою | Палатно па-за рамкай | 画布（边框之外） | Lienzo, fuera del marco | Płótno poza ramką |
| The Canvas is {canvas} now. The Frame stays {frame}. (toast) | Холст теперь: {canvas}. Рамка остаётся: {frame}. | Полотно тепер: {canvas}. Рамка лишається: {frame}. | Палатно цяпер: {canvas}. Рамка застаецца: {frame}. | 画布现在是{canvas}，边框仍是{frame}。 | El lienzo ahora es {canvas}. El marco sigue en {frame}. | Płótno to teraz: {canvas}. Ramka zostaje: {frame}. |
| Change the Frame too (its first action) | Изменить и рамку | Змінити й рамку | Змяніць і рамку | 边框也一起改 | Cambiar también el marco | Zmień też ramkę |
| Open Frame (its second action) | Открыть рамку | Відкрити рамку | Адкрыць рамку | 打开边框 | Abrir marco | Otwórz ramkę |

English follows the audit's proposal (UX-018); the other languages are proposals for review with the build.

## Lifted pieces copy (ticket 1042)

The Menu's Preferences switch for the Lifted piece (BeadBoard card), named in the plural, as it switches every Piece at once, and what it does behind its Info button: what a person sees with it on, then what Off leaves.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Lifted pieces | Приподнятые кусочки | Підняті шматочки | Прыпаднятыя кавалачкі | 浮起的小块 | Trozos en relieve | Uniesione kawałki |
| What Lifted pieces does (the Info button) | Что делают Приподнятые кусочки | Що роблять Підняті шматочки | Што робяць Прыпаднятыя кавалачкі | 浮起的小块的作用 | Para qué sirven los Trozos en relieve | Do czego służą Uniesione kawałki |
| Each piece lies on its own ground, with a thin line and a soft shadow round it. Switched off, pieces lie flat on the Canvas. | Каждый кусочек лежит на своей подложке, с тонкой линией и мягкой тенью вокруг. Если выключить, кусочки лежат на холсте плоско. | Кожен шматочок лежить на власній підкладці, з тонкою лінією та м’якою тінню навколо. Якщо вимкнути, шматочки лежать на полотні пласко. | Кожны кавалачак ляжыць на сваёй падкладцы, з тонкай лініяй і мяккім ценем вакол. Калі выключыць, кавалачкі ляжаць на палатне плоска. | 每个小块都衬在自己的底色上，周围有一条细线和柔和的阴影。关闭后，小块平铺在画布上。 | Cada trozo descansa sobre su propio fondo, con una línea fina y una sombra suave alrededor. Si lo apagas, los trozos quedan planos sobre el lienzo. | Każdy kawałek leży na własnym tle, z cienką linią i miękkim cieniem dookoła. Po wyłączeniu kawałki leżą płasko na płótnie. |

The languages other than English are proposals for review with the build.
