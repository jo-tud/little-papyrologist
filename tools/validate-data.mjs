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
const EDUCELAB_SOURCES = ["grandprize", "firstletters", "firstscroll"];
const NULL_SHARE_MIN = 0.18; // about every fourth to fifth round
const NULL_KINDS = ["fibres", "streaks", "crack", "blot", "shuffle"];

const { letters: glyphs } = read("data/glyphs.yaml");
const { sources } = read("data/sources.yaml");
const stage0 = read("data/stage0.yaml");
const itemFile = read("data/items.yaml");
const items = itemFile.items ?? [];
const quizSets = itemFile.sets ?? [];
const { levels } = read("data/levels.yaml");
const levelIds = new Set(levels.map(l => l.level));
if (levelIds.size !== levels.length || levels.some((l, i) => l.level !== i + 1 || !l.title || !l.text))
  fail("levels: consecutive numbered levels with titles and descriptions required");
const active = it => !it.retired && !it.simulated && it.degradation === 0 && it.task !== "detect" && it.truth !== "*"
  && !quizSets.find(s => s.id === it.set)?.retired;
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

// The homepage reuses a verified, unaltered short reading and its image credits.
const heroItem = items.find(it => it.id === stage0.hero.item);
if (!heroItem || heroItem.task !== "read" || heroItem.simulated || heroItem.degradation !== 0
    || heroItem.uncertain?.length || !/^[ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϹΤΥΦΧΨΩ]{1,4}$/u.test(heroItem.truth))
  fail("hero: needs an existing, unaltered short reading without uncertain letters");

// Stage 0
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

// Quiz items, including retired records needed to interpret old answers.
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
    if (!it.answer_image && !(it.edition && it.source?.some(id => ["cerc54", "preprint1667"].includes(id)))) fail(`${where}: study needs a traced photo or a published edition`);
    if (it.choices !== undefined) fail(`${where}: study examples must not have answer choices`);
  }
  for (const key of ["id", "level", "image", "alt", "truth", "source", "license", "credit", "checked", "explain"])
    if (it[key] === undefined || it[key] === "" || it[key] === null) fail(`${where}: missing "${key}"`);
  if (itemIds.has(it.id)) fail(`${where}: duplicate id`);
  itemIds.add(it.id);
  if (!levelIds.has(it.level)) fail(`${where}: unknown level`);
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
  if (it.retired !== undefined && typeof it.retired !== "boolean") fail(`${where}: retired must be boolean`);
  if (it.optional_challenge !== undefined && (typeof it.optional_challenge !== "boolean" || it.task !== "read")) fail(`${where}: optional challenges must be reading tasks`);
  if (it.practice_group !== undefined && (typeof it.practice_group !== "string" || !/^[a-z0-9-]+$/.test(it.practice_group))) fail(`${where}: invalid practice group`);
  if (it.guide !== undefined && it.guide !== it.truth) fail(`${where}: guide must match the verified reading`);
  if (it.answer_image && !existsSync(new URL(`../public/images/${it.answer_image}`, import.meta.url))) fail(`${where}: answer image ${it.answer_image} not found`);
  checkSources(where, it.source);
  if (it.image && !existsSync(new URL(`../public/images/${it.image}`, import.meta.url))) fail(`${where}: image ${it.image} not found`);
  for (const key of ["reference_image", "reference_answer_image"]) {
    if (it[key] && !existsSync(new URL(`../public/images/${it[key]}`, import.meta.url))) fail(`${where}: missing ${key}`);
  }
}
const itemById = new Map(items.map((it) => [it.id, it]));
// Alphabet-only references keep their provenance, but must not enter scored rounds.
const referenceItems = read("data/alphabet-items.yaml").items;
const referenceConfig = read("data/crops.yaml").alphabet_references;
const referenceIds = new Set();
const expectedReferences = new Map([...referenceConfig.groups, ...referenceConfig.photographs].map(it => [it.id, it]));
for (const it of referenceItems) {
  const where = `alphabet reference ${it.id}`;
  const config = expectedReferences.get(it.id);
  if (!config || referenceIds.has(it.id) || itemById.has(it.id)) fail(`${where}: unknown or duplicate reference`);
  referenceIds.add(it.id);
  if (it.set !== "alphabet-reference" || it.task !== "study" || it.degradation !== 0 || it.simulated
      || it.uncertain?.length || !/^[ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϹΤΥΦΧΨΩ]+$/u.test(it.truth))
    fail(`${where}: references need an unaltered, confirmed published reading`);
  if (!it.source?.length || !it.explain || !it.alt || !it.reading || !it.changes || !DATE.test(String(it.checked)))
    fail(`${where}: incomplete provenance`);
  checkSources(where, it.source);
  if (!LICENSES.includes(it.license) || !it.credit?.includes("Vesuvius Challenge")
      || (it.source?.includes("grandprize") && !it.credit?.includes("EduceLab, University of Kentucky")))
    fail(`${where}: incomplete license or image credit`);
  for (const key of ["image", "answer_image"]) {
    if ((key === "image" && !it[key]) || (it[key] && !existsSync(new URL(`../public/images/${it[key]}`, import.meta.url))))
      fail(`${where}: missing ${key}`);
  }
  if (config?.indices) {
    const [start, end] = config.indices;
    if (it.edition !== config.edition || it.truth !== config.line_truth.slice(start, end)
        || JSON.stringify(it.edition_indices) !== JSON.stringify(config.indices)
        || JSON.stringify(it.source_crop) !== JSON.stringify(config.rect)
        || !it.source.includes("cerc54")) fail(`${where}: crop and edition mapping disagree`);
  } else if (config && (it.sample_id !== config.sample || !it.answer_image || !it.source.includes("profilometer"))) {
    fail(`${where}: photograph must retain its named sample and organizer tracing`);
  }
}
if (referenceIds.size !== expectedReferences.size) fail("alphabet: missing configured references");
for (const reference of referenceItems) itemById.set(reference.id, reference);
// Locations identify approximate letter areas, never additional readings.
const regionEntries = read("data/letter-regions.yaml").items;
const regionIds = new Set();
for (const entry of regionEntries) {
  const it = itemById.get(entry.id);
  const where = `letter locations ${entry.id}`;
  if (regionIds.has(entry.id)) fail(`${where}: duplicate ID`);
  regionIds.add(entry.id);
  if (!it || entry.truth !== it.truth || entry.image !== it.image
    || JSON.stringify(entry.source_crop) !== JSON.stringify(it.source_crop)) fail(`${where}: image, crop or reading changed`);
  if (!Array.isArray(entry.regions) || entry.regions.length !== Array.from(entry.truth).length) fail(`${where}: one region per edition position required`);
  else for (const box of entry.regions) {
    if (box !== null && (!Array.isArray(box) || box.length !== 4 || box.some(n => !Number.isFinite(n) || n < 0 || n > 1)
      || box[0] >= box[2] || box[1] >= box[3])) fail(`${where}: invalid normalized rectangle`);
  }
  if (!entry.checked || !Array.isArray(entry.source) || !entry.source.length
    || entry.source.some(id => !it?.source.includes(id))) fail(`${where}: missing source check`);
}
const regionImages = new Set(regionEntries.map(entry => `${entry.image}:${entry.truth}`));
const corpusConfig = existsSync(new URL("../data/corpus-lessons.yaml", import.meta.url)) ? read("data/corpus-lessons.yaml") : null;
const corpusManifests = corpusConfig ? corpusConfig.manifests.map(name => read(`data/${name}`)) : [];
const corpusEntries = new Map(corpusManifests.flatMap(manifest => manifest.items.map(it => [it.id, { ...it, original: manifest.sources[it.source_key] }])));
if (corpusEntries.size !== corpusManifests.reduce((count, manifest) => count + manifest.items.length, 0))
  fail("corpus: duplicate manifest item IDs");
