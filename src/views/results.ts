import { activeQuizItems, availableLevelNumbers, glyphByChar, itemSetVersion, LEVELS, playSets, quizItems } from "../data";
import { clearAll, exportPayload, importText, isPersistent, setLevelOverride, state } from "../store";
import { progressAfterAnswer, syncRankChip } from "../progress-ui";
import { align, answerOutcome, readingStats } from "../scoring";
import type { AnswerRecord } from "../types";
import { learningAction } from "../learning-action";
import { levelAvailable } from "../rules";
import { readingModes } from "../reading-modes";
import "../orientation.css";
import { esc, pct } from "../util";

const APP_VERSION = "0.1.0";

function levelName(level: number): string {
  return level === 0 ? "Level 0: alphabet" : `Level ${level}: ${LEVELS.find((l) => l.level === level)?.title ?? ""}`;
}

interface Row {
  level: number;
  archived: boolean;
  n: number;
  textTiles: number;
  textSeen: number;
  nulls: number;
  falseAlarms: number;
  readable: number;
  readRight: number;
  leftOpen: number;
  incorrect: number;
  sureWrong: number;
}

const activeIds = new Set(activeQuizItems.map(item => item.id));
const archivedAnswer = (answer: AnswerRecord) => answer.level > 0
  && (!!answer.simulated || answer.degradation > 0 || !activeIds.has(answer.item_id));

function summarise(answers: AnswerRecord[]): Row[] {
  const levels = [...new Set(answers.map((a) => a.level))].sort((a, b) => a - b);
  return levels.flatMap(level => [false, true].flatMap(archived => {
    const list = answers.filter((a) => a.level === level && archivedAnswer(a) === archived);
    if (!list.length) return [];
    const textTiles = list.filter((a) => a.truth !== "none");
    const nulls = list.filter((a) => a.truth === "none");
    // Tiles whose letters can be checked: not empty, not "ink only" (*), not undecidable (?).
    const readable = list.filter((a) => readingStats(a) !== null && !a.truth.includes("?"));
    return [{
      level, archived,
      n: list.length,
      textTiles: textTiles.length,
      textSeen: textTiles.filter((a) => a.said_text === "yes").length,
      nulls: nulls.length,
      falseAlarms: nulls.filter((a) => a.said_text === "yes").length,
      readable: readable.length,
      readRight: readable.filter((a) => readingStats(a)?.complete).length,
      leftOpen: list.filter((a) => answerOutcome(a) === "open").length,
      incorrect: list.filter((a) => answerOutcome(a) === "incorrect").length,
      sureWrong: list.filter((a) => a.confidence === 3 && answerOutcome(a) === "incorrect").length,
    }];
  }));
}

