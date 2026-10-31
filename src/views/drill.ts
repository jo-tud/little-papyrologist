import { drills, fieldnotes, glyphs, groups, playSets } from "../data";
import { progressAfterAnswer, rankUpBanner } from "../progress-ui";
import { tileSvg } from "../glyphs/render";
import { score, type Score } from "../scoring";
import { addAnswer, markSetDone, state } from "../store";
import type { AnswerRecord, Drill, SaidText } from "../types";
import { namedLetter, skipIntroLink, sourceLinks } from "../ui";
import { letterFormLabel } from "../letter-forms";
import { levelDone } from "../rules";
import { esc, shuffle } from "../util";
import "../drill-review.css";

const CANT_TELL = "?";
const keyToLetter = new Map<string, string>(glyphs.map((g) => [g.latin, g.char]));
keyToLetter.set("w", "Ϲ");
type ReviewMode = "side" | "original" | "solution";
interface Pick { said: SaidText; letter: string }

function truthText(d: Drill): string {
  if (d.truth === "none") return "no letter";
  if (d.truth === CANT_TELL) return (d.candidates ?? []).map(namedLetter).join(" or ");
  return namedLetter(d.truth);
}

function givenText(p: Pick): string {
  if (p.said === "no") return "No letter";
  return p.letter === CANT_TELL ? "Can't tell" : namedLetter(p.letter);
}

function headline(d: Drill, s: Score): string {
  if (d.truth === "none") return s.verdict === "honest" ? "Yes — no letter was drawn here" : "No letter was drawn here";
  if (d.truth === CANT_TELL) return s.verdict === "honest" ? "Right to leave this open" : "The missing strokes leave this open";
  if (s.verdict === "right") return `Yes — ${namedLetter(d.truth)}`;
  if (s.verdict === "careful") return `This one is ${namedLetter(d.truth)}`;
  return `Look for ${namedLetter(d.truth)}`;
}

function pointsChips(s: Score): string {
  const chips: string[] = [];
  if (s.reading > 0) chips.push(`<span class="r">+${s.reading} reading</span>`);
  if (s.honesty > 0) chips.push(`<span class="h">+${s.honesty} honesty</span>`);
  return chips.join("");
}

/** Keep the first concrete clue visible; the complete explanation remains available. */
function briefExplanation(d: Drill): string {
  return d.explain.match(/^.*?[.!?](?:\s|$)/u)?.[0].trim() ?? d.explain;
}

