"""Deterministic teaching variants of already verified image tiles.

This module changes the *view*, never the source reading. Its output is explicitly
simulated practice material, not a scanner-resolution model. Each altered tile
keeps an unchanged reference and a machine-readable recipe.
"""

from __future__ import annotations

import copy
import hashlib
import re
from pathlib import Path
from typing import Callable

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


RECIPE_VERSION = 1
# Increasing difficulty is a teaching sequence, not an estimate of micrometre resolution.
RECIPES = {
    1: {"blur_radius": 0.65, "contrast": 1.0, "noise_sigma": 0.0, "coarsen": 1},
    2: {"blur_radius": 0.8, "contrast": 0.72, "noise_sigma": 2.5, "coarsen": 1},
    3: {"blur_radius": 1.15, "contrast": 0.68, "noise_sigma": 3.5, "coarsen": 3},
    4: {"blur_radius": 1.65, "contrast": 0.54, "noise_sigma": 5.0, "coarsen": 5},
    5: {"blur_radius": 2.0, "contrast": 0.5, "noise_sigma": 6.0, "coarsen": 6},
}
STAGES = {
    1: "A little softer",
    2: "Less contrast, more noise",
    3: "Fewer image details",
    4: "When several clues weaken",
    5: "When part of the view is covered",
}
SAFE_ID = re.compile(r"^[a-z0-9][a-z0-9-]*$")


def _error(message: str) -> None:
    raise ValueError(f"degrade_items: {message}")


def _image_path(root: Path, name: str) -> Path:
    if not isinstance(name, str) or Path(name).name != name:
        _error("image references must be plain filenames")
    path = root / name
    if not path.is_file():
        _error(f"missing source image {name}")
    return path


def _recipe(item_id: str, base_id: str, degree: int) -> dict:
    seed = int.from_bytes(hashlib.sha256(f"{RECIPE_VERSION}:{item_id}:{base_id}".encode()).digest()[:4], "big")
    return {
        "version": RECIPE_VERSION,
        "seed": seed,
        **RECIPES[degree],
        # Normalized [left, top, width, height], independent of image content/truth.
        "occlusion": [[0.43, 0.0, 0.13, 1.0]] if degree == 5 else [],
        "occlusion_fill": "median of altered image",
        "operation_order": ["blur", "contrast", "coarsen", "noise", "occlusion"],
    }


def _covered(size: tuple[int, int], rectangles: list[list[float]]) -> np.ndarray:
    width, height = size
    covered = np.zeros((height, width), dtype=bool)
    for x, y, w, h in rectangles:
        left, top = round(x * width), round(y * height)
        right, bottom = round((x + w) * width), round((y + h) * height)
        covered[top:bottom, left:right] = True
    return covered


def _alter(image: Image.Image, recipe: dict) -> Image.Image:
    image = image.convert("RGB")
    size = image.size
    if recipe["blur_radius"]:
        image = image.filter(ImageFilter.GaussianBlur(recipe["blur_radius"]))
    image = ImageEnhance.Contrast(image).enhance(recipe["contrast"])
    factor = recipe["coarsen"]
    if factor > 1:
        image = image.resize((max(1, round(size[0] / factor)), max(1, round(size[1] / factor))), Image.Resampling.BOX)
        image = image.resize(size, Image.Resampling.NEAREST)
    pixels = np.asarray(image).astype(np.float64)
    if recipe["noise_sigma"]:
        # Shared noise across RGB channels avoids invented coloured markings.
        rng = np.random.default_rng(recipe["seed"])
        pixels += rng.normal(0.0, recipe["noise_sigma"], size=(size[1], size[0], 1))
    pixels = np.clip(np.rint(pixels), 0, 255).astype(np.uint8)
    covered = _covered(size, recipe["occlusion"])
    if covered.any():
        pixels[covered] = np.median(pixels.reshape(-1, 3), axis=0).astype(np.uint8)
    return Image.fromarray(pixels)


