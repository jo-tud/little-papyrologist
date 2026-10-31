import { facts, glyphs, groups, playSets, quizItems } from "../data";
import { resolveAlphabetExamples } from "../alphabet-examples";
import { glyphSvg } from "../glyphs/render";
import { markSetDone, state } from "../store";
import type { Glyph } from "../types";
import { letterName, sourceLinks } from "../ui";
import { esc } from "../util";
import "../alphabet.css";

const examples = resolveAlphabetExamples(quizItems);

function drawing(g: Glyph): string {
  return `<details class="alphabet-drawing"><summary>Simplified drawing and shape guide</summary>
    <div class="pair"><div class="drawn">${glyphSvg(g.char, `${letterName(g.char)}, simplified practice drawing`)}</div>
    <div><strong>Our drawing</strong><p>${esc(g.look_for)}</p></div></div>
    <p class="muted">Drawn for this trainer after published images; a guide, not another original.
    ${sourceLinks(["grandprize"])}</p>
  </details>`;
}

export function renderAlphabet(main: HTMLElement): void {
  let letterIndex = 0;
  let exampleIndex = 0;
  const firstLesson = playSets.find(set => set.level === 1);
  main.innerHTML = `<div class="alphabet-heading"><h1>The scribes' alphabet</h1>
    ${firstLesson ? `<a href="${esc(firstLesson.href)}" data-skip-intro>Practise real letters →</a>` : ""}</div>
    <p class="alphabet-intro">Choose a letter. Compare its printed form with real handwriting.</p>
    <nav class="alphabet-index" aria-label="Choose a letter">
      ${glyphs.map((g, index) => `<button type="button" class="choice greek ${examples.has(g.char) ? "" : "alphabet-unavailable"}"
        data-alphabet-select="${index}" aria-controls="alphabet-panel" aria-pressed="${index === 0}"
        aria-label="${esc(letterName(g.char))}${examples.has(g.char) ? "" : ": no original included yet"}"
        title="${esc(letterName(g.char))}">${esc(g.char === "Ϲ" ? "Σ" : g.char)}</button>`).join("")}
    </nav>
    <section id="alphabet-panel" class="alphabet-card" aria-labelledby="alphabet-title"></section>
    <details class="alphabet-background"><summary>About this alphabet and its sources</summary>
      <p>Original examples for ${examples.size} of 24 letters. Some are complete photographs; others retain a short group
      because neighbouring strokes join. Partial and faint forms are labelled.</p>
      <p>Ancient Greek bookhands used forms broadly comparable to our capitals, with varying shapes and proportions.
      ${sourceLinks(["greek-bookhands"])}</p>
      <p>The letter names and readings come from published sources. A difficult original can be studied here without
      becoming a beginner's test. The simplified drawings are optional guides.</p>
      <details><summary>What is special about this script</summary>
        <ul class="facts">${facts.map(f => `<li class="fact"><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p>
          <div class="cite">${sourceLinks(f.sources)}</div></li>`).join("")}</ul>
      </details>
      <p><a href="#/drill/${groups[0].id}">Optional practice with drawings →</a></p>
      <button type="button" id="alphabet-reviewed" ${state().setsDone["alphabet-seen"] ? "disabled" : ""}>
        ${state().setsDone["alphabet-seen"] ? "Alphabet marked as reviewed" : "Mark alphabet reviewed"}</button>
      <p class="small muted" id="alphabet-review-status" role="status">This optional marker adds no quiz answers or points.</p>
    </details>`;

  const panel = main.querySelector<HTMLElement>("#alphabet-panel")!;
  function renderPanel(focus?: string): void {
    const g = glyphs[letterIndex];
    const available = examples.get(g.char) ?? [];
    const selected = available[exampleIndex];
    main.querySelectorAll<HTMLButtonElement>("[data-alphabet-select]").forEach(button => {
      button.setAttribute("aria-pressed", String(Number(button.dataset.alphabetSelect) === letterIndex));
    });
    const previous = glyphs[(letterIndex + glyphs.length - 1) % glyphs.length];
    const next = glyphs[(letterIndex + 1) % glyphs.length];
    panel.innerHTML = `<div class="alphabet-letter-heading">
      <h2 id="alphabet-title"><span class="greek" lang="grc">${esc(g.char === "Ϲ" ? "Σ" : g.char)}</span> ${esc(letterName(g.char))}</h2>
      <div class="alphabet-letter-nav" aria-label="Browse letters">
        <button type="button" data-letter-step="-1" aria-label="Previous letter: ${esc(letterName(previous.char))}">←</button>
        <button type="button" data-letter-step="1" aria-label="Next letter: ${esc(letterName(next.char))}">→</button>
      </div></div>
      ${selected ? (() => {
        const { item, description, partial, study } = selected;
        const photographed = item.source.includes("profilometer");
        return `<div class="alphabet-example-heading">
          <span>${photographed ? "Photograph" : "CT ink map"}${partial ? " · Partial letter" : study ? " · Study the handwriting" : ""}</span>
          <div class="alphabet-example-nav" aria-label="Browse examples">
            ${available.length > 1 ? `<button type="button" data-example-step="-1" aria-label="Previous example">←</button>` : ""}
            <span>Example ${exampleIndex + 1} of ${available.length}</span>
            ${available.length > 1 ? `<button type="button" data-example-step="1" aria-label="Next example">→</button>` : ""}
          </div></div>
          <figure data-alphabet-example="${esc(item.id)}">
            <div class="alphabet-image" tabindex="0" role="region" aria-label="Original image; zoom to inspect the handwriting">
              <div class="alphabet-image-canvas"><img src="images/${esc(item.image)}" alt="${esc(item.alt)}. Published reading: ${esc(item.truth)}.">
                <svg class="alphabet-location" aria-hidden="true" preserveAspectRatio="xMidYMid meet"></svg></div>
            </div>
            <div class="alphabet-image-actions">
              <button type="button" id="alphabet-zoom" aria-pressed="false">Zoom in</button>
              ${item.answer_image ? `<button type="button" id="alphabet-tracing" aria-pressed="false">Show ink tracing</button>` : ""}
            </div>
            <figcaption><span class="alphabet-reading" lang="grc" aria-label="Published reading: ${Array.from(item.truth).map(letterName).map(esc).join(', ')}">
              ${Array.from(item.truth).map((char, index) => item.letter_regions?.[index]
                ? `<button type="button" class="greek" data-letter-location="${index}" aria-pressed="false"
                    aria-label="Show ${esc(letterName(char))}, letter ${index + 1} in the image">${esc(char)}</button>`
                : `<span class="greek${char === g.char ? " alphabet-target" : ""}">${esc(char)}</span>`).join("")}
            </span><span class="small muted" id="alphabet-location-label" role="status">${item.truth.length > 1 ? "Choose a letter to locate it in the image." : "Published reading"}</span></figcaption>
          </figure>
          <p class="alphabet-description">${esc(description)}</p>
          <p class="alphabet-credit cite">${esc(item.credit)} · ${esc(item.license)}</p>
          <details class="alphabet-source"><summary>Reading and source</summary>
            <p>${photographed ? esc(item.reading ?? "") : `PHerc. Paris 4, ${esc(item.reading ?? "")}`}.
              ${photographed ? "Named by the organizers in the published dataset." : "Letter identities come from the papyrologists’ edition; bright marks are a CT ink-detection model’s output."}</p>
            <p><strong class="greek" lang="grc">${esc(item.truth)}</strong>: ${Array.from(item.truth).map(char => esc(letterName(char))).join(" · ")}.</p>
            ${item.letter_regions ? "<p>Frames show approximate letter locations, not ink tracings. A frame can include touching strokes from a neighbour.</p>" : ""}
            ${item.edition ? `<p lang="grc">Edition: ${esc(item.edition)}</p>` : ""}
            ${item.edition_indices ? `<p>Characters ${item.edition_indices[0] + 1}–${item.edition_indices[1]} in the line’s reading.</p>` : ""}
            ${item.sample_id ? `<p>Published sample: ${esc(item.sample_id)}.</p>` : ""}
            <p>${esc(item.changes ?? "")}. ${sourceLinks(item.source)}</p>
            <p><a href="images/${esc(item.image)}" target="_blank" rel="noopener">Open full image <span class="visually-hidden">(new tab)</span></a></p>
          </details>`;
      })() : `<div class="alphabet-empty"><p>No checked original example in this collection yet.</p>
        <p class="muted">The printed letter and its name are shown above. A simplified guide is available below.</p></div>`}
      ${drawing(g)}`;

    if (selected) {
      const item = selected.item;
      const viewport = panel.querySelector<HTMLElement>(".alphabet-image")!;
      const canvas = panel.querySelector<HTMLElement>(".alphabet-image-canvas")!;
      const image = panel.querySelector<HTMLImageElement>(".alphabet-image img")!;
      const overlay = panel.querySelector<SVGSVGElement>(".alphabet-location")!;
      let position = item.truth.indexOf(g.char);
      let zoomed = false;
      function centerLocation(): void {
        if (!image.isConnected || !image.naturalWidth) return;
        const region = item.letter_regions?.[position] ?? [0, 0, 1, 1];
        const scale = Math.min(canvas.clientWidth / image.naturalWidth, canvas.clientHeight / image.naturalHeight);
        const width = image.naturalWidth * scale;
        const height = image.naturalHeight * scale;
        viewport.scrollTo({
          left: canvas.offsetLeft + (canvas.clientWidth - width) / 2 + (region[0] + region[2]) * width / 2 - viewport.clientWidth / 2,
          top: canvas.offsetTop + (canvas.clientHeight - height) / 2 + (region[1] + region[3]) * height / 2 - viewport.clientHeight / 2,
          behavior: "instant",
        });
      }
      function showLocation(center = false): void {
        if (!image.isConnected) return;
        const region = item.letter_regions?.[position];
        panel.querySelectorAll<HTMLButtonElement>("[data-letter-location]").forEach(button =>
          button.setAttribute("aria-pressed", String(Number(button.dataset.letterLocation) === position)));
        if (!region || !image.naturalWidth) { overlay.innerHTML = ""; return; }
        const [left, top, right, bottom] = region;
        overlay.setAttribute("viewBox", `0 0 ${image.naturalWidth} ${image.naturalHeight}`);
        overlay.innerHTML = `<rect x="${left * image.naturalWidth}" y="${top * image.naturalHeight}"
          width="${(right - left) * image.naturalWidth}" height="${(bottom - top) * image.naturalHeight}" vector-effect="non-scaling-stroke"/>`;
        panel.querySelector("#alphabet-location-label")!.textContent = `${letterName(item.truth[position])} · ${position + 1}/${item.truth.length} · approximate letter area`;
        if (center && zoomed) centerLocation();
      }
      image.addEventListener("load", () => showLocation());
      panel.querySelectorAll<HTMLButtonElement>("[data-letter-location]").forEach(button => button.addEventListener("click", () => {
        position = Number(button.dataset.letterLocation);
        showLocation(true);
      }));
      panel.querySelector<HTMLButtonElement>("#alphabet-zoom")!.addEventListener("click", event => {
        zoomed = !zoomed;
        viewport.classList.toggle("alphabet-image-zoomed", zoomed);
        viewport.setAttribute("aria-label", zoomed ? "Enlarged image; scroll or use arrow keys to pan" : "Original image; zoom to inspect the handwriting");
        const button = event.currentTarget as HTMLButtonElement;
        button.textContent = zoomed ? "Fit image" : "Zoom in";
        button.setAttribute("aria-pressed", String(zoomed));
        if (zoomed) centerLocation();
        else viewport.scrollTo({ left: 0, top: 0, behavior: "instant" });
      });
      showLocation();
    }

    panel.querySelectorAll<HTMLButtonElement>("[data-letter-step]").forEach(button => button.addEventListener("click", () => {
      const direction = Number(button.dataset.letterStep);
      letterIndex = (letterIndex + direction + glyphs.length) % glyphs.length;
      exampleIndex = 0;
      renderPanel(`[data-letter-step="${direction}"]`);
    }));
    panel.querySelectorAll<HTMLButtonElement>("[data-example-step]").forEach(button => button.addEventListener("click", () => {
      const direction = Number(button.dataset.exampleStep);
      exampleIndex = (exampleIndex + direction + available.length) % available.length;
      renderPanel(`[data-example-step="${direction}"]`);
    }));
    panel.querySelector<HTMLButtonElement>("#alphabet-tracing")?.addEventListener("click", event => {
      const button = event.currentTarget as HTMLButtonElement;
      const traced = button.getAttribute("aria-pressed") !== "true";
      button.setAttribute("aria-pressed", String(traced));
      button.textContent = traced ? "Show original photograph" : "Show ink tracing";
      const image = panel.querySelector<HTMLImageElement>(".alphabet-image img")!;
      image.src = `images/${traced ? selected!.item.answer_image : selected!.item.image}`;
      image.alt = traced ? "The organizers' ink tracing in red, over the same photograph." : `${selected!.item.alt}. Published reading: ${selected!.item.truth}.`;
    });
    if (focus) panel.querySelector<HTMLElement>(focus)?.focus({ preventScroll: true });
  }
  main.querySelectorAll<HTMLButtonElement>("[data-alphabet-select]").forEach(button => button.addEventListener("click", () => {
    letterIndex = Number(button.dataset.alphabetSelect);
    exampleIndex = 0;
    renderPanel();
  }));
  main.querySelector<HTMLButtonElement>("#alphabet-reviewed")?.addEventListener("click", event => {
    if (state().setsDone["alphabet-seen"]) return;
    markSetDone("alphabet-seen");
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    button.textContent = "Alphabet marked as reviewed";
    main.querySelector("#alphabet-review-status")!.textContent = "Saved in this browser. Come back whenever you need a reference.";
  });
  renderPanel();
}
