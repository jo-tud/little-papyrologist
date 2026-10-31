import { glyphs, itemSetVersion, playSets, quizItems, quizSets, sourceById } from "../data";
import { glyphSvg } from "../glyphs/render";
import { progressAfterAnswer, rankUpBanner } from "../progress-ui";
import { align, readingStats, score, type Score } from "../scoring";
import { addAnswer, clearRound, markSetDone, saveRound, state } from "../store";
import type { AnswerRecord, QuizItem, QuizSet, SaidText } from "../types";
import { letterLabel, letterName, namedLetter, sourceLinks, tip } from "../ui";
import { planPractice } from "../practice";
import { canStartFirstLine, levelAvailable, levelDone } from "../rules";
import { handleComparisonClick, imageComparison, syncComparisonScroll } from "../image-comparison";
import { answerKey, canResume } from "../round-session";
import { esc, shuffle } from "../util";

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
  return `<span class="reference-drawing" aria-hidden="true">${Array.from(reading).map((char) => glyphSvg(char, "")).join("")}</span>
    <span class="greek" lang="grc">${esc(reading)}</span>
    <span class="letter-name">${Array.from(reading).map(letterName).map(esc).join(" · ")}</span>`;
}

/** The reading, one letter per box, coloured by how the player did. Uncertain letters get a dot below. */
function readingBoxes(item: QuizItem, s: Score): string {
  const unc = new Set(item.uncertain ?? []);
  return `<div class="reading" tabindex="0" role="region" aria-label="The reading, letter by letter; scroll sideways if needed">${Array.from(item.truth)
    .map((ch, i) => {
      const m = s.marks[i] ?? "missing";
      const label = { ok: "read", honest: "marked as unreadable", wrong: "misread", missing: "not given" }[m];
      return `<span class="rl named-letter rl-${m}${unc.has(i) ? " rl-unc" : ""}" role="img" aria-label="${esc(namedLetter(ch))}: ${label}${unc.has(i) ? ", uncertain in the edition" : ""}" title="${label}${unc.has(i) ? ", uncertain in the edition" : ""}">${letterLabel(ch)}</span>`;
    })
    .join("")}</div>`;
}

