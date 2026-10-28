"""Builds the image tiles for levels 1–3 from data/crops.yaml.

    .venv/bin/python tools/make_items.py

Downloads the public source images into .cache/ (once), cuts the tiles, writes them to
public/images/ and regenerates data/items.yaml. It stops with an error when a tile would
break a rule: an "ink" tile without traced ink, an empty tile near traced ink, or a line
whose edition text has lost letters.
"""

from __future__ import annotations

import datetime as dt
import random
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

import numpy as np
import yaml
from PIL import Image
from scipy import ndimage

Image.MAX_IMAGE_PIXELS = None
ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache" / "src"
WORK = ROOT / ".cache" / "work"
OUT = ROOT / "public" / "images"
GREEK = set("ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡϹΤΥΦΧΨΩ")
TODAY = dt.date.today().isoformat()


def fail(msg: str) -> None:
    sys.exit(f"make_items: {msg}")


def fetch(key: str, name: str, url: str) -> Path:
    """Downloads a source file once into .cache/src."""
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{key}__{name}{Path(url).suffix}"
    if not path.exists():
        print(f"  downloading {url}")
        tmp = path.with_suffix(path.suffix + ".part")
        urllib.request.urlretrieve(url, tmp)
        tmp.rename(path)
    return path


def parse_edition(text: str) -> tuple[str, list[int]]:
    """Edition text -> capitals as on the papyrus, plus positions of uncertain letters.

    Accents, breathings, punctuation and elision marks are dropped; a dot below a letter
    (U+0323) marks it uncertain; {x} (written by the scribe, deleted by the editor) is kept;
    <x> (added by the editor) is dropped; [x] (lost) is refused.
    """
    if "[" in text or "]" in text:
        fail(f"edition line has lost letters, not usable: {text}")
    text = re.sub(r"<[^>]*>", "", text).replace("{", "").replace("}", "")
    letters: list[str] = []
    uncertain: list[int] = []
    for ch in unicodedata.normalize("NFD", text):
        if ch == "̣":
            if not letters:
                fail(f"dot below without a letter in: {text}")
            uncertain.append(len(letters) - 1)
        elif unicodedata.combining(ch):
            continue
        elif ch.isalpha():
            up = "Ϲ" if ch in "ϲςσΣ" else ch.upper()
            if up not in GREEK:
                fail(f"unexpected character {ch!r} in edition line: {text}")
            letters.append(up)
    return "".join(letters), sorted(set(uncertain))


def save_tile(img: Image.Image, name: str, longest: int | None = None) -> str:
    OUT.mkdir(parents=True, exist_ok=True)
    if longest and max(img.size) > longest:
        f = longest / max(img.size)
        img = img.resize((round(img.width * f), round(img.height * f)), Image.LANCZOS)
    path = OUT / f"{name}.webp"
    img.save(path, "WEBP", quality=86, method=6)
    return path.name


