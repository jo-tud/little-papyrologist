"""A guided line-reading lesson derived from an already verified edition line.

The short rectangles isolate the first four published characters; they are not new
readings or organizers' character masks. Source coordinates and edition indexes
are retained so that every fragment can be reconstructed and checked.
"""

from __future__ import annotations

import copy
import re
from pathlib import Path
from typing import Callable

from PIL import Image


BASE_ID = "paris4-col-8-l05"
LINE_TRUTH = "ΓΕΙΝΕϹΘΑΙΠΑΡΑΠΛΗ"
FULL_RECT = [8190, 450, 9210, 550]
SOURCE_SIZE = (16000, 1932)
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")

# Rectangles use original-image pixels, with right/bottom exclusive. Edition
# ranges are also half-open. Keep the final right tips of Epsilon and Nu intact.
FRAGMENTS = (
    {
        "suffix": "epsilon", "indices": [1, 2], "rect": [8294, 453, 8355, 552],
        "task": "identify", "choices": ["Ε", "Ο", "Ϲ"],
        "stage": "A familiar curve",
        "preparation": (
            "Epsilon can have a curved back, as you saw in the photographs. "
            "Here the writing appears bright against a dark background."
        ),
        "question": "Which familiar letter has this open curve and middle stroke?",
        "hint": "Look for the stroke reaching into the curve, between its upper and lower ends.",
        "explain": (
            "The edition reads Epsilon in this position. Its curved back and middle stroke "
            "are visible in the ink map. This is one letter from the start of the line, not a whole word."
        ),
    },
    {
        "suffix": "gamma-epsilon", "indices": [0, 2], "rect": [8238, 453, 8355, 552],
        "task": "identify", "choices": ["ΓΕ", "ΤΕ", "ΓϹ"],
        "stage": "Two neighbours",
        "preparation": (
            "Meet Gamma: printed Γ has an upright and a stroke to the right at the top. "
            "In this handwriting its lower end curls. The neighbouring Epsilon is the same one you just saw."
        ),
        "question": "Which pair records these two letters from left to right?",
        "hint": "Compare the first letter's upper stroke, then the middle stroke in the second letter.",
        "explain": (
            "The first two letters in the published reading are Gamma–Epsilon, ΓΕ. "
            "Gamma's curled foot belongs to that letter. These are the opening letters of a word, not a word on their own."
        ),
    },
    {
        "suffix": "gamma-epsilon-iota", "indices": [0, 3], "rect": [8238, 453, 8382, 552],
        "task": "read",
        "stage": "Add an upright",
        "preparation": (
            "Now keep going one letter at a time. Iota, Ι, is written as one upright. "
            "Use the optional reading guide if you need it."
        ),
        "question": "Read the three letters from left to right.",
        "hint": "Start with the pair you just read, then look at the narrower upright on its right.",
        "explain": (
            "The edition gives Gamma–Epsilon–Iota, ΓΕΙ. The narrow third shape is a complete Iota. "
            "This crop contains the first three letters of a word; it is not a complete word."
        ),
    },
    {
        "suffix": "gamma-epsilon-iota-nu", "indices": [0, 4], "rect": [8238, 453, 8454, 552],
        "task": "read",
        "stage": "Four letters together",
        "preparation": (
            "Nu, Ν, can vary in handwriting. In this line, the new letter at the right "
            "has two uprights joined by a diagonal. Try reading the group before opening the guide."
        ),
        "question": "Read these four neighbouring letters.",
        "hint": "Follow the group from left to right. The diagonal link belongs to the final letter.",
        "explain": (
            "These are Gamma–Epsilon–Iota–Nu, ΓΕΙΝ, in the edition. "
            "The last character is Nu. You have read the beginning of a word, not four separate words."
        ),
    },
)


def _error(message: str) -> None:
    raise ValueError(f"lesson_items: {message}")


def _base(existing_items: list[dict]) -> dict:
    matches = [item for item in existing_items if item.get("id") == BASE_ID]
    if len(matches) != 1:
        _error("the lesson needs exactly one verified column −8, line 5")
    base = matches[0]
    if base.get("truth") != LINE_TRUTH or base.get("uncertain") != []:
        _error("the source reading changed; recheck every fragment against the edition")
    if base.get("task") != "read" or base.get("degradation") != 0 or not base.get("edition"):
        _error("the lesson needs the unaltered, edition-backed line")
    if "cerc54" not in base.get("source", []) or "grandprize" not in base.get("source", []):
        _error("the source line must retain both the edition and image sources")
    return base


