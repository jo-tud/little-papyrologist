import type { AnswerRecord } from "./types";

const KEY = "little-papyrologist:v1";

export interface State {
  answers: AnswerRecord[];
  badges: Record<string, string>; // badge id -> date earned
  setsDone: Record<string, number>; // set id -> times finished
}

function empty(): State {
  return { answers: [], badges: {}, setsDone: {} };
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

export function grantBadges(ids: string[]): string[] {
  const fresh = ids.filter((id) => !memory.badges[id]);
  const today = new Date().toISOString().slice(0, 10);
  for (const id of fresh) memory.badges[id] = today;
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