const corpusLessons = corpusConfig?.lessons ?? [];
const corpusLessonIds = new Set();
const assignedCorpusIds = new Set();
for (const lesson of corpusLessons) {
  const where = `corpus lesson ${lesson.id}`;
  if (corpusLessonIds.has(lesson.id)) fail(`${where}: duplicate lesson ID`);
  corpusLessonIds.add(lesson.id);
  const matches = quizSets.filter(set => set.id === lesson.id);
  const generated = matches[0];
  if (matches.length !== 1 || generated.level !== lesson.level || generated.title !== lesson.title
    || generated.intro !== lesson.intro || generated.ordered !== true || generated.retired || generated.practice_only)
    fail(`${where}: generated lesson metadata differs; regenerate items`);
  if (!Array.isArray(lesson.items) || !lesson.items.length) {
    fail(`${where}: ordered item list required`); continue;
  }
  const generatedItems = items.filter(item => item.set === lesson.id);
  if (JSON.stringify(generatedItems.map(item => item.id)) !== JSON.stringify(lesson.items)
    || generatedItems.some(item => !item.corpus || item.level !== lesson.level || item.practice_only))
    fail(`${where}: generated membership, level or order differs; regenerate items`);
  for (const id of lesson.items) {
    if (!corpusEntries.has(id)) fail(`${where}: unknown item ${id}`);
    if (assignedCorpusIds.has(id)) fail(`${where}: item assigned more than once: ${id}`);
    assignedCorpusIds.add(id);
  }
}
for (const id of corpusEntries.keys())
  if (!assignedCorpusIds.has(id)) fail(`corpus ${id}: not assigned to a lesson`);
for (const item of items.filter(item => item.corpus))
  if (!corpusEntries.has(item.id) || !corpusLessonIds.has(item.set))
    fail(`corpus ${item.id}: generated item has no configured manifest and lesson`);
