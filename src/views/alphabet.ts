import { facts, glyphs, groups } from "../data";
import { glyphSvg } from "../glyphs/render";
import { markSetDone, state } from "../store";
import { introBridge, letterName, sourceLinks, tip } from "../ui";
import { esc } from "../util";

export function renderAlphabet(main: HTMLElement): void {
  if (!state().setsDone["alphabet-seen"]) markSetDone("alphabet-seen");

  main.innerHTML = `
  <h1>The scribes' alphabet</h1>
  <p>Left: our own simplified drawing, made after the letters in the published images of
  PHerc. Paris 4 (${sourceLinks(["grandprize"])}). Right: the modern printed form.
  Real hands vary between scribes, and even within one line.</p>
  ${tip("Read the line under each letter. It names the stroke that tells the letter apart from its look-alikes.")}
  <p><a class="button primary" href="#/drill/${groups[0].id}">Try the first exercise →</a></p>
  ${introBridge()}
  <ul class="alphabet">
    ${glyphs
      .map(
        (g) => `<li class="letter-card">
        <div class="pair">
          <div class="drawn">${glyphSvg(g.char, `${g.name}, drawn in the style of the scrolls`)}</div>
          <div>
            <div class="modern" lang="grc">${esc(g.char === "Ϲ" ? "Σ" : g.char)}</div>
            <div class="name"><strong>${esc(letterName(g.char))}</strong><br>key <kbd>${esc(g.latin)}</kbd></div>
          </div>
        </div>
        <p>${esc(g.look_for)}</p>
      </li>`,
      )
      .join("")}
  </ul>

  <h2>What is special about this script</h2>
  <ul class="facts">
    ${facts
      .map(
        (f) => `<li class="fact">
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.text)}</p>
        ${f.quote ? `<blockquote>“${esc(f.quote)}”</blockquote>` : ""}
        <div class="cite">Source: ${sourceLinks(f.sources)}</div>
      </li>`,
      )
      .join("")}
  </ul>

  <h2>Practise the look-alikes</h2>
  <ul class="path">
    ${groups
      .map(
        (g) => `<li class="stop">
        <span class="mark greek" aria-hidden="true">${esc(g.letters[0])}</span>
        <div><h3>${esc(g.title)}: <span class="greek">${g.letters.map(esc).join(" ")}</span></h3><p>${esc(g.intro)}</p></div>
        <a class="button" href="#/drill/${g.id}">Start</a>
      </li>`,
      )
      .join("")}
  </ul>`;
}
