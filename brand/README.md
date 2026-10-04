# Who's Bluffing? brand kit

The mark is a question mark cut into five pieces. Four pieces draw the hook and stem; the fifth is a square turned 45°
in the accent colour. It is the one that does not sit straight: the one who is bluffing. The five pieces are the game's
five result tiles, recut.

## Files

| File | Use |
|---|---|
| `icon.svg` | App icon: dark tile `#111827`, corner radius 14/64, pieces `#F5F3EE`, dot `#7A95FF`. Favicon, Discord and Slack app icon, GitHub avatar, social preview. |
| `icon-light.svg` | Same on the paper tile `#FBFAF7` (pieces `#111827`, dot `#2F5BFF`). |
| `icon-square.svg` | Square corners, for platforms that apply their own mask (iOS, some bot lists). |
| `mark.svg` | Bare mark for light backgrounds (ink + accent). |
| `mark-white.svg` | Bare mark for dark backgrounds. |
| `mark-mono.svg` | One colour (`currentColor`). |
| `mark-inline.svg` | The snippet the site uses: fills come from `var(--text)` and `var(--accent)`; rotations sit on `<g>` wrappers so CSS can animate the inner rects. |
| `png/icon-{16…1024}.png` | Raster exports of `icon.svg`. Discord wants 512 or larger; Slack 512–2000; GitHub 500 or larger. |
| `png/icon-square-1024.png`, `png/icon-light-1024.png`, `png/mark-1024.png`, `png/mark-white-1024.png` | Raster exports of the other masters. |
| `preview.png` | Contact sheet with the runners-up. |

## Geometry (viewBox 0 0 28 60)

| Piece | Rect | Rotation |
|---|---|---|
| top bar | x 0, y 0, w 28, h 10, rx 3 | — |
| right bar | x 18, y 12.2, w 10, h 12, rx 3 | — |
| elbow | x 10.5, y 24.5, w 16, h 10, rx 3 | −52° about (18.5, 29.5) |
| stem | x 9, y 36.5, w 10, h 8, rx 3 | — |
| dot | x 9.6, y 48.5, w 8.8, h 8.8, rx 2.5 | 45° about (14, 52.9) |

In the 64×64 tile the mark is scaled to 68% of the tile height and centred.

## Lockup

`Who's Bluffing` in the site's 800-weight system font stack, followed by the mark as the name's own question mark (no
typed "?" after it). Mark height about 1.3× the cap height, dot on the baseline, 6px gap at 20px type. The accessible
name stays "Who's Bluffing?".

## Rules

- Never show five equal squares in a row as a logo; that was the earlier mark and it is retired.
- Keep the dot the accent colour and keep it turned. Do not recolour the pieces per result (green/red belongs to the
  in-game result tiles, not to the mark).
- Clear space around the tile: at least one piece-width (10/28 of the mark's width) on every side.
- Minimum sizes: tile 16px, bare mark 14px tall.
- The SVG masters are the source. Edit them directly and re-export the PNGs with any SVG rasteriser; the site renders
  what it needs with `web/design/render.js assets`.
