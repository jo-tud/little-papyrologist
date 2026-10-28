import { glyphs, quizItems, quizSets, sourceById } from "../data";
import { progressAfterAnswer, rankUpBanner } from "../progress-ui";
import { score, type Score } from "../scoring";
import { addAnswer, markSetDone } from "../store";
import type { AnswerRecord, QuizItem, SaidText } from "../types";
import { letterLabel, letterName, namedLetter, sourceLinks, tip } from "../ui";
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
      return `<span class="rl named-letter rl-${m}${unc.has(i) ? " rl-unc" : ""}" role="img" aria-label="${esc(namedLetter(ch))}: ${label}${unc.has(i) ? ", uncertain in the edition" : ""}" title="${label}${unc.has(i) ? ", uncertain in the edition" : ""}">${letterLabel(ch)}</span>`;
    })
    .join("")}</div>`;
}

function headline(item: QuizItem, p: Pick, s: Score, word: string): string {
  if (item.task === "identify") {
    const name = Array.from(item.truth).map(namedLetter).join(" · ");
    return s.verdict === "right" ? `Yes — ${name}` : `Let's look together: ${name}`;
  }
  const detect = item.task === "detect";
  switch (s.verdict) {
    case "right":
      return detect ? `You spotted the ${word}` : "Read correctly";
    case "honest":
      return p.said === "no" ? `Well spotted: no visible ${word} here` : `A careful call: no visible ${word} here`;
    case "careful":
      return detect ? `There is ${word} here` : "Careful, and nothing misread";
    case "false-alarm":
      return `A convincing shape — let's compare it with the reference`;
    case "missed":
      return `The reference shows ${word} here`;
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
  const guided = items.every((item) => item.task === "identify");
  let order = guided ? [...items] : shuffle(items);
  const choices = new Map(items.map((item) => [item.id, shuffle(item.choices ?? [])]));
  let index = 0;
  let pick: Pick = { letters: [] };
  let checked: Score | null = null;
  let newRank: string | undefined;
  const ranksThisSet: string[] = [];
  const results: AnswerRecord[] = [];
  let shownAt = performance.now();
  let zoom = false;

  const detectWord = () => (set.id === "ir-500p2" ? "ink" : "writing");

  function canCheck(): boolean {
    const item = order[index];
    if (!pick.said || !pick.confidence) return false;
    if (item.task !== "detect" && pick.said === "yes" && pick.letters.length === 0) return false;
    return true;
  }

  function letterPanel(item: QuizItem): string {
    const optional = item.task === "detect";
    const disabled = pick.said === "no" || checked !== null;
    return `<fieldset class="question" id="letters-question" ${disabled ? "disabled" : ""}>
      <legend>${optional ? `Which letters do you see? <span class="muted small">(saved, not scored)</span>` : "Read the letters, left to right"}</legend>
      <output class="typed greek" id="typed" aria-live="polite">${pick.letters.length ? pick.letters.map(esc).join("") : `<span class="muted small">Type or tap letters. Use ? for a letter you cannot read.</span>`}</output>
      <div class="keyboard" role="group" aria-label="Greek letters">
        ${LETTERS.map((l) => `<button type="button" class="key named-letter" data-key="${l}" title="Key: ${esc(glyphs.find((g) => g.char === l)!.latin)}">${letterLabel(l)}</button>`).join("")}
        <button type="button" class="key" data-key="?" aria-label="A letter I cannot read">?</button>
        <button type="button" class="key key-wide" data-key="back" aria-label="Delete last letter">⌫</button>
      </div>
    </fieldset>`;
  }

  function renderRound(): void {
    const item = order[index];
    const wide = item.task === "read";
    main.innerHTML = `
    <a class="back-link" href="#/">← Back to the path</a>
    <div class="drill-head">
      <h1 tabindex="-1">${esc(set!.title)}</h1>
      <span class="muted">Tile ${index + 1} of ${order.length}</span>
    </div>
    ${guided && !checked ? `<p class="round-intro">Real papyrus, confirmed letter names. Match the dark strokes to a choice below; the clue gives you a starting point.</p>` : ""}
    <div class="progress" aria-hidden="true">${order.map((_, i) => `<span class="${i < index ? "past" : i === index ? "now" : ""}"></span>`).join("")}</div>
    <div class="round ${wide ? "round-wide" : ""}">
      <figure class="tile-frame photo ${zoom ? "zoomed" : ""}" data-item="${esc(item.id)}">
        <div class="zoom-box" tabindex="0" role="region" aria-label="Papyrus image; scroll to explore when enlarged"><img src="${imgSrc(item.image)}" alt="${esc(item.alt)}" class="tile-img"></div>
        <figcaption>
          <button type="button" class="linkish" id="zoom" aria-pressed="${zoom}">${zoom ? "Zoom out" : "Zoom in"}</button>
          <span class="small muted">${esc(item.credit)}, ${esc(item.license)}</span>
        </figcaption>
        ${wide ? `<p class="image-hint small muted">Scroll sideways to explore the line. The names below help you learn each letter.</p>` : ""}
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
      ${item.task === "identify" ? `<fieldset class="question"><legend>${Array.from(item.truth).length > 1 ? "Which two letters do you see?" : "Which letter do you see?"}</legend>
        <p class="small muted">${esc(item.hint ?? "")}</p>
        <div class="match-options">${choices.get(item.id)!.map((reading) => `<button type="button" class="choice named-letter" data-reading="${reading}" aria-pressed="${pick.letters.join("") === reading}"><span class="greek" lang="grc">${reading}</span><span class="letter-name">${Array.from(reading).map(letterName).join(" · ")}</span></button>`).join("")}
        <button type="button" class="choice" data-reading="?" aria-pressed="${pick.said === "unsure"}">Not sure yet</button></div></fieldset>` : `
      <fieldset class="question">
        <legend>Is there ${detectWord()} on this tile?</legend>
        <div class="row">
          ${c("said", "yes", "Yes", pick.said === "yes")}
          ${c("said", "no", `No ${detectWord()}`, pick.said === "no")}
          ${c("said", "unsure", "Not sure", pick.said === "unsure")}
        </div>
      </fieldset>
      ${item.task === "detect" ? `<details class="optional-letters"><summary>Try naming letters <span class="muted">(optional, not scored)</span></summary>${letterPanel(item)}</details>` : letterPanel(item)}`}
      <fieldset class="question">
        <legend>How sure are you?</legend>
        <div class="row">
          ${c("conf", "1", "Guessing", pick.confidence === 1)}
          ${c("conf", "2", "Fairly sure", pick.confidence === 2)}
          ${c("conf", "3", "Sure", pick.confidence === 3)}
        </div>
      </fieldset>
      <button type="button" class="primary" id="check" aria-describedby="check-hint" ${canCheck() ? "" : "disabled"}>Check answer</button>
      <p class="small muted check-hint" id="check-hint">${checkHint()}</p>
      <p class="keys">${guided ? `<kbd>Tab</kbd> move between choices, <kbd>Space</kbd> select, <kbd>?</kbd> not sure yet, <kbd>1</kbd>–<kbd>3</kbd> how sure, <kbd>Enter</kbd> check.` : `Keyboard shortcuts: <kbd>e</kbd> Ε, <kbd>s</kbd> Ϲ, <kbd>u</kbd> Θ, or type Greek. <kbd>?</kbd> unreadable letter,
      <kbd>Backspace</kbd> delete, <kbd>-</kbd> no ${detectWord()}, <kbd>1</kbd>–<kbd>3</kbd> how sure, <kbd>Enter</kbd> check.`}</p>`;
  }

  function checkHint(): string {
    if (!pick.said) return guided ? "Choose the closest match, or “Not sure yet”." : `Choose whether you see ${detectWord()}.`;
    if (order[index].task === "read" && pick.said === "yes" && !pick.letters.length) return "Enter letters, or use ? for a letter you cannot read.";
    if (!pick.confidence) return "Choose how sure you are to check your answer.";
    return "Ready when you are.";
  }

  function updateQuestions(): void {
    main.querySelectorAll<HTMLButtonElement>("[data-said], [data-conf], [data-reading]").forEach((button) => {
      const pressed = button.dataset.reading ? button.dataset.reading === "?" ? pick.said === "unsure" : button.dataset.reading === pick.letters.join("")
        : button.dataset.said ? button.dataset.said === pick.said : Number(button.dataset.conf) === pick.confidence;
      button.setAttribute("aria-pressed", String(pressed));
    });
    const lettersQuestion = main.querySelector<HTMLFieldSetElement>("#letters-question");
    if (lettersQuestion) lettersQuestion.disabled = pick.said === "no";
    const typed = main.querySelector<HTMLElement>("#typed");
    if (typed) typed.innerHTML = pick.letters.length ? pick.letters.map(esc).join("") : `<span class="muted small">Type or tap letters. Use ? for a letter you cannot read.</span>`;
    const optional = main.querySelector<HTMLDetailsElement>(".optional-letters");
    if (optional && pick.letters.length) optional.open = true;
    main.querySelector<HTMLButtonElement>("#check")!.disabled = !canCheck();
    main.querySelector<HTMLElement>("#check-hint")!.textContent = checkHint();
  }

  function feedback(item: QuizItem, s: Score): string {
    const reading = item.task === "identify"
      ? `${readingBoxes(item, s)}<p class="small">You chose: ${pick.said === "unsure" ? "not sure yet" : esc(pick.letters.map(namedLetter).join(" · "))}.</p><p class="small muted">Confirmed reading: ${esc(item.reading ?? "")}.</p>`
      : item.task === "read"
      ? `${readingBoxes(item, s)}
         <p class="small">${s.letters_ok ?? 0} of ${s.letters_total ?? Array.from(item.truth).length} letters read${s.extras ? `, ${s.extras} extra` : ""}.
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
      ${item.task === "detect" && pick.letters.length ? `<p class="small">Your letter suggestion is saved. It is not marked wrong; this round checks visible ${detectWord()} only.</p>` : ""}
      <p class="cite">${sourceLine(item)}</p>
      <button type="button" class="primary" id="next">${index + 1 < order.length ? "Next tile" : "See how it went"}</button>
    </div>
    ${s.verdict === "false-alarm" ? tip(`A familiar shape can be tempting. Compare the strokes with the reference, and use “Not sure” when the evidence is thin. Even the editors set aside ambiguous traces (${sourceLinks(["cerc54"])}).`) : ""}`;
  }

  function check(): void {
    if (!canCheck() || checked) return;
    const item = order[index];
    const letters = pick.said === "no" ? "" : pick.letters.join("");
    const s = score({ text: item.truth, uncertain: item.uncertain }, { said: pick.said!, letters, confidence: pick.confidence! });
    const rec: AnswerRecord = {
      item_id: item.id,
      task: item.task,
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
    main.querySelector<HTMLElement>("h1")?.focus();
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
        ${guided ? `<div><strong>${count("right")}/${results.length}</strong><span class="muted">photographs matched</span></div>` : `<div><strong>${results.filter((r) => r.truth !== "none" && r.said_text === "yes").length}</strong><span class="muted">tiles with ${detectWord()} spotted</span></div>
        <div class="honesty"><strong>${results.filter((r) => r.truth === "none" && r.said_text === "no").length}</strong><span class="muted">empty tiles called right</span></div>
        <div><strong>${count("false-alarm")}</strong><span class="muted">false alarms on ${empty} empty tiles</span></div>`}
        ${lettersAll && !guided ? `<div><strong>${lettersOk}/${lettersAll}</strong><span class="muted">letters read in lines</span></div>` : ""}
      </div>
      ${tip(guided ? "You have met real handwriting. Next, look more closely: sometimes a promising mark is papyrus or image noise. The reference will help you tell the difference." : count("false-alarm") === 0 ? "No false alarms. That is the habit that matters most." : "Some empty tiles suggested writing. Comparing them with the reference is part of learning what to look for.")}
      <div class="row">
        ${guided ? `<a class="button primary" href="#/quiz/ir-500p2">Next: look closer →</a>` : ""}
        <button type="button" id="again" class="${guided ? "" : "primary"}">Play again</button>
        <a class="button" href="#/">Back to the path</a>
        <a class="button" href="#/results">My results</a>
      </div>`;
    main.querySelector("#again")?.addEventListener("click", () => {
      order = guided ? [...items] : shuffle(items);
      index = 0;
      results.length = 0;
      ranksThisSet.length = 0;
      shownAt = performance.now();
      renderRound();
      main.querySelector<HTMLElement>("h1")?.focus();
    });
    main.querySelector<HTMLElement>("h1")?.focus();
  }

  function addLetter(l: string): void {
    pick.letters.push(l);
    if (!pick.said || pick.said === "no") pick.said = "yes";
  }

  function onClick(e: Event): void {
    const b = (e.target as HTMLElement).closest("button");
    if (!b || b.disabled) return;
    if (b.id === "zoom") {
      zoom = !zoom;
      main.querySelector(".photo")?.classList.toggle("zoomed", zoom);
      b.setAttribute("aria-pressed", String(zoom));
      b.textContent = zoom ? "Zoom out" : "Zoom in";
      return;
    }
    if (b.id === "check") return check();
    if (b.id === "next") return next();
    if (checked) return;
    if (b.dataset.reading) {
      pick.said = b.dataset.reading === "?" ? "unsure" : "yes";
      pick.letters = Array.from(b.dataset.reading === "?" ? "?".repeat(order[index].truth.length) : b.dataset.reading);
    } else if (b.dataset.said) {
      pick.said = b.dataset.said as SaidText;
      if (pick.said === "no") pick.letters = [];
    } else if (b.dataset.conf) pick.confidence = Number(b.dataset.conf) as 1 | 2 | 3;
    else if (b.dataset.key === "back") pick.letters.pop();
    else if (b.dataset.key) addLetter(b.dataset.key);
    else return;
    updateQuestions();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing || index >= order.length) return;
    if ((e.target as HTMLElement).closest("input, textarea, select, [contenteditable], .topbar, .footer")) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    if (k === "Enter") {
      if (e.repeat) return;
      if ((e.target as HTMLElement).closest("a, summary, button:not([data-said]):not([data-conf]):not([data-key]):not([data-reading])")) return;
      e.preventDefault();
      if (checked) next();
      else check();
      return;
    }
    if (checked) return;
    if (guided) {
      if (k === "?") {
        pick.said = "unsure";
        pick.letters = Array.from("?".repeat(order[index].truth.length));
      } else if (k === "1" || k === "2" || k === "3") pick.confidence = Number(k) as 1 | 2 | 3;
      else return;
      e.preventDefault();
      updateQuestions();
      return;
    }
    let changed = true;
    if (k === "-") {
      pick.said = "no";
      pick.letters = [];
    } else if (k === "?") addLetter("?");
    else if (k === "Backspace") pick.letters.pop();
    else if (k === "1" || k === "2" || k === "3") pick.confidence = Number(k) as 1 | 2 | 3;
    else if (keyToLetter.has(k)) addLetter(keyToLetter.get(k)!);
    else if (LETTERS.includes(e.key.toUpperCase().replace(/[Σϲ]/g, "Ϲ"))) addLetter(e.key.toUpperCase().replace(/[Σϲ]/g, "Ϲ"));
    else changed = false;
    if (changed) {
      e.preventDefault();
      updateQuestions();
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
