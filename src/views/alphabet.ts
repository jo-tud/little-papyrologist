import { facts, glyphs, groups, playSets, quizItems } from "../data";
import { resolveAlphabetExamples } from "../alphabet-examples";
import { glyphSvg } from "../glyphs/render";
import { markSetDone, state } from "../store";
import type { Glyph, QuizItem } from "../types";
import { letterName, sourceLinks } from "../ui";
import { esc } from "../util";
import "../alphabet.css";

const examples = resolveAlphabetExamples(quizItems);

function drawing(g: Glyph): string {
  return `<details class="alphabet-drawing"><summary>Simplified drawing and shape guide</summary>
    <div class="pair"><div class="drawn">${glyphSvg(g.char, `${letterName(g.char)}, simplified practice drawing`)}</div>
    <div><strong>Our drawing</strong><br><span class="muted">A guide to compare with handwriting.</span></div></div>
    <p>${esc(g.look_for)}</p>
    <p class="muted">Drawn for this trainer after the published images of PHerc. Paris 4. Real handwriting can differ.
    ${sourceLinks(["grandprize"])}</p>
  </details>`;
}

function original(item: QuizItem, description: string, study?: boolean): string {
  const photographed = item.source.includes("profilometer");
  const kind = photographed ? "Brightfield photograph" : "CT-derived ink map";
  const where = photographed ? item.reading : `PHerc. Paris 4, ${item.reading}`;
  return `<figure data-alphabet-example="${esc(item.id)}">
    <div class="alphabet-image"><img src="images/${esc(item.image)}" alt="${esc(item.alt)}. Published reading: ${esc(item.truth)}." loading="lazy"></div>
    <figcaption><strong>${esc(kind)}</strong>${study ? " · Study the handwriting" : ""}<br>
    ${esc(where ?? "")}<br><span class="cite">${esc(item.credit)}, ${esc(item.license)}.</span></figcaption>
    </figure>
    <p class="alphabet-description">${esc(description)}</p>
    <details class="alphabet-source"><summary>Reading, image and source</summary>
      <p>${photographed ? "Named by the organizers in the published dataset" : "Reading from the papyrologists’ published edition"}:
      <strong class="greek" lang="grc">${esc(item.truth)}</strong> (${Array.from(item.truth).map(char => esc(letterName(char))).join("–")}).</p>
      <p>${photographed ? "The photograph records visible ink." : "Bright marks show an ink-detection model’s output from CT scans. The letter identification comes from the edition."}</p>
      ${item.sample_id ? `<p>Published sample: ${esc(item.sample_id)}.</p>` : ""}
      ${item.edition_indices ? `<p>Characters ${item.edition_indices[0] + 1}–${item.edition_indices[1]} in the line’s reading.</p>` : ""}
      ${item.changes ? `<p>Image preparation: ${esc(item.changes)}.</p>` : ""}
      <p>${sourceLinks(item.source)}</p>
      <p><a href="images/${esc(item.image)}" target="_blank" rel="noopener">Open full image <span class="visually-hidden">(new tab)</span></a></p>
    </details>`;
}

function card(g: Glyph): string {
  const available = examples.get(g.char);
  const first = available?.[0];
  return `<li class="alphabet-card" data-alphabet-letter="${esc(g.char)}">
    <h3 id="alphabet-letter-${esc(g.latin)}" tabindex="-1"><span class="greek" lang="grc">${esc(g.char === "Ϲ" ? "Σ" : g.char)}</span>${esc(letterName(g.char))}</h3>
    ${first ? `${original(first.item, first.description, first.study)}
      ${available!.length > 1 ? `<details class="alphabet-variants"><summary>Compare ${available!.length - 1} more ${available!.length === 2 ? "example" : "examples"}</summary>
        ${available!.slice(1).map(example => `<div>${original(example.item, example.description, example.study)}</div>`).join("")}
      </details>` : ""}`
      : `<p class="muted">No checked original example included yet.</p>`}
    ${drawing(g)}
  </li>`;
}

