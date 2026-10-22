import { BADGES, earnedNow } from "../badges";
import { drills, glyphs, groups } from "../data";
import { tileSvg } from "../glyphs/render";
import { score, type Score } from "../scoring";
import { addAnswer, grantBadges, markSetDone, state } from "../store";
import type { AnswerRecord, Drill, SaidText } from "../types";
import { sourceLinks, tip, toast } from "../ui";
import { esc, shuffle } from "../util";

const CANT_TELL = "?";
const keyToLetter = new Map<string, string>(glyphs.map((g) => [g.latin, g.char]));
keyToLetter.set("w", "Ϲ"); // final sigma sits on W in the Greek layout

interface Pick {
  said?: SaidText;
  letter?: string;
  confidence?: 1 | 2 | 3;
}

function truthText(d: Drill): string {
  if (d.truth === "none") return "no letter";
  if (d.truth === CANT_TELL) return `can't tell (${(d.candidates ?? []).join(" or ")})`;
  return d.truth;
}

function givenText(p: Pick): string {
  if (p.said === "no") return "no letter";
  const sure = p.said === "unsure" ? " (not sure there is a letter)" : "";
  if (!p.letter) return `a letter, not named${sure}`;
  return (p.letter === CANT_TELL ? "can't tell" : p.letter) + sure;
}

function headline(d: Drill, p: Pick, s: Score): string {
  switch (s.verdict) {
    case "right":
      return `Right: ${d.truth}`;
    case "honest":
      if (d.truth === "none") return p.said === "no" ? "No false alarm. There is no letter here." : "Fair. There is no letter here.";
      return "Honest call. Nobody could tell.";
    case "careful":
      return `Careful, but it can be read: ${d.truth}`;
    case "guessed":
      return `It could be ${p.letter}, but you could not know`;
    case "false-alarm":
      return "False alarm. There is no letter here.";
    case "missed":
      return "There is a letter here";
    default:
      return d.truth === CANT_TELL ? `Not quite. It could be ${(d.candidates ?? []).join(" or ")}` : `Not quite: it is ${d.truth}`;
  }
}

function pointsChips(s: Score): string {
  const chips: string[] = [];
  if (s.reading > 0) chips.push(`<span class="r">+${s.reading} reading</span>`);
  if (s.reading < 0) chips.push(`<span class="neg">−1 for being sure and wrong</span>`);
  if (s.honesty > 0) chips.push(`<span class="h">+${s.honesty} honesty</span>`);
  if (!chips.length) chips.push(`<span class="r">no points this time</span>`);
  return chips.join("");
}

function extraTip(d: Drill, s: Score): string {
  if (s.verdict === "false-alarm")
    return tip(
      `Seeing letters where there are none is the most common trap. Even the editors of PHerc. Paris 4 had to set aside strokes that may have been only noise (${sourceLinks(["cerc54"])}).`,
    );
  if (s.verdict === "guessed") return tip("When the stroke that decides is lost, “can't tell” is the expert answer.");
  if (s.verdict === "careful") return tip("Good instinct to be careful. Here, though, every deciding stroke is visible.");
  if (s.verdict === "right" && d.damage?.length) return tip("Damage does not always make a letter uncertain. You looked for the stroke that decides.");
  return "";
}

