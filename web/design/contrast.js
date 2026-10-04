// WCAG contrast check for the colour tokens in public/styles.css (no dependencies). Reads the light block (:root) and
// the dark block (:root[data-theme="dark"], which must match the prefers-color-scheme copy), then checks every
// text/background pair the stylesheet uses. Exit code 1 if any pair fails.   Usage: node web/design/contrast.js
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

function tokens(selector) {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`no "${selector} {" block in styles.css`);
  const body = css.slice(start, css.indexOf('}', start));
  return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2].toUpperCase()]));
}

const light = tokens(':root');
const darkOnly = tokens(':root[data-theme="dark"]');
const darkMedia = tokens(':root:not([data-theme="light"])');
if (JSON.stringify(darkOnly) !== JSON.stringify(darkMedia)) throw new Error('the two dark blocks in styles.css differ');
const themes = { light, dark: { ...light, ...darkOnly } };

const channel = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => channel(parseInt(hex.slice(i, i + 2), 16) / 255));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
export const ratio = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

// [foreground, background, where]. Body text needs 4.5:1.
const TEXT = [
  ['text', 'bg', 'body text'], ['text', 'surface', 'text in cards, inputs, footer'],
  ['muted', 'bg', 'secondary text'], ['muted', 'surface', 'secondary text in cards, footer links, placeholders'],
  ['accent', 'bg', 'links'], ['accent', 'surface', 'links in cards'],
  ['accent-ink', 'accent', 'primary buttons'],
  ['text', 'accent-soft', 'notes, code, selected options'], ['accent', 'accent-soft', 'badges, step numbers, current nav link'],
  ['hit-ink', 'bg', 'hit text'], ['hit-ink', 'surface', 'hit verdicts, sent messages'],
  ['miss-ink', 'bg', 'miss text, errors'], ['miss-ink', 'surface', 'miss verdicts, errors in cards'],
  ['surface', 'hit-ink', 'Play button in the Slack illustration'],
];
// Display text of 24px bold or larger may use 3:1. None of the tokens needs this today.
const LARGE = [];
// Non-text (WCAG 1.4.11, 3:1): the focus ring is 3px --focus outside a 2px --text ring, so the --text ring carries
// the contrast on light backgrounds where amber alone does not; inputs are outlined in --muted.
const NON_TEXT = [
  ['text', 'bg', 'focus ring (inner 2px)'], ['text', 'surface', 'focus ring (inner 2px) on cards'],
  ['muted', 'surface', 'input borders'], ['muted', 'bg', 'input borders on the page'],
];

let failures = 0;
function report(title, pairs, min) {
  console.log(`\n${title} (minimum ${min.toFixed(1)}:1)`);
  if (!pairs.length) { console.log('  none'); return; }
  for (const [name, t] of Object.entries(themes)) {
    for (const [fg, bg, where] of pairs) {
      const r = ratio(t[fg], t[bg]);
      const ok = r >= min;
      if (!ok) failures += 1;
      console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${name.padEnd(5)} ${`--${fg}`.padEnd(13)} ${t[fg]} on ${`--${bg}`.padEnd(13)} ${t[bg]}  ${r.toFixed(2).padStart(5)}:1  ${where}`);
    }
  }
}

report('Text', TEXT, 4.5);
report('Large display text', LARGE, 3);
report('Non-text', NON_TEXT, 3);
const amber = Object.entries(themes).map(([name, t]) => `${name} ${ratio(t.focus, t.bg).toFixed(2)}:1`).join(', ');
console.log(`\nFor information: --focus amber on --bg alone is ${amber} (hence the inner --text ring).`);
console.log(failures ? `\n${failures} pair(s) below the minimum` : '\nall pairs pass');
process.exit(failures ? 1 : 0);
