# Tools copy

The copy approved for the Tools area's strings (`toolPill`, `mirror`, `tools`, `toolbox`, `contextBar`, `inputMode`, `shortcutsHelp`, `tooltips`: `src/i18n/translations/tools.ts` and each language's `tools.ts`), ticket by ticket in the order it was approved. The rules it follows are in [`writing.md`](../writing.md). A new ticket's approved copy goes at the end of this file.

## Fill reach copy (ticket 0715)

The two toasts (Message card, info tone) after a Fill tool press on the Canvas that Fill reach refuses: what happened, then what to do, as the Error pattern. The Selection bar's Fill is the way to fill a chosen area, so both name selecting.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Nothing encloses this spot. Select an area to fill it. | Это место ничем не окружено. Выделите область, чтобы залить её. | Це місце нічим не оточене. Виділіть область, щоб залити її. | Гэта месца нічым не акружана. Вылучыце вобласць, каб заліць яе. | 这里没有被围住。选择一个区域即可填充。 | Nada rodea este punto. Selecciona un área para rellenarla. | Nic nie otacza tego miejsca. Zaznacz obszar, aby go wypełnić. |
| Too big to fill. Zoom in, or select an area. | Слишком большая область для заливки. Увеличьте масштаб или выделите область. | Завелика область для заливки. Збільште масштаб або виділіть область. | Завялікая вобласць для заліўкі. Павялічце маштаб або вылучыце вобласць. | 区域太大，无法填充。放大画布，或选择一个区域。 | Demasiado grande para rellenar. Acerca la vista o selecciona un área. | Za duży obszar do wypełnienia. Powiększ widok lub zaznacz obszar. |

## Grid focus copy (ticket 1002): gone

Ticket 1007 removed Grid focus: its name, Tooltip line and disabled reason are gone from every language.

## A button says its name on touch (ticket 0927)

