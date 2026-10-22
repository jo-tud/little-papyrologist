import { rankChecks, rankStatus } from "../badges";
import { rankDefs } from "../data";
import type { Check } from "../rules";
import { state } from "../store";
import { rankSeal, sourceLinks, tip } from "../ui";
import { esc } from "../util";

/** A checklist of conditions with small progress bars. */
export function checksList(checks: Check[]): string {
  if (!checks.length) return "";
  return `<ul class="checks">${checks
    .map(
      (c) => `<li class="${c.met ? "met" : ""}">
        <span class="tick" aria-hidden="true">${c.met ? "✓" : "○"}</span>
        <span>${esc(c.text)}${c.need > 1 && !c.met ? ` <span class="muted">(${c.have} of ${c.need})</span>` : ""}<span class="visually-hidden">${c.met ? ", done" : ", not yet"}</span></span>
        ${c.need > 1 && !c.met ? `<span class="bar" aria-hidden="true"><span style="width:${(100 * c.have) / c.need}%"></span></span>` : ""}
      </li>`,
    )
    .join("")}</ul>`;
}

export function renderRanks(main: HTMLElement): void {
  const s = state();
  const now = rankStatus(s);

  main.innerHTML = `
  <h1>Ranks</h1>
  <p>Ranks follow your path through the levels. You move up by reading well and by being honest
  about what you cannot see. A rank once reached stays yours.</p>
  ${tip("The last rank is a secret. You will know it when you get there.")}
  <ol class="ladder">
    ${rankDefs
      .map((r, i) => {
        const reached = i <= now.index;
        const hidden = r.secret && !reached;
        const seal = rankSeal(i + 1, i === now.index ? "current" : reached ? "reached" : "locked");
        const checks = reached ? [] : rankChecks(r, s);
        const isNext = i === now.index + 1;
        const later = !reached && !isNext && !hidden
          ? `<p class="small muted">Needs: ${checks.filter((c) => !c.met).map((c) => esc(c.text.charAt(0).toLowerCase() + c.text.slice(1))).join("; ")}.</p>`
          : "";
        return `<li class="${i === now.index ? "is-current" : ""}">
          ${seal}
          <div>
            <h2>${hidden ? "???" : esc(r.title)}${i === now.index ? ` <span class="muted small">(your rank)</span>` : ""}</h2>
            <p>${hidden ? "A surprise for the very end." : esc(r.blurb)}</p>
            ${!hidden && r.sources?.length ? `<p class="cite">Source: ${sourceLinks(r.sources)}</p>` : ""}
            ${isNext && !hidden ? checksList(checks) : later}
          </div>
        </li>`;
      })
      .join("")}
  </ol>`;
}
