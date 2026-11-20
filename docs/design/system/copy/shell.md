# Shell copy

The copy approved for the Shell area's strings (`app`, `form`, `fields`, `size`, `header`, `theme`, `languageSwitcher`, `shell`, `storage`, `opening`, `a11y`: `src/i18n/translations/shell.ts` and each language's `shell.ts`), ticket by ticket in the order it was approved. The rules it follows are in [`writing.md`](../writing.md). A new ticket's approved copy goes at the end of this file.

## A Project that won't open copy (ticket 0716)

The notice row after a load that found the safe start's note still set (Message card, warning tone), the question before a Project over the size gate opens (ConfirmDialogs card), the Projects library's rows for a sealed Project and a count not yet in (MenuPanel card), and the Homepage's second button, which is the Menu row's own name and the count ("Projects library · 3"), so it needs no string of its own. The size warning gives the count in millions: Russian, Ukrainian, Belarusian and Polish write «млн» / "mln", which takes no plural form after a number.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| “{name}” didn't open last time. | Проект «{name}» не открылся в прошлый раз. | Проєкт «{name}» не відкрився минулого разу. | Праект «{name}» не адкрыўся ў мінулы раз. | “{name}”上次没有打开。 | «{name}» no se abrió la última vez. | Projekt „{name}” nie otworzył się ostatnim razem. |
| Remove · Save Project file (the Project panel's own words since ticket 0859) | Удалить · Сохранить файл проекта | Видалити · Зберегти файл проєкту | Выдаліць · Захаваць файл праекта | 移除 · 保存项目文件 | Quitar · Guardar archivo de proyecto | Usuń · Zapisz plik projektu |
| Open “{name}”? | Открыть «{name}»? | Відкрити «{name}»? | Адкрыць «{name}»? | 打开“{name}”？ | ¿Abrir «{name}»? | Otworzyć „{name}”? |
| {count} million beads. Opening may be slow or fail. | {count} млн бисеринок. Открытие может быть медленным или не удаться. | {count} млн бісерин. Відкриття може бути повільним або не вдатися. | {count} млн бісерынак. Адкрыццё можа быць павольным або не атрымацца. | {count} 百万颗珠子。打开可能很慢或失败。 | {count} millones de cuentas. Abrirlo puede ser lento o fallar. | {count} mln koralików. Otwieranie może być wolne lub się nie udać. |
| Open anyway · Cancel | Всё равно открыть · Отмена | Однаково відкрити · Скасувати | Усё адно адкрыць · Скасаваць | 仍然打开 · 取消 | Abrir igualmente · Cancelar | Otwórz mimo to · Anuluj |
| too big to count | слишком много, чтобы посчитать | забагато, щоб порахувати | зашмат, каб палічыць | 太多，无法计数 | demasiado para contar | za dużo, by policzyć |
| Counting pieces | Считаем части | Рахуємо частини | Лічым часткі | 正在计数小块 | Contando trozos | Liczenie kawałków |
| {count} beads | {count} бисеринка / бисеринки / бисеринок | {count} бісерина / бісерини / бісерин | {count} бісерынка / бісерынкі / бісерынак | {count} 颗珠子 | {count} cuenta / cuentas | {count} koralik / koraliki / koralików |
| made {created} · saved {saved} | создан {created} · сохранён {saved} | створено {created} · збережено {saved} | створаны {created} · захаваны {saved} | 创建于 {created} · 保存于 {saved} | creado {created} · guardado {saved} | utworzono {created} · zapisano {saved} |

Russian, Ukrainian, Belarusian, Spanish, Polish and Chinese are proposals for review with the build.

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

## Unnamed Project copy (ticket 0866)

A Project left unnamed is "Project 1", then the next free number as Duplicate counts ("Project 2" once "Project 1" is taken), never the Bead's name, which belongs in the Bead row. The same words are New Project's Name placeholder, so the grey text is the name the Project gets. The number always ends the name, after a space, in every language.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Project {number} (an unnamed Project's name and New Project's Name placeholder) | Проект {number} | Проєкт {number} | Праект {number} | 项目 {number} | Proyecto {number} | Projekt {number} |

## Update ready copy (ticket 1048)

"Update ready" (Message card) says what Reload switches to, in words the app already has: its name, the waiting Version as a number ("2.2.0", never "v2.2.0" or "version"), then the one note's kind label and line as What's new shows it, or each kind's label and count ("new 2 · changed 3 · fixed 5" as drawn, no plural forms, so no counted word). The second action is What's new's own name, so the link and the fold it opens say the same. When what waits can't be learned the toast keeps its plain words. No string is new.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| Update ready | Обновление готово | Оновлення готове | Абнаўленне гатова | 更新已就绪 | Actualización lista | Aktualizacja gotowa |
| Reload | Перезагрузить | Перезавантажити | Перазагрузіць | 重新加载 | Recargar | Załaduj ponownie |
| What's new | Что нового | Що нового | Што новага | 更新内容 | Novedades | Co nowego |

## Update ready's list (ticket 1091)

With two or more notes waiting, "Update ready"'s What's new opens the list of what waits in the toast (Message card): each row is a note's kind label and line as What's new shows them, so no string is new there. One string is new: when more than 10 wait, the link under the list to the rest on What's new, "{count} more in What's new". It names What's new by its own name and has no plural forms in any language (the count stands apart from any counted word). English and Russian are the canvas's, approved by the owner; the others follow their sense and are proposals for review with the build.

| English | Русский | Українська | Беларуская | 中文 | Español | Polski |
|---|---|---|---|---|---|---|
| {count} more in What's new | Ещё {count} в «Что нового» | Ще {count} у «Що нового» | Яшчэ {count} у «Што новага» | “更新内容”中还有 {count} 条 | {count} más en Novedades | Jeszcze {count} w „Co nowego” |
