// Checks the data files before every build. Run: node tools/validate-data.mjs
// Fails when an exercise or quiz item lacks a reliable answer, a source, a license or a check date.
import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";

const read = (p) => parse(readFileSync(new URL(`../${p}`, import.meta.url), "utf8"));
const errors = [];
const fail = (msg) => errors.push(msg);
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const LICENSES = ["CC BY-NC 4.0"];
const NULL_SHARE_MIN = 0.18; // about every fourth to fifth round
const NULL_KINDS = ["fibres", "streaks", "crack", "blot", "shuffle"];

const { letters: glyphs } = read("data/glyphs.yaml");
const { sources } = read("data/sources.yaml");
const stage0 = read("data/stage0.yaml");
const items = read("data/items.yaml").items ?? [];

// Sources
const sourceIds = new Set();
for (const s of sources) {
  if (sourceIds.has(s.id)) fail(`sources: duplicate id ${s.id}`);
  sourceIds.add(s.id);
  if (!DATE.test(String(s.checked))) fail(`sources: ${s.id} has no valid "checked" date`);
  if (s.kind !== "book" && s.kind !== "own" && !s.url) fail(`sources: ${s.id} has no url`);
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
for (const f of stage0.facts) {
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
  for (const key of ["id", "level", "image", "alt", "truth", "source", "license", "checked", "explain"])
    if (it[key] === undefined || it[key] === "" || it[key] === null) fail(`${where}: missing "${key}"`);
  if (itemIds.has(it.id)) fail(`${where}: duplicate id`);
  itemIds.add(it.id);
  if (![1, 2, 3].includes(it.level)) fail(`${where}: level must be 1, 2 or 3`);
  if (!Number.isInteger(it.degradation ?? 0)) fail(`${where}: degradation must be a whole number`);
  if (!LICENSES.includes(it.license)) fail(`${where}: license "${it.license}" is not cleared for this repo`);
  if (!DATE.test(String(it.checked))) fail(`${where}: "checked" must be a date`);
  if (typeof it.truth === "string" && it.truth !== "none" && !/^[ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϹΤΥΦΧΨΩ?]+$/u.test(it.truth))
    fail(`${where}: truth must be capitals (Ϲ for sigma), "?" or "none"`);
  checkSources(where, it.source);
  if (it.image && !existsSync(new URL(`../data/images/${it.image}`, import.meta.url))) fail(`${where}: image ${it.image} not found`);
}
for (const level of [1, 2, 3]) {
  const list = items.filter((i) => i.level === level);
  if (list.length && share(list) < NULL_SHARE_MIN) fail(`level ${level}: only ${Math.round(100 * share(list))} % empty tiles`);
}

if (errors.length) {
  console.error(`Data check failed (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Data check passed: ${glyphs.length} letters, ${stage0.drills.length} drawn tiles (${Math.round(100 * share(stage0.drills))} % empty), ${items.length} quiz items, ${sources.length} sources.`);
