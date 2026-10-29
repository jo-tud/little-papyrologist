import assert from "node:assert/strict";
import test from "node:test";
import { answerKey, canResume, validSession } from "../src/round-session.ts";
import type { RoundSession } from "../src/round-session.ts";
import type { AnswerRecord } from "../src/types.ts";
const answer: AnswerRecord = { item_id: "a", task: "read", level: 2, degradation: 0,
  said_text: "yes", letters: "ΙΗ", confidence: 2, ms: 8000, answered_at: "2026-10-29T08:00:00Z",
  truth: "ΙΗ", text_correct: true, letters_correct: true, verdict: "right", reading_points: 3, honesty_points: 0 };
const session: RoundSession = { version: "abc", item_ids: ["a", "b"], index: 0,
  answer_keys: [answerKey(answer)], draft: { said: "yes", letters: ["Ι", "Η"], confidence: 2 },
  checked: true, help_used: false, elapsed_ms: 8000 };
test("Resume preserves checked feedback, exact order and saved answer identity", () => {
  const restored = JSON.parse(JSON.stringify(session));
  assert.ok(canResume(restored, "abc", new Set(["a", "b"]), [answer]));
  assert.deepEqual(restored.item_ids, ["a", "b"]);
  assert.equal(canResume(restored, "new-version", new Set(["a", "b"]), [answer]), false);
  assert.equal(canResume(restored, "abc", new Set(["a"]), [answer]), false);
  assert.equal(canResume(restored, "abc", new Set(["a", "b"]), []), false);
  assert.equal(canResume({ ...restored, index: 1 }, "abc", new Set(["a", "b"]), [answer]), false);
  assert.equal(canResume({ ...restored, draft: { ...restored.draft, letters: ["Ν"] } }, "abc", new Set(["a", "b"]), [answer]), false);
});
test("Resume accepts a partial draft and rejects broken or unsafe saved data", () => {
  assert.ok(canResume({ ...session, checked: false, index: 1, draft: { letters: ["?"] } }, "abc", new Set(["a", "b"]), [answer]));
  for (const malformed of [null, {}, { ...session, index: -1 }, { ...session, index: 2 },
    { ...session, elapsed_ms: Infinity }, { ...session, item_ids: ["a", "a"] },
    { ...session, draft: { letters: ["<script>"] } }, { ...session, draft: { letters: ["Ι"], confidence: 4 } },
    { ...session, checked: true, draft: { letters: ["Ι"] } }]) assert.equal(validSession(malformed), false);
});