def _check_remaining_ink(
    base_id: str, overlay: Image.Image | None, size: tuple[int, int], recipe: dict, is_empty: bool
) -> None:
    """Only cover positive tiles whose organizer tracing proves ink remains outside it."""
    if not recipe["occlusion"] or is_empty:
        return
    if overlay is None:
        _error(f"{base_id}: covering a positive tile requires its original ink overlay")
    overlay = overlay.convert("RGB")
    if overlay.size != size:
        _error(f"{base_id}: reference overlay dimensions differ from the source")
    channels = np.asarray(overlay).astype(np.int16)
    # The existing IR generator adds red to the organizers' mask. A wide threshold
    # avoids counting small WebP differences as traced ink.
    traced = (channels[:, :, 0] - channels[:, :, 1] > 60) & (channels[:, :, 0] - channels[:, :, 2] > 60)
    if traced.sum() < 10:
        _error(f"{base_id}: no identifiable organizer tracing in reference overlay")
    remaining = traced & ~_covered(size, recipe["occlusion"])
    if remaining.sum() / traced.sum() < 0.2:
        _error(f"{base_id}: too much of the known ink would be covered")


def create_variant(
    image: Image.Image,
    degree: int,
    *,
    variant_id: str,
    base_id: str,
    reference_overlay: Image.Image | None = None,
    is_empty: bool = False,
) -> tuple[Image.Image, dict]:
    """Return deterministic pixels and their recipe for guided or repeat practice.

    A stable variant_id gives stable noise; a different id creates a new realization
    at the same difficulty. Nothing is cropped, rotated or mirrored. On degree 5,
    positive images require an organizer's red overlay as an occlusion safeguard.
    The caller preserves the unaltered source and its verified answer. Degrees 4–5
    are for presence questions only, never for grading a letter identity.
    """
    if type(degree) is not int or degree not in RECIPES:
        _error("variant difficulty must be an integer from 1 to 5")
    if not variant_id or not base_id:
        _error("a variant needs stable variant and source identifiers")
    recipe = _recipe(variant_id, base_id, degree)
    _check_remaining_ink(base_id, reference_overlay, image.size, recipe, is_empty)
    altered = _alter(image, recipe)
    if altered.size != image.size:
        _error(f"{variant_id}: altered image dimensions changed")
    return altered, recipe


