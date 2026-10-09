# Pen mode and Mouse mode decide per pointer, not per Tool

**Status: accepted.** Tickets 325, 326.

On an iPad, a palm or finger resting on the screen used to paint while the Apple Pencil was in use. The **input mode** (CONTEXT.md: Pen mode, Mouse mode) decides, for each pointer event by its `pointerType`, whether that pointer draws with the active Tool or moves the canvas: in Pen mode the pen draws and a finger or mouse moves the canvas; in Mouse mode a finger or mouse draws and the pen moves it (`pointerDraws`, `domain/inputMode.ts`).

- **It is decided per pointer, not by switching the Tool**, so a pen and a finger can be used together without touching the Toolbox, and the Tool stays whatever was picked.
- **Mouse mode is the default, and the toggle appears only once a pen has been seen** on this device, so a mouse or touch-only person never meets it. The mode and "a pen was seen" are kept on the device.
