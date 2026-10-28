import { itemSetVersion, LEVELS, playSets, quizItems } from "../data";
import { clearAll, exportPayload, importText, isPersistent, setLevelOverride, state } from "../store";
import { progressAfterAnswer, syncRankChip } from "../progress-ui";
import type { AnswerRecord } from "../types";
import { tip } from "../ui";
import { esc, pct } from "../util";

const APP_VERSION = "0.1.0";

function levelName(level: number): string {
  return level === 0 ? "Level 0: alphabet" : `Level ${level}: ${LEVELS.find((l) => l.level === level)?.title ?? ""}`;
}

interface Row {
  level: number;
  n: number;
  textTiles: number;
  textSeen: number;
  nulls: number;
  falseAlarms: number;
  readable: number;
  readRight: number;
  undecidable: number;
  honestCalls: number;
  sureWrong: number;
}

function summarise(answers: AnswerRecord[]): Row[] {
  const levels = [...new Set(answers.map((a) => a.level))].sort();
  return levels.map((level) => {
    const list = answers.filter((a) => a.level === level);
    const textTiles = list.filter((a) => a.truth !== "none");
    const nulls = list.filter((a) => a.truth === "none");
    // Tiles whose letters can be checked: not empty, not "ink only" (*), not undecidable (?).
    const readable = list.filter((a) => a.truth !== "none" && a.truth !== "*" && !a.truth.includes("?"));
    const undecidable = list.filter((a) => a.truth.includes("?") && a.truth !== "*");
    return {
      level,
      n: list.length,
      textTiles: textTiles.length,
      textSeen: textTiles.filter((a) => a.said_text === "yes").length,
      nulls: nulls.length,
      falseAlarms: nulls.filter((a) => a.said_text === "yes").length,
      readable: readable.length,
      readRight: readable.filter((a) => a.letters_correct === true).length,
      undecidable: undecidable.length,
      honestCalls: undecidable.filter((a) => a.letters.includes("?")).length,
      sureWrong: list.filter((a) => a.confidence === 3 && (a.verdict === "wrong" || a.verdict === "guessed" || a.verdict === "false-alarm")).length,
    };
  });
}

