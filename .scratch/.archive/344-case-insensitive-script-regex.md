# 344: Match the pre-paint script tag case-insensitively in the theme test

**What to build:** Code scanning alert 1 (`js/bad-tag-filter`, "Bad HTML filtering regexp") flags the regexp in `src/theme/theme.test.ts` that pulls the inline pre-paint script out of `index.html`: it doesn't match upper case `<SCRIPT>` tags. Make it case-insensitive and tolerate whitespace in the closing tag.

**Blocked by:** None.

**Status:** done

- [x] The regexp has the `i` flag and accepts `</script >`
- [x] The theme tests still pass
