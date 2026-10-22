import { sourceById } from "./data";
import { esc } from "./util";

/** Glaux, a small owl (the owl of Athena), who gives short tips. */
export function owl(): string {
  return `<svg class="owl" viewBox="0 0 64 64" aria-hidden="true">
    <path class="body" stroke-width="2" d="M14 24 L12 10 L22 17 Q32 13 42 17 L52 10 L50 24 Q56 38 50 50 Q42 60 32 60 Q22 60 14 50 Q8 38 14 24 Z"/>
    <circle class="eye" cx="24" cy="29" r="7" stroke-width="2"/>
    <circle class="eye" cx="40" cy="29" r="7" stroke-width="2"/>
    <circle class="pupil" cx="25" cy="30" r="2.6"/>
    <circle class="pupil" cx="41" cy="30" r="2.6"/>
    <path class="beak" stroke-width="1.5" d="M30 36 L34 36 L32 41 Z"/>
    <path class="line" stroke-width="1.6" stroke-linecap="round" d="M15 36 Q19 48 25 55 M49 36 Q45 48 39 55 M29 48 l3 2 l3 -2 M29 53 l3 2 l3 -2"/>
  </svg>`;
}

/** A tip from Glaux. `html` must already be escaped. */
export function tip(html: string): string {
  return `<div class="tip">${owl()}<div class="bubble"><p><span class="visually-hidden">Tip: </span>${html}</p></div></div>`;
}

export function sourceLinks(ids: string[] = []): string {
  return ids
    .map((id) => {
      const s = sourceById.get(id);
      if (!s) throw new Error(`Unknown source ${id}`);
      return s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a>` : esc(s.title);
    })
    .join("; ");
}

export function toast(text: string): void {
  const area = document.querySelector(".toast-area");
  if (!area) return;
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = text;
  area.appendChild(el);
  window.setTimeout(() => el.remove(), 4500);
}

/** A small seal for each badge. Earned seals are filled. */
export function badgeIcon(): string {
  return `<svg viewBox="0 0 32 32" aria-hidden="true">
    <circle cx="16" cy="16" r="13" fill="var(--ochre)" stroke="var(--basalt)" stroke-width="1.5"/>
    <path d="M10 17 L14.5 21 L22 11" fill="none" stroke="var(--basalt)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
