import { glyphByChar } from "../data";
import type { Box, Draw } from "../types";
import { esc, rng } from "../util";

const VIEW = "-10 -6 120 142";
const PEN = 9;
let uid = 0;

function strokesOf(char: string, hide: string[] = []): string[] {
  const g = glyphByChar.get(char);
  if (!g) throw new Error(`No drawing for letter ${char}`);
  return Object.entries(g.strokes)
    .filter(([name]) => !hide.includes(name))
    .map(([, d]) => d);
}

function inkFilter(id: string, seed: number, scale = 3.2): string {
  // Fixed region in user space: a straight stroke has a zero-width bounding box,
  // and a filter region based on it would hide the stroke entirely.
  return `<filter id="${id}" filterUnits="userSpaceOnUse" x="-30" y="-30" width="160" height="190">
    <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="2" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G"/>
  </filter>`;
}

function inkPaths(paths: string[], filterId: string, cls = "ink"): string {
  return `<g class="${cls}" filter="url(#${filterId})" fill="none" stroke-width="${PEN}" stroke-linecap="round" stroke-linejoin="round">${paths
    .map((d) => `<path d="${d}"/>`)
    .join("")}</g>`;
}

/** A plain letter in ink, for the alphabet table. Colour follows CSS currentColor. */
export function glyphSvg(char: string, label: string): string {
  const id = `ink${++uid}`;
  return `<svg class="glyph" viewBox="${VIEW}" role="img" aria-label="${esc(label)}">
    <defs>${inkFilter(id, char.charCodeAt(0) % 97, 2.4)}</defs>
    ${inkPaths(strokesOf(char), id, "ink ink-current")}
  </svg>`;
}

function fibres(rand: () => number): string {
  const out: string[] = [];
  // Vertical fibres of the back layer, faint.
  for (let i = 0; i < 9; i++) {
    const x = -10 + rand() * 120;
    const w = 0.5 + rand() * 1.6;
    out.push(`<path class="fibre fibre-v" d="M${x.toFixed(1)} -6 Q${(x + rand() * 4 - 2).toFixed(1)} 64 ${(x + rand() * 3 - 1.5).toFixed(1)} 136" stroke-width="${w.toFixed(2)}" opacity="${(0.05 + rand() * 0.09).toFixed(2)}"/>`);
  }
  // Horizontal fibres of the front layer, where the writing sits.
  for (let i = 0; i < 60; i++) {
    const y = -6 + rand() * 142;
    const w = 0.4 + rand() * 1.5;
    const wobble = rand() * 3 - 1.5;
    out.push(`<path class="fibre" d="M-10 ${y.toFixed(1)} Q50 ${(y + wobble).toFixed(1)} 110 ${(y + rand() * 2 - 1).toFixed(1)}" stroke-width="${w.toFixed(2)}" opacity="${(0.12 + rand() * 0.3).toFixed(2)}"/>`);
  }
  return `<g fill="none">${out.join("")}</g>`;
}

function jaggedBox(b: Box, rand: () => number): string {
  const pts: [number, number][] = [];
  const step = 6;
  const j = () => rand() * 6 - 3;
  for (let x = b.x; x < b.x + b.w; x += step) pts.push([x + j(), b.y + j()]);
  for (let y = b.y; y < b.y + b.h; y += step) pts.push([b.x + b.w + j(), y + j()]);
  for (let x = b.x + b.w; x > b.x; x -= step) pts.push([x + j(), b.y + b.h + j()]);
  for (let y = b.y + b.h; y > b.y; y -= step) pts.push([b.x + j(), y + j()]);
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
}

