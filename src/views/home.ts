import { BADGES, currentStreak, rankStatus } from "../badges";
import { drills, groups, hero, LEVELS, playSets } from "../data";
import { levelDone, totalPoints } from "../rules";
import { lineSvg } from "../glyphs/render";
import { state } from "../store";
import { badgeIcon, rankSeal, sourceLinks, tip } from "../ui";
import { checksList } from "./ranks";
import { esc } from "../util";

export function renderHome(main: HTMLElement): void {
  const s = state();
  const chars = Array.from(hero.line);
  const starts = new Set<number>();
  let pos = 0;
  for (const w of hero.words) {
    starts.add(pos);
    pos += Array.from(w).length;
  }
  const setsDone = groups.filter((g) => (s.setsDone[g.id] ?? 0) > 0).length;
  const { reading, honesty } = totalPoints(s);
  const streak = currentStreak(s);
  const rank = rankStatus(s);

  const groupStops = groups
    .map((g) => {
      const done = (s.setsDone[g.id] ?? 0) > 0;
      const n = drills.filter((d) => d.group === g.id).length;
      return `<li class="stop ${done ? "done" : ""}">
        <span class="mark greek" aria-hidden="true">${esc(g.letters[0])}</span>
        <div><h3>${esc(g.title)}: <span class="greek">${g.letters.map(esc).join(" ")}</span></h3>
          <p>${n} tiles${done ? `. Finished ${s.setsDone[g.id]}×` : ""}</p></div>
        <a class="button ${done ? "" : "primary"}" href="#/drill/${g.id}">${done ? "Play again" : "Start"}</a>
      </li>`;
    })
    .join("");

  // Levels open one after the other. Their sets come from the data, so new material shows up here.
  const levelStops = LEVELS.map((l) => {
    const open = levelDone(s, l.level - 1);
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
        return `<li class="stop ${done ? "done" : open ? "" : "locked"}">
          <span class="mark" aria-hidden="true">${l.level}</span>
          <div><h3>Level ${l.level}: ${esc(p.title)}</h3><p>${esc(l.text)}</p></div>
          ${open ? `<a class="button ${done ? "" : "primary"}" href="${p.href}">${done ? "Play again" : "Start"}</a>` : `<span class="muted small">Finish ${l.level === 1 ? "stage 0" : `level ${l.level - 1}`} first</span>`}
        </li>`;
      })
      .join("");
  }).join("");

  main.innerHTML = `
  <section class="hero" aria-labelledby="hero-title">
    <h1 id="hero-title">Learn to see letters on the Herculaneum scrolls, and to notice when there are none.</h1>
    <p>In AD 79 the eruption of Vesuvius buried and carbonized a library of papyrus scrolls
    <span class="cite">(${sourceLinks(["grandprize"])})</span>. Today some of their text can be made
    visible again. This trainer shows you what the letters look like, which ones are easily
    confused, and how to be honest about what you cannot see.</p>
    <div class="band" id="band">
      ${lineSvg(chars, starts, `A line of Greek capitals without spaces: ${hero.line}`)}
    </div>
    <div class="row">
      <button type="button" class="choice" id="split" aria-pressed="false" aria-controls="band reveal">Show where the words end</button>
    </div>
    <div class="reveal" id="reveal" hidden>
      <p class="edition" lang="grc">${esc(hero.edition)}</p>
      <p>${esc(hero.where)}. ${esc(hero.note)} ${esc(hero.gloss)}</p>
      <p class="cite">Reading: ${sourceLinks(hero.sources)}. Letters drawn for this trainer.</p>
    </div>
  </section>

  <h2>Your path</h2>
  <p class="muted">Stage 0: the scribes' alphabet. ${setsDone} of ${groups.length} sets finished.</p>
  <div class="meter" role="progressbar" aria-label="Stage 0 progress" aria-valuemin="0" aria-valuemax="${groups.length}" aria-valuenow="${setsDone}">
    <span style="width:${(100 * setsDone) / groups.length}%"></span>
  </div>
  <ol class="path">
    <li class="stop ${s.setsDone["alphabet-seen"] ? "done" : ""}">
      <span class="mark greek" aria-hidden="true">Α</span>
      <div><h3>The alphabet</h3><p>All 24 letters as the scribes wrote them, and what is special about this script.</p></div>
      <a class="button" href="#/alphabet">Open</a>
    </li>
    ${groupStops}
    ${levelStops}
  </ol>

  ${tip(
    s.answers.length === 0
      ? "Every exercise has tiles with no letter at all. Saying “no letter” there earns more points than a lucky guess elsewhere."
      : streak >= 3
        ? `${streak} good answers in a row. Honest “can't tell” answers count, too.`
        : "Points for reading, and separate points for honesty. Both count.",
  )}

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
