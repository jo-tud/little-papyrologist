// Checks the data files before every build. Run: node tools/validate-data.mjs
// Fails when an exercise or quiz item lacks a reliable answer, a source, a license or a check date.
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

const read = (p) => parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const errors = [];
const fail = (msg) => errors.push(msg);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LICENSES = ["CC BY-NC 4.0"];
// Credits the Vesuvius Challenge asked for (email of 2026-10-28, see LICENSES.md).
const EDUCELAB_SOURCES = ["grandprize", "firstletters"];
const NULL_SHARE_MIN = 0.18; // about every fourth to fifth round
const NULL_KINDS = ["fibres", "streaks", "crack", "blot", "shuffle"];

const { letters: glyphs } = read("data/glyphs.yaml");
const { sources } = read("data/sources.yaml");
const stage0 = read("data/stage0.yaml");
const itemFile = read("data/items.yaml");
const items = itemFile.items ?? [];
const quizSets = itemFile.sets ?? [];
const { badges } = read("data/badges.yaml");
const { ranks } = read("data/ranks.yaml");
// Keep in step with REQUIREMENT_KEYS in src/rules.ts.
const REQUIREMENT_KEYS = ["answers", "points", "honesty_points", "sets_done", "levels_done", "honest_calls",
  "letters_right", "empty_streak", "clean_streak", "false_alarms", "calibration", "badges"];

// Sources
const sourceIds = new Set();
for (const s of sources) {
  if (sourceIds.has(s.id)) fail(`sources: duplicate id ${s.id}`);
  sourceIds.add(s.id);
  if (!DATE.test(String(s.checked))) fail(`sources: ${s.id} has no valid "checked" date`);
  if (s.kind !== "book" && s.kind !== "own" && !s.url) fail(`sources: ${s.id} has no url`);
  if (s.kind === "related" && !s.note) fail(`sources: related project ${s.id} needs a one-sentence note`);
}
const checkSources = (where, ids = []) => ids.forEach((id) => sourceIds.has(id) || fail(`${where}: unknown source "${id}"`));

// Letters
const glyphByChar = new Map(glyphs.map((g) => [g.char, g]));
if (glyphs.length !== 24) fail(`glyphs: expected 24 letters (Ϲ for sigma), found ${glyphs.length}`);
for (const g of glyphs) {
  if (!g.look_for) fail(`glyphs: ${g.char} has no "look_for" text`);
  if (!g.strokes || !Object.keys(g.strokes).length) fail(`glyphs: ${g.char} has no strokes`);
}

// Stage 0
checkSources("hero", stage0.hero.sources);
for (const f of [...stage0.facts, ...stage0.fieldnotes]) {
  if (!f.title || !f.text) fail(`fact ${f.id}: needs title and text`);
  if (!f.sources?.length) fail(`fact ${f.id}: no source`);
  checkSources(`fact ${f.id}`, f.sources);
}
const groupById = new Map(stage0.groups.map((g) => [g.id, g]));
for (const g of stage0.groups) checkSources(`group ${g.id}`, g.sources);
const drillIds = new Set();
for (const d of stage0.drills) {
  const where = `drill ${d.id}`;
  if (drillIds.has(d.id)) fail(`${where}: duplicate id`);
  drillIds.add(d.id);
  const group = groupById.get(d.group);
  if (!group) fail(`${where}: unknown group ${d.group}`);
  if (!d.explain) fail(`${where}: no explanation`);
  checkSources(where, d.sources);
  if (d.draw.letter) {
    const g = glyphByChar.get(d.draw.letter);
    if (!g) fail(`${where}: no drawing for ${d.draw.letter}`);
    for (const h of d.draw.hide ?? []) if (g && !g.strokes[h]) fail(`${where}: ${d.draw.letter} has no stroke "${h}"`);
  } else if (!NULL_KINDS.includes(d.draw.empty)) fail(`${where}: draws neither a letter nor a known empty tile`);
  for (const [letter, stroke] of d.draw.pieces ?? [])
    if (!glyphByChar.get(letter)?.strokes[stroke]) fail(`${where}: piece ${letter}.${stroke} does not exist`);
  if (d.truth === "none") {
    if (d.draw.letter) fail(`${where}: truth is "none" but a letter is drawn`);
  } else if (d.truth === "?") {
    if (!d.candidates || d.candidates.length < 2) fail(`${where}: "?" needs at least two candidates`);
    for (const c of d.candidates ?? []) if (group && !group.letters.includes(c)) fail(`${where}: candidate ${c} is not in the group`);
  } else if (group && !group.letters.includes(d.truth)) fail(`${where}: truth ${d.truth} is not one of the group's letters`);
}
const share = (list) => list.filter((x) => x.truth === "none").length / Math.max(1, list.length);
if (share(stage0.drills) < NULL_SHARE_MIN) fail(`stage 0: only ${Math.round(100 * share(stage0.drills))} % empty tiles`);

