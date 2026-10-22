// Stops anything private from reaching the public repo or the built site.
//   node tools/check-public.mjs          checks all files git would publish, plus commit messages
//   node tools/check-public.mjs --dist   checks the built site in dist/
//
// Two rule sets:
//   1. General rules below (local paths, ticket numbers, chat links …).
//   2. Project-specific words in private/denylist.txt, one regular expression per line.
//      That file is never committed, so the list itself stays private.
//      Without it the check fails, except in CI (set CI=true), where only the general rules run.
import { execSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const SELF = "tools/check-public.mjs";
const BINARY = /\.(png|jpe?g|webp|gif|ico|woff2?|ttf|otf|zip|gz|pdf)$/i;

const GENERAL = [
  { id: "home-path", re: /\/home\/[a-z_][\w-]*/g },
  { id: "user-dir", re: /~\/(projects|Dokumente|Documents|Desktop)\b/g },
  { id: "scratch-path", re: /\/tmp\/cl[a]ude|\/var\/tmp\//g },
  { id: "ticket-number", re: /\b[A-Z]{2,6}-\d{2,6}\b/g, allow: ["SHA-256", "ISO-8601"] },
  { id: "finding-number", re: /\bF-\d{2,4}\b/g },
  { id: "chat-link", re: /discord(app)?\.(com|gg)\//gi },
  { id: "co-author-line", re: /co-authored-by/gi },
  { id: "account-number", re: /(?<![\d.])\d{12}(?![\d.])/g },
];

function privateRules() {
  const p = join(root, "private/denylist.txt");
  if (!existsSync(p)) {
    if (process.env.CI) {
      console.log("No private/denylist.txt in CI: checking general rules only.");
      return [];
    }
    console.error("Missing private/denylist.txt. Create it (one regular expression per line) before building.");
    process.exit(1);
  }
  return readFileSync(p, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"))
    .map((l, i) => ({ id: `private rule ${i + 1}`, re: new RegExp(l, "gi") }));
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

function filesToCheck(dist) {
  if (dist) return walk(join(root, "dist")).map((p) => relative(root, p));
  const out = execSync("git ls-files -co --exclude-standard", { cwd: root, encoding: "utf8" });
  return out.split("\n").filter(Boolean);
}

function commitMessages() {
  try {
    return execSync("git log --format=%B%x00", { cwd: root, encoding: "utf8" });
  } catch {
    return ""; // no commits yet
  }
}

const dist = process.argv.includes("--dist");
const rules = [...GENERAL.map((r) => ({ ...r, general: true })), ...privateRules()];
const problems = [];

function scan(name, raw) {
  // Embedded binary data (inlined fonts) is not text and only produces false hits.
  const text = raw.replace(/data:[\w/+.-]+;base64,[A-Za-z0-9+/=]+/g, "data:");
  for (const rule of rules) {
    if (rule.general && name === SELF) continue; // this file has to spell out the patterns
    rule.re.lastIndex = 0;
    for (const m of text.matchAll(rule.re)) {
      if (rule.allow?.includes(m[0])) continue;
      const line = text.slice(0, m.index).split("\n").length;
      problems.push(`${name}:${line}  ${rule.id}`);
    }
  }
}

for (const f of filesToCheck(dist)) {
  scan(f, f); // the path itself
  if (BINARY.test(f) || !existsSync(join(root, f))) continue;
  scan(f, readFileSync(join(root, f), "utf8"));
}
if (!dist) scan("(commit messages)", commitMessages());

if (problems.length) {
  // Only file, line and rule are printed, never the matched text.
  console.error(`Public check failed (${problems.length}):\n  ${problems.join("\n  ")}`);
  process.exit(1);
}
console.log(`Public check passed${dist ? " for dist/" : ""}: ${rules.length} rules.`);