/** Pairs "true letter → what was answered" for wrong or guessed answers. */
function confusions(answers: AnswerRecord[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const a of answers) {
    if (a.verdict === "false-alarm") {
      const key = `no letter → ${a.letters || "a letter"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    } else if (a.verdict === "wrong" || a.verdict === "guessed") {
      const key = `${a.truth === "?" ? "can't tell" : a.truth} → ${a.letters || "–"}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((x, y) => y[1] - x[1]).slice(0, 8);
}

function calibration(answers: AnswerRecord[]): string {
  const names = { 1: "Guessing", 2: "Fairly sure", 3: "Sure" } as const;
  return ([1, 2, 3] as const)
    .map((c) => {
      const list = answers.filter((a) => a.confidence === c);
      const right = list.filter((a) => a.verdict === "right" || a.verdict === "honest").length;
      return `<tr><td>${names[c]}</td><td class="num">${list.length}</td><td class="num">${pct(right, list.length)}</td></tr>`;
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
  const answers = state().answers;
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
  const modes = [
    { title: "Recognition with choices", list: realAnswers.filter((a) => a.task === "identify") },
    { title: "Reading with clues or a guide", list: realAnswers.filter((a) => a.task === "read" && a.help_used) },
    { title: "Reading without clues or a guide", list: realAnswers.filter((a) => a.task === "read" && a.help_used === false) },
  ];

  main.innerHTML = `
  <h1>My results</h1>
  ${
    isPersistent()
      ? `<p>Your answers are saved in this browser only. Nothing is sent anywhere.</p>`
      : `<p><strong>This browser does not allow saving.</strong> Your answers are kept only until you close the page.</p>`
  }
  ${
    answers.length === 0
      ? tip(`Your first discoveries will appear here. <a href="#/drill/esot">Try the round letters</a>.`)
      : `
  <h2>By level</h2>
  <div class="table-wrap" tabindex="0" role="region" aria-label="Results by level, scroll to see all columns"><table>
    <thead><tr>
      <th>Level</th><th class="num">Answers</th><th class="num">Text noticed</th>
      <th class="num">False alarms on empty tiles</th><th class="num">Fully read tiles</th>
      <th class="num">Honest “can't tell”</th><th class="num">Sure but wrong</th>
    </tr></thead>
    <tbody>
    ${rows
      .map(
        (r) => `<tr>
        <td>${esc(levelName(r.level))}</td>
        <td class="num">${r.n}</td>
        <td class="num">${r.textSeen}/${r.textTiles} (${pct(r.textSeen, r.textTiles)})</td>
        <td class="num">${r.falseAlarms}/${r.nulls} (${pct(r.falseAlarms, r.nulls)})</td>
        <td class="num">${r.readRight}/${r.readable} (${pct(r.readRight, r.readable)})</td>
        <td class="num">${r.honestCalls}/${r.undecidable} (${pct(r.honestCalls, r.undecidable)})</td>
        <td class="num">${r.sureWrong}</td>
      </tr>`,
      )
      .join("")}
    </tbody>
  </table></div>
  <p class="small muted">“Text noticed” counts tiles with ink or writing where you said yes. “Fully read tiles” counts correct readings of a whole letter or line;
  tiles without a confirmed reading are excluded. Level 1 uses clues, reference drawings and letter choices;
  those matches are assisted, not independent transcriptions. Its guided examples are not scored and add no answers here.
  Tiles where the deciding stroke is lost count under “can't tell”.</p>

  <h2>Practice and support</h2>
  <p>${realAnswers.length} answers on photographed or scan-derived material, from ${originals} source regions.
  ${realAnswers.filter((a) => a.practice).length} answers came from extra practice rounds.
  Altered versions count under their original region; some regions overlap. Returning to one image is repetition, not a new sample.</p>
  <div class="table-wrap"><table><thead><tr><th>Reading mode</th><th class="num">Answers</th><th class="num">Fully matched</th></tr></thead><tbody>
    ${modes.map(({ title, list }) => `<tr><td>${title}</td><td class="num">${list.length}</td><td class="num">${pct(list.filter((a) => a.letters_correct).length, list.length)}</td></tr>`).join("")}
  </tbody></table></div>
  <p class="small muted">Older saved answers may not record help use and are left out of the last two rows.
  “Without clues or a guide” describes that attempt; a familiar image may have appeared before.</p>
  ${answers.some((a) => a.simulated) ? `<h3>Altered-image practice</h3><div class="table-wrap"><table><thead><tr><th>Difficulty</th><th class="num">Answers</th><th class="num">Not sure</th></tr></thead><tbody>
    ${[1, 2, 3, 4, 5].map((degree) => { const list = answers.filter((a) => a.simulated && a.degradation === degree); return `<tr><td>${degree}/5</td><td class="num">${list.length}</td><td class="num">${list.filter((a) => a.said_text === "unsure" || a.letters.includes("?")).length}</td></tr>`; }).join("")}
    </tbody></table></div><p class="small muted">These are controlled image changes, not scanner resolutions. Their source readings do not establish what remains visible after alteration.</p>` : ""}

  <h2>Most frequent mix-ups</h2>
  ${
    conf.length
      ? `<div class="table-wrap"><table><thead><tr><th>Answer → you said</th><th class="num">Times</th></tr></thead><tbody>
        ${conf.map(([k, n]) => `<tr><td class="greek">${esc(k)}</td><td class="num">${n}</td></tr>`).join("")}
        </tbody></table></div>`
      : `<p>No mix-ups so far.</p>`
  }

  <h2>How sure were you?</h2>
  <div class="table-wrap"><table><thead><tr><th>You said</th><th class="num">Answers</th><th class="num">Right or honest</th></tr></thead>
  <tbody>${calibration(answers)}</tbody></table></div>
  <p class="small muted">If “Sure” is right much more often than “Guessing”, your sense of certainty is working.</p>`
  }

  <section class="practice-settings" aria-labelledby="practice-settings-title">
    <h2 id="practice-settings-title">Your practice level</h2>
    <p class="small">Want to jump ahead or revisit the basics? Choose which levels to open.
    This changes access only; your answers, completed sets, points and ranks stay as they are.</p>
    <label for="practice-level">Open exercises through</label>
    <div class="row">
      <select id="practice-level">
        <option value="auto" ${state().levelOverride === undefined ? "selected" : ""}>Follow my progress automatically</option>
        ${[...new Set(playSets.map((p) => p.level))].sort().map((level) => `<option value="${level}" ${state().levelOverride === level ? "selected" : ""}>${esc(levelName(level))}</option>`).join("")}
      </select>
      <button type="button" id="apply-level">Apply</button>
      <button type="button" id="reset-level" ${state().levelOverride === undefined ? "disabled" : ""}>Use automatic progress</button>
    </div>
    <p class="small muted" id="level-note" role="status">${state().levelOverride !== undefined ? `Manually opened through level ${state().levelOverride}.` : "Levels follow your progress. You can also skip the introduction from the path."}</p>
    <a class="button" href="#/">Back to the path →</a>
  </section>

  <details class="backup" id="backup">
    <summary>Back up or move your progress</summary>
    <p class="small">Your progress lives only in this browser. To keep a copy or move to another
    browser, save it as a file and load it there. Loading adds to what is already here; nothing is
    overwritten.</p>
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
    the letters you gave, how sure you were and how long you took. It also holds your finished sets,
    badges, ranks and practice settings.</p>
  </details>

  <section class="reset-progress" aria-labelledby="reset-title">
    <h2 id="reset-title">Start fresh</h2>
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
  </section>`;

  const $ = <T extends HTMLElement>(sel: string) => main.querySelector<T>(sel)!;
  const applyLevel = (value: string) => {
    setLevelOverride(value === "auto" ? undefined : Number(value));
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
      const r = importText(text);
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
