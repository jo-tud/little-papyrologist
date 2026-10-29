import { BADGES, currentStreak, rankStatus } from "../badges";
import { drills, groups, hero, itemSetVersion, LEVELS, playSets, quizItems } from "../data";
import { canResume } from "../round-session";
import { summarizePractice } from "../practice";
import { levelAvailable, levelDone, totalPoints } from "../rules";
import { lineSvg } from "../glyphs/render";
import { state } from "../store";
import { badgeIcon, rankSeal, skipIntroLink, sourceLinks, tip } from "../ui";
import { checksList } from "./ranks";
import { esc } from "../util";

export function renderHome(main: HTMLElement): void {
  const s = state();
  const version = itemSetVersion();
  const resumeLabel = (id: string): string | undefined => {
    const saved = s.rounds?.[id];
    const match = id.match(/^practice-([1-3])(?:\/([a-z0-9-]+))?$/);
    const level = match ? Number(match[1]) : undefined;
    const group = match?.[2];
    const allowed = new Set(quizItems.filter(item => level ? item.level === level && item.task !== "study"
      && (!group || item.practice_group === group) : item.set === id && !item.practice_only).map(item => item.id));
    return canResume(saved, version, allowed, s.answers)
      ? `Continue · ${saved.index + (saved.checked ? 1 : 0)}/${saved.item_ids.length}` : undefined;
  };
  const chars = Array.from(hero.line);
  const starts = new Set<number>();
  let pos = 0;
  for (const w of hero.words) {
    starts.add(pos);
    pos += Array.from(w).length;
  }
  const setsDone = playSets.filter((p) => (s.setsDone[p.id] ?? 0) > 0).length;
  const startingLevel = s.levelOverride ?? (s.introSkipped ? 1 : 0);
  const availableSets = playSets.filter((p) => levelAvailable(s, p.level));
  const nextSet = availableSets.find((p) => !s.setsDone[p.id] && p.level >= startingLevel)
    ?? availableSets.find((p) => !s.setsDone[p.id]);
  const showAlphabet = !s.setsDone["alphabet-seen"] && startingLevel === 0;
  const nextHref = showAlphabet ? "#/alphabet" : nextSet?.href ?? "#/results";
  const nextLabel = showAlphabet ? "Meet the alphabet" : nextSet ? `${resumeLabel(nextSet.id) ?? "Next"}: ${nextSet.title}` : "See my results";
  const { reading, honesty } = totalPoints(s);
  const streak = currentStreak(s);
  const rank = rankStatus(s);

  const groupStops = groups
    .map((g) => {
      const done = (s.setsDone[g.id] ?? 0) > 0;
      const n = drills.filter((d) => d.group === g.id).length;
      return `<li class="stop ${done ? "done" : nextSet?.id === g.id ? "up-next" : ""}">
        <span class="mark greek" aria-hidden="true">${esc(g.letters[0])}</span>
        <div><h3>${esc(g.title)}: <span class="greek">${g.letters.map(esc).join(" ")}</span></h3>
          <p>Level 0 · ${n} tiles${done ? ` · Finished ${s.setsDone[g.id]}×` : ""}</p></div>
        <a class="button ${nextSet?.id === g.id ? "primary" : ""}" href="#/drill/${g.id}" aria-label="${done ? "Play again" : "Start"}: ${esc(g.title)}">${done ? "Play again" : "Start"}</a>
      </li>`;
    })
    .join("");

  // Levels open one after the other. Their sets come from the data, so new material shows up here.
  const levelStops = LEVELS.map((l) => {
    const open = levelAvailable(s, l.level);
    const sets = playSets.filter((p) => p.level === l.level);
    if (!sets.length)
      return `<li class="stop locked">
        <span class="mark" aria-hidden="true">${l.level}</span>
        <div><h3>Level ${l.level}: ${esc(l.title)}</h3><p>${esc(l.text)}</p></div>
        <span class="muted small">Coming soon</span>
      </li>`;
    return sets
      .map((p) => {
        const done = (s.setsDone[p.id] ?? 0) > 0;
        const label = resumeLabel(p.id) ?? (done ? "Play again" : "Start");
        return `<li class="stop ${done ? "done" : open ? nextSet?.id === p.id ? "up-next" : "" : "locked"}">
          <span class="mark" aria-hidden="true">${l.level}</span>
          <div><h3>Level ${l.level}: ${esc(p.title)}</h3><p>${esc(l.text)}</p></div>
          ${open ? `<a class="button ${nextSet?.id === p.id ? "primary" : ""}" href="${p.href}" aria-label="${label}: ${esc(p.title)}">${label}</a>` : `<span class="muted small">${s.levelOverride !== undefined ? `<a href="#/results">Change practice level</a>` : `Finish level ${l.level - 1} first`}</span>`}
        </li>`;
      })
      .join("");
  }).join("");

  main.innerHTML = `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">Small steps into ancient handwriting</p>
      <h1 id="hero-title">Learn to see the letters.</h1>
      <p>Meet the Greek letters of the Herculaneum scrolls. Practise their shapes,
      untangle look-alikes, and learn when to say “I can't tell”.</p>
      <a class="button primary" href="${nextHref}">${esc(nextLabel)} <span aria-hidden="true">→</span></a>
      <p class="small muted hero-note">No Greek needed. Your progress stays in this browser.</p>
      ${!s.introSkipped && !s.setsDone[playSets.find((p) => p.level === 1)?.id ?? ""] ? `<p class="small">Already comfortable with Greek? ${skipIntroLink()}</p>` : ""}
      <p class="small muted">Thanks to the <a href="https://scrollprize.org/" rel="noopener">Vesuvius Challenge</a>
      for permission to use the images. <a href="#/about">Acknowledgements</a>.</p>
    </div>
    <div class="hero-example">
    <p class="eyebrow">Try a line</p>
    <h2>Where does one word end?</h2>
    <p class="small muted">Start by looking. Then reveal the word breaks.</p>
    <div class="band" id="band">
      ${lineSvg(chars, starts, `A line of Greek capitals without spaces: ${hero.line}`)}
    </div>
    <div class="row">
      <button type="button" class="choice" id="split" aria-pressed="false" aria-controls="band reveal">Show where the words end</button>
    </div>
    <div class="reveal" id="reveal" hidden>
      <p class="edition" lang="grc">${esc(hero.edition)}</p>
      <p class="small">${esc(hero.where)}. ${esc(hero.note)} ${esc(hero.gloss)}</p>
      <p class="cite">Reading: ${sourceLinks(hero.sources)}. Letters drawn for this trainer.</p>
    </div>
    <p class="cite hero-source">In AD 79, Vesuvius buried and carbonized a library of papyrus scrolls.
    Some of their text is now visible again. ${sourceLinks(["grandprize"])}</p>
    </div>
  </section>

  <div class="home-layout">
  <section aria-labelledby="path-title">
  <h2 id="path-title">Your path</h2>
  ${s.levelOverride !== undefined ? `<p class="small">Practice is open through level ${s.levelOverride}. <a href="#/results">Change or reset this choice</a>.</p>` : ""}
  <p class="small muted">${s.introSkipped ? "You skipped the introduction. The drawn exercises are here whenever you want them." : "Learn with drawings in level 0, recognize real letters with help in level 1, then look closer in level 2. You can skip the introduction whenever you like."}</p>
  <p class="muted small">From drawn letters to real scrolls. ${setsDone} of ${playSets.length} available sets finished.</p>
  <div class="meter" role="progressbar" aria-label="Exercise sets finished" aria-valuemin="0" aria-valuemax="${playSets.length}" aria-valuenow="${setsDone}">
    <span style="width:${(100 * setsDone) / playSets.length}%"></span>
  </div>
  <ol class="path">
    <li class="stop ${s.setsDone["alphabet-seen"] ? "done" : ""}">
      <span class="mark greek" aria-hidden="true">Α</span>
      <div><h3>The alphabet</h3><p>Meet all 24 letters, their names and the shapes to look for.</p></div>
      <a class="button" href="#/alphabet">Open</a>
    </li>
    ${groupStops}
    ${levelStops}
  </ol>

  <section class="practice-library" aria-labelledby="practice-title">
    <h2 id="practice-title">Make it familiar</h2>
    <p>The lessons introduce the material. Short practice rounds help you return to it:
    unfamiliar images and previous difficulties appear more often. Stop after one round or keep going.</p>
    <div class="practice-cards">
      ${LEVELS.map((l) => {
        const counts = summarizePractice(quizItems, s.answers, l.level);
        const focused = Object.keys(s.rounds ?? {}).filter(id => id.startsWith(`practice-${l.level}/`) && resumeLabel(id));
        return `<article class="practice-card"><h3>Level ${l.level}</h3><p>${esc(l.title)}</p>
          <p class="small muted">${counts.available} exercises · ${counts.originals} source regions</p>
          ${levelAvailable(s, l.level) ? `<a class="button" href="#/practice/${l.level}">${resumeLabel(`practice-${l.level}`) ?? `Practise ${Math.min(12, counts.available)} tiles`}</a>` : `<p class="small">Opens with level ${l.level}. <a href="#/results">Choose your level</a>.</p>`}
          ${levelAvailable(s, l.level) ? focused.map(id => `<p class="small"><a href="#/practice/${l.level}/group/${id.split("/")[1]}">${resumeLabel(id)} · focused reading</a></p>`).join("") : ""}</article>`;
      }).join("")}
    </div>
    <p class="small muted">Altered versions are counted under the same source region. Some source regions overlap.
    These rounds record practice answers; they do not complete lessons for you.</p>
  </section>

  ${tip(
    s.answers.length === 0
      ? "The drawn exercises include empty and damaged tiles. A well-placed “no letter” or “can't tell” earns honesty points. No need to invent a letter to make progress."
      : streak >= 3
        ? `${streak} good answers in a row. Honest “can't tell” answers count, too.`
        : "Points for reading, and separate points for honesty. Both count.",
  )}
  </section>

  <aside class="home-progress" aria-label="Your progress">
  <h2>Your rank</h2>
  <div class="rank-now">
    ${rankSeal(rank.index + 1, "current")}
    <div>
      <h3>${esc(rank.rank.title)}</h3>
      <p>${esc(rank.rank.blurb)}</p>
      ${
        rank.next
          ? `<p class="small"><strong>Next: ${rank.next.secret ? "a secret rank" : esc(rank.next.title)}.</strong> To get there:</p>${checksList(rank.nextChecks)}`
          : `<p class="small"><strong>This is the last rank.</strong> Thank you for reading so carefully.</p>`
      }
      ${s.introSkipped && !levelDone(s, 0) ? `<p class="small muted">Some ranks include the drawn exercises. Skipping the introduction opens the real images without marking those exercises complete.</p>` : ""}
      <p class="small"><a href="#/ranks">See all ranks</a></p>
    </div>
  </div>

  <h2>So far</h2>
  <div class="tally">
    <div><strong>${reading}</strong><span class="muted">reading points</span></div>
    <div class="honesty"><strong>${honesty}</strong><span class="muted">honesty points</span></div>
    <div><strong>${streak}</strong><span class="muted">current streak</span></div>
  </div>
  <ul class="badges">
    ${BADGES.map(
      (b) => `<li class="badge ${s.badges[b.id] ? "got" : ""}" title="${esc(b.how)}">${badgeIcon()}
        <span><strong>${esc(b.title)}</strong><br><span class="small">${s.badges[b.id] ? "Earned" : esc(b.how)}</span></span></li>`,
    ).join("")}
  </ul>
  </aside>
  </div>
  `;

  const button = main.querySelector<HTMLButtonElement>("#split")!;
  const band = main.querySelector<HTMLElement>(".script-line")!;
  const reveal = main.querySelector<HTMLElement>("#reveal")!;
  button.addEventListener("click", () => {
    const on = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(on));
    button.textContent = on ? "Hide the word breaks" : "Show where the words end";
    band.classList.toggle("words", on);
    reveal.hidden = !on;
  });
}
