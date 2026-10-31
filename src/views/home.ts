import { BADGES, currentStreak, rankStatus } from "../badges";
import { drills, groups, hero, itemSetVersion, LEVELS, playSets, quizItems } from "../data";
import { learningAction, savedRoundLabel } from "../learning-action";
import { summarizePractice } from "../practice";
import { canStartFirstLine, levelAvailable, totalPoints } from "../rules";
import { state } from "../store";
import { badgeIcon, letterLabel, skipIntroLink, sourceLinks } from "../ui";
import { esc } from "../util";
import "../orientation.css";

const lessonNotes: Record<string, string> = {
  "first-letters-500p2": "Recognise clear letters, then compare different handwritten forms.",
  "first-line": "Read a short group, one letter at a time. A whole line is optional.",
  "ir-500p2": "Distinguish ink from papyrus in infrared photographs.",
  "paris4-col-8": "Read two to four letters at a time, and locate each one in the image.",
  "harder-images": "Explore blur and missing detail. Practise when to say “not sure”.",
};

export function renderHome(main: HTMLElement): void {
  const s = state();
  const next = learningAction(s);
  const example = quizItems.find(item => item.id === hero.item)!;
  const realSets = playSets.filter(p => p.level > 0);
  const setsDone = realSets.filter(p => (s.setsDone[p.id] ?? 0) > 0).length;
  const startingLevel = s.levelOverride ?? 1;
  const firstLineOpen = canStartFirstLine(s);
  const { reading, honesty } = totalPoints(s);
  const rank = rankStatus(s);
  const version = itemSetVersion();
  const resumeLabel = (id: string) => savedRoundLabel(s, id, version);
  const levelTitles = { 1: "Photographs", 2: "Ink and short readings", 3: "Harder images" };

  const levelStops = LEVELS.map(l => `<li class="path-level">
    <h3><span class="level-number">${l.level}</span>${levelTitles[l.level]}</h3>
    <ol class="lesson-list">${playSets.filter(p => p.level === l.level).map(p => {
      const open = levelAvailable(s, l.level) || (p.id === "first-line" && firstLineOpen);
      const done = (s.setsDone[p.id] ?? 0) > 0;
      const label = resumeLabel(p.id) ?? (done ? "Again" : "Start");
      return `<li class="lesson-stop ${done ? "done" : ""} ${next.setId === p.id ? "up-next" : ""} ${open ? "" : "locked"}">
        <div><h4>${esc(p.title)}${done ? `<span class="lesson-done"> · Finished</span>` : ""}</h4>
        <p class="small muted">${esc(lessonNotes[p.id] ?? "Explore this lesson at your own pace.")}</p></div>
        ${open ? `<a class="button" href="${p.href}" aria-label="${esc(label)}: ${esc(p.title)}">${esc(label)}</a>`
          : `<span class="small muted">${s.levelOverride !== undefined ? `<a href="#/results">Choose your level</a>` : p.id === "first-line" ? "Try three real examples first" : `Finish level ${l.level - 1} first`}</span>`}
      </li>`;
    }).join("")}</ol>
  </li>`).join("");

  main.innerHTML = `
  <div class="orientation-page home-page">
  <section class="hero" aria-labelledby="hero-title">
    <div class="hero-copy">
      <p class="eyebrow">The Herculaneum papyri</p>
      <h1 id="hero-title">Learn to see the letters.</h1>
      <p>Real images, short rounds, one letter at a time. No Greek needed.</p>
      <a class="button primary learning-continue" href="${next.href}">${esc(next.label)} <span aria-hidden="true">→</span></a>
      <p class="small"><a href="#/alphabet">Find a letter in the alphabet</a>${startingLevel === 0 ? ` · ${skipIntroLink()}` : ""}</p>
      <p class="small muted hero-note">Progress stays in this browser.</p>
      <p class="small muted">Images thanks to the <a href="https://scrollprize.org/" rel="noopener">Vesuvius Challenge</a>. <a href="#/about">Acknowledgements</a>.</p>
    </div>
    <div class="hero-example">
      <h2>Try a real example</h2>
      <figure class="hero-photo">
        <img src="images/${esc(example.image)}" alt="${esc(example.alt)}" width="216" height="99">
        <figcaption class="cite">Cropped CT-derived ink map. ${esc(example.credit)}, ${esc(example.license)}.</figcaption>
      </figure>
      <button type="button" class="choice" id="show-reading" aria-expanded="false" aria-controls="hero-reading">Show the reading</button>
      <div class="reveal" id="hero-reading" hidden>
        <div class="reading" role="group" aria-label="Published reading, letter by letter">
          ${Array.from(example.truth).map(letter => `<span class="rl named-letter">${letterLabel(letter)}</span>`).join("")}
        </div>
        <p class="small">${esc(hero.note)}</p>
      </div>
      <details class="hero-sources"><summary>About this image &amp; sources</summary>
        <p class="small">${esc(hero.where)}. Letters from a closed scroll.</p>
        <p class="cite">Image: ${sourceLinks(["grandprize"])}.<br>Reading: ${sourceLinks(example.source.filter(id => id !== "grandprize"))}.</p>
      </details>
    </div>
  </section>

  <section class="learning-path" aria-labelledby="path-title">
    <div class="section-heading"><h2 id="path-title">Your path</h2><span class="small muted">${setsDone}/${realSets.length} lessons finished</span></div>
    ${s.levelOverride !== undefined ? `<p class="small">Open through level ${s.levelOverride}. <a href="#/results">Change this</a>.</p>` : ""}
    <ol class="level-path">${levelStops}</ol>
  </section>

  <section class="practice-library" aria-labelledby="practice-title">
    <div class="section-heading"><h2 id="practice-title">Another short round</h2><span class="small muted">Up to 12 tiles</span></div>
    <div class="practice-options">${LEVELS.filter(l => levelAvailable(s, l.level)).map(l => {
      const counts = summarizePractice(quizItems, s.answers, l.level);
      const focused = Object.keys(s.rounds ?? {}).filter(id => id.startsWith(`practice-${l.level}/`) && resumeLabel(id));
      return `<div><a class="button" href="#/practice/${l.level}">${resumeLabel(`practice-${l.level}`) ?? `Practise level ${l.level}`}</a>
        ${focused.map(id => `<p class="small"><a href="#/practice/${l.level}/group/${id.split("/")[1]}">${resumeLabel(id)} · focused reading</a></p>`).join("")}
        <span class="small muted">${counts.originals} source regions</span></div>`;
    }).join("") || `<a href="#/results">Choose a practice level</a>`}</div>
    <details class="orientation-detail"><summary>How practice works</summary>
      <p class="small">Short rounds revisit familiar shapes and earlier difficulties. Some source regions overlap;
      altered versions are counted under their original region. Practice records answers without completing lessons.</p>
    </details>
  </section>

  <details class="orientation-detail optional-basics" ${startingLevel === 0 ? "open" : ""}>
    <summary>Optional basics: alphabet and drawings</summary>
    <p class="small">Drawn exercises help you practise shapes and look-alikes.</p>
    <p><a class="button" href="#/alphabet">Explore the alphabet</a></p>
    <ul class="lesson-list">${groups.map(g => {
      const done = (s.setsDone[g.id] ?? 0) > 0;
      return `<li class="lesson-stop"><div><h4>${esc(g.title)}: <span class="greek">${g.letters.map(esc).join(" ")}</span></h4>
        <p class="small muted">${drills.filter(d => d.group === g.id).length} drawn tiles${done ? " · Finished" : ""}</p></div>
        <a class="button" href="#/drill/${g.id}" aria-label="${done ? "Again" : "Start"}: ${esc(g.title)}">${done ? "Again" : "Start"}</a></li>`;
    }).join("")}</ul>
  </details>

  <details class="orientation-detail home-achievements"><summary>Your achievements · ${esc(rank.rank.title)}</summary>
    <div class="tally"><div><strong>${reading}</strong><span class="muted">reading points</span></div>
      <div class="honesty"><strong>${honesty}</strong><span class="muted">honesty points</span></div>
      <div><strong>${currentStreak(s)}</strong><span class="muted">current streak</span></div></div>
    <p class="small"><a href="#/results">My results</a> · <a href="#/ranks">Ranks and how to reach them</a></p>
    <ul class="badges">${BADGES.map(b => `<li class="badge ${s.badges[b.id] ? "got" : ""}" title="${esc(b.how)}">${badgeIcon()}
      <span><strong>${esc(b.title)}</strong><br><span class="small">${s.badges[b.id] ? "Earned" : esc(b.how)}</span></span></li>`).join("")}</ul>
  </details>
  </div>`;

  const button = main.querySelector<HTMLButtonElement>("#show-reading")!;
  const reveal = main.querySelector<HTMLElement>("#hero-reading")!;
  button.addEventListener("click", () => {
    const on = button.getAttribute("aria-expanded") !== "true";
    button.setAttribute("aria-expanded", String(on));
    button.textContent = on ? "Hide the reading" : "Show the reading";
    reveal.hidden = !on;
  });
}
