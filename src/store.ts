import type { AnswerRecord } from "./types";
import { canResume, validSession, type RoundSession } from "./round-session";
import { availableLevelNumbers } from "./data";

const KEY = "little-papyrologist:v1";

export interface State {
  answers: AnswerRecord[];
  badges: Record<string, string>; // badge id -> date earned
  ranks: Record<string, string>; // rank id -> date reached; a rank once reached is kept
  setsDone: Record<string, number>; // set id -> times finished
  introSkipped?: boolean;
  levelOverride?: number;
  rounds?: Record<string, RoundSession>;
}

function empty(): State {
  return { answers: [], badges: {}, ranks: {}, setsDone: {} };
}

let memory: State = empty();
let persistent = true;

/** Reads the saved state. Falls back to memory when storage is blocked or broken. */
export function load(): State {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<State>;
      memory = { ...empty(), ...parsed };
      if (!availableLevelNumbers.includes(memory.levelOverride ?? -1)) delete memory.levelOverride;
      memory.rounds = cleanRounds(parsed.rounds);
    }
  } catch {
    persistent = false;
  }
  return memory;
}

export function save(): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
  } catch {
    persistent = false;
  }
}

export function state(): State {
  return memory;
}

export function isPersistent(): boolean {
  return persistent;
}

export function addAnswer(a: AnswerRecord): void {
  memory.answers.push(a);
  save();
}

export function markSetDone(id: string): void {
  memory.setsDone[id] = (memory.setsDone[id] ?? 0) + 1;
  save();
}

function cleanRounds(value: unknown): Record<string, RoundSession> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(Object.entries(value).filter(([key, round]) =>
    /^[a-z0-9/-]+$/.test(key) && validSession(round)));
}

export function saveRound(id: string, round: RoundSession): void {
  memory.rounds ??= {};
  memory.rounds[id] = round;
  save();
}

export function clearRound(id: string): void {
  if (memory.rounds) delete memory.rounds[id];
  save();
}

/** Opens real images without claiming that the introductory exercises were completed. */
export function skipIntro(): void {
  memory.introSkipped = true;
  if (memory.levelOverride === 0) delete memory.levelOverride;
  save();
}

export function setLevelOverride(level?: number): void {
  if (level === undefined) delete memory.levelOverride;
  else if (availableLevelNumbers.includes(level)) memory.levelOverride = level;
  save();
}

export function grantBadges(ids: string[]): string[] {
  const fresh = ids.filter((id) => !memory.badges[id]);
  const today = new Date().toISOString().slice(0, 10);
  for (const id of fresh) memory.badges[id] = today;
  if (fresh.length) save();
  return fresh;
}

export function grantRanks(ids: string[]): string[] {
  const fresh = ids.filter((id) => !memory.ranks[id]);
  const today = new Date().toISOString().slice(0, 10);
  for (const id of fresh) memory.ranks[id] = today;
  if (fresh.length) save();
  return fresh;
}

export function clearAll(): void {
  memory = empty();
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    persistent = false;
  }
}

/** Everything needed to move progress to another browser. */
export function exportPayload(appVersion: string, itemSet: string): object {
  return {
    app: "little-papyrologist",
    format: 1,
    app_version: appVersion,
    item_set: itemSet,
    exported_at: new Date().toISOString(),
    note: "Answers from The Little Papyrologist. Level 0 tiles are drawings made for the trainer. A null confidence means confidence was not asked.",
    answers: memory.answers,
    progress: { sets_done: memory.setsDone, badges: memory.badges, ranks: memory.ranks, intro_skipped: !!memory.introSkipped, level_override: memory.levelOverride, rounds: memory.rounds },
  };
}

export interface ImportResult {
  added: number;
  duplicates: number;
  skipped: number;
}

const SAID = new Set(["yes", "no", "unsure"]);

function validAnswer(a: unknown): a is AnswerRecord {
  if (!a || typeof a !== "object") return false;
  const r = a as Record<string, unknown>;
  return (
    typeof r.item_id === "string" &&
    typeof r.level === "number" &&
    typeof r.degradation === "number" &&
    SAID.has(r.said_text as string) &&
    typeof r.letters === "string" &&
    (r.confidence === null || [1, 2, 3].includes(r.confidence as number)) &&
    typeof r.ms === "number" &&
    typeof r.answered_at === "string" &&
    typeof r.truth === "string" &&
    typeof r.verdict === "string" &&
    typeof r.reading_points === "number" &&
    typeof r.honesty_points === "number"
  );
}

function mergeDates(into: Record<string, string>, from: unknown): void {
  if (!from || typeof from !== "object") return;
  for (const [id, date] of Object.entries(from as Record<string, unknown>)) {
    if (typeof date !== "string") continue;
    if (!into[id] || date < into[id]) into[id] = date;
  }
}

/**
 * Merges an exported file into the current progress. Nothing is overwritten:
 * answers already present (same tile, same moment) are kept once.
 * Throws an Error with a readable message when the text is not an export of this trainer.
 */
export function importText(text: string, currentItemSet?: string): ImportResult {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("This is not a valid JSON file.");
  }
  if (!data || data.app !== "little-papyrologist" || !Array.isArray(data.answers))
    throw new Error("This file was not exported from The Little Papyrologist.");

  const seen = new Set(memory.answers.map((a) => `${a.item_id}@${a.answered_at}`));
  const result: ImportResult = { added: 0, duplicates: 0, skipped: 0 };
  for (const a of data.answers as unknown[]) {
    if (!validAnswer(a)) {
      result.skipped++;
      continue;
    }
    const key = `${a.item_id}@${a.answered_at}`;
    if (seen.has(key)) {
      result.duplicates++;
      continue;
    }
    seen.add(key);
    memory.answers.push({ ...a, letters_correct: a.letters_correct ?? null, text_correct: !!a.text_correct });
    result.added++;
  }
  memory.answers.sort((x, y) => x.answered_at.localeCompare(y.answered_at));

  const progress = (data.progress ?? {}) as Record<string, unknown>;
  // Prefer an active local round, but do not let an obsolete one hide a valid backup.
  const incomingRounds = cleanRounds(progress.rounds);
  const mergedRounds = { ...incomingRounds };
  const usable = (round: RoundSession): boolean => !!currentItemSet
    && canResume(round, currentItemSet, new Set(round.item_ids), memory.answers);
  for (const [id, local] of Object.entries(memory.rounds ?? {})) {
    if (!incomingRounds[id] || !currentItemSet || usable(local) || !usable(incomingRounds[id])) mergedRounds[id] = local;
  }
  memory.rounds = mergedRounds;
  if (progress.intro_skipped === true) memory.introSkipped = true;
  if (memory.levelOverride === undefined && availableLevelNumbers.includes(progress.level_override as number))
    memory.levelOverride = progress.level_override as number;
  const sets = progress.sets_done;
  if (sets && typeof sets === "object")
    for (const [id, n] of Object.entries(sets as Record<string, unknown>))
      if (typeof n === "number" && n > 0) memory.setsDone[id] = Math.max(memory.setsDone[id] ?? 0, Math.floor(n));
  mergeDates(memory.badges, progress.badges);
  mergeDates(memory.ranks, progress.ranks);
  save();
  return result;
}
