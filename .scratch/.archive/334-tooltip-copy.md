# 334: Tooltip copy for every control, in English and Russian

**What to build:** Put the copy below into the registry (ticket 329) and `en.ts`/`ru.ts`. The rules, from the buttons audit:
- The name is the control's existing name in sentence case, with product nouns capitalized. Reuse the existing Russian name.
- The body is one imperative sentence ending in a full stop.
- Keys appear only in the key chip, never in the text.
- Never "Click to …": on touch the Tooltip opens with a long press.
- Lists are written as "A, B, C." and built from the item names, so they never drift.

Russian bodies are drafts: check them in review.

**Spec:** 343 (unified controls spec)

**Blocked by:** 329

**Status:** done

## Copy

| Control | Name | Key | Body | Disabled body |
| --- | --- | --- | --- | --- |
| Paint | Paint | 1 | Right-click erases. / Правая кнопка мыши стирает. | |
| Fill | Fill | 2 | Right-click erases the area. / Правая кнопка мыши стирает область. | |
| Select | Select | 3 | Then copy and paste, or remove. / Затем скопируйте и вставьте или удалите. | |
| Eraser | Eraser | 4 | Delete empties the Selection. / Delete очищает выделение. | |
| Hand | Hand | 5 | Drag to move around the canvas. / Перетаскивайте, чтобы двигать холст. | |
| Set Frame (every place) | Set Frame | 6 | Drag to mark which beads are the Pattern. / Проведите, чтобы отметить, какие бусины входят в схему. | |
| Dock: Tool | (active tool's name) | | {Paint, Fill, Select, Eraser, Hand}. | |
| Dock: Frame | Frame | | {Set Frame, Rotate, Copy, Paste}. | |
| Dock: Colors | Colors | | Set up the colors to paint with. / Настройте цвета для рисования. | |
| Dock: Project / Project sheet | Project | | {the Project sheet's items}. | |
| Menu (Dock, header, phone bar) | Menu | | {the Menu's items}. | |
| Remove Frame | Remove Frame | | Remove the Frame. Beads stay where they are. / Убрать рамку. Бусины останутся на месте. | There is no Frame to remove. / Рамки нет. — or: Turn off Row progress to change the Frame. / Выключите прогресс рядов, чтобы менять рамку. |
| Remove row/column | Remove row/column | Shift+Del | Remove the selected row or column and close the gap. / Удалить выбранный ряд или столбец и сдвинуть остальное. | Select one whole row or column first. / Сначала выделите целый ряд или столбец. — or: the Row progress reason |
| Clear | Clear | | Clear everything from the canvas. / Очистить весь холст. | |
| Palette swatch, Image color swatch, Canvas color swatch | Color | Shift+key (palette only) | #hex | |
| Remove added swatch × | (none) | | | |
| Custom color | Custom color | | Add a color to the Palette, up to {max}. / Добавьте цвет в палитру, не больше {max}. | The Palette is full: {max} added colors. / Палитра заполнена: добавлено {max} цветов. |
| Image colors | (none when enabled) | | | This Project was not made from a picture. / Этот проект создан не из картинки. |
| Undo | Undo | Ctrl/Cmd+Z | | Nothing to undo. / Нечего отменять. |
| Redo | Redo | Ctrl/Cmd+Shift+Z | | Nothing to redo. / Нечего повторять. |
| Copy | Copy | Ctrl/Cmd+C | | Select an area first. / Сначала выделите область. |
| Paste | Paste | Ctrl/Cmd+V | | Copy an area first. / Сначала скопируйте область. |
| Rotate | Rotate | Shift+R | Turn the Frame a quarter turn. / Повернуть рамку на четверть оборота. | Set a Frame first. / Сначала задайте рамку. — or: Turn off Row progress to rotate. / Выключите прогресс рядов, чтобы повернуть. |
| Frame number chip | Frame {n} | | Bring it into view. / Показать её на холсте. | |
| Fit to drawing | Fit to drawing | | Fit the Frame around every bead. / Подогнать рамку под все бусины. | There are no beads to fit. / Нет бусин, под которые можно подогнать рамку. (disabled whenever the canvas has no beads) — or: the Row progress reason |
| Width/height steppers | Decrease width, Increase width, Decrease height, Increase height | | | the Row progress reason |
| Quantities expand | Show all / Show fewer | | | |
| Done (setting a Frame) | Done | Escape | | |
| Clear selection × | Clear selection | Escape | | |
| Cancel (paste) | Cancel | Escape | | |
| Rulers | Rulers | R | | |
| Row progress (switch and Zoom pill button) | Row progress | P | | Set a Frame first. / Сначала задайте рамку. (disabled while there is no Frame) |
| Zoom out, Zoom in | Zoom out, Zoom in | Ctrl/Cmd+−, Ctrl/Cmd++ | | Already zoomed out as far as it goes. / Дальше уменьшать некуда. (zoom out at the floor); Already zoomed in as far as it goes. / Дальше увеличивать некуда. (zoom in at the top) |
| Fit (zoom) | Fit | Ctrl/Cmd+0 | Zoom to fit everything. / Показать всё целиком. | |
| Canvas color | Canvas color | | Set the background color. / Задать цвет фона. | |
| Turn row direction | Turn row direction | D | | |
| Row not done | Row not done | Shift+Enter, Shift+Space | | |
| Row done | Row done | Enter, Space | | |
| Keyboard shortcuts | Keyboard shortcuts | ? | | |
| Close × (dialogs, sheets, toasts, messages) | Close | Escape (dialogs only) | | |
| Theme options | Match device, Light, Dark, High contrast | | | |
| New Project | New Project | | Start an empty canvas. / Начать с пустого холста. | |
| Import a file | Import a file | | Open a Project from a file. / Открыть проект из файла. | |
| Import QR code | Import QR code | | Open a Project from a QR code. / Открыть проект по QR-коду. | |
| Current Project summary | (the Project's name) | | (the Project summary) | |
| Saved Projects | Saved Projects | | | |
| Saved Projects: project row | (the Project's name) | | | |
| Save Project | Save Project | Ctrl/Cmd+S | Save to a file on this device. / Сохранить в файл на этом устройстве. | |
| Name on exports: Change | Change | | Change the maker's name printed on exports. / Изменить имя мастера на экспорте. | |
| Convert image | Convert image | | Turn a picture into a Pattern. / Превратить картинку в схему. | |

Everything the buttons audit marks "none" gets no Tooltip, only its `aria-label`: the menu items, Language switcher, Export menu items, dialog buttons, toast actions, Overview controls, Saved Projects remove × and Export project/library.

- [ ] Every row above is in the registry with English and Russian strings
- [ ] No native `title` is left in `src/` (a lint or grep check in CI)
- [ ] A test checks that every registry action has a name in both languages, and a `disabledBody` when it can be disabled
