# 267: Make the visual tests give the same answer on every machine

**Status:** done

**What to build:** The visual check's references are made on Linux, and a Mac failed it on things that are not bugs: light text on a dark pill anti-aliased differently (Convert image framing) and two titles that wrapped because the text was 0.2px wider than its box (text fit check).

**Done:**
- Chromium is launched with no font hinting, no LCD text and the sRGB profile (`playwright.config.ts`); every page load gets `text-rendering: geometricPrecision`, kerning on and no synthesized faces (`e2e/support/app.ts`). The references did not change.
- The text fit check reports a one-line control that wraps only when its text, set on one line, is more than 2px wider than its room (`e2e/support/textFit.ts`).
- The framing screenshots mask the pan hint, so no operating system's text anti-aliasing is compared; the references were remade without it.

**Left for later:** a Pinned Linux container for the visual check (needs Docker; not installed here). Nothing was run on Linux, so the references and the new tolerance are only confirmed on macOS: a human should check CI/Linux, and Docker would remove the doubt for good. No browser-free replacement was found for the text fit check: whether text wraps depends on layout.
