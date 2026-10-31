import { activeQuizItems, activeQuizSets, glyphs, itemSetVersion, LEVELS, playSets, quizItems, quizSets, sourceById } from "../data";
import { isPracticeItem } from "../curriculum";
import { learningAction } from "../learning-action";
import { letterFormLabel } from "../letter-forms";
import { progressAfterAnswer, rankUpBanner } from "../progress-ui";
import { align, readingStats, score, type Score } from "../scoring";
import { addAnswer, clearRound, markSetDone, saveRound, state } from "../store";
import type { AnswerRecord, QuizItem, QuizSet, SaidText } from "../types";
import { letterLabel, letterName, namedLetter, tip } from "../ui";
import { planPractice } from "../practice";
import { canStartFirstLine, levelAvailable, levelDone } from "../rules";
import { handleComparisonClick, imageComparison, syncComparisonScroll } from "../image-comparison";
import { answerKey, canResume } from "../round-session";
import { esc, shuffle } from "../util";
import { handleViewerClick, revealTaskViewer, showLetterRegion, syncViewerScroll, taskViewer } from "../task-viewer";
import "../learning-task.css";

const LETTERS = glyphs.map((g) => g.char);
const keyToLetter = new Map<string, string>(glyphs.map((g) => [g.latin, g.char]));
keyToLetter.set("w", "Ϲ");

