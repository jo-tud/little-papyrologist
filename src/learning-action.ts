import { activeQuizItems, itemSetVersion, LEVELS, playSets } from "./data";
import { isPracticeItem } from "./curriculum";
import { canResume } from "./round-session";
import { canStartFirstLine, levelAvailable } from "./rules";
import type { State } from "./store";

export function savedRoundLabel(s: State, id: string, version = itemSetVersion()): string | undefined {
  const saved = s.rounds?.[id];
  const match = id.match(/^practice-([1-9]\d*)(?:\/([a-z0-9-]+))?$/);
  const level = match ? Number(match[1]) : undefined;
  const group = match?.[2];
  const allowed = new Set(activeQuizItems.filter(item => level ? isPracticeItem(item, level, group)
    : item.set === id && !item.practice_only).map(item => item.id));
  return canResume(saved, version, allowed, s.answers)
    ? `Continue · ${saved.index + (saved.checked ? 1 : 0)}/${saved.item_ids.length}` : undefined;
}

/** The same next lesson and access rules on the path and the results page. */
export function learningAction(s: State): { href: string; label: string; setId?: string } {
  const startingLevel = s.levelOverride ?? 1;
  const version = itemSetVersion();
  const resume = (id: string) => savedRoundLabel(s, id, version);
  const firstLineOpen = canStartFirstLine(s);
  const available = playSets.filter(p => (levelAvailable(s, p.level) || (p.id === "first-line" && firstLineOpen))
    && (p.level > 0 || startingLevel === 0));
  const earlyReading = !levelAvailable(s, 2) && firstLineOpen && resume("first-line")
    ? available.find(p => p.id === "first-line") : undefined;
  const next = earlyReading ?? available.find(p => p.level >= startingLevel && resume(p.id))
    ?? available.find(p => !s.setsDone[p.id] && p.level >= startingLevel)
    ?? available.find(p => resume(p.id))
    ?? available.find(p => !s.setsDone[p.id]);
  if (!s.setsDone["alphabet-seen"] && startingLevel === 0) return { href: "#/alphabet", label: "Explore the alphabet" };
  if (next) return {
    href: next.href,
    setId: next.id,
    label: resume(next.id) ? `Continue: ${next.title}`
      : next.id === "first-letters-500p2" ? "Start with real letters" : `Next: ${next.title}`,
  };
  const level = [...LEVELS].reverse().find(entry => levelAvailable(s, entry.level))?.level;
  return level ? { href: `#/practice/${level}`, label: `Practise level ${level}` }
    : { href: "#/alphabet", label: "Explore the alphabet" };
}