export function renderDrill(main: HTMLElement, groupId: string): () => void {
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    main.innerHTML = `<h1>Exercise not found</h1><p><a href="#/">Back to the path</a></p>`;
    return () => {};
  }
  const order = shuffle(drills.filter((d) => d.group === group.id));
  let index = 0;
  let pick: Pick | undefined;
  let shownAt = performance.now();
  let checked: Score | null = null;
  let newRank: string | undefined;
  let reviewMode: ReviewMode = "solution";
  const ranksThisSet: string[] = [];
  const results: AnswerRecord[] = [];

  function progress(): string {
    return `<div class="progress" aria-hidden="true">${order.map((_, i) =>
      `<span class="${i < index ? "past" : i === index ? "now" : ""}"></span>`).join("")}</div>`;
  }

  function drawing(): string {
    const d = order[index];
    const hasReading = d.truth !== "none" && d.truth !== CANT_TELL;
    return `<section class="drill-review" data-mode="original" aria-label="Practice drawing">
      <div class="drill-review-panels">
        <figure class="tile-frame" data-item="${esc(d.id)}" data-review-panel="original">
          ${tileSvg(d.id, d.draw, d.damage, `Drawn papyrus tile ${index + 1}${d.damage?.length ? ", with grey holes" : ""}`)}
        </figure>
        <figure class="tile-frame drill-review-solution${hasReading ? " has-reading" : ""}" data-review-panel="solution" hidden>
          ${tileSvg(d.id, d.draw, d.damage, hasReading ? `The same drawing with the visible strokes of ${namedLetter(d.truth)} in red` : `The unchanged drawing: ${truthText(d)}`)}
        </figure>
      </div>
      <div class="drill-review-controls" id="drawing-controls"></div>
      <p class="drill-drawing-credit">Practice drawing.${d.damage?.length ? " Grey areas are missing papyrus." : ""}</p>
    </section>`;
  }

  function questions(): string {
    return `<fieldset class="question">
      <legend id="drawing-question" tabindex="-1">Which letter can you see?</legend>
      <div class="drawing-choices" style="--drawing-choice-count:${group!.letters.length}">
        ${group!.letters.map(l => `<button type="button" class="choice letter named-letter" data-letter="${esc(l)}">${letterFormLabel(l)}</button>`).join("")}
      </div>
      <div class="drawing-open-choices">
        <button type="button" class="choice" data-said="no">No letter</button>
        <button type="button" class="choice" data-letter="?">Can't tell</button>
      </div>
    </fieldset>`;
  }

  function optionalDetails(): string {
    const d = order[index];
    const offset = groups.slice(0, groups.findIndex(g => g.id === groupId))
      .reduce((n, g) => n + Math.ceil(drills.filter(tile => tile.group === g.id).length / 2), 0);
    const note = fieldnotes[(offset + Math.floor(index / 2)) % fieldnotes.length];
    return `${checked ? `<details><summary>Why this answer?</summary>
        <p>${esc(d.explain)}</p>
        <p class="small">${d.truth !== "none" && d.truth !== CANT_TELL
          ? "Red marks the visible letter strokes in this drawing. Missing parts stay missing."
          : "The answer view leaves the drawing unchanged; it adds no missing strokes."}</p>
        <p class="cite">The answer is known from how this tile was drawn.${d.sources?.length ? ` ${sourceLinks(d.sources)}` : ""}</p>
      </details>${index % 2 === 0 ? `<details class="drawing-field-note"><summary>A little papyrology: ${esc(note.title)}</summary>
        <p>${esc(note.text)}</p><p class="cite">${sourceLinks(note.sources)}</p></details>` : ""}` : ""}
      <details><summary>Letter guide &amp; keyboard</summary>
        <p>${esc(group!.intro)}</p>${group!.sources?.length ? `<p class="cite">${sourceLinks(group!.sources)}</p>` : ""}
        <p class="keys">${group!.letters.map(l => `<kbd>${esc(glyphs.find(g => g.char === l)?.latin ?? "")}</kbd> ${esc(namedLetter(l))}`).join(" · ")}<br>
        <kbd>?</kbd> Can't tell · <kbd>-</kbd> No letter · <kbd>Enter</kbd> Continue after an answer.<br>Tab moves between controls; Enter or Space activates the focused button.</p>
      </details>
      ${newRank ? `<details><summary>New rank reached</summary>${rankUpBanner(newRank)}</details>` : ""}
      <p class="drawing-real-link">Optional drawings · ${skipIntroLink()}</p>`;
  }

  function renderRound(): void {
    main.innerHTML = `<article class="drawing-task">
      <a class="back-link" href="#/">← Back to the path</a>
      <div class="drill-head"><h1 tabindex="-1">${esc(group!.title)}</h1><span class="muted">Tile ${index + 1} of ${order.length}</span></div>
      ${progress()}
      <div class="drawing-workspace">
        ${drawing()}
        <div class="drawing-answer">
          <div class="drawing-response" id="drawing-response">${questions()}</div>
          <div class="drawing-action" id="drawing-action"><span class="small muted">Choose an answer to check it.</span></div>
        </div>
      </div>
      <div class="drawing-details" id="drawing-details">${optionalDetails()}</div>
    </article>`;
  }

  function feedback(d: Drill, s: Score): string {
    return `<div class="drawing-verdict v-${s.verdict}">
      <h2 id="verdict" tabindex="-1">${esc(headline(d, s))}</h2>
      ${d.truth === CANT_TELL ? `<p class="drawing-candidates">${esc(truthText(d))}</p>` : ""}
      <p class="small muted">You chose: ${esc(givenText(pick!))}.</p>
      <p class="drawing-clue">${esc(briefExplanation(d))}</p>
      <div class="points">${pointsChips(s)}</div>
    </div>`;
  }

  function changeReview(mode: ReviewMode): void {
    reviewMode = mode;
    const review = main.querySelector<HTMLElement>(".drill-review");
    if (!review) return;
    review.dataset.mode = mode;
    review.querySelectorAll<HTMLButtonElement>("[data-review-mode]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.reviewMode === mode));
    });
    review.querySelectorAll<HTMLElement>("[data-review-panel]").forEach(panel => {
      panel.hidden = mode !== "side" && panel.dataset.reviewPanel !== mode;
    });
  }

  function check(answer: Pick): void {
    if (checked || index >= order.length) return;
    const d = order[index];
    pick = answer;
    const letters = pick.said === "no" ? "" : pick.letter;
    const s = score({ text: d.truth, candidates: d.candidates }, { said: pick.said, letters, confidence: null, presenceAsked: false });
    const record: AnswerRecord = {
      item_id: d.id,
      task: "drawn",
      level: 0,
      degradation: d.damage?.length ? 1 : 0,
      said_text: pick.said,
      letters,
      confidence: null,
      ms: Math.round(performance.now() - shownAt),
      answered_at: new Date().toISOString(),
      truth: d.truth,
      text_correct: s.text_correct,
      letters_correct: s.letters_correct,
      verdict: s.verdict,
      reading_points: s.reading,
      honesty_points: s.honesty,
    };
    addAnswer(record);
    results.push(record);
    checked = s;
    noteProgress();
    // The drawing remains mounted, at the same size and location, while only its answer changes.
    main.querySelector<HTMLElement>("#drawing-response")!.innerHTML = feedback(d, s);
    main.querySelector<HTMLElement>("#drawing-action")!.innerHTML = `<button type="button" class="primary" id="next">${index + 1 < order.length ? "Next tile →" : "Finish this set →"}</button>`;
    main.querySelector<HTMLElement>("#drawing-controls")!.innerHTML = `<div role="group" aria-label="Comparison view">
      <button type="button" data-review-mode="original" aria-pressed="false">A · Tile</button>
      <button type="button" data-review-mode="solution" aria-pressed="false">B · Answer</button>
      <button type="button" data-review-mode="side" aria-pressed="false">Side by side</button>
    </div>`;
    main.querySelector<HTMLElement>("#drawing-details")!.innerHTML = optionalDetails();
    changeReview(reviewMode);
    main.querySelector<HTMLElement>("#verdict")?.focus({ preventScroll: true });
  }

  function noteProgress(): void {
    const news = progressAfterAnswer();
    newRank = news.rank?.id;
    if (newRank) ranksThisSet.push(newRank);
  }

  function next(): void {
    if (!checked) return;
    const anchor = main.querySelector<HTMLElement>(".drawing-workspace")!.getBoundingClientRect().top;
    index++;
    pick = undefined;
    checked = null;
    newRank = undefined;
    reviewMode = "solution";
    if (index >= order.length) {
      markSetDone(group!.id);
      noteProgress();
      newRank = undefined;
      renderSummary();
      return;
    }
    shownAt = performance.now();
    renderRound();
    // Keep the task in view when leaving optional material farther down the page.
    if (anchor < 0) main.querySelector<HTMLElement>(".drawing-workspace")?.scrollIntoView({ block: "start" });
    main.querySelector<HTMLElement>("#drawing-question")?.focus({ preventScroll: true });
  }

  function renderSummary(): void {
    const count = (v: string) => results.filter(r => r.verdict === v).length;
    const nextGroup = groups[groups.findIndex(g => g.id === group!.id) + 1];
    const firstReal = levelDone(state(), 0) ? playSets.find(p => p.level === 1) : undefined;
    main.innerHTML = `<section class="drawing-summary">
      <h1 tabindex="-1">${esc(group!.title)}: done</h1>
      <p>${count("right")} read correctly · ${count("honest") + count("careful")} honest calls</p>
      <div class="row">
        <a class="button primary" href="${firstReal?.href ?? (nextGroup ? `#/drill/${nextGroup.id}` : "#/")}">${firstReal ? "On to real papyrus →" : nextGroup ? `Next: ${esc(nextGroup.title)} →` : "Continue on the path →"}</a>
        <button type="button" id="again">Practise again</button>
      </div>
      <details><summary>Results for this set</summary>
        <p>${count("false-alarm")} false alarms on ${results.filter(r => r.truth === "none").length} empty tiles.</p>
        <p>${results.reduce((n, r) => n + r.reading_points, 0)} reading points · ${results.reduce((n, r) => n + r.honesty_points, 0)} honesty points.</p>
        ${ranksThisSet.length ? rankUpBanner(ranksThisSet[ranksThisSet.length - 1]) : ""}
      </details>
      <p class="drawing-real-link">${skipIntroLink()} · <a href="#/">Back to the path</a></p>
    </section>`;
    main.querySelector("#again")?.addEventListener("click", () => {
      index = 0;
      pick = undefined;
      checked = null;
      newRank = undefined;
      reviewMode = "solution";
      results.length = 0;
      ranksThisSet.length = 0;
      order.splice(0, order.length, ...shuffle(order));
      shownAt = performance.now();
      renderRound();
      main.querySelector<HTMLElement>("#drawing-question")?.focus({ preventScroll: true });
    });
    main.querySelector<HTMLElement>("h1")?.focus();
  }

  function onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest("button");
    if (!t || t.disabled || index >= order.length) return;
    if (checked && ["side", "original", "solution"].includes(t.dataset.reviewMode ?? "")) {
      changeReview(t.dataset.reviewMode as ReviewMode);
      return;
    }
    if (t.id === "next") return next();
    if (checked) return;
    if (t.dataset.said === "no") check({ said: "no", letter: "" });
    else if (t.dataset.letter) check({ said: t.dataset.letter === CANT_TELL ? "unsure" : "yes", letter: t.dataset.letter });
  }

  function onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || index >= order.length) return;
    const target = e.target as HTMLElement;
    if (target.closest("input, textarea, select, [contenteditable], .topbar, .footer")) return;
    const k = e.key.toLowerCase();
    if (e.repeat) {
      if (k === "enter") e.preventDefault();
      return;
    }
    // Preserve native Enter and Space on every button, link and disclosure.
    if (target.closest("a, button, summary") && (k === "enter" || k === " ")) return;
    if (checked) {
      if (k === "enter") { e.preventDefault(); next(); }
      return;
    }
    let answer: Pick | undefined;
    if (k === "0" || k === "-") answer = { said: "no", letter: "" };
    else if (k === "?") answer = { said: "unsure", letter: CANT_TELL };
    else {
      const letter = keyToLetter.get(k) ?? e.key.toUpperCase().replace(/[Σϲ]/g, "Ϲ");
      if (group!.letters.includes(letter)) answer = { said: "yes", letter };
    }
    if (answer) { e.preventDefault(); check(answer); }
  }

  main.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  renderRound();
  return () => {
    main.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