On the iPad most buttons are icons, and only a half-second hold shows a name. The touch hint line now says so, a Tool pill tile's first tap says its Tooltip's name and line in a toast, and Help has a row that shows every strip and pill name at once. `{name}` and `{line}` are the tile's Tooltip's own words, not copies.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| hold a button for its name (the touch hint's last part) | удержание кнопки: её название | утримання кнопки: її назва | утрыманне кнопкі: яе назва | 长按按钮查看名称 | mantén un botón para ver su nombre | przytrzymaj przycisk, aby zobaczyć nazwę |
| {name}: {line} (toast, a tile's first tap) | {name}: {line} | {name}: {line} | {name}: {line} | {name}：{line} | {name}: {line} | {name}: {line} |
| What the buttons do (Menu › Help) | Что делают кнопки | Що роблять кнопки | Што робяць кнопкі | 按钮的作用 | Qué hace cada botón | Co robią przyciski |

## The Radial toolbox's words (approved 2026-11-18; the right click's are in the app, ticket 1064)

The Canvas hint's last part, for the device in hand (CanvasHint and RadialToolbox cards): with a keyboard it says the right click (ticket 1064), on touch the hold (ticket 1065). "Tools" stands for the Tool pill, colours included, and keeps the line short. Keyboard shortcuts' row, "Tools at the pointer", carries both (ShortcutsHelp card). The ring's items have no words of their own: each takes its existing control's name. The owner approved the English; the other languages follow the hint's own patterns and are for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| right-click for tools (the keyboard hint's last part) | щелчок правой кнопкой: инструменты | клацання правою кнопкою: інструменти | пстрычка правай кнопкай: інструменты | 右键点击打开工具 | clic derecho para ver las herramientas | kliknij prawym przyciskiem, aby otworzyć narzędzia |
| hold the Canvas for tools (the touch hint's last part) | удержание на холсте: инструменты | утримання на полотні: інструменти | утрыманне на палатне: інструменты | 长按画布打开工具 | mantén el lienzo para ver las herramientas | przytrzymaj płótno, aby otworzyć narzędzia |
| Tools at the pointer (Keyboard shortcuts, Canvas group) | Инструменты у указателя | Інструменти біля вказівника | Інструменты каля паказальніка | 指针旁的工具 | Herramientas junto al puntero | Narzędzia przy wskaźniku |

English follows the audit's proposal (UX-006); the other languages are proposals for review with the build.

## Mirror area grows to fit (ticket 1027)

A setting on the Mirror bar that a Canvas Area's size does not fit grows the Area, and an info toast (Message card) says so, once per action, naming the new size as the bar's readout writes it (`{size}`, columns×rows), the Mode `{mode}` (the bar's own segment name) and only the counts it grew for, `{axes}`: one direction's count, or both joined. For Fold 4 the Radial line stands alone. Counts take each language's plural forms. The Stepper's + says why it is off where no size fits another Axis.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Mirror area grown to {size} so {mode} with {axes} lines up. | Область отражения увеличена до {size}, и «{mode}» с {axes} ложится ровно. | Область відображення збільшено до {size}, і «{mode}» з {axes} лягає рівно. | Вобласць адлюстравання павялічана да {size}, і «{mode}» з {axes} кладзецца роўна. | 镜像区域已扩大到 {size}，让“{mode}”的{axes}对齐。 | Área del espejo ampliada a {size} para que {mode} con {axes} quede alineado. | Obszar odbicia powiększony do {size}, aby tryb „{mode}” z {axes} pasował. |
| Mirror area grown to {size} so Radial with Fold {count} lines up. | … и «По кругу» на {count} часть / части / частей ложится ровно. | … і «По колу» на {count} частину / частини / частин лягає рівно. | … і «Па крузе» на {count} частку / часткі / частак кладзецца роўна. | …，让“环绕”的 {count} 份对齐。 | … para que Radial con {count} parte / partes quede alineado. | …, aby obrót „Wokół środka” na {count} część / części pasował. |
| {count} Left–right axis / axes | {count} осью / осями слева направо | {count} віссю / осями зліва направо | {count} воссю / восямі злева направа | {count} 条左右轴 | {count} eje / ejes izquierda–derecha | {count} osią / osiami lewo–prawo |
| {count} Top–bottom axis / axes | {count} осью / осями сверху вниз | {count} віссю / осями згори донизу | {count} воссю / восямі зверху ўніз | {count} 条上下轴 | {count} eje / ejes arriba–abajo | {count} osią / osiami góra–dół |
| {leftRight} and {topBottom} | {leftRight} и {topBottom} | {leftRight} і {topBottom} | {leftRight} і {topBottom} | {leftRight}和{topBottom} | {leftRight} y {topBottom} | {leftRight} i {topBottom} |
| In Mirror mode the half-bead shift lines up no more axes: try Repeat. (the + Tooltip) | В режиме «Отражение» сдвиг на половину бисеринки не даёт больше осей: попробуйте «Повтор». | У режимі «Відображення» зсув на пів бісерини не дає більше осей: спробуйте «Повтор». | У рэжыме «Адлюстраванне» зрух на паўпацеркі не дае больш восей: паспрабуйце «Паўтор». | 在“镜像”模式下，半珠错位无法对齐更多轴：请试试“重复”。 | En modo Espejo el desfase de media cuenta no alinea más ejes: prueba con Repetir. | W trybie „Odbicie” przesunięcie o pół koralika nie pozwala na więcej osi: spróbuj „Powtórz”. |

English follows the ticket, tightened to name each count with its own noun ("2 Left–right axes and 1 Top–bottom axis"); Russian rewrites the ticket's «чтобы … совпадал» as «и … ложится ровно», so the verb agrees with every Mode and the Area keeps the app's word, «область отражения». The other languages are proposals for review with the build.

## Keyboard shortcuts in Menu (ticket 1159)

Keyboard shortcuts became Menu › Help's Subpanel (ShortcutsHelp card), and lists the keys and gestures the editor already answered but never named: one chord per row, each row named for its way, the Palette's one row split in three, and a group for the keys on a focused handle with its condition line. The English follows the card's table; the other languages use each one's own words for the Frame, Piece, Mirror area, reference image, handle and bead, and are for review with the build. The Show key hints row is now a Switch, so its On and Off are gone.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Move it from any tool (middle-drag) | Двигать его при любом инструменте | Рухати його будь-яким інструментом | Рухаць яго любым інструментам | 任何工具下都可移动 | Moverlo con cualquier herramienta | Przesuń je dowolnym narzędziem |
| Scroll the Canvas (wheel) | Прокручивать холст | Прокручувати полотно | Пракручваць палатно | 滚动画布 | Desplazar el lienzo | Przewiń płótno |
| Scroll it sideways (Shift + wheel) | Прокручивать его вбок | Прокручувати його вбік | Пракручваць яго ўбок | 横向滚动画布 | Desplazarlo de lado | Przewiń je w bok |
| Zoom on a trackpad (pinch) | Менять масштаб на трекпаде | Змінювати масштаб на трекпаді | Змяняць маштаб на трэкпадзе | 在触控板上缩放 | Hacer zoom en un trackpad | Powiększ na gładziku |
| Tools at a finger or Pencil (hold) | Инструменты у пальца или Pencil | Інструменти біля пальця або Pencil | Інструменты каля пальца або Pencil | 手指或 Pencil 旁的工具 | Herramientas junto al dedo o el Pencil | Narzędzia przy palcu lub Pencil |
| On a handle (the group) | На маркере | На маркері | На маркеры | 在控点上 | En un tirador | Na uchwycie |
| Tab to the handle first, then: (its line) | Сначала перейдите к маркеру клавишей Tab, затем: | Спершу перейдіть до маркера клавішею Tab, потім: | Спачатку перайдзіце да маркера клавішай Tab, потым: | 先用 Tab 移到控点，然后： | Primero llega al tirador con Tab, luego: | Najpierw przejdź do uchwytu klawiszem Tab, potem: |
| Move the selection, Piece or Mirror area | Двигать выделение, кусочек или область отражения | Рухати виділення, шматочок або область відображення | Рухаць вылучэнне, кавалачак або вобласць адлюстравання | 移动选区、小块或镜像区域 | Mover la selección, el trozo o el área del espejo | Przesuń zaznaczenie, kawałek lub obszar odbicia |
| Move the Frame | Двигать рамку | Рухати рамку | Рухаць рамку | 移动边框 | Mover el marco | Przesuń ramkę |
| Resize the Frame | Менять размер рамки | Змінювати розмір рамки | Змяняць памер рамкі | 调整边框大小 | Cambiar el tamaño del marco | Zmień rozmiar ramki |
| Move the reference picture | Двигать подложку | Рухати підкладку | Рухаць падкладку | 移动参考图 | Mover la imagen de referencia | Przesuń obraz pomocniczy |
| … ten beads at a time | … на десять бисеринок за раз | … на десять бісерин за раз | … на дзесяць бісерынак за раз | ……每次十颗珠子 | … diez cuentas a la vez | … o dziesięć koralików naraz |
| Move a Palette color | Переставить цвет палитры | Переставити колір палітри | Пераставіць колер палітры | 移动调色板颜色 | Mover un color de la paleta | Przestaw kolor palety |
| A recent color (Shift + 1…3) | Недавний цвет | Нещодавній колір | Нядаўні колер | 最近使用的颜色 | Un color reciente | Ostatni kolor |
| Palette colors 1 to 6 (Shift + 4…9) | Цвета палитры с 1 по 6 | Кольори палітри з 1 по 6 | Колеры палітры з 1 па 6 | 调色板颜色 1 至 6 | Colores 1 a 6 de la paleta | Kolory palety od 1 do 6 |
| Palette color 7 (Shift + 0) | Цвет палитры 7 | Колір палітри 7 | Колер палітры 7 | 调色板颜色 7 | Color 7 de la paleta | Kolor palety 7 |
| Show key hints (the first row, now a Switch; unchanged) | Показывать подсказки клавиш | Показувати підказки клавіш | Паказваць падказкі клавіш | 显示按键提示 | Mostrar atajos de teclado | Pokazuj podpowiedzi klawiszy |