export function renderAlphabet(main: HTMLElement): void {
  const firstLesson = playSets.find(set => set.level === 1);
  const singles = glyphs.filter(g => examples.get(g.char)?.[0].item.truth.length === 1);
  const inGroups = glyphs.filter(g => (examples.get(g.char)?.[0].item.truth.length ?? 0) > 1);
  const missing = glyphs.filter(g => !examples.has(g.char));
  const reviewed = !!state().setsDone["alphabet-seen"];

  main.innerHTML = `
  <h1>The scribes' alphabet</h1>
  <p>Real papyrus, with published readings. Compare each handwritten shape with its printed letter and name.</p>
  <details class="alphabet-background"><summary>Why handwriting looks different</summary>
    <p>Ancient Greek bookhands used forms broadly comparable to our capitals, with varying shapes and proportions.
    A handwritten letter need not look exactly like its printed counterpart.
    <span class="cite">${sourceLinks(["greek-bookhands"])}</span></p>
    <p>The simplified drawings are optional shape guides. They are not a complete catalogue of handwriting.</p>
  </details>
  <div class="alphabet-actions">
    ${firstLesson ? `<a class="button primary" href="${esc(firstLesson.href)}" data-skip-intro>Start with real letters →</a>` : ""}
    <a href="#/drill/${groups[0].id}">Optional practice with drawings</a>
  </div>
  <nav class="alphabet-index" aria-label="Find a letter">
    ${glyphs.map(g => `<button type="button" class="choice greek" data-alphabet-jump="${esc(g.latin)}"
      aria-label="${esc(letterName(g.char))} (${esc(g.char === "Ϲ" ? "Σ" : g.char)})" aria-controls="alphabet-letter-${esc(g.latin)}"
      title="${esc(letterName(g.char))}">${esc(g.char === "Ϲ" ? "Σ" : g.char)}</button>`).join("")}
  </nav>

  <h2>Letters in original images</h2>
  <p>${singles.length} letters, with other forms to compare where available. A confirmed reading can still be hard to recognize.</p>
  <ul class="alphabet-originals">${singles.map(card).join("")}</ul>

  <h2>Letters with their neighbours</h2>
  <p>These ${inGroups.length} letters appear in short groups. We keep the complete group visible and name each letter's position.
  Pi and Lambda share the same connected group.</p>
  <ul class="alphabet-originals">${inGroups.map(card).join("")}</ul>

  <h2>More letters to know</h2>
  <p>We have not included a checked original example for these ${missing.length} letters yet.
  Their names, printed forms and optional drawings are available while the collection grows.</p>
  <ul class="alphabet-originals alphabet-missing">${missing.map(card).join("")}</ul>
  <div class="alphabet-review">
    <button type="button" id="alphabet-reviewed" ${reviewed ? "disabled" : ""}>${reviewed ? "Alphabet marked as reviewed" : "Mark alphabet reviewed"}</button>
    <p class="small muted" id="alphabet-review-status" role="status">${reviewed ? "Saved in this browser. Come back whenever you need a reference." : "Optional: save that you have looked through this reference. No quiz answers or points are added."}</p>
  </div>

  <h2>What is special about this script</h2>
  <ul class="facts">
    ${facts.map(f => `<li class="fact"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p>
      ${f.quote ? `<blockquote>“${esc(f.quote)}”</blockquote>` : ""}
      <div class="cite">Source: ${sourceLinks(f.sources)}</div></li>`).join("")}
  </ul>

  <h2>Optional practice with drawings</h2>
  <p>Use these short exercises to compare simplified shapes. You can return to the real images at any time.</p>
  <ul class="path">
    ${groups.map(g => `<li class="stop">
      <span class="mark greek" aria-hidden="true">${esc(g.letters[0])}</span>
      <div><h3>${esc(g.title)}: <span class="greek">${g.letters.map(esc).join(" ")}</span></h3><p>${esc(g.intro)}</p></div>
      <a class="button" href="#/drill/${g.id}">Practise</a>
      </li>`).join("")}
  </ul>`;

  main.querySelectorAll<HTMLButtonElement>("[data-alphabet-jump]").forEach(button => {
    button.addEventListener("click", () => {
      const heading = main.querySelector<HTMLElement>(`#alphabet-letter-${button.dataset.alphabetJump}`);
      heading?.scrollIntoView({ block: "start" });
      heading?.focus({ preventScroll: true });
    });
  });

  main.querySelector<HTMLButtonElement>("#alphabet-reviewed")?.addEventListener("click", event => {
    if (state().setsDone["alphabet-seen"]) return;
    markSetDone("alphabet-seen");
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Alphabet marked as reviewed";
    main.querySelector("#alphabet-review-status")!.textContent = "Saved in this browser. Come back whenever you need a reference.";
  });
}
