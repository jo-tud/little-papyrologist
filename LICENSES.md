# Licenses and data sources

> No images from third-party data are in this repository yet.
> Images will be added only after the open questions below are settled.

## Code

The code in this repository is released under the MIT License, see [`LICENSE`](LICENSE).
The MIT License covers the code and our own drawings (see below). It does not cover the fonts,
or any image derived from Vesuvius Challenge data. Those keep the licenses listed here.

## Our own drawings

The letter drawings (`data/glyphs.yaml`) and the drawn exercise tiles of stage 0 are made for this trainer.
They are drawn freehand as vector paths, after the letter shapes visible in the published images of PHerc. Paris 4 (https://scrollprize.org/grandprize).
Nothing is traced from those images.
They are released under the MIT License, together with the code.

## Fonts

The fonts are bundled so that the trainer works offline. Both are licensed under the SIL Open Font License 1.1 (https://openfontlicense.org):

- **Gentium Book Plus**, © SIL International.
- **Atkinson Hyperlegible Next**, © The Atkinson Hyperlegible Next Project Authors.

Both come from the Fontsource packages.

## Images derived from Vesuvius Challenge data

The images planned for this repository are derived from data published by the Vesuvius Challenge.
That data is licensed under **CC BY-NC 4.0** (https://creativecommons.org/licenses/by-nc/4.0/).

- Images derived from that data stay under CC BY-NC 4.0. Use them only for non-commercial purposes.
- They are provided "as is", without warranties (Section 5 of the license).
- Our changes: cropping, rescaling, contrast adjustment and artificial degradation (blur, noise, coarser sampling, partial occlusion) for a learning game.

Each image in `data/items` lists its exact source, license and retrieval date.

### Vesuvius Challenge open data (CT scans and derived renders)

- License: CC BY-NC 4.0. See https://vesuvius-challenge-open-data.s3.us-east-1.amazonaws.com/LICENSE.txt and https://scrollprize.org/data.
- The bucket's metadata schema says: "Derived artifacts follow the license of the volume they were computed from".
- Dataset citation: Angelotti, G., Parsons, S., Johnson, S., et al. *Vesuvius Challenge – CT Scans of Herculaneum Papyri.* Vesuvius Challenge, 2026.

### Infrared photographs and ink tracings of opened fragments

- Candidate source: `https://dl.ash2txt.org/fragments/PHerc0500P2/paths/2um_front_surface/`.
- License: CC BY-NC 4.0, per the folder's `LICENSE.txt`.
- Credit: Vesuvius Challenge for the photography, its registration and the letter tracing. The full credit line is still to be confirmed.
- The objects are held by the Biblioteca Nazionale di Napoli "Vittorio Emanuele III" (Officina dei Papiri Ercolanesi).

### Images published on scrollprize.org

- The site says: "Everything on this site is licensed CC BY-NC 4.0 unless otherwise noted … with the credit "Vesuvius Challenge"." (https://scrollprize.org/press)

## Readings (answers in the quiz)

The answers shown in the quiz come only from:

- readings checked by papyrologists, for example:
  - F. Nicolardi, D. Delattre, G. Del Mastro, R. Fowler, R. Janko, "The final columns of PHerc.Paris. 4 revealed through virtual unwrapping", *Cronache Ercolanesi* 54 (2024) 9–27;
  - G. Angelotti, S. Parsons, F. Nicolardi et al., "Complete virtual unwrapping and reading of a rolled Herculaneum papyrus" (2026), https://arxiv.org/abs/2606.29085;
- physical evidence (infrared photographs);
- labels published by the Vesuvius Challenge.

## Not used

- **EduceLab-Scrolls data** (DLS scans from 2023, Fragments 1–6): it has a different license, see https://dl.ash2txt.org/LICENSE.txt.
- **Multispectral images of opened Herculaneum papyri** (Biblioteca Nazionale di Napoli / Brigham Young University, shown on Chartes): all rights reserved. We only link to them: https://www.chartes.it/
- **Plates from Cavallo/Maehler, *Hellenistic Bookhands*** (De Gruyter 2008): the book is cited as further reading only.

## Open questions (to be settled before images are added)

1. Confirm that CC BY-NC 4.0 applies to the infrared photographs and ink tracings on dl.ash2txt.org.
2. Confirm that crops of the images on scrollprize.org may be used, given the underlying EduceLab license and the publication reservation for PHerc. Paris 4 until 2027-06-25.
3. Confirm the credit line for the infrared photographs.
