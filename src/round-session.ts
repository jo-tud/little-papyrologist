import type { AnswerRecord, SaidText } from "./types";

/** A paused round keeps its exact order and draft; scored answers remain in history. */
export interface RoundSession {
  version: string;
  item_ids: string[];
  index: number;
  answer_keys: string[];
  draft: { said?: SaidText; letters: string[]; confidence?: 1 | 2 | 3 };
  checked: boolean;
  help_used: boolean;
  elapsed_ms: number;
}

export const answerKey = (a: AnswerRecord): string => `${a.item_id}@${a.answered_at}`;

/** Validate untrusted browser/backup data before using it to restore a round. */
export function validSession(value: unknown): value is RoundSession {
  if (!value || typeof value !== "object") return false;
  const r = value as RoundSession;
  return typeof r.version === "string" && Array.isArray(r.item_ids) && r.item_ids.length > 0 && r.item_ids.length <= 500
    && r.item_ids.every(id => typeof id === "string" && /^[a-z0-9-]+$/.test(id))
    && new Set(r.item_ids).size === r.item_ids.length
    && Number.isInteger(r.index) && r.index >= 0 && r.index < r.item_ids.length
    && Array.isArray(r.answer_keys) && r.answer_keys.every(key => typeof key === "string")
    && !!r.draft && Array.isArray(r.draft.letters) && r.draft.letters.length <= 500
    && r.draft.letters.every(letter => typeof letter === "string" && /^[Α-ΩϹ?]$/.test(letter))
    && (r.draft.said === undefined || ["yes", "no", "unsure"].includes(r.draft.said))
    && (r.draft.confidence === undefined || [1, 2, 3].includes(r.draft.confidence))
    && typeof r.checked === "boolean" && (!r.checked || (!!r.draft.said && !!r.draft.confidence))
    && typeof r.help_used === "boolean" && Number.isFinite(r.elapsed_ms) && r.elapsed_ms >= 0;
}

/** Reject changed material or missing history; never fabricate a completed answer. */
export function canResume(r: unknown, version: string, allowedIds: Set<string>, answers: AnswerRecord[]): r is RoundSession {
  if (!validSession(r) || r.version !== version || !r.item_ids.every(id => allowedIds.has(id))) return false;
  const known = new Set(answers.map(answerKey));
  if (!r.answer_keys.every(key => known.has(key))) return false;
  if (r.checked) {
    const last = answers.find(a => answerKey(a) === r.answer_keys.at(-1));
    if (!last || last.item_id !== r.item_ids[r.index] || last.letters !== r.draft.letters.join("")
      || last.said_text !== r.draft.said || last.confidence !== r.draft.confidence) return false;
  }
  return true;
}
