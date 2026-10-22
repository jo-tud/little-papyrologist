import { sources } from "../data";
import type { Source } from "../types";
import { esc } from "../util";

const SECTIONS: { title: string; kinds: string[]; intro: string }[] = [
  { title: "From the Vesuvius Challenge", kinds: ["organizers"], intro: "The organizers' own pages: what has been read, how ink is found, and the open data." },
  { title: "Editions and papers", kinds: ["edition", "paper"], intro: "Where the readings used here were published, and how the scans were made." },
  { title: "Catalogues and books", kinds: ["catalogue", "book"], intro: "For the script itself. The books are in print; we do not reproduce their plates." },
];

function item(s: Source): string {
  return `<li>${s.url ? `<a href="${esc(s.url)}" rel="noopener">${esc(s.title)}</a>` : esc(s.title)}</li>`;
}

export function renderLearn(main: HTMLElement): void {
  main.innerHTML = `
  <h1>Keep learning</h1>
  <p>Primary sources only. Everything this trainer says about the script, the scrolls and the
  readings comes from one of these.</p>
  ${SECTIONS.map(
    (sec) => `<h2>${esc(sec.title)}</h2><p class="muted">${esc(sec.intro)}</p>
    <ul class="sources-list">${sources.filter((s) => sec.kinds.includes(s.kind)).map(item).join("")}</ul>`,
  ).join("")}`;
}