def generate_lesson(
    cfg: dict,
    existing_items: list[dict],
    out_path: str | Path,
    save_tile: Callable[[Image.Image, str], str],
) -> list[dict]:
    """Build six ordered steps from the full-resolution Grand Prize image.

    cfg requires ``set``, ``level: 2`` and ``source_path``. out_path contains the
    already generated line image. The callback writes a crop and returns its
    filename. Whole-line steps reuse the existing file unchanged.
    """
    set_id = cfg.get("set", "")
    if not isinstance(set_id, str) or not SAFE_ID.fullmatch(set_id) or cfg.get("level") != 2:
        _error("expected a valid level-2 lesson set")
    base = _base(existing_items)
    image_name = base.get("image", "")
    if not isinstance(image_name, str) or Path(image_name).name != image_name:
        _error("the existing line image must be a plain filename")
    line_path = Path(out_path) / image_name
    if not line_path.is_file():
        _error("the existing full-line image is missing")
    with Image.open(line_path) as image:
        if image.size != (1020, 100):
            _error("the source line dimensions changed; recheck the crop coordinates")

    # Short crops extend two pixels below the existing whole-line crop. Use the
    # full image rather than padding missing pixels or resampling a saved tile.
    source_path = cfg.get("source_path")
    if not source_path or not Path(source_path).is_file():
        _error("the full-resolution source_path is required for complete fragment crops")
    with Image.open(source_path) as image:
        if image.size != SOURCE_SIZE:
            _error("unexpected source dimensions; the checked coordinates no longer apply")
        source = image.convert("RGB")

    ids = {item["id"] for item in existing_items}
    if len(ids) != len(existing_items):
        _error("existing item ids are not unique")
    new_ids = [f"{set_id}-study", *(f"{set_id}-{fragment['suffix']}" for fragment in FRAGMENTS), f"{set_id}-read"]
    if ids.intersection(new_ids):
        _error("lesson item ids already exist")

    common = {
        key: copy.deepcopy(base[key])
        for key in ("source", "license", "credit", "checked", "edition", "reading")
    }
    common.update({
        "set": set_id, "level": 2, "degradation": 0, "base_item": BASE_ID,
        "uncertain": [],
    })
    whole = {
        **common, "image": image_name, "truth": base["truth"], "guide": base["truth"],
        "edition_indices": [0, len(base["truth"])], "source_crop": FULL_RECT.copy(),
        "alt": "One complete line from the ink-detection image of PHerc. Paris 4",
        "changes": base["changes"],
    }
    items = [{
        **copy.deepcopy(whole), "id": new_ids[0], "task": "study",
        "stage": "Meet an ink map",
        "preparation": (
            "This line comes from inside a rolled papyrus. Bright marks are an ink-detection "
            "model's output from a CT scan; the reading below comes from papyrologists. "
            "First we will find familiar shapes, then build up to the whole line."
        ),
        "explain": (
            "This is column −8, line 5 of PHerc. Paris 4. Its beginning is clearer than its middle. "
            "Study the published reading here; a guide will remain available later. "
            "The letters run together, and the final word continues on the next line. This introduction is not scored."
        ),
    }]
    for fragment in FRAGMENTS:
        start, end = fragment["indices"]
        truth = base["truth"][start:end]
        item_id = f"{set_id}-{fragment['suffix']}"
        item = {
            **copy.deepcopy(common), "id": item_id,
            **{key: copy.deepcopy(fragment[key]) for key in ("task", "stage", "preparation", "question", "hint", "explain")},
            "truth": truth, "guide": truth,
            "image": save_tile(source.crop(fragment["rect"]), item_id),
            "alt": "A short group of bright writing strokes from a verified line of PHerc. Paris 4",
            "edition_indices": fragment["indices"].copy(), "source_crop": fragment["rect"].copy(),
            "changes": "cropped to a verified character range in the original ink-detection image",
        }
        if "choices" in fragment:
            if truth not in fragment["choices"]:
                _error(f"{item_id}: choices no longer match the source reading")
            item["choices"] = fragment["choices"].copy()
        items.append(item)
    items.append({
        **copy.deepcopy(whole), "id": new_ids[-1], "task": "read",
        "stage": "Your first line",
        "preparation": (
            "Start with the four letters you know, then continue across the line. Its middle is harder: "
            "use the optional guide, or put ? for a letter you cannot make out. Reading with help counts as supported practice."
        ),
        "question": "Read the line from left to right. Use the guide whenever you need it.",
        "hint": "There are 16 letters. Ignore marks entering from the neighbouring lines; do not add spaces or accents.",
        "explain": (
            "The published reading is γείνεϲθαι, παραπλη-. The last word continues on the next line; "
            "this is not a complete sentence. In this passage, the writer asks whether scarce foods "
            "are necessarily more pleasant than plentiful ones. You can return to this line and try it with less help."
        ),
    })
    return items