export function renderDrill(main: HTMLElement, groupId: string): () => void {
  const group = groups.find((g) => g.id === groupId);
  if (!group) {
    main.innerHTML = `<h1>Exercise not found</h1><p><a href="#/">Back to the path</a></p>`;
    return () => {};
  }
  const order = shuffle(drills.filter((d) => d.group === group.id));
  const options = [...group.letters, CANT_TELL];
  let index = 0;
  let pick: Pick = {};
  let shownAt = performance.now();
  let checked: Score | null = null;
  const results: AnswerRecord[] = [];

  function progress(): string {
    return `<div class="progress" aria-hidden="true">${order
      .map((_, i) => `<span class="${i < index ? "past" : i === index ? "now" : ""}"></span>`)
      .join("")}</div>`;
  }

  function choice(name: string, value: string, label: string, pressed: boolean, cls = ""): string {
    return `<button type="button" class="choice ${cls}" data-${name}="${esc(value)}" aria-pressed="${pressed}">${label}</button>`;
  }

  function canCheck(): boolean {
    return !!pick.said && !!pick.confidence && (pick.said !== "yes" || !!pick.letter);
  }

  function renderRound(): void {
    const d = order[index];
    const lettersDisabled = pick.said === "no" || checked !== null;
    main.innerHTML = `
    <div class="drill-head">
      <h1>${esc(group!.title)}: <span class="greek">${group!.letters.map(esc).join(" ")}</span></h1>
      <span class="muted">Tile ${index + 1} of ${order.length}</span>
    </div>
    ${progress()}
    <div class="round">
      <figure class="tile-frame" data-item="${esc(d.id)}">
        ${tileSvg(d.id, d.draw, d.damage, `Drawn papyrus tile ${index + 1}${d.damage?.length ? ", partly damaged" : ""}`)}
        <figcaption>Drawn for this trainer.${d.damage?.length ? " Grey patches are holes in the papyrus." : ""}</figcaption>
      </figure>
      <div class="answer">
        ${
          checked
            ? feedback(d, checked)
            : `
        <fieldset class="question">
          <legend>Is there a letter on this tile?</legend>
          <div class="row">
            ${choice("said", "yes", "Yes", pick.said === "yes")}
            ${choice("said", "no", "No letter", pick.said === "no")}
            ${choice("said", "unsure", "Not sure", pick.said === "unsure")}
          </div>
        </fieldset>
        <fieldset class="question" ${lettersDisabled ? "disabled" : ""}>
          <legend>Which letter?</legend>
          <div class="row">
            ${options
              .map((l) =>
                l === CANT_TELL
                  ? choice("letter", l, "Can't tell", pick.letter === l)
                  : choice("letter", l, esc(l), pick.letter === l, "letter"),
              )
              .join("")}
          </div>
        </fieldset>
        <fieldset class="question">
          <legend>How sure are you?</legend>
          <div class="row">
            ${choice("conf", "1", "Guessing", pick.confidence === 1)}
            ${choice("conf", "2", "Fairly sure", pick.confidence === 2)}
            ${choice("conf", "3", "Sure", pick.confidence === 3)}
          </div>
        </fieldset>
        <button type="button" class="primary" id="check" ${canCheck() ? "" : "disabled"}>Check answer</button>
        <p class="keys">Keys: Greek letters on the Greek layout (${group!.letters
          .map((l) => `<kbd>${esc(glyphs.find((g) => g.char === l)?.latin ?? "")}</kbd> ${esc(l)}`)
          .join(", ")}), <kbd>?</kbd> can't tell, <kbd>-</kbd> no letter, <kbd>1</kbd>–<kbd>3</kbd> how sure, <kbd>Enter</kbd> check.</p>`
        }
      </div>
    </div>`;
  }

  function feedback(d: Drill, s: Score): string {
    return `<div class="verdict v-${s.verdict}">
      <h2 id="verdict" tabindex="-1">${esc(headline(d, pick, s))}</h2>
      <dl class="compare">
        <dt>You said</dt><dd>${esc(givenText(pick))}</dd>
        <dt>Answer</dt><dd>${esc(truthText(d))}</dd>
      </dl>
      <p>${esc(d.explain)}</p>
      <div class="points">${pointsChips(s)}</div>
      <p class="cite">Tile drawn for this trainer, so the answer is known exactly.${d.sources?.length ? ` See also: ${sourceLinks(d.sources)}.` : ""}</p>
      <button type="button" class="primary" id="next">${index + 1 < order.length ? "Next tile" : "See how it went"}</button>
    </div>
    ${extraTip(d, s)}`;
  }

  function check(): void {
    if (!canCheck() || checked) return;
    const d = order[index];
    const letters = pick.said === "no" ? "" : (pick.letter ?? "");
    const s = score({ text: d.truth, candidates: d.candidates }, { said: pick.said!, letters, confidence: pick.confidence! });
    const record: AnswerRecord = {
      item_id: d.id,
      level: 0,
      degradation: d.damage?.length ? 1 : 0,
      said_text: pick.said!,
      letters,
      confidence: pick.confidence!,
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
    announceBadges();
    renderRound();
    main.querySelector<HTMLElement>("#verdict")?.focus();
  }

  function announceBadges(): void {
    const fresh = grantBadges(earnedNow(state()));
    for (const id of fresh) {
      const b = BADGES.find((x) => x.id === id);
      if (b) toast(`New badge: ${b.title}`);
    }
  }

  function next(): void {
    index++;
    pick = {};
    checked = null;
    if (index >= order.length) {
      markSetDone(group!.id);
      announceBadges();
      renderSummary();
      return;
    }
    shownAt = performance.now();
    renderRound();
    main.querySelector<HTMLElement>("[data-said]")?.focus();
  }

  function renderSummary(): void {
    const count = (v: string) => results.filter((r) => r.verdict === v).length;
    const reading = results.reduce((n, r) => n + r.reading_points, 0);
    const honesty = results.reduce((n, r) => n + r.honesty_points, 0);
    const nulls = results.filter((r) => r.truth === "none").length;
    const nextGroup = groups[groups.findIndex((g) => g.id === group!.id) + 1];
    main.innerHTML = `
      <h1>${esc(group!.title)}: done</h1>
      <div class="tally">
        <div><strong>${count("right")}</strong><span class="muted">read correctly</span></div>
        <div class="honesty"><strong>${count("honest") + count("careful")}</strong><span class="muted">honest calls</span></div>
        <div><strong>${count("false-alarm")}</strong><span class="muted">false alarms on ${nulls} empty tiles</span></div>
        <div><strong>${count("wrong") + count("guessed") + count("missed")}</strong><span class="muted">to look at again</span></div>
      </div>
      <p>This set: ${reading} reading points and ${honesty} honesty points.</p>
      ${tip(
        count("false-alarm") === 0
          ? "No false alarms. That is the habit that matters most."
          : "Some empty tiles looked like letters to you. Look for strokes that start and stop at the line height.",
      )}
      <div class="row">
        <a class="button primary" href="${nextGroup ? `#/drill/${nextGroup.id}` : "#/results"}">${nextGroup ? `Next: ${esc(nextGroup.title)}` : "See my results"}</a>
        <button type="button" id="again">Play again</button>
        <a class="button" href="#/">Back to the path</a>
      </div>`;
    main.querySelector("#again")?.addEventListener("click", () => {
      index = 0;
      results.length = 0;
      order.splice(0, order.length, ...shuffle(order));
      shownAt = performance.now();
      renderRound();
    });
    main.querySelector<HTMLElement>("h1")?.focus();
  }

  function setSaid(v: SaidText): void {
    pick.said = v;
    if (v === "no") pick.letter = undefined;
  }

  function onClick(e: Event): void {
    const t = (e.target as HTMLElement).closest("button");
    if (!t || checked === undefined) return;
    if (t.id === "check") return check();
    if (t.id === "next") return next();
    if (checked) return;
    if (t.dataset.said) setSaid(t.dataset.said as SaidText);
    else if (t.dataset.letter) {
      pick.letter = t.dataset.letter;
      if (!pick.said) pick.said = "yes";
    } else if (t.dataset.conf) pick.confidence = Number(t.dataset.conf) as 1 | 2 | 3;
    else return;
    const focusKey = Object.entries(t.dataset)[0];
    renderRound();
    if (focusKey) main.querySelector<HTMLElement>(`[data-${focusKey[0]}="${focusKey[1]}"]`)?.focus();
  }

  function onKey(e: KeyboardEvent): void {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (index >= order.length) return;
    const k = e.key.toLowerCase();
    if (k === "enter") {
      if ((e.target as HTMLElement).closest("button, a")) return; // let the focused control act
      e.preventDefault();
      if (checked) next();
      else check();
      return;
    }
    if (checked) return;
    let changed = true;
    if (k === "0" || k === "-") setSaid("no");
    else if (k === "?") {
      pick.letter = CANT_TELL;
      if (!pick.said || pick.said === "no") pick.said = "yes";
    } else if (k === "1" || k === "2" || k === "3") pick.confidence = Number(k) as 1 | 2 | 3;
    else if (keyToLetter.has(k) && group!.letters.includes(keyToLetter.get(k)!)) {
      pick.letter = keyToLetter.get(k);
      if (!pick.said || pick.said === "no") pick.said = "yes";
    } else changed = false;
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