// Quiz items (levels 1–3)
const itemIds = new Set();
for (const it of items) {
  const where = `item ${it.id ?? "(no id)"}`;
  if (!["read", "detect", "identify", "study"].includes(it.task)) fail(`${where}: unknown task`);
  if (["identify", "study"].includes(it.task)) {
    if (typeof it.truth !== "string" || !it.truth || it.truth === "none" || it.truth.includes("*") || it.truth.includes("?") || it.uncertain?.length)
      fail(`${where}: guided photographs need a confirmed letter reading`);
    for (const key of ["preparation", "stage"])
      if (typeof it[key] !== "string" || !it[key].trim()) fail(`${where}: guided photographs need "${key}"`);
  }
  if (it.task === "identify") {
    if (!Array.isArray(it.choices) || it.choices.length < 2 || new Set(it.choices).size !== it.choices.length || !it.choices.includes(it.truth))
      fail(`${where}: identification needs at least two distinct choices including the published reading`);
    for (const key of ["question", "hint"])
      if (typeof it[key] !== "string" || !it[key].trim()) fail(`${where}: identification needs "${key}"`);
  }
  if (it.task === "study") {
    if (!it.answer_image && !(it.edition && it.source?.includes("cerc54"))) fail(`${where}: study needs a traced photo or a published edition`);
    if (it.choices !== undefined) fail(`${where}: study examples must not have answer choices`);
  }
  for (const key of ["id", "level", "image", "alt", "truth", "source", "license", "credit", "checked", "explain"])
    if (it[key] === undefined || it[key] === "" || it[key] === null) fail(`${where}: missing "${key}"`);
  if (itemIds.has(it.id)) fail(`${where}: duplicate id`);
  itemIds.add(it.id);
  if (![1, 2, 3].includes(it.level)) fail(`${where}: level must be 1, 2 or 3`);
  if (!Number.isInteger(it.degradation ?? 0)) fail(`${where}: degradation must be a whole number`);
  if (!LICENSES.includes(it.license)) fail(`${where}: license "${it.license}" is not cleared for this repo`);
  if (typeof it.credit === "string" && !it.credit.includes("Vesuvius Challenge")) fail(`${where}: credit must name the Vesuvius Challenge`);
  if ((it.source ?? []).some((s) => EDUCELAB_SOURCES.includes(s)) && !String(it.credit).includes("EduceLab"))
    fail(`${where}: images of Scrolls 1–4 must also credit EduceLab`);
  if (!DATE.test(String(it.checked))) fail(`${where}: "checked" must be a date`);
  if (typeof it.truth === "string" && it.truth !== "none" && it.truth !== "*" && !/^[ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϹΤΥΦΧΨΩ?]+$/u.test(it.truth))
    fail(`${where}: truth must be capitals (Ϲ for sigma), "?", "*" (ink, letters unconfirmed) or "none"`);
  for (const u of it.uncertain ?? []) if (!Number.isInteger(u) || u < 0 || u >= [...it.truth].length) fail(`${where}: uncertain position ${u} is outside the reading`);
  if (!quizSets.some((s) => s.id === it.set)) fail(`${where}: unknown set "${it.set}"`);
  if (quizSets.find((s) => s.id === it.set)?.level !== it.level) fail(`${where}: item and set levels differ`);
  if (it.practice_only !== undefined && typeof it.practice_only !== "boolean") fail(`${where}: practice_only must be boolean`);
  if (it.guide !== undefined && it.guide !== it.truth) fail(`${where}: guide must match the verified reading`);
  if (it.answer_image && !existsSync(new URL(`../public/images/${it.answer_image}`, import.meta.url))) fail(`${where}: answer image ${it.answer_image} not found`);
  checkSources(where, it.source);
  if (it.image && !existsSync(new URL(`../public/images/${it.image}`, import.meta.url))) fail(`${where}: image ${it.image} not found`);
  for (const key of ["reference_image", "reference_answer_image"]) {
    if (it[key] && !existsSync(new URL(`../public/images/${it[key]}`, import.meta.url))) fail(`${where}: missing ${key}`);
  }
}
const itemById = new Map(items.map((it) => [it.id, it]));
for (const it of items) {
  if (it.base_item && !itemById.has(it.base_item)) fail(`item ${it.id}: unknown base_item`);
  if (it.simulated) {
    const base = itemById.get(it.base_item);
    if (!base || base.degradation !== 0 || !it.degradation_recipe || !it.reference_image || it.reference_image !== base.image)
      fail(`item ${it.id}: simulated views need an unaltered base, reference and recipe`);
    if (it.degradation < 1 || it.degradation > 5 || it.level !== 3) fail(`item ${it.id}: invalid simulated difficulty`);
    if (it.task === "read" && (it.truth !== base?.truth || it.degradation > 3)) fail(`item ${it.id}: unsupported altered reading`);
    if (JSON.stringify(it.source) !== JSON.stringify(base?.source) || it.credit !== base?.credit || it.license !== base?.license)
      fail(`item ${it.id}: altered views must preserve source attribution`);
  }
  if (it.compare_with === undefined) continue;
  const comparison = itemById.get(it.compare_with);
  if (!comparison || !["identify", "study"].includes(comparison.task) || comparison.truth !== it.truth)
    fail(`item ${it.id}: comparison must reference a guided photograph with the same reading`);
}
for (const level of [1, 2, 3]) {
  // Guided first-letter recognition introduces real ink before blank-tile discrimination.
  // Optional practice is sampled with its own blank quota by planPractice.
  const list = items.filter((i) => i.level === level && !i.practice_only && !["identify", "study"].includes(i.task));
  if (list.length && share(list) < NULL_SHARE_MIN) fail(`level ${level}: only ${Math.round(100 * share(list))} % empty tiles`);
}