def generate_reading_practice(existing_items: list[dict]) -> list[dict]:
    """Return four optional recall tasks, reusing the lesson's unchanged images.

    These are repeat readings of the same verified fragments, not new examples.
    Choices and revealing preparation text are removed. The optional guide is
    still available; the UI records its use rather than revealing it initially.
    """
    ids = {item["id"] for item in existing_items}
    practice = []
    for fragment in FRAGMENTS:
        matches = [
            item for item in existing_items
            if item.get("base_item") == BASE_ID and item.get("level") == 2
            and item.get("degradation") == 0 and not item.get("practice_only")
            and item.get("source_crop") == fragment["rect"]
            and item.get("edition_indices") == fragment["indices"]
        ]
        if len(matches) != 1:
            _error(f"recall needs one verified {fragment['suffix']} lesson fragment")
        item = copy.deepcopy(matches[0])
        item["id"] += "-recall"
        if item["id"] in ids:
            _error(f"duplicate recall item {item['id']}")
        item.update({
            "task": "read", "practice_only": True, "stage": "Read it again",
            "preparation": "This is a fragment you met in the guided lesson. Try reading it without the guide this time.",
            "question": "Which letters can you read, from left to right?",
            "hint": "Work through the visible strokes one character at a time; ? is welcome when you are unsure.",
            "explain": item["explain"] + " This repeat uses the same source image; it is practice, not a new passage.",
        })
        item.pop("choices", None)
        practice.append(item)
    return practice


# Additional small views were checked in the full column against the edition,
# including the neighbouring letters. These are coordinate annotations for the
# trainer, not published per-character masks. Changes require renewed inspection.
EXTRA_CROP_VERSION = 1
EXTRA_BASES = {
    "paris4-col-8-l05": ("γείνεϲθαι, παραπλη-", "ΓΕΙΝΕϹΘΑΙΠΑΡΑΠΛΗ", []),
    "paris4-col-8-l08": ("εἶναι καὶ παρὰ πλε̣ί-", "ΕΙΝΑΙΚΑΙΠΑΡΑΠΛΕΙ", [14]),
    "paris4-col-8-l12": ("πάντωϲ κα̣ὶ ἡδίω", "ΠΑΝΤΩϹΚΑΙΗΔΙΩ", [7]),
    "paris4-col-8-l16": ("λοϲ ε̣ἴη{ι}, καὶ κάπ̣πα-", "ΛΟϹΕΙΗΙΚΑΙΚΑΠΠΑ", [3, 12]),
}

# (base id, stable suffix, half-open edition indexes, original-source rectangle,
#  visible-shape reminder, explanation). All selected positions are unqualified
# in the edition; uncertainties elsewhere in a parent line are not inherited.
EXTRA_FRAGMENTS = (
    (
        "paris4-col-8-l05", "l05-iota", (2, 3), (8357, 453, 8383, 552),
        "The main shape is one upright. Small changes in its thickness do not add another letter.",
        "This is Iota, the third letter of the line you met in the guided lesson. It is a single letter from a word.",
    ),
    (
        "paris4-col-8-l05", "l05-nu", (3, 4), (8384, 453, 8454, 552),
        "Look at the two uprights and the sloping link between them.",
        "This is Nu, the fourth letter of the same line. Its diagonal joins the uprights; these strokes form one character.",
    ),
    (
        "paris4-col-8-l08", "l08-iota", (15, 16), (9055, 744, 9100, 826),
        "Follow the single bright upright, including its thicker lower end.",
        "The edition records Iota at the end of this line. The word continues on the next line; this crop shows only its final visible letter here.",
    ),
    (
        "paris4-col-8-l12", "l12-eta", (9, 10), (8793, 1135, 8870, 1235),
        "Compare the linked uprights. Their feet and upper ends do not have identical lengths.",
        "This is Eta in the published reading. Its broad link joins two uprights, with an extended foot on the right. It begins a word in the edition.",
    ),
    (
        "paris4-col-8-l16", "l16-eta", (5, 6), (8444, 1550, 8506, 1635),
        "The linking stroke and both uprights belong to one letter.",
        "The edition records Eta here too. Its proportions differ from the Eta in line 12. This is a letter within a word, not a separate word.",
    ),
    (
        "paris4-col-8-l12", "l12-iota", (8, 9), (8750, 1135, 8793, 1235),
        "This upright has a broad foot. Compare the whole shape rather than expecting a perfectly straight stroke.",
        "This is Iota, the final letter of a word in the edition. The broad foot is part of the handwritten form, not an extra character.",
    ),
    (
        "paris4-col-8-l16", "l16-iota", (4, 5), (8406, 1550, 8444, 1635),
        "The narrow shape has curled ends. The optional guide can help with unfamiliar handwriting.",
        "The edition reads Iota here. Its curled ends can make an isolated view less familiar than printed Ι. This letter sits inside a word.",
    ),
    (
        "paris4-col-8-l12", "l12-iota-eta", (8, 10), (8750, 1135, 8870, 1235),
        "Read from the small upright to the wider shape with a connecting stroke.",
        "These are Iota–Eta, ΙΗ. In the edition, Iota ends one word and Eta starts the next. The pair is a reading fragment, not a word on its own.",
    ),
    (
        "paris4-col-8-l16", "l16-iota-eta", (4, 6), (8406, 1550, 8506, 1635),
        "Compare the curled narrow shape with the linked uprights to its right.",
        "These are also Iota–Eta, ΙΗ, with different proportions from the pair in line 12. Here both belong inside the same word; the crop is not a complete word.",
    ),
)


