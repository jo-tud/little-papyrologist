# The Little Papyrologist

A small, unofficial trainer for reading Greek letters on the Herculaneum scrolls, and for noticing when there are none.

You see a tile and decide whether there is a letter on it, and which one. You also say how sure you are. You then get the answer with a short explanation and its source.

Points are given for honest answers as well as for correct ones. A correct "no letter" on an empty tile, or "can't tell" where the deciding stroke is lost, both earn points.

**Not affiliated with the Vesuvius Challenge.**

**Try it:** https://jo-tud.github.io/little-papyrologist/

## Status

- **Level 0 (the scribes' alphabet)** introduces all 24 letter names and five sets of look-alikes (Ε/Ϲ/Ο/Θ, Α/Λ/Δ, Η/Ν/Π, Ι/Τ/Γ, Μ/Ν), with empty and damaged tiles. Short, sourced reading breaks introduce papyrology along the way. You can skip straight to real photographs and return anytime.
- **Ranks and badges** follow your path through the levels. Both are defined in `data/ranks.yaml` and `data/badges.yaml`. New material counts towards them automatically.
- **Level 1** starts with a clear, rounded Epsilon, then an uneven Omicron and the pair Iota–Tau. Clues and reference drawings help connect handwriting with printed letter names. Three unscored examples then introduce two Nu forms and an unfamiliar Eta: a confirmed reading is not always easy to recognize. All six photographs come from named samples of PHerc. 248, 250 and 500P2 in the organizers' profilometry dataset. No answers come from model predictions.
- **Level 2** introduces practice in telling ink from papyrus using infrared photos, then column −8 of PHerc. Paris 4 as the ink model sees it. You read lines against the published edition, or distinguish writing from image noise. Empty tiles are included here and in level 0.
- **Level 3** (harder images) is in preparation.
- The Vesuvius Challenge has confirmed that the images may be used, with credit (see [LICENSES.md](LICENSES.md)).

## Run it

```bash
npm install
npm run dev      # local development server
npm run build    # checks the data, builds one self-contained dist/index.html
```

`dist/index.html` also works when opened straight from the folder, together with `dist/images/`.

To rebuild the image tiles from `data/crops.yaml` (downloads the public source images once):

```bash
python3 -m venv .venv && .venv/bin/pip install -r tools/requirements.txt
.venv/bin/python tools/make_items.py
```
Every push to `main` builds the site and publishes it on GitHub Pages (`.github/workflows/deploy.yml`).

## How it is organised

| Path | What it holds |
|---|---|
| `data/glyphs.yaml` | the letter drawings, one named path per stroke |
| `data/stage0.yaml` | facts with sources, look-alike sets and drawn tiles |
| `data/crops.yaml` | which crops to cut for levels 1–3, and where their answers come from |
| `data/items.yaml` | the resulting quiz items (generated: image, reading, source, license, credit, date) |
| `tools/make_items.py` | cuts the tiles, derives the answers from the edition text, refuses tiles without a reliable answer |
| `data/sources.yaml` | every source the site cites, plus related projects |
| `data/ranks.yaml`, `data/badges.yaml` | ranks and badges, with their conditions |
| `src/` | the page (TypeScript, no framework) |
| `tools/validate-data.mjs` | refuses items without a reliable answer, a source, a license or a check date |
| `tools/check-public.mjs` | stops local paths and private terms from reaching the repo or the site |

New tiles and quiz items go into `data/`. Adding them needs no code changes.

## Your data

There is no server and no tracking. Answers, badges and ranks stay in your browser's local storage. At the end of **My results** you can save your progress as a file and load it in another browser. New answer records include the task type, so assisted letter matching can be separated from free transcription. Skipping the introduction is saved separately from completed exercises and earns no completion credit.

Guided study examples add no answers or points. Earlier answers remain in your history even when a photograph is now used as an unscored example.

**My results** also lets you open a practice level manually, return to automatic progression, or reset all progress with confirmation. Choosing a level changes access without awarding completed exercises, points or ranks. Your practice settings are included in backups.

## Licenses

Code and our own letter drawings: MIT, see [LICENSE](LICENSE).
Fonts and any images derived from Vesuvius Challenge data keep their own licenses, see [LICENSES.md](LICENSES.md).