function nullLayer(draw: Draw, rand: () => number, filterId: string): string {
  switch (draw.empty) {
    case "streaks": {
      const xs = [26 + rand() * 6, 68 + rand() * 6];
      return `<g class="streak" fill="none" filter="url(#${filterId})">${xs
        .map((x) => `<path d="M${x.toFixed(1)} -8 Q${(x + rand() * 5 - 2.5).toFixed(1)} 64 ${(x + rand() * 4 - 2).toFixed(1)} 138" stroke-width="${(4 + rand() * 2).toFixed(1)}"/>`)
        .join("")}</g>`;
    }
    case "crack": {
      let x = 44 + rand() * 12;
      const pts: string[] = [];
      for (let y = -8; y <= 138; y += 7) {
        x += rand() * 7 - 3.5;
        pts.push(`${x.toFixed(1)},${y}`);
      }
      const line = pts.join(" ");
      return `<polyline class="crack-edge" points="${line}" fill="none" stroke-width="5"/>
        <polyline class="crack" points="${line}" fill="none" stroke-width="2.6"/>`;
    }
    case "blot": {
      const cx = 46 + rand() * 10;
      const cy = 58 + rand() * 10;
      const pts: string[] = [];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 9) {
        const r = 14 + rand() * 12;
        pts.push(`${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r * 0.8).toFixed(1)}`);
      }
      return `<polygon class="blot" points="${pts.join(" ")}" filter="url(#${filterId})"/>`;
    }
    case "shuffle": {
      return (draw.pieces ?? [])
        .map(([letter, stroke, dx, dy, rot]) => {
          const d = glyphByChar.get(letter)?.strokes[stroke];
          if (!d) return "";
          return `<g transform="translate(${dx} ${dy}) rotate(${rot} 50 62)">${inkPaths([d], filterId)}</g>`;
        })
        .join("");
    }
    default:
      return "";
  }
}

/**
 * A drawn papyrus tile for the exercises.
 * The label is read by screen readers; it must not give the answer away.
 */
export function tileSvg(seed: string, draw: Draw, damage: Box[] = [], label = "Drawn papyrus tile"): string {
  const rand = rng(seed);
  const id = `t${++uid}`;
  const ink = draw.letter ? inkPaths(strokesOf(draw.letter, draw.hide), `${id}i`) : "";
  const holes = damage
    .map((b) => `<polygon class="hole" points="${jaggedBox(b, rand)}"/>`)
    .join("");
  return `<svg class="tile" viewBox="${VIEW}" role="img" aria-label="${esc(label)}">
    <defs>
      ${inkFilter(`${id}i`, Math.floor(rand() * 1000))}
      <clipPath id="${id}c"><rect x="-10" y="-6" width="120" height="142" rx="3"/></clipPath>
    </defs>
    <g clip-path="url(#${id}c)">
      <rect class="papyrus" x="-10" y="-6" width="120" height="142"/>
      ${fibres(rand)}
      ${nullLayer(draw, rand, `${id}i`)}
      ${ink}
      ${holes}
    </g>
  </svg>`;
}

/**
 * A line of continuous script. Letters sit in <g> elements so CSS can open gaps
 * between words (see .script-line.words in styles.css).
 */
/** Horizontal extent of a letter's strokes (path coordinates come in x,y pairs). */
function extent(char: string): [number, number] {
  const xs = strokesOf(char).flatMap((d) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number).filter((_, i) => i % 2 === 0));
  return [Math.min(...xs), Math.max(...xs)];
}

export function lineSvg(chars: string[], wordStarts: Set<number>, label: string): string {
  const spacing = 26;
  const gap = 60;
  const id = `l${++uid}`;
  const rand = rng(chars.join(""));
  let words = 0;
  let pen = 0;
  const letters = chars
    .map((c, i) => {
      if (i > 0 && wordStarts.has(i)) words++;
      const [min, max] = extent(c);
      const x = pen - min;
      pen += max - min + spacing;
      const tilt = (rand() * 3 - 1.5).toFixed(2);
      const dy = (rand() * 4 - 2).toFixed(1);
      return `<g class="script-letter" style="--x:${x}px;--wx:${x + words * gap}px">
        <g transform="translate(0 ${dy}) rotate(${tilt} 50 62)">${inkPaths(strokesOf(c), id)}</g></g>`;
    })
    .join("");
  const width = pen + words * gap + 20;
  return `<svg class="script-line" viewBox="-20 -10 ${width} 150" role="img" aria-label="${esc(label)}">
    <defs>${inkFilter(id, 7, 3)}</defs>
    ${letters}
  </svg>`;
}
