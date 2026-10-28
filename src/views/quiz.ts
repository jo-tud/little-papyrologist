import { glyphs, quizItems, quizSets, sourceById } from "../data";
import { progressAfterAnswer, rankUpBanner } from "../progress-ui";
import { score, type Score } from "../scoring";
import { addAnswer, markSetDone } from "../store";
import type { AnswerRecord, QuizItem, SaidText } from "../types";
import { sourceLinks, tip } from "../ui";
import { esc, shuffle } from "../util";

const LETTERS = glyphs.map((g) => g.char);
const keyToLetter = new Map<string, string>(glyphs.map((g) => [g.latin, g.char]));
keyToLetter.set("w", "Ϲ");

interface Pick {
  said?: SaidText;
  letters: string[];
  confidence?: 1 | 2 | 3;
}

const imgSrc = (file: string) => `images/${file}`;

function sourceLine(item: QuizItem): string {
  const links = item.source
    .map((id) => sourceById.get(id))
    .filter((s): s is NonNullable<typeof s> => !!s && !!s.url)
    .map((s) => `<a href="${esc(s.url!)}" rel="noopener">${esc(s.title)}</a>`)
    .join("; ");
  const changes = item.changes ? item.changes.charAt(0).toUpperCase() + item.changes.slice(1) + ". " : "";
  return `Image: ${esc(item.credit)}, ${esc(item.license)}. ${esc(changes)}Sources: ${links}.`;
}

/** The reading, one letter per box, coloured by how the player did. Uncertain letters get a dot below. */
function readingBoxes(item: QuizItem, s: Score): string {
  const unc = new Set(item.uncertain ?? []);
  return `<div class="reading" aria-label="The reading, letter by letter">${Array.from(item.truth)
    .map((ch, i) => {
      const m = s.marks[i] ?? "missing";
      const label = { ok: "read", honest: "marked as unreadable", wrong: "misread", missing: "not given" }[m];
      return `<span class="rl rl-${m}${unc.has(i) ? " rl-unc" : ""}" title="${label}${unc.has(i) ? ", uncertain in the edition" : ""}">${esc(ch)}</span>`;
    })
    .join("")}</div>`;
}

function headline(item: QuizItem, p: Pick, s: Score, word: string): string {
  const detect = item.task === "detect";
  switch (s.verdict) {
    case "right":
      return detect ? `Right: there is ${word} here` : "Read correctly";
    case "honest":
      return p.said === "no" ? `No false alarm. There is no ${word} here.` : `Fair. There is no ${word} here.`;
    case "careful":
      return detect ? `There is ${word} here` : "Careful, and nothing misread";
    case "false-alarm":
      return `False alarm. There is no ${word} here.`;
    case "missed":
      return `There is ${word} here`;
    default:
      return "Some letters misread";
  }
}

function points(s: Score): string {
  const chips: string[] = [];
  if (s.reading > 0) chips.push(`<span class="r">+${s.reading} reading</span>`);
  if (s.reading < 0) chips.push(`<span class="neg">−1 for being sure and wrong</span>`);
  if (s.honesty > 0) chips.push(`<span class="h">+${s.honesty} honesty</span>`);
  if (!chips.length) chips.push(`<span class="r">no points this time</span>`);
  return chips.join("");
}