const corpusRegions = new Set();
for (const [id, entry] of corpusEntries) {
  const it = itemById.get(id), original = entry.original;
  const where = `corpus ${id}`;
  if (!it || !it.corpus || !active(it) || it.source_image !== original?.url || it.source_sha256 !== original?.sha256
    || JSON.stringify(it.source_crop) !== JSON.stringify(entry.rect)) {
    fail(`${where}: changed source or crop`); continue;
  }
  if (it.license !== original.license || it.credit !== original.credit
    || JSON.stringify(it.source) !== JSON.stringify(original.source_ids)) fail(`${where}: changed attribution`);
  const identity = `${original.sha256}:${entry.rect.join(",")}`;
  if (corpusRegions.has(identity)) fail(`${where}: repeated source rectangle`);
  corpusRegions.add(identity);
  if (!entry.checked || !["easy", "medium", "hard"].includes(entry.difficulty)) fail(`${where}: missing review or difficulty`);
  if (entry.blank) {
    if (it.truth !== "none" || it.task !== "read" || it.letter_regions?.length) fail(`${where}: invalid empty reading`);
  } else {
    if (it.edition !== entry.edition || it.truth !== entry.line_truth.slice(...entry.indices)
      || JSON.stringify(it.edition_indices) !== JSON.stringify(entry.indices)
      || JSON.stringify(it.letter_regions) !== JSON.stringify(entry.letter_regions)) fail(`${where}: changed edition mapping`);
    if (!Array.isArray(it.letter_regions) || it.letter_regions.length !== Array.from(it.truth).length
      || it.letter_regions.some(box => !Array.isArray(box) || box.length !== 4 || box.some(n => !Number.isFinite(n) || n < 0 || n > 1)
        || box[0] >= box[2] || box[1] >= box[3])) fail(`${where}: invalid letter locations`);
    regionImages.add(`${it.image}:${it.truth}`);
  }
}
for (const it of items) {
  if (it.task === "read" && it.truth !== "none" && active(it) && !it.practice_only && !quizSets.find(s => s.id === it.set)?.practice_only && it.truth.length > 4)
    fail(`item ${it.id}: required readings must be short groups`);
  if (["read", "identify"].includes(it.task) && it.truth !== "none" && it.truth.length <= 4
    && !regionImages.has(`${it.reference_image ?? it.image}:${it.truth}`)) fail(`item ${it.id}: short reading needs reviewed letter locations`);
}
for (const set of quizSets) {
  const steps = items.filter(it => it.set === set.id && !it.practice_only);
  if (steps.some((it, i) => it.optional_challenge && (i !== steps.length - 1 || !set.ordered)))
    fail(`set ${set.id}: an optional challenge must be the final ordered step`);
}
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
for (const level of levelIds) {
  // Guided first-letter recognition introduces real ink before blank-tile discrimination.
  // Optional practice is sampled with its own blank quota by planPractice.
  const list = items.filter((i) => i.level === level && active(i) && !i.practice_only
    && !quizSets.find(s => s.id === i.set)?.practice_only && !["identify", "study"].includes(i.task));
  if (list.length && share(list) < NULL_SHARE_MIN) fail(`level ${level}: only ${Math.round(100 * share(list))} % empty tiles`);
}

// Badges and ranks
const badgeIds = new Set();
function checkRequires(where, req) {
  if (!req || typeof req !== "object") return fail(`${where}: "requires" must be a map ({} for none)`);
  for (const [key, value] of Object.entries(req)) {
    if (!REQUIREMENT_KEYS.includes(key)) fail(`${where}: unknown condition "${key}"`);
    if (key === "levels_done" && !(Array.isArray(value) && value.every((l) => l === 0 || levelIds.has(l))))
      fail(`${where}: levels_done must list known levels`);
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

// Printed letters and shape aids must remain tied to known source examples.
const formChars = new Set();
for (const form of read("data/letter-forms.yaml").forms) {
  const example = itemById.get(form.example);
  if (formChars.has(form.char) || !glyphByChar.has(form.char) || !example?.truth.includes(form.char)
    || example.simulated || !form.sources?.length || !form.label) fail(`letter forms: invalid reference for ${form.char}`);
  formChars.add(form.char);
  checkSources(`letter forms ${form.char}`, form.sources);
  if (!form.paths?.length || form.paths.some(path => !/^[MmLlHhVvCcSsQqTtAaZz0-9.,\s-]+$/.test(path)))
    fail(`letter forms: invalid drawing for ${form.char}`);
}

if (errors.length) {
  console.error(`Data check failed (${errors.length}):\n  - ${errors.join("\n  - ")}`);
  process.exit(1);
}
console.log(`Data check passed: ${glyphs.length} letters, ${stage0.drills.length} drawn tiles (${Math.round(100 * share(stage0.drills))} % empty), ${items.length} quiz items, ${sources.length} sources, ${badges.length} badges, ${ranks.length} ranks.`);
