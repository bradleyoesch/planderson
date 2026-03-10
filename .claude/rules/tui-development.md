# TUI Development with render-tui

`bun run render-tui -- <file> [--keys <seq>] [--width N] [--height N] [--output <file>] [--watch]`

## Two tools, two jobs

**render-tui = development feedback** — use it while building to see what you're making. Iterate until it looks right. No tests needed yet.

**Snapshot tests = regression locks** — once it looks right in render-tui, add snapshots to catch future changes that accidentally break the layout, colors, or structure you just decided on.

These are separate phases. render-tui tells you when it's right; snapshots make sure it stays right.

## Development loop (render-tui)

Use `--watch` while actively building — it re-renders automatically whenever a file in `app/src/` changes (300ms debounce):

```bash
bun run render-tui -- dev/plan-test.md --keys c --watch
# save any .ts/.tsx file → screen clears and re-renders
```

Without `--watch`, run manually and read the output file:

```bash
bun run render-tui -- dev/plan-test.md --keys c --output /tmp/frames.txt
# Read /tmp/frames.txt to see raw ANSI — Bash strips color, Read tool does not
```

## Locking in decisions (snapshot tests)

Once render-tui confirms the output is correct, add a snapshot to lock it in. The snapshot content must come from the render-tui output — never construct ANSI strings from memory.

Run render-tui, Read the output file, copy the exact escape sequences into the snapshot assertion. This ensures the snapshot captures what actually renders, including exact color codes, column positions, and cursor characters.

## Four things render-tui tells you that your mental model cannot

**1. Exact ANSI for snapshot assertions**

Read the raw output file and copy the exact escape sequences into your snapshot test. Never construct snapshot strings from memory — the actual color codes, cursor characters, and column offsets will differ from what you imagine.

**2. Exact column positions**

When a component renders at column 0 vs column 1 matters for layout assertions. Use render-tui output to count the leading bytes of each line — do not infer column positions from component code alone.

Example: is `❯` at col 0 or col 1? Read the raw line: if it starts with `\x1b[37m❯` there is no leading space; if it starts with ` \x1b[37m❯` there is. Write your assertion based on what you actually see.

**3. Edge cases before writing tests**

Before writing tests for cursor-at-end, empty-text, overflow, or wrapping boundary conditions, render those exact states first:

```bash
# Empty input
bun run render-tui -- dev/plan-test.md --keys c --output /tmp/empty.txt

# Text that wraps at boundary
bun run render-tui -- dev/plan-test.md --keys c,a,a,a,...  --output /tmp/wrap.txt
```

Read the output, then write the test to match what you actually saw. Do not write tests for edge cases you have not rendered.

**4. Color constant verification**

ANSI color codes are not memorable. After picking a constant (e.g. `COLORS.SUBTLE`), run render-tui and read the hex in the raw output to confirm it produced the right escape sequence. Example: `COLORS.SUBTLE` = `#606060` = `\x1b[38;2;96;96;96m`. If you see a different code, you chose the wrong constant.

## Key names (from `Keys` constant)

`DOWN_ARROW`, `UP_ARROW`, `LEFT_ARROW`, `RIGHT_ARROW`, `ENTER`, `ESCAPE`, `BACKSPACE`, `TAB`, `PAGE_UP`, `PAGE_DOWN`, `HOME`, `END`

Raw chars are passed through: `c` (comment), `x` (toggle delete), `?` (question), `:` (command input)

Run `planderson help` for the full list of keybindings and settings.

## ANSI interpretation

Output always contains full ANSI codes (`FORCE_COLOR=1` is set automatically).

Use `--output <file>` and the Read tool to see raw bytes — the Bash tool strips ANSI before display.

- Cursor line: `\x1b[48;2;80;80;80m` (grey background) — all wrapped display lines of the current logical line are highlighted
- Deleted/strikethrough: `\x1b[9m` plus `\x1b[38;2;102;102;102m` (grey color)
- Comment mode: mode bar contains `Comment`
- Approve confirm: type `:wq` then `ENTER` to submit; command input renders at bottom as `\x1b[37m:wq█\x1b[39m` while typing

## Examples

```bash
bun run render-tui -- dev/plan-test.md --output /tmp/frames.txt
bun run render-tui -- dev/plan-test.md --keys DOWN_ARROW,DOWN_ARROW,c --output /tmp/frames.txt
bun run render-tui -- dev/plan-test.md --keys DOWN_ARROW,x --output /tmp/frames.txt
bun run render-tui -- dev/plan-test.md --keys :,w,q,ENTER --output /tmp/frames.txt
bun run render-tui -- dev/plan-test.md --keys c --watch
```
