import { itemSetVersion, LEVELS } from "../data";
import { clearAll, exportPayload, importText, isPersistent, state } from "../store";
import { progressAfterAnswer } from "../progress-ui";
import type { AnswerRecord } from "../types";
import { tip } from "../ui";
import { esc, pct } from "../util";

const APP_VERSION = "0.1.0";

function levelName(level: number): string {
  return level === 0 ? "Stage 0: alphabet" : `Level ${level}: ${LEVELS.find((l) => l.level === level)?.title ?? ""}`;
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
  const rows = summarise(answers);
  const conf = confusions(answers);

  main.innerHTML = `
  <h1>My results</h1>
  ${
    isPersistent()
      ? `<p>Your answers are saved in this browser only. Nothing is sent anywhere.</p>`
      : `<p><strong>This browser does not allow saving.</strong> Your answers are kept only until you close the page.</p>`
  }
  ${
    answers.length === 0
      ? tip(`No answers yet. <a href="#/">Start with the first exercise</a>.`)
      : `
  <h2>By level</h2>
  <div class="table-wrap"><table>
    <thead><tr>
      <th>Level</th><th class="num">Answers</th><th class="num">Text noticed</th>
      <th class="num">False alarms on empty tiles</th><th class="num">Letters read</th>
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
  <p class="small muted">“Text noticed” counts tiles with a letter where you said yes. “Letters read” counts tiles where the letter could be decided.
  Tiles where the deciding stroke is lost count under “can't tell”.</p>

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

  <details class="backup" id="backup">
    <summary>Back up or move your progress</summary>
    <p class="small">Your progress lives only in this browser. To keep a copy or move to another
    browser, save it as a file and load it there. Loading adds to what is already here; nothing is
    overwritten.</p>
    <div class="row">
      <button type="button" id="export" ${answers.length ? "" : "disabled"}>Save as file</button>
      <button type="button" id="copy" ${answers.length ? "" : "disabled"}>Copy as text</button>
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
    badges and ranks.</p>
    <div class="row">
      <button type="button" id="clear" class="quiet" ${answers.length ? "" : "disabled"}>Delete my progress</button>
    </div>
    <div id="confirm-clear" class="confirm" hidden>
      <p><strong>Delete all your answers, points, badges and ranks from this browser?</strong> This cannot be undone.</p>
      <div class="row">
        <button type="button" id="clear-yes">Delete everything</button>
        <button type="button" class="primary" id="clear-no">Keep my progress</button>
      </div>
    </div>
  </details>`;

  const $ = <T extends HTMLElement>(sel: string) => main.querySelector<T>(sel)!;
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
    progressAfterAnswer();
    renderResults(main);
  });
}
