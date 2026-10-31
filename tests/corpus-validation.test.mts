import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse, stringify } from "yaml";

const root = fileURLToPath(new URL("../", import.meta.url));

function validateChangedLessons(change: (lessons: any) => void) {
  const fixture = mkdtempSync(join(tmpdir(), "papyrologist-corpus-validation-"));
  try {
    mkdirSync(join(fixture, "tools"));
    cpSync(join(root, "tools/validate-data.mjs"), join(fixture, "tools/validate-data.mjs"));
    cpSync(join(root, "data"), join(fixture, "data"), { recursive: true });
    symlinkSync(join(root, "public"), join(fixture, "public"), "dir");
    symlinkSync(join(root, "node_modules"), join(fixture, "node_modules"), "dir");
    const path = join(fixture, "data/corpus-lessons.yaml");
    const config = parse(readFileSync(path, "utf8"));
    change(config.lessons);
    writeFileSync(path, stringify(config));
    return spawnSync(process.execPath, [join(fixture, "tools/validate-data.mjs")], { encoding: "utf8" });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("Data validation rejects a changed corpus lesson order until the generated items are updated", () => {
  const result = validateChangedLessons(lessons => lessons[0].items.reverse());
  assert.equal(result.status, 1);
  assert.match(result.stderr, /generated membership, level or order differs/);
});

test("Data validation rejects stale generated lesson metadata", () => {
  const result = validateChangedLessons(lessons => { lessons[0].title = "A revised lesson title"; });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /generated lesson metadata differs/);
});

test("Every reviewed corpus item must remain assigned exactly once", () => {
  const missing = validateChangedLessons(lessons => lessons[0].items.pop());
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /not assigned to a lesson/);
  const duplicated = validateChangedLessons(lessons => lessons[1].items.push(lessons[0].items[0]));
  assert.equal(duplicated.status, 1);
  assert.match(duplicated.stderr, /item assigned more than once/);
});
