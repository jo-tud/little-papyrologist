"""Build short, individually reviewed original readings without modifying their pixels."""

from __future__ import annotations

import hashlib
import math
import re
import unicodedata
from pathlib import Path

from PIL import Image

GREEK = set("ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϹΤΥΦΧΨΩ")


def edition_positions(text: str) -> tuple[str, set[int]]:
    """Count edition letters, retaining restored/uncertain positions as ineligible.

    Bracketed letters count towards indices, but cannot become scored targets.
    The written letters in editorial deletion braces remain part of the witness.
    """
    letters: list[str] = []
    excluded: set[int] = set()
    stack: list[str] = []
    pairs = {"]": "[", ">": "<", "⟩": "⟨"}
    for char in unicodedata.normalize("NFD", text):
        if char in "[<⟨":
            stack.append(char)
        elif char in pairs:
            if not stack or stack.pop() != pairs[char]:
                raise ValueError("Unbalanced edition brackets")
        elif char == "\u0323":
            if not letters:
                raise ValueError("Unattached uncertainty mark")
            excluded.add(len(letters) - 1)
        elif unicodedata.combining(char):
            continue
        elif char.isalpha():
            normalized = "Ϲ" if char in "ϲςσΣ" else char.upper()
            if normalized not in GREEK:
                raise ValueError(f"Unexpected edition character: {char}")
            if stack:
                excluded.add(len(letters))
            letters.append(normalized)
    if stack:
        raise ValueError("Unbalanced edition brackets")
    return "".join(letters), excluded


def valid_regions(regions, count: int) -> bool:
    return isinstance(regions, list) and len(regions) == count and all(
        isinstance(box, list) and len(box) == 4
        and all(isinstance(v, (int, float)) and math.isfinite(v) and 0 <= v <= 1 for v in box)
        and box[0] < box[2] and box[1] < box[3]
        for box in regions
    )


def generate_corpus(manifests: list[dict], lessons: dict, load_source, save_tile) -> tuple[list[dict], list[dict]]:
    sources: dict = {}
    candidates: dict = {}
    for manifest in manifests:
        for key, source in manifest["sources"].items():
            if key in sources and sources[key] != source:
                raise ValueError(f"Conflicting corpus source: {key}")
            sources[key] = source
        for candidate in manifest["items"]:
            identifier = candidate["id"]
            if identifier in candidates:
                raise ValueError(f"Duplicate corpus item: {identifier}")
            candidates[identifier] = candidate

    images = {}
    for key, source in sources.items():
        path = Path(load_source(key, source["url"]))
        if hashlib.sha256(path.read_bytes()).hexdigest() != source["sha256"]:
            raise ValueError(f"Corpus source changed: {key}")
        with Image.open(path) as original:
            if list(original.size) != source["size"]:
                raise ValueError(f"Corpus source dimensions changed: {key}")
            images[key] = original.convert("RGB")

    sets, items, assigned, regions_seen = [], [], set(), set()
    for lesson in lessons["lessons"]:
        sets.append({"id": lesson["id"], "level": lesson["level"], "title": lesson["title"],
                     "intro": lesson["intro"], "ordered": True})
        for identifier in lesson["items"]:
            if identifier in assigned or identifier not in candidates:
                raise ValueError(f"Missing or reused corpus item: {identifier}")
            assigned.add(identifier)
            entry = candidates[identifier]
            source = sources[entry["source_key"]]
            image = images[entry["source_key"]]
            rect = entry["rect"]
            if (len(rect) != 4 or not all(isinstance(n, int) for n in rect)
                    or not (0 <= rect[0] < rect[2] <= image.width and 0 <= rect[1] < rect[3] <= image.height)):
                raise ValueError(f"Invalid original crop: {identifier}")
            region_id = (source["sha256"], *rect)
            if region_id in regions_seen:
                raise ValueError(f"Duplicate source region: {identifier}")
            regions_seen.add(region_id)
            if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(entry.get("checked", ""))):
                raise ValueError(f"Missing corpus review date: {identifier}")
            if entry.get("blank"):
                truth = "none"
                if entry.get("truth") != truth or entry.get("letter_regions"):
                    raise ValueError(f"Invalid blank reference: {identifier}")
                reading = entry["reading"]
                mapping = {}
            else:
                line, excluded = edition_positions(entry["edition"])
                if line != entry["line_truth"]:
                    raise ValueError(f"Edition mismatch: {identifier}")
                start, end = entry["indices"]
                if not (0 <= start < end <= len(line)) or set(range(start, end)) & excluded:
                    raise ValueError(f"Uncertain or restored target: {identifier}")
                truth = line[start:end]
                if not 2 <= len(truth) <= 4 or entry.get("truth", truth) != truth:
                    raise ValueError(f"Invalid short reading: {identifier}")
                if not valid_regions(entry["letter_regions"], len(truth)):
                    raise ValueError(f"Unreviewed letter positions: {identifier}")
                reading = f"{source['papyrus']}, column {entry['column']}, line {entry['line']}"
                mapping = {"edition": entry["edition"], "edition_indices": entry["indices"],
                           "guide": truth, "letter_regions": entry["letter_regions"]}
            task = entry.get("task", "read")
            if task not in {"read", "study"} or task == "study" and truth == "none":
                raise ValueError(f"Invalid corpus task: {identifier}")
            item = {"id": identifier, "set": lesson["id"], "level": lesson["level"], "task": task,
                    "degradation": 0, "truth": truth, "uncertain": [],
                    "image": save_tile(image.crop(rect), identifier),
                    "source_crop": rect, "source_image": source["url"], "source_sha256": source["sha256"],
                    "corpus": True, "difficulty": entry["difficulty"],
                    "alt": f"An original region from {source['papyrus']}",
                    "reading": reading, "source": source["source_ids"], "credit": source["credit"],
                    "license": source["license"], "checked": str(entry["checked"]),
                    "changes": "cropped from the published image; no strokes added, hidden or altered",
                    "hint": entry["hint"], "explain": entry["explain"], **mapping}
            if task == "study":
                item.update(stage="Meet another handwritten form", preparation="Compare the named letters with their places in the original.")
            items.append(item)
    if assigned != candidates.keys():
        raise ValueError(f"Unassigned reviewed corpus items: {sorted(candidates.keys() - assigned)}")
    return items, sets
