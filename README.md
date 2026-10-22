# The Little Papyrologist

A small, unofficial trainer for reading Greek letters on the Herculaneum scrolls, and for noticing when there are none.

You see a tile and decide whether there is a letter on it, and which one. You also say how sure you are. You then get the answer with a short explanation and its source.

Points are given for honest answers as well as for correct ones. A correct "no letter" on an empty tile, or "can't tell" where the deciding stroke is lost, both earn points.

**Not affiliated with the Vesuvius Challenge.**

## Status

- **Stage 0 (the scribes' alphabet) is playable.** It covers the 24 letters as drawn for this trainer, plus five sets of look-alikes (Ε/Ϲ/Ο/Θ, Α/Λ/Δ, Η/Ν/Π, Ι/Τ/Γ, Μ/Ν) with empty and damaged tiles.
- **Levels 1–3, with real images, are in preparation.** Their images will be added once their use is cleared.

## Run it

```bash
npm install
npm run dev      # local development server
npm run build    # checks the data, builds one self-contained dist/index.html
```

`dist/index.html` also works when opened straight from the folder.

## How it is organised

| Path | What it holds |
|---|---|
| `data/glyphs.yaml` | the letter drawings, one named path per stroke |
| `data/stage0.yaml` | facts with sources, look-alike sets and drawn tiles |
| `data/items.yaml` | quiz items for levels 1–3 (image, reading, source, license, date checked) |
| `data/sources.yaml` | every source the site cites |
| `src/` | the page (TypeScript, no framework) |
| `tools/validate-data.mjs` | refuses items without a reliable answer, a source, a license or a check date |
| `tools/check-public.mjs` | stops local paths and private terms from reaching the repo or the site |

New tiles and quiz items go into `data/`. Adding them needs no code changes.

## Your data

There is no server and no tracking. Answers stay in your browser's local storage. **My results → Export** saves them as a JSON file, if you want to keep them.

## Licenses

See [LICENSES.md](LICENSES.md).
