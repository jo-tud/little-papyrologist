import { BADGES, currentStreak, rankStatus } from "../badges";
import { drills, groups, hero, itemSetVersion, LEVELS, playSets, quizItems } from "../data";
import { canResume } from "../round-session";
import { summarizePractice } from "../practice";
import { canStartFirstLine, levelAvailable, totalPoints } from "../rules";
import { state } from "../store";
import { badgeIcon, letterLabel, rankSeal, skipIntroLink, sourceLinks, tip } from "../ui";
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
  const example = quizItems.find(item => item.id === hero.item)!;
  const realSets = playSets.filter((p) => p.level > 0);
  const setsDone = realSets.filter((p) => (s.setsDone[p.id] ?? 0) > 0).length;
  const startingLevel = s.levelOverride ?? 1;
  const firstLineOpen = canStartFirstLine(s);
  const availableSets = playSets.filter((p) => (levelAvailable(s, p.level) || (p.id === "first-line" && firstLineOpen))
    && (p.level > 0 || startingLevel === 0));
  const earlyReading = !levelAvailable(s, 2) && firstLineOpen && resumeLabel("first-line")
    ? availableSets.find(p => p.id === "first-line") : undefined;
  const nextSet = earlyReading ?? availableSets.find((p) => p.level >= startingLevel && resumeLabel(p.id))
    ?? availableSets.find((p) => !s.setsDone[p.id] && p.level >= startingLevel)
    ?? availableSets.find((p) => resumeLabel(p.id))
    ?? availableSets.find((p) => !s.setsDone[p.id]);
  const showAlphabet = !s.setsDone["alphabet-seen"] && startingLevel === 0;
  const nextHref = showAlphabet ? "#/alphabet" : nextSet?.href ?? "#/results";
  const nextResume = nextSet ? resumeLabel(nextSet.id) : undefined;
  const nextLabel = showAlphabet ? "Explore the alphabet" : nextSet
    ? nextResume ? `${nextResume}: ${nextSet.title}`
      : nextSet.id === realSets[0]?.id && !s.setsDone[nextSet.id] ? "Start with real letters" : `Next: ${nextSet.title}`
    : "See my results";
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

  // Real photographs are open immediately; later levels follow completed lessons.
  const levelStops = LEVELS.map((l) => {
    const sets = playSets.filter((p) => p.level === l.level);
    if (!sets.length)
      return `<li class="stop locked">
        <span class="mark" aria-hidden="true">${l.level}</span>
        <div><h3>Level ${l.level}: ${esc(l.title)}</h3><p>${esc(l.text)}</p></div>
        <span class="muted small">Coming soon</span>
      </li>`;
    return sets
      .map((p) => {
        const open = levelAvailable(s, l.level) || (p.id === "first-line" && firstLineOpen);
        const done = (s.setsDone[p.id] ?? 0) > 0;
        const label = resumeLabel(p.id) ?? (done ? "Play again" : "Start");
        return `<li class="stop ${done ? "done" : open ? nextSet?.id === p.id ? "up-next" : "" : "locked"}">
          <span class="mark" aria-hidden="true">${l.level}</span>
          <div><h3>Level ${l.level}: ${esc(p.title)}</h3><p>${esc(l.text)}</p></div>
          ${open ? `<a class="button ${nextSet?.id === p.id ? "primary" : ""}" href="${p.href}" aria-label="${label}: ${esc(p.title)}">${label}</a>` : `<span class="muted small">${s.levelOverride !== undefined ? `<a href="#/results">Change practice level</a>` : p.id === "first-line" ? "Try three real examples first" : `Finish level ${l.level - 1} first`}</span>`}
        </li>`;
      })
      .join("");
  }).join("");

  main.innerHTML = `
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">Small steps into ancient handwriting</p>
      <h1 id="hero-title">Learn to see the letters.</h1>
      <p>Begin with real photographs of the Herculaneum papyri. Learn the letter names,
      compare handwritten shapes, and work up to reading short groups.</p>
      <a class="button primary" href="${nextHref}">${esc(nextLabel)} <span aria-hidden="true">→</span></a>
      <p class="small muted hero-note">No Greek needed. Your progress stays in this browser.</p>
      <p class="small"><a href="#/alphabet">Explore the alphabet</a>${startingLevel === 0 ? ` · ${skipIntroLink()}` : ". Drawing exercises are optional."}</p>
      <p class="small muted">Thanks to the <a href="https://scrollprize.org/" rel="noopener">Vesuvius Challenge</a>
      for permission to use the images. <a href="#/about">Acknowledgements</a>.</p>
    </div>
    <div class="hero-example">
    <p class="eyebrow">Try a real example</p>
    <h2>Letters from a closed scroll</h2>
    <p class="small muted">Look at the shapes. Then reveal the reading.</p>
    <figure class="hero-photo">
      <img src="images/${esc(example.image)}" alt="${esc(example.alt)}" width="216" height="99">
      <figcaption class="cite">${esc(hero.where)}. Cropped CT-derived ink map.<br>
      ${esc(example.credit)}, ${esc(example.license)}.<br>
      Image: ${sourceLinks(["grandprize"])}.</figcaption>
    </figure>
    <div class="row">
      <button type="button" class="choice" id="show-reading" aria-expanded="false" aria-controls="hero-reading">Show the reading</button>
    </div>
    <div class="reveal" id="hero-reading" hidden>
      <div class="reading" role="group" aria-label="Published reading, letter by letter">
        ${Array.from(example.truth).map(letter => `<span class="rl named-letter">${letterLabel(letter)}</span>`).join("")}
      </div>
      <p class="small">${esc(hero.note)}</p>
      <p class="cite">Reading: ${sourceLinks(example.source.filter(id => id !== "grandprize"))}.</p>
    </div>
    <p class="cite hero-source">In AD 79, Vesuvius buried and carbonized a library of papyrus scrolls.
    Some of their text is now visible again. ${sourceLinks(["grandprize"])}</p>
    </div>
  </section>

  <div class="home-layout">
  <section aria-labelledby="path-title">
  <h2 id="path-title">Your path</h2>
  ${s.levelOverride !== undefined ? `<p class="small">Practice is open through level ${s.levelOverride}. <a href="#/results">Change or reset this choice</a>.</p>` : ""}
  <p class="small muted">Start with real letters and helpful choices. Then read short groups and explore harder images.
  The alphabet and drawing exercises are available whenever you want a refresher.</p>
  <p class="muted small">${setsDone} of ${realSets.length} lessons with real images finished.</p>
  <div class="meter" role="progressbar" aria-label="Lessons with real images finished" aria-valuemin="0" aria-valuemax="${realSets.length}" aria-valuenow="${setsDone}">
    <span style="width:${realSets.length ? (100 * setsDone) / realSets.length : 0}%"></span>
  </div>
  <ol class="path">
    ${levelStops}
  </ol>

  <details class="optional-basics" ${startingLevel === 0 ? "open" : ""}>
  <summary>Optional basics: alphabet and drawings</summary>
  <p class="small muted">Use these simplified drawings to practise letter shapes and look-alikes.
  They are separate from the lessons with real images, and you can come back to them at any time.</p>
  <ul class="path">
    <li class="stop ${s.setsDone["alphabet-seen"] ? "done" : ""}">
      <span class="mark greek" aria-hidden="true">Α</span>
      <div><h3>The alphabet</h3><p>Meet all 24 letters, their names and the shapes to look for.</p></div>
      <a class="button" href="#/alphabet">Open</a>
    </li>
    ${groupStops}
  </ul>
  </details>

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
      ? "The first photographs come with helpful choices and letter names. Look closely, and use “Not sure” whenever you need it."
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

  const button = main.querySelector<HTMLButtonElement>("#show-reading")!;
  const reveal = main.querySelector<HTMLElement>("#hero-reading")!;
  button.addEventListener("click", () => {
    const on = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(on));
    button.textContent = on ? "Hide the reading" : "Show the reading";
    reveal.hidden = !on;
  });
}