export function renderQuiz(main: HTMLElement, setId: string): () => void {
  const set = quizSets.find((s) => s.id === setId);
  const items = quizItems.filter((i) => i.set === setId);
  if (!set || !items.length) {
    main.innerHTML = `<h1>Set not found</h1><p><a href="#/">Back to the path</a></p>`;
    return () => {};
  }
  let order = shuffle(items);
  let index = 0;
  let pick: Pick = { letters: [] };
  let checked: Score | null = null;
  let newRank: string | undefined;
  const ranksThisSet: string[] = [];
  const results: AnswerRecord[] = [];
  let shownAt = performance.now();
  let zoom = false;

  const detectWord = () => (set.level === 1 ? "ink" : "writing");

  function canCheck(): boolean {
    const item = order[index];
    if (!pick.said || !pick.confidence) return false;
    if (item.task === "read" && pick.said === "yes" && pick.letters.length === 0) return false;
    return true;
  }

  function letterPanel(item: QuizItem): string {
    const optional = item.task === "detect";
    const disabled = pick.said === "no" || checked !== null;
    return `<fieldset class="question" ${disabled ? "disabled" : ""}>
      <legend>${optional ? `Which letters do you see? <span class="muted small">(optional${set!.level === 1 ? ", not scored: there is no published reading yet" : ", not scored here"})</span>` : "Read the letters, left to right"}</legend>
      <output class="typed greek" id="typed" aria-live="polite">${pick.letters.length ? pick.letters.map(esc).join("") : `<span class="muted small">Type or tap letters. Use ? for a letter you cannot read.</span>`}</output>
      <div class="keyboard" role="group" aria-label="Greek letters">
        ${LETTERS.map((l) => `<button type="button" class="key greek" data-key="${l}" aria-label="${esc(glyphs.find((g) => g.char === l)?.name ?? l)}">${l}</button>`).join("")}
        <button type="button" class="key" data-key="?" aria-label="A letter I cannot read">?</button>
        <button type="button" class="key key-wide" data-key="back" aria-label="Delete last letter">⌫</button>
      </div>
    </fieldset>`;
  }

  function renderRound(): void {
    const item = order[index];
    const wide = item.task === "read";
    main.innerHTML = `
    <div class="drill-head">
      <h1>${esc(set!.title)}</h1>
      <span class="muted">Tile ${index + 1} of ${order.length}</span>
    </div>
    <div class="progress" aria-hidden="true">${order.map((_, i) => `<span class="${i < index ? "past" : i === index ? "now" : ""}"></span>`).join("")}</div>
    <div class="round ${wide ? "round-wide" : ""}">
      <figure class="tile-frame photo ${zoom ? "zoomed" : ""}" data-item="${esc(item.id)}">
        <div class="zoom-box"><img src="${imgSrc(item.image)}" alt="${esc(item.alt)}" class="tile-img"></div>
        <figcaption>
          <button type="button" class="linkish" id="zoom" aria-pressed="${zoom}">${zoom ? "Zoom out" : "Zoom in"}</button>
          <span class="small muted">${esc(item.credit)}, ${esc(item.license)}</span>
        </figcaption>
      </figure>
      <div class="answer">
        ${checked ? feedback(item, checked) : questions(item)}
      </div>
    </div>`;
  }

  function questions(item: QuizItem): string {
    const c = (name: string, value: string, label: string, pressed: boolean) =>
      `<button type="button" class="choice" data-${name}="${value}" aria-pressed="${pressed}">${label}</button>`;
    return `
      <fieldset class="question">
        <legend>Is there ${detectWord()} on this tile?</legend>
        <div class="row">
          ${c("said", "yes", "Yes", pick.said === "yes")}
          ${c("said", "no", `No ${detectWord()}`, pick.said === "no")}
          ${c("said", "unsure", "Not sure", pick.said === "unsure")}
        </div>
      </fieldset>
      ${letterPanel(item)}
      <fieldset class="question">
        <legend>How sure are you?</legend>
        <div class="row">
          ${c("conf", "1", "Guessing", pick.confidence === 1)}
          ${c("conf", "2", "Fairly sure", pick.confidence === 2)}
          ${c("conf", "3", "Sure", pick.confidence === 3)}
        </div>
      </fieldset>
      <button type="button" class="primary" id="check" ${canCheck() ? "" : "disabled"}>Check answer</button>
      <p class="keys">Keys: Greek letters on the Greek layout (e.g. <kbd>e</kbd> Ε, <kbd>s</kbd> Ϲ, <kbd>u</kbd> Θ), <kbd>?</kbd> unreadable letter,
      <kbd>Backspace</kbd> delete, <kbd>-</kbd> no ${detectWord()}, <kbd>1</kbd>–<kbd>3</kbd> how sure, <kbd>Enter</kbd> check.</p>`;
  }

  function feedback(item: QuizItem, s: Score): string {
    const reading = item.task === "read"
      ? `${readingBoxes(item, s)}
         <p class="small">${s.letters_ok} of ${s.letters_total} letters read${s.extras ? `, ${s.extras} extra` : ""}.
         You typed: <span class="greek">${pick.letters.length ? pick.letters.map(esc).join("") : "nothing"}</span></p>
         <p class="edition-line greek" lang="grc">${esc(item.edition ?? "")}</p>
         <p class="small muted">${esc(item.reading ?? "")}, as printed in the edition. Letters with a dot below are uncertain there.</p>`
      : `<dl class="compare"><dt>You said</dt><dd>${pick.said === "no" ? `no ${detectWord()}` : pick.said === "unsure" ? "not sure" : `${detectWord()}`}${pick.letters.length ? ` <span class="greek">(${pick.letters.map(esc).join("")})</span>` : ""}</dd>
         <dt>Answer</dt><dd>${item.truth === "none" ? `no ${detectWord()}` : `${detectWord()}`}</dd></dl>`;
    const traced = item.answer_image
      ? `<figure class="answer-figure"><img src="${imgSrc(item.answer_image)}" alt="The same tile with the organizers' tracing in red"><figcaption class="small muted">Red: ink traced by the organizers.</figcaption></figure>`
      : "";
    return `${newRank ? rankUpBanner(newRank) : ""}<div class="verdict v-${s.verdict}">
      <h2 id="verdict" tabindex="-1">${esc(headline(item, pick, s, detectWord()))}</h2>
      ${reading}
      ${traced}
      <p>${esc(item.explain)}</p>
      <div class="points">${points(s)}</div>
      <p class="cite">${sourceLine(item)}</p>
      <button type="button" class="primary" id="next">${index + 1 < order.length ? "Next tile" : "See how it went"}</button>
    </div>
    ${s.verdict === "false-alarm" ? tip(`Seeing ${detectWord()} where there is none is the most common trap. The editors of PHerc. Paris 4 also set aside traces that may have been noise (${sourceLinks(["cerc54"])}).`) : ""}`;
  }

  function check(): void {
    if (!canCheck() || checked) return;
    const item = order[index];
    const letters = pick.said === "no" ? "" : pick.letters.join("");
    const s = score({ text: item.truth, uncertain: item.uncertain }, { said: pick.said!, letters, confidence: pick.confidence! });
    const rec: AnswerRecord = {
      item_id: item.id,
      level: item.level,
      degradation: item.degradation,
      said_text: pick.said!,
      letters,
      confidence: pick.confidence!,
      ms: Math.round(performance.now() - shownAt),
      answered_at: new Date().toISOString(),
      truth: item.truth,
      text_correct: s.text_correct,
      letters_correct: s.letters_correct,
      verdict: s.verdict,
      reading_points: s.reading,
      honesty_points: s.honesty,
      ...(s.letters_total ? { letters_ok: s.letters_ok, letters_total: s.letters_total } : {}),
    };
    addAnswer(rec);
    results.push(rec);
    checked = s;
    const news = progressAfterAnswer();
    newRank = news.rank?.id;
    if (newRank) ranksThisSet.push(newRank);
    renderRound();
    main.querySelector<HTMLElement>("#verdict")?.focus();
  }

  function next(): void {
    index++;
    pick = { letters: [] };
    checked = null;
    newRank = undefined;
    if (index >= order.length) {
      markSetDone(set!.id);
      const news = progressAfterAnswer();
      if (news.rank) ranksThisSet.push(news.rank.id);
      renderSummary();
      return;
    }
    shownAt = performance.now();
    renderRound();
    main.querySelector<HTMLElement>("[data-said]")?.focus();
  }

  function renderSummary(): void {
    const count = (v: string) => results.filter((r) => r.verdict === v).length;
    const empty = results.filter((r) => r.truth === "none").length;
    const lines = results.filter((r) => r.letters_total);
    const lettersOk = lines.reduce((n, r) => n + (r.letters_ok ?? 0), 0);
    const lettersAll = lines.reduce((n, r) => n + (r.letters_total ?? 0), 0);
    main.innerHTML = `
      <h1 tabindex="-1">${esc(set!.title)}: done</h1>
      ${ranksThisSet.length ? rankUpBanner(ranksThisSet[ranksThisSet.length - 1]) : ""}
      <div class="tally">
        <div><strong>${results.filter((r) => r.truth !== "none" && r.said_text === "yes").length}</strong><span class="muted">tiles with ${detectWord()} spotted</span></div>
        <div class="honesty"><strong>${count("honest")}</strong><span class="muted">empty tiles called right</span></div>
        <div><strong>${count("false-alarm")}</strong><span class="muted">false alarms on ${empty} empty tiles</span></div>
        ${lettersAll ? `<div><strong>${lettersOk}/${lettersAll}</strong><span class="muted">letters read in lines</span></div>` : ""}
      </div>
      ${tip(count("false-alarm") === 0 ? "No false alarms. That is the habit that matters most." : "Some empty tiles looked like writing to you. Strokes have to join into letter shapes; scattered specks do not.")}
      <div class="row">
        <button type="button" id="again" class="primary">Play again</button>
        <a class="button" href="#/">Back to the path</a>
        <a class="button" href="#/results">My results</a>
      </div>`;
    main.querySelector("#again")?.addEventListener("click", () => {
      order = shuffle(items);
      index = 0;
      results.length = 0;
      ranksThisSet.length = 0;
      shownAt = performance.now();
      renderRound();
    });
    main.querySelector<HTMLElement>("h1")?.focus();
  }

  function addLetter(l: string): void {
    pick.letters.push(l);
    if (!pick.said || pick.said === "no") pick.said = "yes";
  }

  function onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    if (b.id === "zoom") {
      zoom = !zoom;
      renderRound();
      main.querySelector<HTMLElement>("#zoom")?.focus();
      return;
    }
    if (b.id === "check") return check();
    if (b.id === "next") return next();
    if (checked) return;
    if (b.dataset.said) {
      pick.said = b.dataset.said as SaidText;
      if (pick.said === "no") pick.letters = [];
    } else if (b.dataset.conf) pick.confidence = Number(b.dataset.conf) as 1 | 2 | 3;
    else if (b.dataset.key === "back") pick.letters.pop();
    else if (b.dataset.key) addLetter(b.dataset.key);
    else return;
    const [k, v] = Object.entries(b.dataset)[0] ?? [];
    renderRound();
    if (k) main.querySelector<HTMLElement>(`[data-${k}="${v}"]`)?.focus();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || index >= order.length) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "Enter") {
      if ((e.target as HTMLElement).closest("button, a")) return;
      e.preventDefault();
      if (checked) next();
      else check();
      return;
    }
    if (checked) return;
    let changed = true;
    if (k === "-") {
      pick.said = "no";
      pick.letters = [];
    } else if (k === "?") addLetter("?");
    else if (k === "Backspace") pick.letters.pop();
    else if (k === "1" || k === "2" || k === "3") pick.confidence = Number(k) as 1 | 2 | 3;
    else if (keyToLetter.has(k)) addLetter(keyToLetter.get(k)!);
    else changed = false;
    if (changed) {
      e.preventDefault();
      renderRound();
    }
  }

  main.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  renderRound();
  return () => {
    main.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
