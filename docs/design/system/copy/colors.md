# Colors copy

The copy approved for the Colors area's strings (`colorNames`, `palette`, `replaceBead`: `src/i18n/translations/colors.ts` and each language's `colors.ts`), ticket by ticket in the order it was approved. The rules it follows are in [`writing.md`](../writing.md). A new ticket's approved copy goes at the end of this file.

## Replace bead? per layer (ticket 0687)

The confirmation asked from a layer's panel (ConfirmDialogs card): the layer, its Bead's size in mm before and after, then for the Frame its Estimated size, always in mm. Following the Confirm pattern: what changes, then that it can be undone. The other five languages say the same in the app.

| English | Русский |
|---|---|
| The Canvas's Bead changes from {old} to {new}. The Canvas will look different in proportion, but your design and its bead count stay exactly the same. You can undo this. | Бисер холста меняется с {old} на {new}. Пропорции холста будут выглядеть иначе, но рисунок и число бисеринок останутся точно такими же. Это действие можно отменить. |
| The Frame's Bead changes from {old} to {new}, so the Frame will be about {newSize} instead of {oldSize}. It will look different in proportion, but your design and its bead count stay exactly the same. You can undo this. | Бисер рамки меняется с {old} на {new}, поэтому рамка будет примерно {newSize} вместо {oldSize}. Её пропорции будут выглядеть иначе, но рисунок и число бисеринок останутся точно такими же. Это действие можно отменить. |

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