// Badges and ranks
const badgeIds = new Set();
function checkRequires(where, req) {
  if (!req || typeof req !== "object") return fail(`${where}: "requires" must be a map ({} for none)`);
  for (const [key, value] of Object.entries(req)) {
    if (!REQUIREMENT_KEYS.includes(key)) fail(`${where}: unknown condition "${key}"`);
    if (key === "levels_done" && !(Array.isArray(value) && value.every((l) => [0, 1, 2, 3].includes(l))))
      fail(`${where}: levels_done must list levels 0–3`);
    if (key === "badges") for (const id of value ?? []) if (!badgeIds.has(id)) fail(`${where}: unknown badge "${id}"`);
    if (key === "letters_right") for (const l of value?.letters ?? []) if (!glyphByChar.has(l)) fail(`${where}: unknown letter ${l}`);
  }
}
for (const b of badges) {
  if (badgeIds.has(b.id)) fail(`badge ${b.id}: duplicate id`);
  badgeIds.add(b.id);
  if (!b.title || !b.how) fail(`badge ${b.id}: needs a title and a "how"`);
}
for (const b of badges) checkRequires(`badge ${b.id}`, b.requires);
const rankIds = new Set();
ranks.forEach((r, i) => {
  if (rankIds.has(r.id)) fail(`rank ${r.id}: duplicate id`);
  rankIds.add(r.id);
  if (!r.title || !r.blurb) fail(`rank ${r.id}: needs a title and a blurb`);
  checkRequires(`rank ${r.id}`, r.requires);
  checkSources(`rank ${r.id}`, r.sources);
  if (i === 0 && Object.keys(r.requires ?? {}).length) fail(`rank ${r.id}: the first rank must have no conditions`);
});

if (errors.length) {
  console.error(`Data check failed (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Data check passed: ${glyphs.length} letters, ${stage0.drills.length} drawn tiles (${Math.round(100 * share(stage0.drills))} % empty), ${items.length} quiz items, ${sources.length} sources, ${badges.length} badges, ${ranks.length} ranks.`);
