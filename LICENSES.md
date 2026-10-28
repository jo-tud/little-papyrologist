# Licenses and data sources

> No images from third-party data are in this repository yet.
> Their use in this trainer was confirmed by the Vesuvius Challenge on 2026-10-28 (see below).

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

## Permission from the Vesuvius Challenge

On 2026-10-28 the Vesuvius Challenge confirmed by email that the images planned for this trainer may be used.
These are the infrared photographs and ink tracings of opened fragments, and crops of the column images published on scrollprize.org.
The conditions are:

- credit the Vesuvius Challenge;
- also credit EduceLab for any data derived from the original scans of Scrolls 1–4. This includes PHerc. Paris 4 (Scroll 1).

The Vesuvius Challenge also confirmed that this trainer does not count as "publication" under the publication reservation for PHerc. Paris 4.

## How images are credited

Every image in the trainer shows these, next to it or in its answer card:

1. **"Vesuvius Challenge"**, the license (CC BY-NC 4.0), a link to the source, and what we changed.
2. If the image derives from the original scans of Scrolls 1–4 (for example PHerc. Paris 4 = Scroll 1), also **"EduceLab, University of Kentucky"**, citing:
   S. Parsons et al., "EduceLab-Scrolls: Verifiable Recovery of Text from Herculaneum Papyri using X-ray CT" (2023), https://doi.org/10.48550/arXiv.2304.02084.
3. The reading, with its own source (edition or paper, see below).

Each item in `data/items.yaml` carries its credit line in a `credit` field. The build refuses items without one.

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

- Planned source: `https://dl.ash2txt.org/fragments/PHerc0500P2/paths/2um_front_surface/`.
- License: CC BY-NC 4.0, per the folder's `LICENSE.txt`, confirmed by the Vesuvius Challenge.
- Credit: Vesuvius Challenge, for the photography, its registration and the letter tracing.
- The objects are held by the Biblioteca Nazionale di Napoli "Vittorio Emanuele III" (Officina dei Papiri Ercolanesi).

### Images published on scrollprize.org

- The site says: "Everything on this site is licensed CC BY-NC 4.0 unless otherwise noted … with the credit "Vesuvius Challenge"." (https://scrollprize.org/press)
- Images of PHerc. Paris 4 and other scrolls derived from the original scans of Scrolls 1–4 also credit EduceLab (see above).

## Readings (answers in the quiz)

The answers shown in the quiz come only from:

- readings checked by papyrologists, for example:
  - F. Nicolardi, D. Delattre, G. Del Mastro, R. Fowler, R. Janko, "The final columns of PHerc.Paris. 4 revealed through virtual unwrapping", *Cronache Ercolanesi* 54 (2024) 9–27;
  - G. Angelotti, S. Parsons, F. Nicolardi et al., "Complete virtual unwrapping and reading of a rolled Herculaneum papyrus" (2026), https://arxiv.org/abs/2606.29085;
- physical evidence (infrared photographs);
- labels published by the Vesuvius Challenge.

## Not used

- **Raw EduceLab-Scrolls data** (the 2023 DLS scan files, Fragments 1–6) is not copied into this repository. It has its own terms, see https://dl.ash2txt.org/LICENSE.txt. Images of Scrolls 1–4 appear here only as crops of images the Vesuvius Challenge has published, credited as above.
- **Multispectral images of opened Herculaneum papyri** (Biblioteca Nazionale di Napoli / Brigham Young University, shown on Chartes): all rights reserved. We only link to them: https://www.chartes.it/
- **Plates from Cavallo/Maehler, *Hellenistic Bookhands*** (De Gruyter 2008): the book is cited as further reading only.

## Open question

We know of no published reading of the traced letters on the opened fragments.
Until one exists, tiles from those photographs only ask whether there is ink.
Where they name letters, those letters are marked as unconfirmed.
