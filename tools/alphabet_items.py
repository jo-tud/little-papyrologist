"""Labelled reference crops, kept separate from scored exercises.

These are technical mappings of published readings to image regions. Their
rectangles preserve neighbouring letters when a single-letter boundary is not
clear. No masks or missing strokes are inferred from the edition.
"""

from __future__ import annotations

import hashlib
from pathlib import Path

from PIL import Image


def reference_groups(cfg, source_path, source, parse_edition, save_tile, checked):
    path = Path(source_path)
    if hashlib.sha256(path.read_bytes()).hexdigest() != cfg["source_sha256"]:
        raise ValueError("alphabet: source image changed; recheck the crop coordinates")
    with Image.open(path) as image:
        image = image.convert("RGB")
        if list(image.size) != cfg["source_size"]:
            raise ValueError("alphabet: source dimensions changed")
        items = []
        for group in cfg["groups"]:
            reading, uncertain = parse_edition(group["edition"])
            if reading != group["line_truth"]:
                raise ValueError(f"alphabet {group['id']}: edition changed")
            start, end = group["indices"]
            if not (0 <= start < end <= len(reading)) or any(start <= u < end for u in uncertain):
                raise ValueError(f"alphabet {group['id']}: incomplete or uncertain reading")
            left, top, right, bottom = group["rect"]
            if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
                raise ValueError(f"alphabet {group['id']}: invalid crop")
            items.append({
                "id": group["id"], "set": "alphabet-reference", "level": 2,
                "task": "study", "degradation": 0, "truth": reading[start:end], "uncertain": [],
                "image": save_tile(image.crop(group["rect"]), group["id"]),
                "alt": "A group of bright writing strokes from PHerc. Paris 4",
                "reading": f"column {group['column']}, line {group['line']}",
                "edition": group["edition"], "edition_indices": group["indices"],
                "source_crop": group["rect"], "source": ["cerc54", *source["source_ids"]],
                "license": source["license"], "credit": source["credit"], "checked": checked,
                "changes": "cropped to a group in the published reading; no strokes added or removed",
                "explain": group["explain"],
            })
        return items