def generate_extra_fragments(
    cfg: dict,
    existing_items: list[dict],
    out_path: str | Path,
    save_tile: Callable[[Image.Image, str], str],
) -> list[dict]:
    """Add nine optional readings across four verified lines of the same column.

    cfg has the same set, level and full-resolution source_path as generate_lesson.
    Overlapping singles/pairs are labelled as practice and retain their original
    line identities. No uncertain or editor-deleted character is selected.
    """
    set_id = cfg.get("set", "")
    if not isinstance(set_id, str) or not SAFE_ID.fullmatch(set_id) or cfg.get("level") != 2:
        _error("additional fragments need a valid level-2 set")
    source_path = cfg.get("source_path")
    if not source_path or not Path(source_path).is_file():
        _error("additional fragments need the full-resolution source_path")
    with Image.open(source_path) as image:
        if image.size != SOURCE_SIZE:
            _error("source dimensions changed; recheck the additional crop coordinates")
        source = image.convert("RGB")
    by_id = {item["id"]: item for item in existing_items}
    if len(by_id) != len(existing_items):
        _error("existing item ids are not unique")
    root = Path(out_path)
    for base_id, (edition, truth, uncertain) in EXTRA_BASES.items():
        base = by_id.get(base_id)
        if base is None or (base.get("edition"), base.get("truth"), base.get("uncertain")) != (edition, truth, uncertain):
            _error(f"{base_id}: the edition changed; recheck the additional character ranges")
        if base.get("task") != "read" or base.get("degradation") != 0:
            _error(f"{base_id}: fragments need unaltered, edition-backed source lines")
        if not {"cerc54", "grandprize"}.issubset(base.get("source", [])):
            _error(f"{base_id}: edition or image provenance is missing")
        name = base.get("image", "")
        if not isinstance(name, str) or Path(name).name != name or not (root / name).is_file():
            _error(f"{base_id}: the original line image is missing or invalid")
        with Image.open(root / name) as image:
            if image.size != (1020, 100):
                _error(f"{base_id}: original line dimensions changed")

    new_ids = [f"{set_id}-extra-{fragment[1]}" for fragment in EXTRA_FRAGMENTS]
    if set(new_ids).intersection(by_id) or len(set(new_ids)) != len(new_ids):
        _error("additional fragment ids already exist or are not unique")
    result = []
    for (base_id, suffix, indices, rect, hint, explain), item_id in zip(EXTRA_FRAGMENTS, new_ids):
        base = by_id[base_id]
        start, end = indices
        if any(start <= index < end for index in base["uncertain"]):
            _error(f"{item_id}: an uncertain letter entered a clear-character crop")
        truth = base["truth"][start:end]
        if len(truth) != end - start or start < 0 or not truth:
            _error(f"{item_id}: invalid edition range")
        if not (0 <= rect[0] < rect[2] <= source.width and 0 <= rect[1] < rect[3] <= source.height):
            _error(f"{item_id}: rectangle exceeds the source image")
        item = {
            key: copy.deepcopy(base[key])
            for key in ("source", "license", "credit", "checked", "edition", "reading")
        }
        count = end - start
        item.update({
            "id": item_id, "set": set_id, "level": 2, "degradation": 0,
            "task": "read", "practice_only": True, "base_item": base_id,
            "truth": truth, "uncertain": [], "guide": truth,
            "edition_indices": list(indices), "source_crop": list(rect),
            "source_crop_version": EXTRA_CROP_VERSION,
            "image": save_tile(source.crop(rect), item_id),
            "alt": "A small group of bright writing strokes from PHerc. Paris 4",
            "changes": "cropped to a checked character range in the original ink-detection image",
            "stage": "Meet the same letters in more places",
            "preparation": (
                "These small views come from published lines in the same column. "
                "Some repeat a shape in a pair after showing it alone. Use the reading guide if the handwriting is unfamiliar."
            ),
            "question": "Read this one letter." if count == 1 else f"Read these {count} letters from left to right.",
            "hint": hint, "explain": explain,
        })
        result.append(item)
    return result