def generate_degradations(
    cfg: dict,
    existing_items: list[dict],
    out_path: str | Path,
    save_tile: Callable[[Image.Image, str], str],
) -> list[dict]:
    """Generate a configured, ordered practice set from existing verified items.

    cfg requires ``set`` and ``items``. Every entry has ``id``, ``base`` and
    ``degradation`` (1–5); optional task is ``detect`` or ``read``. Optional
    ``stage``, ``question``, ``preparation``, ``hint`` and ``explain`` customize
    teaching copy, without replacing provenance. ``level`` defaults to 3.

    Existing image files live in out_path. The callback writes an unscaled image
    and returns its filename, following make_items.save_tile's normal contract.
    """
    if cfg.get("level", 3) != 3 or not cfg.get("set") or not cfg.get("items"):
        _error("expected a nonempty level-3 set")
    root = Path(out_path)
    by_id = {item["id"]: item for item in existing_items}
    if len(by_id) != len(existing_items):
        _error("existing item ids are not unique")
    ids = set(by_id)
    items: list[dict] = []
    # A detection tile's dimensions and degradation must not disclose its answer.
    detection_families: dict[tuple[int, int, int], set[bool]] = {}
    previous_degree = 0
    for entry in cfg["items"]:
        item_id = entry.get("id", "")
        if not SAFE_ID.fullmatch(item_id) or item_id in ids:
            _error(f"invalid or duplicate item id {item_id!r}")
        ids.add(item_id)
        base = by_id.get(entry.get("base"))
        if base is None or base.get("degradation", 0) != 0:
            _error(f"{item_id}: base must be an existing unaltered tile")
        if base.get("task") not in ("detect", "read"):
            _error(f"{item_id}: base must have a verified detection or edition-reading answer")
        degree = entry.get("degradation")
        if type(degree) is not int or degree not in RECIPES or degree < previous_degree:
            _error(f"{item_id}: degradation must progress monotonically from 1 to 5")
        previous_degree = degree
        task = entry.get("task", base["task"])
        if task not in ("read", "detect"):
            _error(f"{item_id}: expected detect or read task")
        if task == "read" and (base["task"] != "read" or degree > 3):
            _error(f"{item_id}: reading needs an edition-backed line and degradation at most 3")
        source_path = _image_path(root, base["image"])
        image = Image.open(source_path).convert("RGB")
        is_empty = base["truth"] == "none"
        overlay = Image.open(_image_path(root, base["answer_image"])) if degree == 5 and base.get("answer_image") else None
        altered, recipe = create_variant(
            image, degree, variant_id=item_id, base_id=base["id"], reference_overlay=overlay, is_empty=is_empty
        )
        recipe["base_image_sha256"] = hashlib.sha256(source_path.read_bytes()).hexdigest()
        if task == "detect":
            detection_families.setdefault((*image.size, degree), set()).add(is_empty)
        truth = base["truth"] if task == "read" or is_empty else "*"
        preparation = {
            1: "The edges are a little softer. Look for strokes that still hold together.",
            2: "Contrast is lower and noise has been added. Follow connected marks rather than isolated specks.",
            3: "Coarser sampling removes fine detail. Use ? for a letter whose shape you cannot make out.",
            4: "Several clues are weaker now. ‘I cannot tell’ and ‘there is no writing’ are different answers.",
            5: "A vertical strip covers part of the image. Base your answer on the marks that remain visible.",
        }[degree]
        explain = (
            "Compare the unchanged reference shown here. Its answer comes from the original "
            "source; blur, noise or a covered region do not create a new reading. "
            + ("Your letters are compared with the published edition. A question mark records what you could not read in this altered view. " if task == "read" else "Only the presence of ink is checked here; letter suggestions are not graded. ")
            + base["explain"]
        )
        changes = (
            f"practice alteration {degree}/5 of {base['image']}: "
            f"Gaussian blur {recipe['blur_radius']} px; contrast factor {recipe['contrast']}; "
            f"noise standard deviation {recipe['noise_sigma']}/255; "
            f"downsampling factor {recipe['coarsen']} with nearest-neighbour enlargement"
            + ("; a vertical strip deliberately covered" if recipe["occlusion"] else "")
            + ". This does not simulate a stated scan resolution."
        )
        item = {
            "id": item_id,
            "set": cfg["set"],
            "level": 3,
            "degradation": degree,
            "task": task,
            "truth": truth,
            "image": save_tile(altered, item_id),
            "alt": "Deliberately altered practice view. " + base["alt"],
            "base_item": base["id"],
            "reference_image": base["image"],
            "reference_truth": base["truth"],
            "simulated": True,
            "degradation_recipe": recipe,
            "stage": entry.get("stage", STAGES[degree]),
            "question": entry.get("question", "Which letters can you read in this altered view? Use ? wherever you cannot tell." if task == "read" else "Does this altered view give you evidence of ink?"),
            "preparation": entry.get("preparation", preparation),
            "explain": entry.get("explain", explain),
            "changes": changes,
            **{key: copy.deepcopy(base[key]) for key in ("source", "license", "credit", "checked", "reading") if key in base},
        }
        if base.get("answer_image"):
            item["reference_answer_image"] = base["answer_image"]
        if task == "read":
            for key in ("edition", "uncertain", "edition_indices", "source_crop"):
                if key in base:
                    item[key] = copy.deepcopy(base[key])
        if "hint" in entry:
            item["hint"] = entry["hint"]
        items.append(item)
    if sum(item["truth"] == "none" for item in items) / len(items) < 0.2:
        _error("at least 20% of scored altered tiles must be empty")
    for family, answers in detection_families.items():
        if answers != {False, True}:
            _error(f"detection size/degradation {family} needs both ink and empty examples")
    return items
