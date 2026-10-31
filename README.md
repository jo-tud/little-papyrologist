# The Little Papyrologist

A small, unofficial trainer for reading Greek letters on the Herculaneum scrolls, and for noticing when there are none.

Start with real photographs and tap a letter name to see the published reading. Later exercises ask you to read groups of two to four letters, with a “No letters” answer in the same task. Buttons show simplified handwritten forms beside the printed letter and its name. Confidence ratings, background and sources are available on request. Tap a letter in a short published reading to locate its approximate area in the image. Original and reference images can be compared side by side or switched in the same position with A/B view; checking an answer keeps the image, zoom and pan in place.

Points are given for honest answers as well as for correct ones. A correct "no letter" on an empty tile, or "can't tell" where the deciding stroke is lost, both earn points.

**Not affiliated with the Vesuvius Challenge.**

**Try it:** https://jo-tud.github.io/little-papyrologist/

## Status

- **12 levels** include 109 newly curated original regions: 86 short letter groups and 23 spaces between columns. They add 79 distinct letter sequences from two scrolls, with 279 reviewed letter positions. One group introduces the second hand without a score. These are regions from two text witnesses, not 86 independent hands.
- **The alphabet** introduces all 24 letter names, with checked originals for 21 letters in 109 image views, from named photographs and edition-backed groups in two scrolls. Beta, Xi and Psi still lack an admitted original example. Several letters can share a group; image counts are not counts of independent hands. A compact letter index, variants and position markers make them easy to compare. Missing examples and partial or faint forms are labelled openly. Simplified drawings are optional references. **Level 0** offers five optional sets of look-alikes (Ε/Ϲ/Ο/Θ, Α/Λ/Δ, Η/Ν/Π, Ι/Τ/Γ, Μ/Ν), with empty and damaged tiles and short, sourced reading breaks.
- **Ranks and badges** follow your path through the levels. Both are defined in `data/ranks.yaml` and `data/badges.yaml`. New material counts towards them automatically.
- **Level 1** is open from the start: a clear, rounded Epsilon, then an uneven Omicron and the pair Iota–Tau. Letter choices show feedback immediately, without a separate confidence question. Clues and reference drawings help connect handwriting with printed letter names. You can then explore three unscored examples of Nu and Eta, or try the first short reading lesson and return later. All six photographs come from named samples of PHerc. 248, 250 and 500P2 in the organizers' profilometry dataset. No answers come from model predictions.
- **Level 2** starts with short groups, compares the same letters in different places, and explains connected handwriting without scoring it. Reading guides can be opened when needed. Groups from PHerc. Paris 4 are mixed with real spaces between columns. Whole lines are a separate optional challenge. Letter-position frames are approximate teaching aids, distinct from the organizers' ink tracings.
- **Levels 3–12** add new combinations from multiple columns of PHerc. Paris 4 and a second hand in PHerc. 1667. Later rounds use naturally harder originals, without added blur, noise or covering. Each short group has its published reading and individually reviewed approximate letter positions. Restored and underdotted edition letters are excluded from scored targets.
- **Repeat practice** offers short rounds at each level, favouring unfamiliar source images and previous difficulties. Practice records answers without completing lessons. Historical altered images and ink-only questions remain in the data for old results but cannot enter a new round.
- The Vesuvius Challenge has confirmed that the images may be used, with credit (see [LICENSES.md](LICENSES.md)).

## Run it

```bash
npm install
npm run dev      # local development server
npm test         # practice selection, scoring and resume checks (Node 24)
npm run build    # checks the data, builds one self-contained dist/index.html
```

`dist/index.html` also works when opened straight from the folder, together with `dist/images/`.

To rebuild the image tiles from the crop and corpus manifests (downloads the public source images once):

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/make_items.py
```
Generator checks: `.venv/bin/python -m unittest discover -s tests -p 'test_*.py'`.

Every push to `main` builds the site and publishes it on GitHub Pages (`.github/workflows/deploy.yml`).

## How it is organised

| Path | What it holds |
|---|---|
| `data/glyphs.yaml` | the letter drawings, one named path per stroke |
| `data/stage0.yaml` | facts with sources, look-alike sets and drawn tiles |
| `data/crops.yaml` | early lessons, alphabet references and retained historical crops |
| `data/corpus-*.yaml` | reviewed original crops, source hashes, editions, positions and lesson order |
| `data/levels.yaml` | level names and descriptions |
| `data/letter-forms.yaml` | additional simplified handwritten forms, tied to checked examples |
| `data/items.yaml` | the resulting quiz items (generated: image, reading, source, license, credit, date) |
| `data/alphabet-items.yaml` | additional source-checked alphabet references, including forms unsuitable for early quizzes |
| `data/letter-regions.yaml` | reviewed approximate letter positions, matched to a source image and reading |
| `tools/make_items.py` | builds the tiles from verified sources and edition text |
| `tools/lesson_items.py`, `tools/short_reading_items.py`, `tools/corpus_items.py` | source-aligned short readings, optional whole lines and the expanded original corpus |
| `tools/degrade_items.py` | reproduction of retired historical images only |
| `tools/alphabet_items.py` | checks source image hashes and edition ranges for additional alphabet examples |
| `src/practice.ts` | selects varied repeat rounds and focused short-group practice |
| `src/round-session.ts` | validates saved round order, draft input and answered steps |
| `data/sources.yaml` | every source the site cites, plus related projects |
| `data/ranks.yaml`, `data/badges.yaml` | ranks and badges, with their conditions |
| `src/` | the page (TypeScript, no framework) |
| `tools/validate-data.mjs` | refuses items without a reliable answer, a source, a license or a check date |
| `tools/check-public.mjs` | stops local paths and private terms from reaching the repo or the site |

Crop selections and source readings are specified in the crop and corpus manifests. New corpus crops use lossless WebP, preserving the decoded pixels of the published source image. Additional teaching fragments retain their source coordinates and character ranges for checking against the edition.

## Your data

There is no server and no tracking. Answers, badges and ranks stay in your browser's local storage. Under **Backup** in **My results** you can save your progress as a file and load it in another browser. New answer records include task type, guide use, practice mode, source image and whether the view was artificially altered. Results distinguish recognition with choices, reading with help and reading without opening a guide. An attempt without a guide is not necessarily a first encounter with that image. Skipping the introduction is saved separately from completed exercises and earns no completion credit.

Results distinguish full matches, answers left open and incorrect claims. Accepted uncertainty does not count as a letter read; historical responses keep their original points.

Confidence is optional and saved as `null` when no rating was chosen; those answers are excluded from confidence statistics. Direct letter choices award reading points for matched letters, without an extra point for an ink-presence decision that was not asked.

Guided study examples add no answers or points. Earlier answers remain in your history even when a photograph is now used as an unscored example.

**My results** also lets you open a practice level manually, return to automatic progression, or reset all progress with confirmation. Choosing a level changes access without awarding completed exercises, points or ranks. Your practice settings and paused image rounds are included in backups. Return with “Continue” to keep the same order, current input and feedback. Restarting a round keeps previously saved answers. If an update changes the exercise material, a new round starts and past answers remain in My results.

## Licenses

Code and our own letter drawings: MIT, see [LICENSE](LICENSE).
Fonts and any images derived from Vesuvius Challenge data keep their own licenses, see [LICENSES.md](LICENSES.md).
