# 171: Rotate: support 4 quarter-turn positions; auto-switch to Paint on color pick

**What to build:** Rotate cycles through all 4 quarter turns (0°/90°/180°/270°) instead of just 2 today, correctly updating the size estimate, Row direction mapping, Mirror axis handling, and export orientation at every position. Separately, picking a color while any other tool is active automatically switches the active tool to Paint.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Rotate button cycles 0° → 90° → 180° → 270° → 0°
- [ ] Estimated real-world size swaps width/height correctly at each quarter turn
- [ ] Row direction flips correctly relative to the current rotation, per the existing Row direction rule
- [ ] Mirror axis counts swap correctly at 90°/270° and are unaffected at 180° (Mirror's UI is hidden per #174, but the underlying logic must not break for patterns saved with mirror state)
- [ ] PDF/PNG exports render in the correct orientation at all 4 rotation states
- [ ] Selecting a color while Fill/Select/Eraser/etc. is active switches the active tool to Paint