The BeadColors list made wider and quieter. The entry button is named for what it does with the Bead whose colors it lists: "Add {bead} colors", where `{bead}` is the Bead's label (Brand, Form factor and size, a literal in every language: "Miyuki Delica 11/0"). "Palette" means the Project's own swatches only, so the color popover says it once, as the label over the Project's grid (ticket 0960, UX-047: "Palette {bead}" under that label read as a second Palette); the Project's Palette keeps its words ("In the Palette", "Add {code} to the Palette"). The counts take the "Label: number" form in every language, so they need no plural. The two notes now in the Info button's Tooltip keep their existing words ("Approximate colors: …", "A color that comes out the same …"), and so do Clear filters and the empty-state sentences above. The entry's old name "Bead colors" (Convert image's match-to choice keeps it) and "Showing the first {count}. Search to narrow the list." are gone. Russian, Ukrainian, Belarusian, Chinese, Spanish and Polish are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Add {bead} colors (the entry button; "Palette {bead}" before ticket 0960) | Добавить цвета {bead} | Додати кольори {bead} | Дадаць колеры {bead} | 添加 {bead} 颜色 | Añadir colores de {bead} | Dodaj kolory {bead} |
| About these colors (the Info button's name) | Об этих цветах | Про ці кольори | Пра гэтыя колеры | 关于这些颜色 | Sobre estos colores | O tych kolorach |
| codes: {count} (the count line) | кодов: {count} | кодів: {count} | кодаў: {count} | 色号：{count} | códigos: {count} | kodów: {count} |
| first {count} shown | показаны первые {count} | показано перші {count} | паказаны першыя {count} | 显示前 {count} 个 | se muestran los primeros {count} | pokazano pierwsze {count} |
| Filters (the narrow layout's button) | Фильтры | Фільтри | Фільтры | 筛选 | Filtros | Filtry |
| Filters, {count} on (its name while values are on) | Фильтры, включено: {count} | Фільтри, увімкнено: {count} | Фільтры, уключана: {count} | 筛选，已开启 {count} 个 | Filtros, activos: {count} | Filtry, włączone: {count} |

## The Palette's letters and a Bead color pressed out (ticket 1092)

The Palette's Letters switch reuses the Frame's word, "Letters". A letter another color has is traded, never refused, and one line says which color got which. A row of the Bead colors list that the Palette holds says "In the Palette"; a default color's says "Default color", and a row whose color the Palette holds under another code says "Same color". The names of rows and swatches start with the words shown (WCAG 2.5.3).

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Show each color's letter on its swatch and on the Canvas's beads; the Frame has its own switch. (the Palette's Letters Tooltip) | Показывать букву цвета на его образце и на бисеринках холста; у рамки свой переключатель. | Показувати літеру кольору на його зразку й на бісеринах полотна; рамка має свій перемикач. | Паказваць літару колеру на яго ўзоры і на бісерынках палатна; у рамкі свой пераключальнік. | 在色块和画布的珠子上显示每种颜色的字母；边框有自己的开关。 | Muestra la letra de cada color en su muestra y en las cuentas del lienzo; el marco tiene su propio interruptor. | Pokazuj literę koloru na jego próbce i na koralikach płótna; ramka ma własny przełącznik. |
| {name}, letter {letter} (a swatch's name while it shows its letter) | {name}, буква {letter} | {name}, літера {letter} | {name}, літара {letter} | {name}，字母 {letter} | {name}, letra {letter} | {name}, litera {letter} |
| {letter}, change the letter of {name} (the letter button in Edit Palette) | {letter}, изменить букву цвета {name} | {letter}, змінити літеру кольору {name} | {letter}, змяніць літару колеру {name} | {letter}，更改 {name} 的字母 | {letter}, cambiar la letra de {name} | {letter}, zmień literę koloru {name} |
| Letter of {name} (its field) | Буква цвета {name} | Літера кольору {name} | Літара колеру {name} | {name} 的字母 | Letra de {name} | Litera koloru {name} |
| {name} is now {letter}. {other} had it and is now {otherLetter}. (after a trade) | {name}: теперь буква {letter}. Раньше она была у цвета {other}, теперь у него {otherLetter}. | {name}: тепер літера {letter}. Раніше вона була в кольору {other}, тепер у нього {otherLetter}. | {name}: цяпер літара {letter}. Раней яна была ў колеру {other}, цяпер у яго {otherLetter}. | {name} 的字母现在是 {letter}。{other} 原来用这个字母，现在是 {otherLetter}。 | {name} ahora es {letter}. {other} la tenía y ahora es {otherLetter}. | {name} ma teraz literę {letter}. Miał ją {other}, który ma teraz {otherLetter}. |
| Same color (a row whose color the Palette holds under another code) | Тот же цвет | Той самий колір | Той самы колер | 颜色相同 | Mismo color | Ten sam kolor |
| Default color (a default color's row) | Стандартный цвет | Стандартний колір | Стандартны колер | 默认颜色 | Color predeterminado | Kolor domyślny |
| {name}, in the Palette, a default color that can't be removed | {name}, в палитре, стандартный цвет, убрать нельзя | {name}, у палітрі, стандартний колір, прибрати не можна | {name}, у палітры, стандартны колер, прыбраць нельга | {name}，已在调色板，默认颜色无法移除 | {name}, en la paleta, un color predeterminado que no se puede quitar | {name}, w palecie, kolor domyślny, którego nie można usunąć |
| {name}, remove from the Palette (a row the Palette holds) | {name}, убрать из палитры | {name}, прибрати з палітри | {name}, прыбраць з палітры | {name}，从调色板移除 | {name}, quitar de la paleta | {name}, usuń z palety |
| {name}, in the Palette (the same row where nothing removes it) | {name}, в палитре | {name}, у палітрі | {name}, у палітры | {name}，已在调色板 | {name}, en la paleta | {name}, w palecie |
| A press on a code that is in the Palette takes it out again. (the Info button's third note) | Нажатие на код, который уже в палитре, убирает его из неё. | Натискання на код, який уже в палітрі, прибирає його з неї. | Націск на код, які ўжо ў палітры, прыбірае яго з яе. | 再按一次已在调色板中的色号，可将它移除。 | Al pulsar un código que ya está en la paleta, se quita de ella. | Naciśnięcie kodu, który jest już w palecie, usuwa go z niej. |