def work_images(key: str, src: dict) -> dict[str, np.ndarray]:
    """Shrinks large sources once and keeps them as greyscale arrays."""
    WORK.mkdir(parents=True, exist_ok=True)
    scale = src.get("work_scale", 1)
    out = {}
    for name, url in src["files"].items():
        small = WORK / f"{key}__{name}__s{scale}.png"
        if not small.exists():
            full = Image.open(fetch(key, name, url)).convert("L")
            size = (full.width // scale, full.height // scale)
            resample = Image.LANCZOS if name == "image" else Image.BILINEAR
            full.resize(size, resample).save(small)
        out[name] = np.asarray(Image.open(small).convert("L"))
    return out


def ir_tiles(cfg: dict, sources: dict, set_level: dict) -> list[dict]:
    key = cfg["source"]
    src = sources[key]
    arr = work_images(key, src)
    ir, trace, mask = arr["image"], arr["tracing"] > 127, arr["mask"] > 127
    items = []
    common = {
        "set": cfg["set"],
        "level": set_level[cfg["set"]],
        "degradation": 0,
        "source": src["source_ids"],
        "license": src["license"],
        "credit": src["credit"],
        "checked": TODAY,
        "changes": "cropped and scaled down; greyscale as in the infrared photo",
        "task": "detect",
    }
    w, h = cfg["window"]
    for t in cfg["ink"]:
        cx, cy = t["at"]
        x, y = cx - w // 2, cy - h // 2
        if x < 0 or y < 0 or x + w > ir.shape[1] or y + h > ir.shape[0]:
            fail(f"{t['id']}: tile reaches outside the image")
        traced = trace[y : y + h, x : x + w]
        if traced.sum() < 0.002 * w * h:
            fail(f"{t['id']}: no traced ink in this box")
        tile = Image.fromarray(ir[y : y + h, x : x + w])
        overlay = np.stack([ir[y : y + h, x : x + w]] * 3, -1).astype(np.float32)
        red = np.array([220, 30, 30], np.float32)
        overlay[traced] = overlay[traced] * 0.35 + red * 0.65
        items.append(
            {
                "id": t["id"],
                **common,
                "image": save_tile(tile, t["id"], cfg["size"]),
                "answer_image": save_tile(Image.fromarray(overlay.astype(np.uint8)), t["id"] + "-traced", cfg["size"]),
                "alt": "Infrared photo of an opened papyrus fragment",
                "truth": "*",
                "reading": "ink traced by the organizers; no published reading of the letters",
                "explain": cfg["explain_ink"],
            }
        )

    # Empty tiles: inside the fragment, far from tracing, no dark patches.
    e = cfg["empty"]
    near_ink = ndimage.distance_transform_edt(~trace) < e["margin"]
    papyrus = ir[mask]
    dark = ir < np.percentile(papyrus, e["dark_percentile"])
    integ = lambda a: np.pad(a.astype(np.int64).cumsum(0).cumsum(1), ((1, 0), (1, 0)))
    I_mask, I_ink, I_dark = integ(mask), integ(near_ink), integ(dark)
    box_sum = lambda I, x, y: I[y + h, x + w] - I[y, x + w] - I[y + h, x] + I[y, x]
    cands = []
    for y in range(0, ir.shape[0] - h, 40):
        for x in range(0, ir.shape[1] - w, 40):
            if box_sum(I_mask, x, y) < w * h or box_sum(I_ink, x, y) > 0:
                continue
            if any(x + w > ax0 and x < ax1 and y + h > ay0 and y < ay1 for ax0, ay0, ax1, ay1 in e.get("avoid", [])):
                continue
            cands.append((box_sum(I_dark, x, y) / (w * h), x, y))
    cands.sort()
    chosen: list[tuple[int, int]] = []
    for frac, x, y in cands:
        if frac > e["max_dark_share"]:
            break
        if all(abs(x - cx) > w * 1.2 or abs(y - cy) > h * 1.2 for cx, cy in chosen):
            chosen.append((x, y))
        if len(chosen) == len(e["ids"]):
            break
    if len(chosen) < e["min"]:
        fail(f"found only {len(chosen)} clean empty windows, need {e['min']}")
    print(f"  {len(chosen)} clean empty windows")
    for tile_id, (x, y) in zip(e["ids"], sorted(chosen, key=lambda p: (p[1], p[0]))):
        items.append(
            {
                "id": tile_id,
                **common,
                "image": save_tile(Image.fromarray(ir[y : y + h, x : x + w]), tile_id, cfg["size"]),
                "alt": "Infrared photo of an opened papyrus fragment",
                "truth": "none",
                "reading": f"no ink traced within {e['margin'] * src.get('work_scale', 1)} px of this area",
                "explain": cfg["explain_empty"],
                "box": [x, y, w, h],
            }
        )
    return items


def line_tiles(cfg: dict, sources: dict, set_level: dict) -> list[dict]:
    key = cfg["source"]
    src = sources[key]
    img = Image.open(fetch(key, "image", src["files"]["image"])).convert("RGB")
    x0, x1 = cfg["x"]
    half = cfg["height"] // 2
    common = {
        "set": cfg["set"],
        "level": set_level[cfg["set"]],
        "degradation": 0,
        "source": [cfg["reading_source"], *src["source_ids"]],
        "license": src["license"],
        "credit": src["credit"],
        "checked": TODAY,
        "changes": "cut to one line",
        "task": "read",
    }
    alt = f"One line of an ink detection image of a closed scroll"
    items = []
    for it in cfg["items"]:
        truth, uncertain = parse_edition(it["edition"])
        crop = img.crop((x0, it["y"] - half, x1, it["y"] + half))
        tile_id = f"{cfg['set']}-l{it['line']:02d}"
        items.append(
            {
                "id": tile_id,
                **common,
                "image": save_tile(crop, tile_id),
                "alt": alt,
                "truth": truth,
                "uncertain": uncertain,
                "edition": it["edition"],
                "reading": f"column {cfg['column']}, line {it['line']}",
                "explain": cfg["explain"],
            }
        )
    return items


def window_tiles(cfg: dict, sources: dict, set_level: dict) -> list[dict]:
    """Same-size windows: inside the column (text) or between columns (blank, per the edition)."""
    key = cfg["source"]
    src = sources[key]
    img = Image.open(fetch(key, "image", src["files"]["image"])).convert("RGB")
    w, h = cfg["size"]
    common = {
        "set": cfg["set"],
        "level": set_level[cfg["set"]],
        "degradation": 0,
        "source": [cfg["reading_source"], *src["source_ids"]],
        "license": src["license"],
        "credit": src["credit"],
        "checked": TODAY,
        "changes": "cut to a small window",
        "task": "detect",
        "alt": "A small window of an ink detection image of a closed scroll",
    }
    items = []
    for kind, truth, text in (("text", "*", cfg["explain_text"]), ("blank", "none", cfg["explain_blank"])):
        for t in cfg[kind]:
            x, y = t["at"]
            if x < 0 or y < 0 or x + w > img.width or y + h > img.height:
                fail(f"{t['id']}: window reaches outside the image")
            note = {k: v for k, v in t.items() if k not in ("id", "at")}
            items.append(
                {
                    "id": t["id"],
                    **common,
                    "image": save_tile(img.crop((x, y, x + w, y + h)), t["id"]),
                    "truth": truth,
                    "reading": (f"inside the column, lines {t['lines']}" if kind == "text" else f"blank space between columns {t['between']}"),
                    "explain": text.format(**note),
                    "box": [x, y, w, h],
                }
            )
    return items


def main() -> None:
    cfg = yaml.safe_load((ROOT / "data" / "crops.yaml").read_text())
    known = {s["id"] for s in yaml.safe_load((ROOT / "data" / "sources.yaml").read_text())["sources"]}
    for key, src in cfg["sources"].items():
        for sid in src["source_ids"]:
            if sid not in known:
                fail(f"source {key}: unknown source id {sid}")
    set_level = {s["id"]: s["level"] for s in cfg["sets"]}
    items = (
        ir_tiles(cfg["ir_tiles"], cfg["sources"], set_level)
        + line_tiles(cfg["lines"], cfg["sources"], set_level)
        + window_tiles(cfg["windows"], cfg["sources"], set_level)
    )
    written = {i["image"] for i in items} | {i["answer_image"] for i in items if "answer_image" in i}
    for stale in OUT.glob("*.webp"):
        if stale.name not in written:
            stale.unlink()
    header = (
        "# GENERATED by tools/make_items.py from data/crops.yaml. Do not edit by hand.\n"
        "# Field meanings: see the comment at the top of data/crops.yaml and src/types.ts.\n"
        "# truth: capitals as read; \"*\" = ink present, letters not confirmed; \"none\" = no text.\n\n"
    )
    sets = [{"id": s["id"], "level": s["level"], "title": s["title"]} for s in cfg["sets"]]
    body = yaml.safe_dump({"sets": sets, "items": items}, allow_unicode=True, sort_keys=False, width=100)
    (ROOT / "data" / "items.yaml").write_text(header + body)
    by_level: dict[int, list[dict]] = {}
    for i in items:
        by_level.setdefault(i["level"], []).append(i)
    for lvl, lst in sorted(by_level.items()):
        empty = sum(i["truth"] == "none" for i in lst)
        print(f"level {lvl}: {len(lst)} tiles, {empty} empty")


if __name__ == "__main__":
    main()