/** Show local substitutions, without turning an omitted letter into a guessed letter. */
function confusions(answers: AnswerRecord[]): [string, number][] {
  const counts = new Map<string, number>();
  const add = (key: string): void => { counts.set(key, (counts.get(key) ?? 0) + 1); };
  const named = (letter: string): string => `${letter} (${glyphByChar.get(letter)?.name ?? "unidentified"})`;
  for (const a of answers) {
    if (a.truth === "none" && a.said_text === "yes") {
      add("empty tile → writing reported");
    } else if (readingStats(a) && a.said_text !== "no") {
      const want = Array.from(a.truth);
      const { pairs, extras } = align(want, Array.from(a.letters));
      want.forEach((w, i) => {
        const got = pairs[i];
        if (got && got !== "?" && got !== w) add(`${w === "?" ? "unresolved letter" : named(w)} → ${named(got)}`);
      });
      if (extras) add("extra letters entered");
    }
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
}

function confidenceRows(answers: AnswerRecord[]): string {
  const names = { 1: "Guessing", 2: "Fairly sure", 3: "Sure" } as const;
  return ([1, 2, 3] as const)
    .map((c) => {
      const list = answers.filter((a) => a.confidence === c);
      const count = (outcome: ReturnType<typeof answerOutcome>): number => list.filter((a) => answerOutcome(a) === outcome).length;
      return `<tr><td>${names[c]}</td><td class="num">${list.length}</td><td class="num">${count("matched")}</td><td class="num">${count("open")}</td><td class="num">${count("incorrect")}</td></tr>`;
    })
    .join("");
}

function exportText(): string {
  return JSON.stringify(exportPayload(APP_VERSION, itemSetVersion()), null, 2);
}

function hasSavedProgress(): boolean {
  const s = state();
  return s.answers.length > 0 || Object.keys(s.setsDone).length > 0
    || Object.keys(s.badges).length > 0 || Object.keys(s.ranks).length > 0
    || Object.keys(s.rounds ?? {}).length > 0
    || !!s.introSkipped || s.levelOverride !== undefined;
}

function download(): void {
  const blob = new Blob([exportText()], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `little-papyrologist-results-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function renderResults(main: HTMLElement, openBackup = false): void {
  const current = state();
  const answers = current.answers;
  const next = learningAction(current);
  const finishedLessons = playSets.filter(p => p.level > 0 && current.setsDone[p.id]).length;
  const practiceLevel = [...answers].reverse().find(a => a.level > 0 && !archivedAnswer(a) && levelAvailable(current, a.level))?.level;
  const confidenceMissing = answers.filter((a) => a.confidence === null).length;
  const hasProgress = hasSavedProgress();
  const rows = summarise(answers);
  const conf = confusions(answers);
  const realAnswers = answers.filter((a) => a.level > 0);
  const byId = new Map(quizItems.map((i) => [i.id, i]));
  const original = (id: string): string => {
    const visited = new Set<string>();
    while (byId.get(id)?.base_item && !visited.has(id)) { visited.add(id); id = byId.get(id)!.base_item!; }
    return id;
  };
  const originals = new Set(realAnswers.map((a) => original(a.base_item ?? a.item_id))).size;
  const modes = readingModes(answers);

  main.innerHTML = `
  <div class="orientation-page results-page">
  <h1>My results</h1>
  <section class="results-overview" aria-label="Your progress and next step">
    ${answers.length ? `<div class="result-counts"><p><strong>${answers.length}</strong> answers</p>
      <p><strong>${finishedLessons}</strong> lessons finished</p></div>` : `<p>Your first discoveries will appear here.</p>`}
    <a class="button primary learning-continue" id="learning-continue" href="${next.href}">${esc(next.label)} →</a>
    ${practiceLevel && next.href !== `#/practice/${practiceLevel}` ? `<p class="small" id="results-practice-link"><a href="#/practice/${practiceLevel}">Try another short round at level ${practiceLevel}</a></p>` : ""}
    <p class="small muted">${isPersistent() ? "Saved in this browser only." : "This browser cannot save progress. Back up before closing the page."}</p>
  </section>
  ${answers.length ? `<details class="orientation-detail result-details" id="result-details">
  <summary>Detailed results · accuracy, mix-ups and confidence</summary>
  <h2>By level</h2>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Results by level, scroll to see all columns"><table>
    <thead><tr>
      <th>Level</th><th class="num">Answers</th><th class="num">Text noticed</th>
      <th class="num">False alarms on empty tiles</th><th class="num">Fully read tiles</th>
      <th class="num">Left open</th><th class="num">Incorrect answers</th><th class="num">Sure but wrong</th>
    </tr></thead>
    <tbody>
    ${rows
      .map(
        (r) => `<tr>
        <td>${esc(r.archived ? `Earlier exercises · level ${r.level}` : levelName(r.level))}</td>
        <td class="num">${r.n}</td>
        <td class="num">${r.textSeen}/${r.textTiles} (${pct(r.textSeen, r.textTiles)})</td>
        <td class="num">${r.falseAlarms}/${r.nulls} (${pct(r.falseAlarms, r.nulls)})</td>
        <td class="num">${r.readRight}/${r.readable} (${pct(r.readRight, r.readable)})</td>
        <td class="num">${r.leftOpen}</td>
        <td class="num">${r.incorrect}</td>
        <td class="num">${r.sureWrong}</td>
      </tr>`,
      )
      .join("")}
    </tbody>
  </table></div>
  <p class="small muted">“Text noticed” counts tiles with ink or writing where you said yes. “Fully read tiles” requires every letter to match,
  with no gaps or extra letters. A question mark can be accepted by the exercise without being a letter read.
  Tiles without a complete reference reading are excluded from that column. “Left open” includes “Not sure” and unfinished readings
  without an incorrect letter claim; a response with both gaps and wrong letters counts as incorrect.
  Level 1 recognition uses clues and choices. Guided examples are unscored.</p>
  ${rows.some(row => row.archived) ? `<p class="small muted">Earlier exercises remain in your history with their original points. They do not count as completing the new lessons at the same level.</p>` : ""}

  <h2>Practice and support</h2>
  <p>${realAnswers.length} answers on photographed or scan-derived material, from ${originals} source regions.
  ${realAnswers.filter((a) => a.practice).length} answers came from extra practice rounds.
  Altered versions count under their original region; some regions overlap. Returning to one image is repetition, not a new sample.</p>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Reading modes, scroll to see all columns"><table><thead><tr><th>Reading mode</th><th class="num">Answers</th><th class="num">Fully matched</th></tr></thead><tbody>
    ${modes.map(({ title, answers, matched }) => `<tr><td>${title}</td><td class="num">${answers}</td><td class="num">${pct(matched, answers)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="small muted">Older saved answers may not record help use and are left out of the last two rows.
  A full match includes a correct “No letters” answer. “Without opening extra help” describes that attempt;
  the keyboard's form guides are always available, and a familiar image may have appeared before.
  Displayed matches are derived from your saved response and reference. Your original points and saved answers stay unchanged.</p>
  ${answers.some((a) => a.simulated) ? `<h3>Earlier altered-image practice</h3><div class="table-wrap" tabindex="0" role="region" aria-label="Altered-image practice, scroll to see all columns"><table><thead><tr><th>Difficulty</th><th class="num">Answers</th><th class="num">Not sure</th></tr></thead><tbody>
    ${[1, 2, 3, 4, 5].map((degree) => { const list = answers.filter((a) => a.simulated && a.degradation === degree); return `<tr><td>${degree}/5</td><td class="num">${list.length}</td><td class="num">${list.filter((a) => a.said_text === "unsure" || a.letters.includes("?")).length}</td></tr>`; }).join("")}
    </tbody></table></div><p class="small muted">These older exercises used artificially changed images and are no longer offered. Your saved answers are unchanged.</p>` : ""}

  <h2>Most frequent mix-ups</h2>
  ${
    conf.length
      ? `<div class="table-wrap" tabindex="0" role="region" aria-label="Most frequent mix-ups, scroll to see all columns"><table><thead><tr><th>Answer → you said</th><th class="num">Times</th></tr></thead><tbody>
        ${conf.map(([k, n]) => `<tr><td class="greek">${esc(k)}</td><td class="num">${n}</td></tr>`).join("")}
        </tbody></table></div>`
      : `<p>No mix-ups so far.</p>`
  }

  <h2>How sure were you?</h2>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Confidence results, scroll to see all columns"><table><thead><tr><th>You said</th><th class="num">Answers</th><th class="num">Matched reference</th><th class="num">Left open</th><th class="num">Incorrect</th></tr></thead>
  <tbody>${confidenceRows(answers)}</tbody></table></div>
  ${confidenceMissing ? `<p class="small muted">No confidence rating was recorded for ${confidenceMissing} ${confidenceMissing === 1 ? "answer" : "answers"}. These attempts count in your results above and are left out of this confidence table.</p>` : ""}
  <p class="small muted">A full match means a complete reading or a correct writing/no-writing decision.
  Leaving something open is recorded separately, including caution that earned honesty points.
  These counts mix choices, clues, free reading and repeated images; they describe your practice, not a test of independent reading ability or confidence calibration.</p>
  </details>` : ""}

  <details class="orientation-detail practice-settings" id="practice-settings">
    <summary id="practice-settings-title">Choose your level</summary>
    <p class="small">Jump ahead or revisit the basics. This changes access; your completed work stays saved.</p>
    <label for="practice-level">Open exercises through</label>
    <div class="row">
      <select id="practice-level">
        <option value="auto" ${state().levelOverride === undefined ? "selected" : ""}>Follow my progress automatically</option>
        ${availableLevelNumbers.map((level) => `<option value="${level}" ${state().levelOverride === level ? "selected" : ""}>${esc(levelName(level))}</option>`).join("")}
      </select>
      <button type="button" id="apply-level">Apply</button>
      <button type="button" id="reset-level" ${state().levelOverride === undefined ? "disabled" : ""}>Use automatic progress</button>
    </div>
    <p class="small muted" id="level-note" role="status">${state().levelOverride !== undefined ? `Manually opened through level ${state().levelOverride}.` : "Start with real letters in level 1, then unlock later levels through practice. The drawing exercises are optional."}</p>
    <a class="button" href="#/">Back to the path →</a>
  </details>

  <details class="orientation-detail backup" id="backup">
    <summary>Back up or move your progress</summary>
    <p class="small">Save a copy to keep or load in another browser. Loading merges saved answers; a valid saved round can replace an older local round.</p>
    <div class="row">
      <button type="button" id="export" ${hasProgress ? "" : "disabled"}>Save as file</button>
      <button type="button" id="copy" ${hasProgress ? "" : "disabled"}>Copy as text</button>
      <input type="file" id="import-file" class="visually-hidden" accept="application/json,.json">
      <label class="button" for="import-file">Load from file</label>
      <button type="button" id="paste-open">Paste text</button>
    </div>
    <p id="copy-note" class="small muted" role="status"></p>
    <textarea id="copy-box" class="copy-box" rows="8" readonly hidden aria-label="Your progress as text"></textarea>
    <div id="paste-area" hidden>
      <textarea id="paste-box" class="copy-box" rows="6" aria-label="Paste a saved progress text here"></textarea>
      <div class="row"><button type="button" id="paste-load">Load pasted text</button></div>
    </div>
    <p class="small">The file holds, for each answer: tile, level, degradation, whether you saw text,
    the letters you gave, how sure you were when asked, and how long you took. It also holds your finished sets,
    badges, ranks and practice settings.</p>
  </details>

  <details class="orientation-detail reset-progress" id="reset-progress">
    <summary id="reset-title">Reset all progress</summary>
    <p class="small muted">Reset your answers, points, badges, ranks and practice settings in this browser.
    You can save a backup above first.</p>
    <button type="button" id="clear" ${hasProgress ? "" : "disabled"}>Reset all progress…</button>
    <div id="confirm-clear" class="confirm" hidden>
      <p><strong>Delete all your answers, points, badges, ranks and practice settings from this browser?</strong> This cannot be undone.</p>
      <div class="row">
        <button type="button" id="clear-yes">Delete everything</button>
        <button type="button" class="primary" id="clear-no">Keep my progress</button>
      </div>
    </div>
  </details>
  </div>`;

  const $ = <T extends HTMLElement>(sel: string) => main.querySelector<T>(sel)!;
  const applyLevel = (value: string) => {
    setLevelOverride(value === "auto" ? undefined : Number(value));
    const updated = learningAction(state());
    const continueLink = $<HTMLAnchorElement>("#learning-continue");
    continueLink.href = updated.href;
    continueLink.textContent = `${updated.label} →`;
    const practiceLink = main.querySelector<HTMLElement>("#results-practice-link");
    if (practiceLink && practiceLevel) practiceLink.hidden = !levelAvailable(state(), practiceLevel) || updated.href === `#/practice/${practiceLevel}`;
    $<HTMLSelectElement>("#practice-level").value = value;
    $<HTMLButtonElement>("#reset-level").disabled = value === "auto";
    $("#level-note").textContent = value === "auto" ? "Automatic progress restored. Your completed work is unchanged." : `Practice is open through level ${value}. Your completed work is unchanged.`;
    for (const id of ["#clear", "#export", "#copy"]) $<HTMLButtonElement>(id).disabled = !hasSavedProgress();
  };
  $("#apply-level").addEventListener("click", () => applyLevel($<HTMLSelectElement>("#practice-level").value));
  $("#reset-level").addEventListener("click", () => applyLevel("auto"));
  if (openBackup) $<HTMLDetailsElement>("#backup").open = true;
  $("#export").addEventListener("click", download);
  $("#copy").addEventListener("click", async () => {
    const text = exportText();
    try {
      await navigator.clipboard.writeText(text);
      $("#copy-note").textContent = "Copied. Paste it into a file to keep it.";
    } catch {
      // Clipboard not available: show the text so it can be selected by hand.
      const box = $<HTMLTextAreaElement>("#copy-box");
      box.value = text;
      box.hidden = false;
      box.select();
      $("#copy-note").textContent = "Copying is blocked here. The text below is selected; copy it with your keyboard.";
    }
  });
  const note = (text: string) => ($("#copy-note").textContent = text);
  const load = (text: string) => {
    try {
      const r = importText(text, itemSetVersion());
      progressAfterAnswer();
      renderResults(main, true);
      const extra = [r.duplicates ? `${r.duplicates} were already here` : "", r.skipped ? `${r.skipped} could not be read and were skipped` : ""]
        .filter(Boolean)
        .join("; ");
      main.querySelector<HTMLElement>("#copy-note")!.textContent = `Loaded ${r.added} answers${extra ? ` (${extra})` : ""}.`;
    } catch (e) {
      note(e instanceof Error ? e.message : "This file could not be loaded.");
    }
  };
  $<HTMLInputElement>("#import-file").addEventListener("change", (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    file.text().then(load, () => note("This file could not be read."));
  });
  $("#paste-open").addEventListener("click", () => {
    $("#paste-area").hidden = false;
    $("#paste-box").focus();
  });
  $("#paste-load").addEventListener("click", () => load($<HTMLTextAreaElement>("#paste-box").value));
  $("#clear").addEventListener("click", () => {
    $("#confirm-clear").hidden = false;
    $("#clear-no").focus();
  });
  $("#clear-no").addEventListener("click", () => {
    $("#confirm-clear").hidden = true;
    $("#clear").focus();
  });
  $("#clear-yes").addEventListener("click", () => {
    clearAll();
    syncRankChip();
    document.querySelector(".toast-area")?.replaceChildren();
    renderResults(main);
    main.querySelector<HTMLElement>("h1")?.setAttribute("tabindex", "-1");
    main.querySelector<HTMLElement>("h1")?.focus();
  });
}
