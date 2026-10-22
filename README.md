# The Little Papyrologist

A small, unofficial trainer for reading Greek letters on the Herculaneum scrolls, and for noticing when there are none.

You see a tile and decide whether there is a letter on it, and which one. You also say how sure you are. You then get the answer with a short explanation and its source.

Points are given for honest answers as well as for correct ones. A correct "no letter" on an empty tile, or "can't tell" where the deciding stroke is lost, both earn points.

**Not affiliated with the Vesuvius Challenge.**

**Try it:** https://jo-tud.github.io/little-papyrologist/

## Status

- **Stage 0 (the scribes' alphabet) is playable.** It covers the 24 letters as drawn for this trainer, plus five sets of look-alikes (Ε/Ϲ/Ο/Θ, Α/Λ/Δ, Η/Ν/Π, Ι/Τ/Γ, Μ/Ν) with empty and damaged tiles.
- **Ranks and badges** follow your path through the levels. Both are defined in `data/ranks.yaml` and `data/badges.yaml`. New material counts towards them automatically.
- **Levels 1–3, with real images, are in preparation.** Their images will be added once their use is cleared.

## Run it

```bash
npm install
npm run dev      # local development server
npm run build    # checks the data, builds one self-contained dist/index.html
```

`dist/index.html` also works when opened straight from the folder.
Every push to `main` builds the site and publishes it on GitHub Pages (`.github/workflows/deploy.yml`).

## How it is organised

| Path | What it holds |
|---|---|
| `data/glyphs.yaml` | the letter drawings, one named path per stroke |
| `data/stage0.yaml` | facts with sources, look-alike sets and drawn tiles |
| `data/items.yaml` | quiz items for levels 1–3 (image, reading, source, license, date checked) |
| `data/sources.yaml` | every source the site cites, plus related projects |
| `data/ranks.yaml`, `data/badges.yaml` | ranks and badges, with their conditions |
| `src/` | the page (TypeScript, no framework) |
| `tools/validate-data.mjs` | refuses items without a reliable answer, a source, a license or a check date |
| `tools/check-public.mjs` | stops local paths and private terms from reaching the repo or the site |

New tiles and quiz items go into `data/`. Adding them needs no code changes.

## Your data

There is no server and no tracking. Answers, badges and ranks stay in your browser's local storage. At the end of **My results** you can save your progress as a file and load it in another browser.

## Licenses

Code and our own letter drawings: MIT, see [LICENSE](LICENSE).
Fonts and any images derived from Vesuvius Challenge data keep their own licenses, see [LICENSES.md](LICENSES.md).