interface Pick {
  said?: SaidText;
  letters: string[];
  confidence?: 1 | 2 | 3 | null;
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

function readingSource(item: QuizItem): string {
  const name = Array.from(item.truth).map(namedLetter).join(" · ");
  return `<details class="reading-source"><summary>Reading and source</summary>
    <p class="small">Published identification: ${esc(name)}. ${esc(item.reading ?? "")}${item.sample_id ? `; source sample label: <span lang="grc">${esc(item.sample_id)}</span>` : ""}.</p>
    <p class="small muted">${item.sample_id ? "The sample label names the letter in the dataset; it is not a picture of its handwritten form." : "The edition supplies the reading; the image shows the handwritten forms."}
    We use printed capitals to record the reading.</p></details>`;
}

/** The drawing and type are references, never presented as a tracing of this photograph. */
function letterReference(reading: string): string {
  return Array.from(reading).map(letterFormLabel).join("");
}

/** The reading, one letter per box, coloured by how the player did. Uncertain letters get a dot below. */
function readingBoxes(item: QuizItem, s?: Score): string {
  if (item.truth === "none" || item.truth === "*") return "";
  const unc = new Set(item.uncertain ?? []);
  return `<div class="reading" tabindex="0" role="region" aria-label="The reading, letter by letter; scroll sideways if needed">${Array.from(item.truth)
    .map((ch, i) => {
      const m = s ? s.marks[i] ?? "missing" : "study";
      const label = { ok: "read", honest: "marked as unreadable", wrong: "misread", missing: "not given", study: "published reading" }[m];
      const mapped = !!item.letter_regions?.[i];
      const tag = mapped ? "button" : "span";
      return `<${tag} class="rl named-letter rl-${m}${unc.has(i) ? " rl-unc" : ""}" ${mapped ? `type="button" data-letter-index="${i}" aria-pressed="false"` : 'role="img"'} aria-label="${esc(namedLetter(ch))}: ${label}${unc.has(i) ? ", uncertain in the edition" : ""}${mapped ? "; locate in the image" : ""}" title="${label}${unc.has(i) ? ", uncertain in the edition" : ""}">${letterLabel(ch)}</${tag}>`;
    })
    .join("")}</div>`;
}

function headline(item: QuizItem, p: Pick, s: Score, word: string): string {
  if (item.truth === "none") return p.said === "no" ? "Well spotted — no letters here"
    : p.said === "unsure" ? "A fair place to pause — no letters here"
    : "A convincing shape — the reference shows no letters here";
  if (item.simulated && (p.said === "unsure" || s.verdict === "careful")) return "A fair place to be unsure — compare the original";
  if (item.simulated && s.verdict !== "right") return item.truth === "none" ? "The source reference has no visible writing here" : "Let's compare with the source reference";
  if (item.task === "identify") {
    const name = Array.from(item.truth).map(namedLetter).join(" · ");
    return s.verdict === "right" ? `Yes — ${name}` : `Let's look together: ${name}`;
  }
  if (item.task === "read" && s.verdict === "right" && (s.letters_ok ?? 0) < item.truth.length) return "Reading accepted, with some letters left open";
  const detect = item.task === "detect";
  switch (s.verdict) {
    case "right":
      return detect ? `You spotted the ${word}` : "Read correctly";
    case "honest":
      if (item.task === "read") return "An honest reading, with uncertainty left visible";
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

export function renderQuiz(main: HTMLElement, setId: string, practiceGroup?: string): () => void {
  const practiceMatch = setId.match(/^practice-([1-9]\d*)$/);
  const practiceLevel = practiceMatch ? Number(practiceMatch[1]) : undefined;
  const practice = practiceLevel !== undefined;
  const set: QuizSet | undefined = practice
    ? LEVELS.some(level => level.level === practiceLevel) ? { id: setId, level: practiceLevel!, title: `Level ${practiceLevel} · ${practiceGroup ? "focused reading" : "practice round"}` } : undefined
    : activeQuizSets.find((s) => s.id === setId);
  const items = practice ? activeQuizItems.filter(i => isPracticeItem(i, practiceLevel!, practiceGroup)) : activeQuizItems.filter((i) => i.set === setId && !i.practice_only);
  if (!practice && !set && (setId === "harder-images" || quizSets.some(candidate => candidate.id === setId))) {
    const destination = learningAction(state());
    main.innerHTML = `<h1>Continue with original images</h1><p>This older exercise has been replaced by short readings from original images. Your saved answers and points are still in My results.</p><a class="button primary" href="${destination.href}">${esc(destination.label)} →</a><p><a href="#/">See the learning path</a></p>`;
    return () => {};
  }
  if (set && !(set.id === "first-line" ? canStartFirstLine(state()) : levelAvailable(state(), set.level))) {
    main.innerHTML = `<h1>This level is next on your path</h1><p>Finish the preceding level, or open this level yourself in <a href="#/results">My results</a>.</p><a class="button" href="#/">Back to the path</a>`;
    return () => {};
  }
  if (!set || !items.length) {
    main.innerHTML = `<h1>Set not found</h1><p><a href="#/">Back to the path</a></p>`;
    return () => {};
  }
  const guided = items.every((item) => item.task === "identify" || item.task === "study");
  const makeOrder = () => practice ? planPractice(activeQuizItems, state().answers, practiceLevel!, { group: practiceGroup, size: practiceGroup ? 6 : 12 }) : guided || set.ordered ? [...items] : shuffle(items);
  let order = makeOrder();
  const choices = new Map(items.map((item) => [item.id, shuffle(item.choices ?? [])]));
  const sessionId = practiceGroup ? `${setId}/${practiceGroup}` : setId;
  const version = itemSetVersion();
  const saved = state().rounds?.[sessionId];
  const resumed = canResume(saved, version, new Set(items.map(i => i.id)), state().answers) ? saved : undefined;
  if (resumed) order = resumed.item_ids.map(id => items.find(item => item.id === id)!);
  let index = resumed?.index ?? 0;
  let pick: Pick = resumed ? { ...resumed.draft, letters: [...resumed.draft.letters] } : { letters: [] };
  let checked: Score | null = null;
  let newRank: string | undefined;
  const ranksThisSet: string[] = [];
  const results: AnswerRecord[] = resumed ? resumed.answer_keys.map(key => state().answers.find(a => answerKey(a) === key)!) : [];
  let shownAt = performance.now();
  let zoom = false;
  let helpUsed = resumed?.help_used ?? false;
  let elapsed = resumed?.elapsed_ms ?? 0;
  let clearReadingContext = () => {};
  if (resumed?.checked) {
    const item = order[index];
    const stored = [...results].reverse().find(answer => answer.item_id === item.id);
    checked = score({ text: item.truth, uncertain: item.uncertain, simulated: item.simulated },
      { said: pick.said!, letters: pick.letters.join(""), confidence: pick.confidence!, presenceAsked: stored?.presence_asked ?? !(item.task === "identify" && pick.confidence === null) });
    if (stored) {
      checked.reading = stored.reading_points;
      checked.honesty = stored.honesty_points;
    }
  }
  function persistRound(): void {
    if (index >= order.length) return;
    saveRound(sessionId, { version, item_ids: order.map(i => i.id), index,
      answer_keys: results.map(answerKey), draft: { ...pick, letters: [...pick.letters] },
      checked: checked !== null, help_used: helpUsed,
      elapsed_ms: elapsed + (checked ? 0 : performance.now() - shownAt) });
  }
  function typedOutput(): string {
    return `<output class="typed greek" id="typed" aria-live="polite" aria-label="Your reading">${pick.letters.length ? pick.letters.map(esc).join("") : `<span class="muted small">Type or tap letters. Use ? for a letter you cannot read.</span>`}</output>`;
  }

  /** Keep the original available while the mobile keyboard is in view. */
  function attachReadingContext(item: QuizItem): void {
    if (item.task !== "read" || checked) return;
    const source = main.querySelector<HTMLElement>(".viewer-images")!;
    const keyboard = main.querySelector<HTMLElement>(".keyboard")!;
    const context = document.createElement("button");
    context.type = "button";
    context.id = "reading-context";
    context.className = "reading-context";
    context.hidden = true;
    context.setAttribute("aria-label", "Return to the full original image");
    context.innerHTML = `<img src="${imgSrc(esc(item.image))}" alt=""><span class="reading-context-caption">Original · tap to return<span class="reading-context-reading greek" aria-hidden="true">${esc(pick.letters.join(""))}</span></span>`;
    main.querySelector(".learning-task")!.append(context);
    const mobile = window.matchMedia("(max-width: 700px)");
    const update = () => {
      const keys = keyboard.getBoundingClientRect();
      context.hidden = !mobile.matches || checked !== null || source.getBoundingClientRect().bottom > 120
        || keys.bottom <= 120 || keys.top >= window.innerHeight - 72;
    };
    const sourceObserver = new IntersectionObserver(update, { rootMargin: "-120px 0px 0px 0px" });
    const keyboardObserver = new IntersectionObserver(update, { rootMargin: "-120px 0px -72px 0px" });
    sourceObserver.observe(source);
    keyboardObserver.observe(keyboard);
    window.addEventListener("resize", update);
    update();
    clearReadingContext = () => {
      sourceObserver.disconnect();
      keyboardObserver.disconnect();
      window.removeEventListener("resize", update);
      context.remove();
      clearReadingContext = () => {};
    };
  }

  const detectWord = () => order[index]?.source.includes("pherc0500p2-ir") ? "ink" : "writing";

  const quickChoice = () => order[index]?.task === "identify";

  function canCheck(): boolean {
    const item = order[index];
    if (item.task === "study") return false;
    if (!pick.said) return false;
    if (item.task !== "detect" && pick.said === "yes" && pick.letters.length === 0) return false;
    return true;
  }

  function letterPanel(item: QuizItem): string {
    const optional = item.task === "detect";
    const disabled = pick.said === "no" || checked !== null;
    return `<fieldset class="question" id="letters-question" ${disabled ? "disabled" : ""}>
      <legend>${optional ? `Which letters do you see? <span class="muted small">(saved, not scored)</span>` : "Read the letters, if any"}</legend>
      ${typedOutput()}
      <div class="keyboard" role="group" aria-label="Greek letters">
        ${LETTERS.map((l) => `<button type="button" class="key named-letter" data-key="${l}" title="Key: ${esc(glyphs.find((g) => g.char === l)!.latin)}">${letterFormLabel(l)}</button>`).join("")}
        <button type="button" class="key" data-key="?" aria-label="A letter I cannot read">?</button>
        <button type="button" class="key key-wide" data-key="back" aria-label="Delete last letter">⌫</button>
      </div>
    </fieldset>`;
  }

  function shortHint(item: QuizItem): string {
    if (item.truth === "none") return item.hint ?? "Fibres and specks can suggest letters. This source area has no visible writing to read.";
    if (item.task === "study" && item.truth.length > 4) return "Bright strokes show a CT-derived ink map. We will read this line a few letters at a time.";
    if (item.task === "detect") return item.truth === "none"
      ? "Fibres and specks can suggest a letter. The reference shows no visible ink here."
      : item.source.includes("pherc0500p2-ir") ? "The tracing confirms ink here. Letter suggestions are saved, but not graded."
      : "The published source confirms writing here. Compare the connected strokes.";
    return item.hint ?? (item.explain.match(/[^.!?]+[.!?]+(?:\s+[^.!?]+[.!?]+)?/)?.[0] ?? item.explain);
  }

  function nextLesson(afterCompletion = false) {
    if (practice) return undefined;
    const st = afterCompletion ? { ...state(), setsDone: { ...state().setsDone, [set!.id]: 1 } } : state();
    if (set!.id === "first-line" && !levelDone(st, 1)) return playSets.find(p => p.id === "first-letters-500p2");
    const pathIndex = playSets.findIndex(p => p.id === set!.id);
    return playSets.slice(pathIndex + 1).find(p => p.level > 0 && !st.setsDone[p.id] && levelAvailable(st, p.level));
  }

  function nextAction(study = false): string {
    const last = index + 1 === order.length;
    // The next level may unlock only when this lesson is completed.
    const upcoming = nextLesson(true);
    return `<div class="task-actions"><button type="button" class="primary" id="${study ? "study-next" : "next"}">${last ? upcoming ? "Next lesson →" : "Finish round →" : "Next →"}</button>
      ${last ? `<button type="button" class="linkish" id="finish-summary">Finish & see summary</button>` : ""}</div>`;
  }

  function taskDetails(item: QuizItem): string {
    const revealed = checked !== null || item.task === "study";
    return `<div class="task-details">
      ${!revealed && item.hint ? `<details class="reading-guide" id="shape-hint"><summary>Need a clue?</summary><p>${esc(item.hint)}</p></details>` : ""}
      ${!revealed && item.guide ? `<details class="reading-guide" id="reading-guide"><summary>Reading guide</summary><p class="greek" lang="grc">${esc(item.guide)}</p><p class="small">${Array.from(item.guide).map(namedLetter).map(esc).join(" · ")}</p><p class="small muted">Saved as assisted practice.</p></details>` : ""}
      <details><summary>${revealed ? "Explanation & sources" : "About this image & sources"}</summary>
        ${index === 0 && set!.intro ? `<p>${esc(set!.intro)}</p>` : ""}
        ${item.preparation ? `<p>${esc(item.preparation)}</p>` : ""}
        ${revealed ? `<p>${esc(item.explain)}</p>${item.sample_id ? readingSource(item) : ""}
          ${item.edition ? `<p class="greek" lang="grc">${esc(item.edition)}</p><p class="small">${esc(item.reading ?? "")}. Dots below letters mark uncertainty in the edition.</p>` : ""}
          ${checked ? readingReview(item, checked) : ""}` : ""}
        <p class="cite">${sourceLine(item)}</p>
      </details>
      ${revealed && item.reference_answer_image ? `<details><summary>Source ink tracing</summary>${imageComparison(
        { file: item.reference_image!, label: "Unchanged source", alt: "Unchanged source" },
        { file: item.reference_answer_image, label: "Ink tracing", alt: "Organizers' ink tracing on the unchanged source" })}</details>` : ""}
      ${!revealed && !quickChoice() ? `<details class="confidence-options" ${pick.confidence != null ? "open" : ""}><summary>Record confidence <span class="muted">(optional)</span></summary>
        <div class="row" role="group" aria-label="How sure are you?">${[[1,"Guessing"],[2,"Fairly sure"],[3,"Sure"]].map(([n,label]) => `<button type="button" class="choice" data-conf="${n}" aria-pressed="${pick.confidence === n}">${label}</button>`).join("")}<button type="button" class="choice" data-conf="none" aria-pressed="${pick.confidence == null}">No rating</button></div>
        <p class="small muted">Optional. Only a rating you choose is saved.</p></details>` : ""}
      <details><summary>Round options & keyboard</summary>
        <p class="small">Button drawings are simplified form guides, not tracings or a complete catalogue of Greek handwriting.</p>
        <p class="small">Your place is saved automatically. Restarting keeps previous answers.</p>
        <button type="button" id="restart">Start this round again</button>
        ${levelAvailable(state(), 2) ? `<p><a href="#/quiz/long-lines">Try a whole line · optional challenge</a></p>` : ""}
        <p class="small">Tab moves between controls. Enter or Space activates the focused button. ${quickChoice() ? "? answers ‘not sure yet’." : "Type Greek letters or their keyboard equivalents; ? leaves a letter open. Enter away from buttons checks your reading."} The minus key answers ‘No letters’.</p>
        ${practice ? `<p class="small">Some views repeat or overlap. Repetition builds recognition; it does not add independent handwriting samples.</p>` : ""}
      </details>
    </div>`;
  }

  function renderRound(): void {
    clearReadingContext();
    const item = order[index];
    const wide = (item.task === "read" || item.task === "study") && item.truth.length > 4;
    const comparison = item.compare_with ? quizItems.find(other => other.id === item.compare_with) : undefined;
    main.innerHTML = `<section class="learning-task">
      <div class="task-topline"><a href="#/">← Path</a><span class="small muted">${index + 1} / ${order.length}</span></div>
      <h1 tabindex="-1">${esc(set!.title)}</h1>
      ${saved && !resumed && index === 0 && !checked ? `<p class="small">New exercises are available. Your previous answers remain in My results.</p>` : ""}
      <div class="progress" aria-hidden="true">${order.map((_, i) => `<span class="${i < index ? "past" : i === index ? "now" : ""}"></span>`).join("")}</div>
      <p class="task-context small muted">${item.task === "study" ? "Guided example · no score" : item.source.includes("profilometer") ? "Original photograph" : "Original CT-derived ink map"}</p>
      <div class="task-workspace${wide ? " task-wide" : ""}" data-item="${esc(item.id)}" data-task="${item.task}">
        <div class="task-image${comparison ? " hand-comparison" : ""}">${taskViewer(item, !!checked || item.task === "study")}
          ${comparison ? `<figure class="other-hand"><img src="${imgSrc(comparison.image)}" alt="A different photograph identified as ${esc(namedLetter(comparison.truth))}"><figcaption>Another ${esc(namedLetter(comparison.truth))}<br><span class="viewer-credit">${esc(comparison.credit)} · ${esc(comparison.license)}</span></figcaption></figure>` : ""}
        </div>
        <div class="task-answer" aria-live="polite">${item.task === "study" ? study(item) : checked ? feedback(item, checked) : questions(item)}</div>
      </div>
      <div id="task-detail-area">${taskDetails(item)}</div>
    </section>`;
    if (checked) highlightFeedback(item, checked);
    else if (item.task === "study") showLetterRegion(main, item, 0);
    else attachReadingContext(item);
  }

  function study(item: QuizItem): string {
    const long = item.truth.length > 4;
    return `<div class="task-study"><h2 id="study-title" tabindex="-1">${long ? "A line from a closed scroll" : esc(Array.from(item.truth).map(namedLetter).join(" · "))}</h2>
      ${long ? `<p class="greek study-line" lang="grc">${esc(item.truth)}</p><p class="small">Published reading. Start with the first few letters.</p>` : `${readingBoxes(item)}<p class="small muted">Tap a letter to locate it in the image.</p>`}
      <p class="learning-hint">${esc(shortHint(item))}</p>
      ${nextAction(true)}
      ${long ? `<details><summary>Letter names</summary><p class="small">${Array.from(item.truth).map(letterName).map(esc).join(" · ")}</p></details>` : ""}
    </div>`;
  }

  function questions(item: QuizItem): string {
    return `<div class="task-body">${item.task === "identify" ? `<fieldset class="question"><legend>${esc(item.question ?? "Name the handwritten letter")}</legend>
      <div class="match-options">${choices.get(item.id)!.map(reading => `<button type="button" class="choice named-letter" data-reading="${reading}">${letterReference(reading)}</button>`).join("")}</div>
      </fieldset>`
      : letterPanel(item)}
      </div>${quickChoice() ? `<div class="task-actions"><button type="button" data-reading="?">Not sure yet</button><button type="button" data-said="no">No letters</button></div><p class="small muted reference-caption">Simplified form guides, not tracings.</p>` : `<div class="task-actions"><button type="button" class="primary" id="check" aria-describedby="check-hint" ${canCheck() ? "" : "disabled"}>Check answer</button><button type="button" data-said="no">No letters</button></div>
        <p class="small muted check-hint" id="check-hint">${checkHint()}</p>`}
      ${!practice && item.optional_challenge ? `<button type="button" class="linkish" id="skip-challenge">Skip this optional challenge →</button>` : ""}`;
  }

  function checkHint(): string {
    if (!pick.said) return order[index].task === "identify" ? "Choose the letter name, or “Not sure yet”." : order[index].task === "read" && !order[index].simulated ? "Enter letters, or use ? where you cannot read one." : `Choose whether you see ${detectWord()}.`;
    if (order[index].task === "read" && pick.said === "yes" && !pick.letters.length) return "Enter letters, or use ? for a letter you cannot read.";
    return "Ready when you are.";
  }

  function updateQuestions(): void {
    main.querySelectorAll<HTMLButtonElement>("[data-said], [data-conf], [data-reading]").forEach((button) => {
      const pressed = button.dataset.reading ? button.dataset.reading === "?" ? pick.said === "unsure" : button.dataset.reading === pick.letters.join("")
        : button.dataset.said ? button.dataset.said === pick.said : button.dataset.conf === "none" ? pick.confidence == null : Number(button.dataset.conf) === pick.confidence;
      button.setAttribute("aria-pressed", String(pressed));
    });
    const lettersQuestion = main.querySelector<HTMLFieldSetElement>("#letters-question");
    if (lettersQuestion) lettersQuestion.disabled = pick.said === "no";
    const typed = main.querySelector<HTMLElement>("#typed");
    if (typed) typed.innerHTML = pick.letters.length ? pick.letters.map(esc).join("") : `<span class="muted small">Type or tap letters. Use ? for a letter you cannot read.</span>`;
    const contextReading = main.querySelector<HTMLElement>(".reading-context-reading");
    if (contextReading) contextReading.textContent = pick.letters.join("");
    const optional = main.querySelector<HTMLDetailsElement>(".optional-letters");
    if (optional && pick.letters.length) optional.open = true;
    const checkButton = main.querySelector<HTMLButtonElement>("#check");
    if (checkButton) checkButton.disabled = !canCheck();
    const hint = main.querySelector<HTMLElement>("#check-hint");
    if (hint) hint.textContent = checkHint();
    const confidence = main.querySelector<HTMLDetailsElement>(".confidence-options");
    if (confidence && pick.confidence != null) confidence.open = true;
    persistRound();
  }

  function readingReview(item: QuizItem, s: Score): string {
    if (item.task !== "read" || item.truth === "none" || item.truth === "*") return "";
    const { pairs } = align(Array.from(item.truth), pick.letters);
    const positions = Array.from(item.truth).map((letter, i) => ({ letter, i, typed: pairs[i] }))
      .filter(({ i }) => item.truth.length <= 4 || s.marks[i] !== "ok");
    return `<div class="reading-review">
      ${positions.length ? `<div class="table-scroll"><table class="reading-comparison"><caption>${item.truth.length <= 4 ? "Your reading and the source" : "Places to look at again"}</caption>
        <thead><tr><th>Position</th><th>You entered</th><th>Source reading</th></tr></thead><tbody>
        ${positions.map(({ letter, i, typed }) => `<tr><th>${i + 1}</th><td>${typed ? esc(namedLetter(typed)) : "Left open"}</td><td>${esc(namedLetter(letter))}${item.uncertain?.includes(i) ? " (uncertain in edition)" : ""}</td></tr>`).join("")}
        </tbody></table></div>` : ""}
      ${s.extras ? `<p class="small">${s.extras} extra ${s.extras === 1 ? "letter has" : "letters have"} no counterpart in the source reading.</p>` : ""}
    </div>`;
  }

  function feedback(item: QuizItem, s: Score): string {
    const reading = item.truth === "none"
      ? `<p>Reference: no letters.</p><p class="small">Your answer: ${pick.said === "no" ? "no letters" : pick.said === "unsure" || !pick.letters.some(letter => letter !== "?") ? "not sure" : esc(pick.letters.join(""))}.</p>`
      : item.task === "identify" || item.task === "read"
      ? `${readingBoxes(item, s)}<p class="small">Your answer: <span class="greek">${pick.said === "unsure" && !pick.letters.some(l => l !== "?") ? "not sure" : pick.said === "no" ? "no writing" : pick.letters.map(esc).join("") || "left open"}</span>${item.uncertain?.length ? " · dotted marks are uncertain in the edition" : ""}.</p>`
      : `<p>Your answer: ${pick.said === "no" ? `no ${detectWord()}` : pick.said === "unsure" ? "not sure" : detectWord()}. Reference: ${item.truth === "none" ? "no visible " : ""}${detectWord()}.</p>`;
    return `<div class="task-feedback v-${s.verdict}"><div class="task-body"><h2 id="verdict" tabindex="-1">${esc(headline(item, pick, s, detectWord()))}</h2>
      ${reading}${item.letter_regions?.some(Boolean) ? `<p class="small muted">Tap a letter above to find its place in the image.</p>` : ""}<p class="learning-hint">${esc(shortHint(item))}</p>
      ${item.simulated ? `<p class="small muted">The answer describes the unchanged source. Detail may be lost in this practice image.</p>` : ""}
      </div>${nextAction()}
      <div class="points">${points(s)}</div>
      ${!practice && set!.id === "first-letters-500p2" && index === 2 && canStartFirstLine(state()) ? `<p class="small"><a href="#/quiz/first-line">Try a short line now →</a></p>` : ""}
      ${item.practice_group && levelAvailable(state(), item.level) ? `<details><summary>More practice</summary><a href="#/practice/${item.level}/group/${item.practice_group}">Practise this letter group</a></details>` : ""}
      ${helpUsed || item.assisted ? `<p class="small muted">Saved as assisted practice.</p>` : ""}
      ${item.task === "detect" && pick.letters.length ? `<p class="small">Your letter suggestion is saved, without a letter score.</p>` : ""}
    </div>`;
  }

  function highlightFeedback(item: QuizItem, s: Score): void {
    const wrong = s.marks.findIndex((mark, i) => mark !== "ok" && !!item.letter_regions?.[i]);
    const first = item.letter_regions?.findIndex(Boolean) ?? -1;
    if (wrong >= 0 || first >= 0) showLetterRegion(main, item, wrong >= 0 ? wrong : first);
  }

  function check(): void {
    if (!canCheck() || checked) return;
    const item = order[index];
    if (item.task === "study") return;
    if (quickChoice()) pick.confidence = null;
    else pick.confidence ??= null;
    if (pick.said === "yes" && pick.letters.length && pick.letters.every(letter => letter === "?")) pick.said = "unsure";
    const letters = pick.said === "no" ? "" : pick.letters.join("");
    const s = score({ text: item.truth, uncertain: item.uncertain, simulated: item.simulated }, { said: pick.said!, letters, confidence: pick.confidence!, presenceAsked: false });
    const rec: AnswerRecord = {
      item_id: item.id,
      task: item.task,
      practice,
      help_used: helpUsed || item.task === "identify" || item.assisted === true,
      base_item: item.base_item ?? item.id,
      simulated: item.simulated ?? false,
      presence_asked: false,
      level: item.level,
      degradation: item.degradation,
      said_text: pick.said!,
      letters,
      confidence: pick.confidence!,
      ms: Math.round(elapsed + performance.now() - shownAt),
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
    elapsed += performance.now() - shownAt;
    checked = s;
    clearReadingContext();
    persistRound();
    const news = progressAfterAnswer();
    newRank = news.rank?.id;
    if (newRank) ranksThisSet.push(newRank);
    // Keep the image DOM, scale and pan. On desktop, also retain the action row's height.
    const bodyHeight = main.querySelector<HTMLElement>(".task-body")?.getBoundingClientRect().height;
    revealTaskViewer(main);
    main.querySelector<HTMLElement>(".task-answer")!.innerHTML = feedback(item, s);
    if (bodyHeight && window.matchMedia("(min-width: 701px)").matches) {
      main.querySelector<HTMLElement>(".task-body")!.style.minHeight = `${bodyHeight}px`;
    }
    main.querySelector<HTMLElement>("#task-detail-area")!.innerHTML = taskDetails(item);
    highlightFeedback(item, s);
    main.querySelector<HTMLElement>("#verdict")?.focus({ preventScroll: true });
    keepImageVisible();
  }

  /** A deliberate reading correction should show its image, even after scrolling to type. */
  function keepImageVisible(): void {
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    const image = main.querySelector<HTMLElement>(".viewer-images");
    if (!image) return;
    const bounds = image.getBoundingClientRect();
    const available = window.innerHeight - 80;
    const feedback = main.querySelector<HTMLElement>(".task-feedback .task-body");
    if (bounds.top < 0 || bounds.bottom > available || (feedback && feedback.getBoundingClientRect().bottom > available)) {
      window.scrollTo({ top: Math.max(0, window.scrollY + bounds.top - 12), behavior: "instant" });
    }
  }

  function next(showSummary = false): void {
    if (index >= order.length || (!checked && order[index].task !== "study" && !order[index].optional_challenge)) return;
    index++;
    pick = { letters: [] };
    checked = null;
    newRank = undefined;
    helpUsed = false;
    zoom = false;
    if (index >= order.length) {
      clearRound(sessionId);
      if (!practice) markSetDone(set!.id);
      const news = progressAfterAnswer();
      if (news.rank) ranksThisSet.push(news.rank.id);
      const destination = nextLesson();
      if (!showSummary && destination) { window.location.hash = destination.href; return; }
      renderSummary();
      return;
    }
    elapsed = 0;
    shownAt = performance.now();
    persistRound();
    renderRound();
    main.querySelector<HTMLElement>("h1")?.focus({ preventScroll: true });
    const task = main.querySelector<HTMLElement>(".learning-task")!;
    if (task.getBoundingClientRect().top < -100) task.scrollIntoView({ block: "start" });
  }

  function renderSummary(): void {
    clearReadingContext();
    const count = (v: string) => results.filter((r) => r.verdict === v).length;
    const empty = results.filter((r) => r.truth === "none").length;
    const readings = results.filter(r => r.task === "read").map(readingStats).filter(r => r !== null);
    const lettersOk = readings.reduce((n, r) => n + r.correct, 0);
    const lettersAll = readings.reduce((n, r) => n + r.total, 0);
    const nextSet = nextLesson();
    const practiceSource = practiceGroup ? playSets.find(lesson => items.some(item => item.set === lesson.id)) : undefined;
    main.innerHTML = `
      <h1 tabindex="-1">${practice ? "Practice round complete" : `${esc(set!.title)}: done`}</h1>
      ${!nextSet && !practice && LEVELS.every(entry => levelDone(state(), entry.level)) ? `<p>You have finished all ${LEVELS.length} levels. Keep practising with short rounds of original images.</p>` : ""}
      ${ranksThisSet.length ? rankUpBanner(ranksThisSet[ranksThisSet.length - 1]) : ""}
      <div class="tally">
        ${guided ? `<div><strong>${count("right")}/${results.length}</strong><span class="muted">examples matched</span></div>` : `<div><strong>${results.filter((r) => r.truth !== "none" && r.said_text === "yes").length}</strong><span class="muted">tiles with ${detectWord()} spotted</span></div>
        <div class="honesty"><strong>${results.filter((r) => r.truth === "none" && r.said_text === "no").length}</strong><span class="muted">empty tiles called right</span></div>
        <div><strong>${count("false-alarm")}</strong><span class="muted">false alarms on ${empty} empty tiles</span></div>`}
        ${lettersAll && !guided ? `<div><strong>${lettersOk}/${lettersAll}</strong><span class="muted">letters read</span></div>` : ""}
      </div>
      ${guided ? `<p>${results.length} recognition questions and ${order.filter((item) => item.task === "study").length} guided examples.
        The guided examples taught less familiar forms; they added no answers or points to your results.</p>` : ""}
      ${tip(practice ? "Come back for another short round. The mix uses your past answers, so difficult material will return alongside unfamiliar images." : guided ? "You have met real handwriting. Next, build a line a few letters at a time." : count("false-alarm") === 0 ? "Keep comparing the strokes with the reference, and leave room for uncertainty." : "Some empty tiles suggested writing. Comparing them with the reference is part of learning what to look for.")}
      <div class="row">
        ${practiceSource ? `<a class="button" href="${practiceSource.href}">Return to the lesson</a>` : ""}
        ${nextSet && !practice ? `<a class="button primary" href="${nextSet.href}">Next: ${esc(nextSet.title)} →</a>` : ""}
        ${!practice && set!.id === "first-line" && !levelDone(state(), 1) ? `<a class="button primary" href="#/quiz/first-letters-500p2">Return to guided handwriting →</a>` : ""}
        ${!practice && levelAvailable(state(), set!.level) ? `<a class="button" href="#/practice/${set!.level}">More practice at this level</a>` : ""}
        <button type="button" id="again" class="${practice ? "primary" : ""}">${practice ? "Another practice round" : "Repeat this lesson"}</button>
        <a class="button" href="#/">Back to the path</a>
        <a class="button" href="#/results">My results</a>
      </div>`;
    main.querySelector("#again")?.addEventListener("click", () => {
      order = makeOrder();
      index = 0;
      pick = { letters: [] };
      checked = null;
      helpUsed = false;
      zoom = false;
      results.length = 0;
      ranksThisSet.length = 0;
      elapsed = 0;
      shownAt = performance.now();
      persistRound();
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
    if ((e.target as HTMLElement).closest("#reading-guide > summary, #shape-hint > summary") && !checked) { helpUsed = true; persistRound(); }
    const b = (e.target as HTMLElement).closest("button");
    if (!b || b.disabled) return;
    if (b.id === "reading-context") {
      const source = main.querySelector<HTMLElement>(".viewer-images")!;
      source.querySelector<HTMLElement>(".viewer-viewport")?.focus({ preventScroll: true });
      window.scrollTo({ top: Math.max(0, window.scrollY + source.getBoundingClientRect().top - 12), behavior: "instant" });
      return;
    }
    if (b.dataset.letterIndex !== undefined && (checked || order[index].task === "study")) {
      showLetterRegion(main, order[index], Number(b.dataset.letterIndex), true);
      keepImageVisible();
      return;
    }
    if (b.id === "review-zoom") {
      zoom = !zoom;
      main.querySelector(".review-image")?.classList.toggle("enlarged", zoom);
      b.setAttribute("aria-pressed", String(zoom));
      b.textContent = zoom ? "Zoom out" : "Zoom in";
      return;
    }
    if (handleViewerClick(b) || handleComparisonClick(b)) return;
    if (b.id === "zoom") {
      zoom = !zoom;
      main.querySelector(".photo")?.classList.toggle("zoomed", zoom);
      b.setAttribute("aria-pressed", String(zoom));
      b.textContent = zoom ? "Zoom out" : "Zoom in";
      return;
    }
    if (b.id === "restart") {
      order = makeOrder();
      index = 0;
      pick = { letters: [] };
      checked = null;
      helpUsed = false;
      zoom = false;
      newRank = undefined;
      elapsed = 0;
      results.length = 0;
      ranksThisSet.length = 0;
      shownAt = performance.now();
      persistRound();
      renderRound();
      main.querySelector<HTMLElement>("h1")?.focus();
      return;
    }
    if (b.id === "skip-challenge" && !practice && order[index]?.optional_challenge) return next();
    if (b.id === "check") return check();
    if (b.id === "next") return next();
    if (b.id === "finish-summary") return next(true);
    if (b.id === "study-next" && order[index].task === "study") return next();
    if (order[index].task === "study") return;
    if (checked) return;
    if (b.dataset.reading) {
      pick.said = b.dataset.reading === "?" ? "unsure" : "yes";
      pick.letters = Array.from(b.dataset.reading === "?" ? "?".repeat(order[index].truth.length) : b.dataset.reading);
      if (quickChoice()) return check();
    } else if (b.dataset.said) {
      pick.said = b.dataset.said as SaidText;
      if (pick.said === "no") { pick.letters = []; return check(); }
    } else if (b.dataset.conf) pick.confidence = b.dataset.conf === "none" ? null : Number(b.dataset.conf) as 1 | 2 | 3;
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
      if (e.repeat) { e.preventDefault(); return; }
      if ((e.target as HTMLElement).closest("a, summary, button")) return;
      e.preventDefault();
      if (checked || order[index].task === "study") next();
      else check();
      return;
    }
    if (checked || order[index].task === "study") return;
    if (k === "-") {
      e.preventDefault();
      pick.said = "no";
      pick.letters = [];
      return check();
    }
    if (order[index].task === "identify") {
      if (k === "?") {
        pick.said = "unsure";
        pick.letters = Array.from("?".repeat(order[index].truth.length));
        if (quickChoice()) { e.preventDefault(); return check(); }
      } else if (!quickChoice() && (k === "1" || k === "2" || k === "3")) pick.confidence = Number(k) as 1 | 2 | 3;
      else return;
      e.preventDefault();
      updateQuestions();
      return;
    }
    let changed = true;
    if (k === "?") addLetter("?");
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

  function onGuide(event: Event): void {
    const target = event.target as HTMLDetailsElement;
    if ((target.id === "reading-guide" || target.id === "shape-hint") && target.open && !checked) { helpUsed = true; persistRound(); }
  }
  main.addEventListener("scroll", syncComparisonScroll, true);
  main.addEventListener("scroll", syncViewerScroll, true);
  main.addEventListener("toggle", onGuide, true);
  main.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  persistRound();
  renderRound();
  window.addEventListener("pagehide", persistRound);
  return () => {
    clearReadingContext();
    persistRound();
    window.removeEventListener("pagehide", persistRound);
    main.removeEventListener("scroll", syncComparisonScroll, true);
    main.removeEventListener("scroll", syncViewerScroll, true);
    main.removeEventListener("toggle", onGuide, true);
    main.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