function headline(item: QuizItem, p: Pick, s: Score, word: string): string {
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
  const practiceLevel = /^practice-[1-3]$/.test(setId) ? Number(setId.slice(-1)) : undefined;
  const practice = practiceLevel !== undefined;
  const set: QuizSet | undefined = practice ? { id: setId, level: practiceLevel!, title: `Level ${practiceLevel} · ${practiceGroup ? "focused reading" : "practice round"}` } : quizSets.find((s) => s.id === setId);
  const items = practice ? quizItems.filter((i) => i.level === practiceLevel && i.task !== "study" && (!practiceGroup || i.practice_group === practiceGroup)) : quizItems.filter((i) => i.set === setId && !i.practice_only);
  if (set && !(set.id === "first-line" ? canStartFirstLine(state()) : levelAvailable(state(), set.level))) {
    main.innerHTML = `<h1>This level is next on your path</h1><p>Finish the preceding level, or open this level yourself in <a href="#/results">My results</a>.</p><a class="button" href="#/">Back to the path</a>`;
    return () => {};
  }
  if (!set || !items.length) {
    main.innerHTML = `<h1>Set not found</h1><p><a href="#/">Back to the path</a></p>`;
    return () => {};
  }
  const guided = items.every((item) => item.task === "identify" || item.task === "study");
  const makeOrder = () => practice ? planPractice(quizItems, state().answers, practiceLevel!, { group: practiceGroup, size: practiceGroup ? 6 : 12 }) : guided || set.ordered ? [...items] : shuffle(items);
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
  let imageObserver: ResizeObserver | undefined;
  function fitReadingImage(): void {
    const photo = main.querySelector<HTMLElement>(".reading-round .photo");
    // With large text or a short viewport, keep every control reachable instead
    // of allowing a tall sticky image panel to cover the keyboard.
    if (photo) photo.classList.toggle("unpinned", photo.getBoundingClientRect().height > window.innerHeight * 0.4);
  }
  if (resumed?.checked) {
    const item = order[index];
    checked = score({ text: item.truth, uncertain: item.uncertain, simulated: item.simulated },
      { said: pick.said!, letters: pick.letters.join(""), confidence: pick.confidence!, presenceAsked: !(item.task === "identify" && pick.confidence === null) });
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

  const detectWord = () => order[index]?.source.includes("pherc0500p2-ir") ? "ink" : "writing";

  const quickChoice = () => !practice && order[index]?.level === 1 && order[index]?.task === "identify";

  function canCheck(): boolean {
    const item = order[index];
    if (item.task === "study") return false;
    if (!pick.said || (!quickChoice() && !pick.confidence)) return false;
    if (item.task !== "detect" && pick.said === "yes" && pick.letters.length === 0) return false;
    return true;
  }

  function letterPanel(item: QuizItem): string {
    const optional = item.task === "detect";
    const disabled = pick.said === "no" || checked !== null;
    return `<fieldset class="question" id="letters-question" ${disabled ? "disabled" : ""}>
      <legend>${optional ? `Which letters do you see? <span class="muted small">(saved, not scored)</span>` : item.truth.length === 1 ? "Name this letter" : "Read the letters, left to right"}</legend>
      ${item.task === "read" ? "" : typedOutput()}
      <div class="keyboard" role="group" aria-label="Greek letters">
        ${LETTERS.map((l) => `<button type="button" class="key named-letter" data-key="${l}" title="Key: ${esc(glyphs.find((g) => g.char === l)!.latin)}">${letterLabel(l)}</button>`).join("")}
        <button type="button" class="key" data-key="?" aria-label="A letter I cannot read">?</button>
        <button type="button" class="key key-wide" data-key="back" aria-label="Delete last letter">⌫</button>
      </div>
    </fieldset>`;
  }

  function renderRound(): void {
    imageObserver?.disconnect();
    const item = order[index];
    const wide = (item.task === "read" || item.task === "study") && item.truth.length > 4;
    main.innerHTML = `
    <a class="back-link" href="#/">← Back to the path</a>
    ${saved && !resumed && index === 0 && !checked ? `<p class="small">The exercises have changed since your saved round. This is a new round; your previous answers are still in My results.</p>` : ""}
    <div class="drill-head">
      <h1 tabindex="-1">${esc(set!.title)}</h1>
      <span class="muted">${guided || set!.ordered ? "Step" : "Tile"} ${index + 1} of ${order.length}</span>
    </div>
    ${set!.id === "first-letters-500p2" && index === 0 && !checked ? `<div class="round-intro"><p><strong>Meet your first real letters.</strong> No Greek needed.
      Printed capitals and our drawings are guides: ancient handwriting varies in shape and proportion.
      Start with clearer shapes and a letter pair, then study unfamiliar forms without a score.</p>
      <p class="cite">About handwritten forms: ${sourceLinks(["greek-bookhands"])}</p></div>` : ""}
    ${item.stage ? `<p class="eyebrow lesson-stage">${esc(item.stage ?? "")}</p>` : ""}
    ${index === 0 && !checked && set!.intro ? `<div class="round-intro"><p>${esc(set!.intro)}</p></div>` : ""}
    ${practiceGroup && index === 0 && !checked ? `<p class="small muted">Short readings of related forms. Some views overlap or repeat a lesson image. This round practises letters; it has no empty-tile questions.</p>` : ""}
    ${practice && !practiceGroup && index === 0 && !checked ? `<p class="small muted">A short mix that favours unfamiliar images and previous difficulties. Repeated images help you practise; they are not new handwriting samples.</p>` : ""}
    ${!practice && item.optional_challenge && !checked ? `<p class="challenge-note"><strong>Optional challenge.</strong> You can finish this lesson with the short groups.<br><button type="button" class="linkish" id="skip-challenge">Skip this challenge and finish the lesson →</button></p>` : ""}
    ${item.simulated ? `<p class="small simulation-note">Image exercise · difficulty ${item.degradation}/5. This image has been altered for practice. “Not sure” is useful; the unchanged source appears after your answer.</p>` : ""}
    <details class="round-options"><summary>Round options</summary><p class="small">Your place and current answer are saved in this browser. Starting again keeps all answers already recorded.</p><button type="button" id="restart">Start this round again</button></details>
    <div class="progress" aria-hidden="true">${order.map((_, i) => `<span class="${i < index ? "past" : i === index ? "now" : ""}"></span>`).join("")}</div>
    <div class="round ${checked || item.task === "study" ? "solution-round" : `${wide ? "round-wide" : ""} ${item.task === "read" ? "reading-round" : ""}`}" data-item="${esc(item.id)}">
      ${checked || item.task === "study" ? "" : sourcePhoto(item, wide)}
      <div class="answer">
        ${item.task === "study" ? study(item) : checked ? feedback(item, checked) : questions(item)}
      </div>
    </div>`;
    const photo = main.querySelector<HTMLElement>(".reading-round .photo");
    if (photo) {
      fitReadingImage();
      imageObserver = new ResizeObserver(fitReadingImage);
      imageObserver.observe(photo);
    }
  }

  function sourcePhoto(item: QuizItem, wide = false, label?: string): string {
    return `<figure class="tile-frame photo ${wide ? "photo-wide" : ""} ${zoom ? "zoomed" : ""}">
      ${label ? `<p class="solution-label">${esc(label)}</p>` : ""}
      <div class="zoom-box" tabindex="0" role="region" aria-label="Papyrus image; scroll to explore when enlarged"><img src="${imgSrc(item.image)}" alt="${esc(item.alt)}" class="tile-img"></div>
      <figcaption><button type="button" class="linkish" id="zoom" aria-pressed="${zoom}">${zoom ? "Zoom out" : "Zoom in"}</button>
        <span class="small muted">${esc(item.credit)}, ${esc(item.license)}</span></figcaption>
      ${wide ? `<p class="image-hint small muted">Scroll sideways to explore the line.</p>` : ""}
      ${item.task === "read" && !checked ? typedOutput() : ""}
    </figure>`;
  }

  function comparisonImages(item: QuizItem): string {
    const reference = item.reference_image ?? item.answer_image;
    if (!reference) return "";
    return imageComparison(
      { file: item.image, label: item.simulated ? "Practice image" : "Original image", alt: item.alt },
      { file: reference, label: item.reference_image ? "Unchanged source" : "Ink tracing", alt: item.reference_image ? "The unchanged source for this practice image" : "The same image with the organizers' ink tracing in red" },
    ) + `<p class="small muted">${item.reference_image ? "The answer describes the unchanged source; some strokes may no longer be visible in the practice image." : "Red: ink traced by the organizers. A/B view shows both images at the same position."}</p>`;
  }

  function study(item: QuizItem): string {
    const comparison = item.compare_with ? quizItems.find((other) => other.id === item.compare_with) : undefined;
    const reading = item.truth.length > 4
      ? `<p class="greek edition-line" lang="grc">${esc(item.truth)}</p><p class="small">${Array.from(item.truth).map(letterName).map(esc).join(" · ")}</p><p class="small">The published reading, recorded in capitals. We will start with a few letters at the left edge.</p><details><summary>The edition's text</summary><p class="greek" lang="grc">${esc(item.edition ?? item.truth)}</p></details>`
      : `<div class="study-reference named-letter">${letterReference(item.truth)}</div><p class="small muted">Simplified practice drawing and printed letters; neither is a tracing of this source image.</p>`;
    return `<section class="study-card" aria-labelledby="study-title">
      <p class="eyebrow">Guided example · no score</p>
      <h2 id="study-title">${esc(item.truth.length > 4 ? "A line from a closed scroll" : Array.from(item.truth).map(namedLetter).join(" · "))}</h2>
      ${item.answer_image ? `${comparisonImages(item)}${reading}` : `<div class="solution-pair">${sourcePhoto(item, item.truth.length > 4, "Original image")}<div><h3>${item.task === "detect" ? "Reference answer" : "Published reading"}</h3>${reading}</div></div>`}
      <p class="preparation">${esc(item.preparation ?? "")}</p>
      <p>${esc(item.explain)}</p>
      ${comparison ? `<figure class="answer-figure comparison-photo"><img src="${imgSrc(comparison.image)}" alt="A different photograph, also identified as Nu by the source">
        <figcaption class="small">A different ${esc(Array.from(comparison.truth).map(letterName).join(" · "))}, for comparison.
          ${esc(comparison.credit)}, ${esc(comparison.license)}.</figcaption></figure>` : ""}
      ${item.sample_id ? readingSource(item) : ""}
      <p class="cite">${sourceLine(item)}</p>
      <button type="button" class="primary" id="study-next">${index + 1 < order.length ? "Continue →" : "Finish this lesson →"}</button>
    </section>`;
  }

  function questions(item: QuizItem): string {
    const c = (name: string, value: string, label: string, pressed: boolean) =>
      `<button type="button" class="choice" data-${name}="${value}" aria-pressed="${pressed}">${label}</button>`;
    return `
      ${item.task === "identify" ? `<p class="preparation">${esc(item.preparation ?? "")}</p>
        <fieldset class="question"><legend>${esc(item.question ?? "Name the handwritten letter")}</legend>
        <p class="small muted">${esc(item.hint ?? "")}</p>
        <p class="small reference-caption">Each choice shows a simplified practice drawing, then its printed letter and name.</p>
        <div class="match-options">${choices.get(item.id)!.map((reading) => `<button type="button" class="choice named-letter" data-reading="${reading}" aria-pressed="${pick.letters.join("") === reading}">${letterReference(reading)}</button>`).join("")}
        <button type="button" class="choice" data-reading="?" aria-pressed="${pick.said === "unsure"}">Not sure yet</button></div></fieldset>` : item.task === "read" && !item.simulated ? letterPanel(item) : `
      <fieldset class="question">
        <legend>${item.simulated ? `Can you make out ${detectWord()} in this altered image?` : `Is there ${detectWord()} on this tile?`}</legend>
        <div class="row">
          ${c("said", "yes", "Yes", pick.said === "yes")}
          ${c("said", "no", `No ${detectWord()}`, pick.said === "no")}
          ${c("said", "unsure", "Not sure", pick.said === "unsure")}
        </div>
      </fieldset>
      ${item.task === "detect" ? `<details class="optional-letters"><summary>Try naming letters <span class="muted">(optional, not scored)</span></summary>${letterPanel(item)}</details>` : letterPanel(item)}`}
      ${quickChoice() ? `<p class="small muted">Tap a choice to see the reading. “Not sure yet” is welcome.</p>` : `<fieldset class="question">
        <legend>How sure are you?</legend>
        <div class="row">
          ${c("conf", "1", "Guessing", pick.confidence === 1)}
          ${c("conf", "2", "Fairly sure", pick.confidence === 2)}
          ${c("conf", "3", "Sure", pick.confidence === 3)}
        </div>
      </fieldset>
      <button type="button" class="primary" id="check" aria-describedby="check-hint" ${canCheck() ? "" : "disabled"}>Check answer</button>
      <p class="small muted check-hint" id="check-hint">${checkHint()}</p>`}
      <div class="task-help">
      ${item.task !== "identify" && item.preparation ? `<details><summary>About this image</summary><p class="preparation">${esc(item.preparation)}</p></details>` : ""}
      ${item.task === "read" && item.hint ? `<details class="reading-guide" id="shape-hint"><summary>Show a shape clue</summary><p>${esc(item.hint)}</p><p class="small muted">Using a clue is saved as assisted practice.</p></details>` : ""}
      ${item.task !== "identify" && item.guide ? `<details class="reading-guide" id="reading-guide"><summary>Show a reading guide</summary><p class="greek" lang="grc">${esc(item.guide)}</p><p class="small">${Array.from(item.guide).map(namedLetter).map(esc).join(" · ")}</p><p class="small muted">Using this guide is saved as assisted practice. Try a few letters yourself first; use ? where you cannot tell.</p></details>` : ""}
      </div>
      <p class="keys">${item.task === "identify" ? quickChoice() ? `<kbd>Tab</kbd> move between choices, <kbd>Enter</kbd> or <kbd>Space</kbd> answer, <kbd>?</kbd> not sure yet.` : `<kbd>Tab</kbd> move between choices, <kbd>Space</kbd> select, <kbd>?</kbd> not sure yet, <kbd>1</kbd>–<kbd>3</kbd> how sure, <kbd>Enter</kbd> check.` : `Keyboard shortcuts: <kbd>e</kbd> Ε, <kbd>s</kbd> Ϲ, <kbd>u</kbd> Θ, or type Greek. <kbd>?</kbd> unreadable letter,
      <kbd>Backspace</kbd> delete, ${item.task === "detect" || item.simulated ? `<kbd>-</kbd> no ${detectWord()}, ` : ""}<kbd>1</kbd>–<kbd>3</kbd> how sure, <kbd>Enter</kbd> check.`}</p>`;
  }

  function checkHint(): string {
    if (!pick.said) return order[index].task === "identify" ? "Choose the letter name, or “Not sure yet”." : order[index].task === "read" && !order[index].simulated ? "Enter letters, or use ? where you cannot read one." : `Choose whether you see ${detectWord()}.`;
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
    const checkButton = main.querySelector<HTMLButtonElement>("#check");
    if (checkButton) checkButton.disabled = !canCheck();
    const hint = main.querySelector<HTMLElement>("#check-hint");
    if (hint) hint.textContent = checkHint();
    persistRound();
  }

  function readingReview(item: QuizItem, s: Score): string {
    if (item.task !== "read") return "";
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
    const reading = item.task === "identify"
      ? `${readingBoxes(item, s)}<p class="small">You chose: ${pick.said === "unsure" ? "not sure yet" : esc(pick.letters.map(namedLetter).join(" · "))}.</p>`
      : item.task === "read"
      ? `${readingBoxes(item, s)}
         <p class="small">${s.letters_ok ?? 0} of ${s.letters_total ?? Array.from(item.truth).length} letters read${s.extras ? `, ${s.extras} extra` : ""}.
         You typed: <span class="greek">${pick.letters.length ? pick.letters.map(esc).join("") : "nothing"}</span></p>`
      : `<dl class="compare"><dt>You said</dt><dd>${pick.said === "no" ? `no ${detectWord()}` : pick.said === "unsure" ? "not sure" : `${detectWord()}`}${pick.letters.length ? ` <span class="greek">(${pick.letters.map(esc).join("")})</span>` : ""}</dd>
         <dt>Answer</dt><dd>${item.truth === "none" ? `no ${detectWord()}` : `${detectWord()}`}</dd></dl>`;
    const provenance = item.task === "identify" || (item.task === "read" && item.sample_id) ? readingSource(item)
      : item.task === "read" ? `<p class="edition-line greek" lang="grc">${esc(item.edition ?? "")}</p>
        <p class="small muted">Source line: ${esc(item.reading ?? "")}, as printed in the edition.${item.edition_indices ? ` This crop uses letter positions ${item.edition_indices[0] + 1}–${item.edition_indices[1]}.` : ""} Letters with a dot below are uncertain there.</p>` : "";
    const images = comparisonImages(item);
    return `${newRank ? rankUpBanner(newRank) : ""}<div class="verdict v-${s.verdict}">
      <h2 id="verdict" tabindex="-1">${esc(headline(item, pick, s, detectWord()))}</h2>
      ${images ? `${images}${reading}` : `<div class="solution-pair">${sourcePhoto(item, item.truth.length > 4, "Your tile")}<div><h3>${item.task === "detect" ? "Reference answer" : "Published reading"}</h3>${reading}</div></div>`}
      ${readingReview(item, s)}
      ${provenance}
      ${item.reference_answer_image ? `<details><summary>Compare the source ink tracing</summary>${imageComparison(
        { file: item.reference_image!, label: "Unchanged source", alt: "Unchanged source image" },
        { file: item.reference_answer_image, label: "Ink tracing", alt: "The unchanged source with the organizers' ink tracing in red" },
      )}<p class="small muted">Red: the organizers' tracing on the unchanged source.</p></details>` : ""}
      <p>${esc(item.explain)}</p>
      ${helpUsed || item.assisted ? `<p class="small">${helpUsed ? "Clue or reading guide used" : "Letter clues provided"} · saved as assisted practice.</p>` : ""}
      <div class="points">${points(s)}</div>
      ${item.task === "detect" && pick.letters.length ? `<p class="small">Your letter suggestion is saved. It is not marked wrong; this round checks visible ${detectWord()} only.</p>` : ""}
      <p class="cite">${sourceLine(item)}</p>
      ${item.practice_group && levelAvailable(state(), item.level) ? `<p><a class="button" href="#/practice/${item.level}/group/${item.practice_group}">Practise this group</a><span class="small muted"> Your place in this lesson is saved.</span></p>` : ""}
      ${!practice && set!.id === "first-letters-500p2" && index === 2 && canStartFirstLine(state()) ? `<div class="lesson-choice"><p><strong>Three real examples. What would you like to try next?</strong></p><div class="row"><button type="button" class="primary" id="next">Explore more handwriting →</button><a class="button" href="#/quiz/first-line">Read a short group →</a></div><p class="small muted">Your place here is saved. You can return to the remaining guided examples.</p></div>` : `<button type="button" class="primary" id="next">${index + 1 < order.length ? "Next tile" : "See how it went"}</button>`}
    </div>
    ${s.verdict === "false-alarm" ? tip(`A familiar shape can be tempting. Compare the strokes with the reference, and use “Not sure” when the evidence is thin. Even the editors set aside ambiguous traces (${sourceLinks(["cerc54"])}).`) : ""}`;
  }

  function check(): void {
    if (!canCheck() || checked) return;
    const item = order[index];
    if (item.task === "study") return;
    if (quickChoice()) pick.confidence = null;
    const letters = pick.said === "no" ? "" : pick.letters.join("");
    const s = score({ text: item.truth, uncertain: item.uncertain, simulated: item.simulated }, { said: pick.said!, letters, confidence: pick.confidence!, presenceAsked: !quickChoice() });
    const rec: AnswerRecord = {
      item_id: item.id,
      task: item.task,
      practice,
      help_used: helpUsed || item.task === "identify" || item.assisted === true,
      base_item: item.base_item ?? item.id,
      simulated: item.simulated ?? false,
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
    persistRound();
    const news = progressAfterAnswer();
    newRank = news.rank?.id;
    if (newRank) ranksThisSet.push(newRank);
    renderRound();
    main.querySelector<HTMLElement>("#verdict")?.focus();
  }

  function next(): void {
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
      renderSummary();
      return;
    }
    elapsed = 0;
    shownAt = performance.now();
    persistRound();
    renderRound();
    main.querySelector<HTMLElement>("h1")?.focus();
  }

  function renderSummary(): void {
    const count = (v: string) => results.filter((r) => r.verdict === v).length;
    const empty = results.filter((r) => r.truth === "none").length;
    const readings = results.filter(r => r.task === "read").map(readingStats).filter(r => r !== null);
    const lettersOk = readings.reduce((n, r) => n + r.correct, 0);
    const lettersAll = readings.reduce((n, r) => n + r.total, 0);
    const pathIndex = playSets.findIndex((p) => p.id === set!.id);
    const nextSet = pathIndex >= 0 ? playSets.slice(pathIndex + 1).find((p) => levelAvailable(state(), p.level)) : undefined;
    main.innerHTML = `
      <h1 tabindex="-1">${practice ? "Practice round complete" : `${esc(set!.title)}: done`}</h1>
      ${set!.level === 3 && !nextSet && !practice && [1, 2, 3].every(level => levelDone(state(), level)) ? `<p>You have finished levels 1–3. Keep practising: recognition grows through repeated comparisons, and difficult images can still deserve “not sure”.</p>` : ""}
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
        ${practiceGroup ? `<a class="button" href="#/quiz/first-line">Return to the lesson</a>` : ""}
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
    if (b.id === "review-zoom") {
      zoom = !zoom;
      main.querySelector(".review-image")?.classList.toggle("enlarged", zoom);
      b.setAttribute("aria-pressed", String(zoom));
      b.textContent = zoom ? "Zoom out" : "Zoom in";
      return;
    }
    if (handleComparisonClick(b)) return;
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
    if (b.id === "study-next" && order[index].task === "study") return next();
    if (order[index].task === "study") return;
    if (checked) return;
    if (b.dataset.reading) {
      pick.said = b.dataset.reading === "?" ? "unsure" : "yes";
      pick.letters = Array.from(b.dataset.reading === "?" ? "?".repeat(order[index].truth.length) : b.dataset.reading);
      if (quickChoice()) return check();
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
      if (e.repeat) { e.preventDefault(); return; }
      if (quickChoice() && !checked && (e.target as HTMLElement).closest("[data-reading]")) return;
      if ((e.target as HTMLElement).closest("a, summary, button:not([data-said]):not([data-conf]):not([data-key]):not([data-reading])")) return;
      e.preventDefault();
      if (checked || order[index].task === "study") next();
      else check();
      return;
    }
    if (checked || order[index].task === "study") return;
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
    if (k === "-" && (order[index].task === "detect" || order[index].simulated)) {
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

  function onGuide(event: Event): void {
    const target = event.target as HTMLDetailsElement;
    if ((target.id === "reading-guide" || target.id === "shape-hint") && target.open && !checked) { helpUsed = true; persistRound(); }
  }
  main.addEventListener("scroll", syncComparisonScroll, true);
  main.addEventListener("toggle", onGuide, true);
  main.addEventListener("click", onClick);
  document.addEventListener("keydown", onKey);
  persistRound();
  renderRound();
  window.addEventListener("pagehide", persistRound);
  window.addEventListener("resize", fitReadingImage);
  return () => {
    persistRound();
    imageObserver?.disconnect();
    window.removeEventListener("pagehide", persistRound);
    window.removeEventListener("resize", fitReadingImage);
    main.removeEventListener("scroll", syncComparisonScroll, true);
    main.removeEventListener("toggle", onGuide, true);
    main.removeEventListener("click", onClick);
    document.removeEventListener("keydown", onKey);
  };
}
