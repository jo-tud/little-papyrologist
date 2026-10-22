import { rankStatus, updateProgress, type ProgressNews } from "./badges";
import { rankDefs } from "./data";
import { grantBadges, grantRanks, state } from "./store";
import { rankSeal, refreshRankChip, toast } from "./ui";
import { esc } from "./util";

export function syncRankChip(): void {
  const st = rankStatus(state());
  refreshRankChip(esc(st.rank.title), st.index + 1);
}

/** Grants what was earned, shows toasts, and returns the news for the page to show. */
export function progressAfterAnswer(): ProgressNews {
  const news = updateProgress(state(), grantBadges, grantRanks);
  for (const b of news.badges) toast(`New badge: ${b.title}`);
  if (news.rank) toast(`New rank: ${news.rank.title}`);
  syncRankChip();
  return news;
}

/** The stamped banner shown when a new rank is reached. */
export function rankUpBanner(rankId: string): string {
  const i = rankDefs.findIndex((r) => r.id === rankId);
  const r = rankDefs[i];
  if (!r) return "";
  return `<div class="rank-up" role="status">
    ${rankSeal(i + 1, "current")}
    <p><strong>New rank: ${esc(r.title)}.</strong> ${esc(r.blurb)} <a href="#/ranks">See all ranks</a></p>
  </div>`;
}
