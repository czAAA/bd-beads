# Canvas copy

The copy approved for the Canvas area's strings (`canvas`, `rowProgress`, `removeLine`: `src/i18n/translations/canvas.ts` and each language's `canvas.ts`), ticket by ticket in the order it was approved. The rules it follows are in [`writing.md`](../writing.md). A new ticket's approved copy goes at the end of this file.

## First-run welcome copy (tickets 0725, 0738, 0795, 0798, 0920)

The welcome over an empty Project (FirstRunHints card): the next step, and one quiet line under it on where Projects are kept. On touch the next step is the Paint tool's own Tooltip (`tooltips.paint`), so it is not new copy; with a mouse it is the same sentence in mouse words (Voice, A help line fits the device in hand). The path to a Project file is no longer on the welcome (ticket 0920): the Project panel and the Save reminder carry it. The bar's no-Frame line (ProgressBar card, ticket 0944) and the CanvasHint keep their own strings. Ticket 0798 took the captions beside the controls away, so nothing else is written over an empty Project.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Tap or drag to place beads in the chosen color. (welcome, lead, on touch: the Paint tool's Tooltip) | Нажмите или проведите, чтобы ставить бисеринки выбранного цвета. | Торкніться або проведіть, щоб ставити бісерини вибраного кольору. | Націсніце або правядзіце, каб ставіць бісерынкі абранага колеру. | 点按或拖动，放上所选颜色的珠子。 | Toca o arrastra para poner cuentas del color elegido. | Dotknij lub przeciągnij, aby kłaść koraliki wybranego koloru. |
| Click or drag to place beads in the chosen color. (welcome, lead, with a mouse; ticket 0920) | Щёлкните или проведите, чтобы ставить бисеринки выбранного цвета. | Клацніть або проведіть, щоб ставити бісерини вибраного кольору. | Пстрыкніце або правядзіце, каб ставіць бісерынкі абранага колеру. | 点击或拖动，放上所选颜色的珠子。 | Haz clic o arrastra para poner cuentas del color elegido. | Kliknij lub przeciągnij, aby kłaść koraliki wybranego koloru. |
| Your Projects are saved only in this browser, on this device. (welcome, the quiet line under the lead; ticket 0920) | Ваши проекты сохранены только в этом браузере, на этом устройстве. | Ваші проєкти збережено лише в цьому браузері, на цьому пристрої. | Вашы праекты захаваны толькі ў гэтым браўзеры, на гэтай прыладзе. | 你的项目只保存在这台设备的浏览器里。 | Tus proyectos se guardan solo en este navegador, en este dispositivo. | Twoje projekty są zapisane tylko w tej przeglądarce, na tym urządzeniu. |

The storage line was approved on the canvas "openbeads first-run: decluttered welcome" (board A), the captions of which are gone (ticket 0798); ticket 0920 (Impeccable UX audit, UX-001) put the next step above it and took away the lines on clearing the browser's data and the path, so a stranger is first told what to do, not how to lose work she has not made. The mouse words of the lead are proposals for review with the build. The storage line says the fact plainly, without alarm words ("without warning", "delete").

## Help lines by device copy (ticket 0846)

The touch words of the help lines (Voice, A help line fits the device in hand): the Canvas hint (CanvasHint card), the empty Canvas's pan sentence (EmptyCanvas card), the converter's empty preview (ConvertImage card) and the first-run welcome's lead (FirstRunHints card; its copy is in First-run welcome copy). With a keyboard each keeps its key words, its key read off the device.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| two fingers to move · pinch to zoom | два пальца: сдвиг · сведение пальцев: масштаб | два пальці: зсув · зведення пальців: масштаб | два пальцы: зрух · звядзенне пальцаў: маштаб | 双指移动 · 双指捏合缩放 | dos dedos para mover · pellizca para hacer zoom | dwa palce, aby przesunąć · uszczypnij, aby powiększyć |
| Drag the Canvas around with two fingers. | Двигайте холст двумя пальцами. | Переміщуйте полотно двома пальцями. | Перасоўвайце палатно двума пальцамі. | 用两根手指拖动画布。 | Mueve el lienzo arrastrando con dos dedos. | Przesuwaj płótno dwoma palcami. |
| Your picture shows here · Choose a file, paste or take a photo | Здесь появится ваше изображение · Выберите файл, вставьте или сфотографируйте | Тут з’явиться ваше зображення · Виберіть файл, вставте або сфотографуйте | Тут з’явіцца ваша выява · Выберыце файл, устаўце або сфатаграфуйце | 你的图片会显示在这里 · 选择文件、粘贴或拍照 | Tu imagen se verá aquí · Elige un archivo, pega o haz una foto | Tu pojawi się twój obraz · Wybierz plik, wklej albo zrób zdjęcie |

English follows the audit's proposal (F-01-10, F-03-15); the other languages are proposals for review with the build.

## Row in view copy (ticket 0934)

After Row done, Back a row and Go to row the announcer says where the weaving is, in the counter's own words, once per move (ScreenReaders card): `{unit}` is Row or Column, a Custom frame says its pass as the counter does ("Round 3 of 9"), and the last pass done says Pattern done. Show row sits beside Go to row's name (ProgressBar card).

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| {unit} {current} of {total} (announced) | {unit} {current} из {total} | {unit} {current} з {total} | {unit} {current} з {total} | 第 {current} {unit}，共 {total} {unit} | {unit} {current} de {total} | {unit} {current} z {total} |
| Pass {current} of {total}, row {line} (announced, peyote) | Проход {current} из {total}, ряд {line} | Прохід {current} з {total}, ряд {line} | Праход {current} з {total}, рад {line} | 第 {current} 趟，共 {total} 趟，第 {line} 行 | Pasada {current} de {total}, fila {line} | Przejście {current} z {total}, rząd {line} |
| Pass {current} of {total}, column {line} | Проход {current} из {total}, столбец {line} | Прохід {current} з {total}, стовпець {line} | Праход {current} з {total}, слупок {line} | 第 {current} 趟，共 {total} 趟，第 {line} 列 | Pasada {current} de {total}, columna {line} | Przejście {current} z {total}, kolumna {line} |
| Show row (Go to row's button) | Показать ряд | Показати ряд | Паказаць рад | 显示当前行 | Mostrar fila | Pokaż rząd |
| Show column | Показать столбец | Показати стовпець | Паказаць слупок | 显示当前列 | Mostrar columna | Pokaż kolumnę |

English follows the audit's proposal (UX-015, UX-017); the other languages are proposals for review with the build.

## The Progress bar's words (ticket 0972)

The counter names its step in the announcer's words: `{unit} {current} of {total}` above ("Row 7 of 10", "Pass 3 of 27" on peyote, with "· row 2" after it); the announcer reads the same step with the rulers' row, `{step}, row {line}`. Where the number counts passes, Go to row is Go to pass, the noun of its field, and an Info button beside its name holds the passes sentence. The back step says where it goes.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Back a row | Назад на ряд | Назад на ряд | Назад на рад | 退回一行 | Atrás una fila | Rząd wstecz |
| Back a column | Назад на столбец | Назад на стовпець | Назад на слупок | 退回一列 | Atrás una columna | Kolumna wstecz |
| This row is marked done. Press Back a row to change it. | Этот ряд отмечен как готовый. Нажмите «Назад на ряд», чтобы изменить его. | Цей ряд позначено як готовий. Натисніть «Назад на ряд», щоб змінити його. | Гэты рад пазначаны як гатовы. Націсніце «Назад на рад», каб змяніць яго. | 这一行已标记为完成。按“退回一行”即可更改。 | Esta fila está marcada como terminada. Pulsa «Atrás una fila» para cambiarla. | Ten rząd jest oznaczony jako gotowy. Naciśnij „Rząd wstecz”, aby go zmienić. |
| {step}, row {line} (announced, peyote) | {step}, ряд {line} | {step}, ряд {line} | {step}, рад {line} | {step}，第 {line} 行 | {step}, fila {line} | {step}, rząd {line} |
| Go to pass | Перейти к проходу | Перейти до проходу | Перайсці да прахода | 跳到趟 | Ir a la pasada | Przejdź do przejścia |
| What a pass is (Info button) | Что такое проход | Що таке прохід | Што такое праход | 什么是趟 | Qué es una pasada | Czym jest przejście |

English follows the audit (UX-059, UX-062, UX-063); whether a peyote beader says "pass" or "row" for a step is open for a beader's answer.
