"""Source-preservation and answer-safety contracts for altered practice images.

All fixtures are small synthetic images; no public data or downloads are needed.
Run with: .venv/bin/python -m unittest discover -s tests -p 'test_*.py'
"""

from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from degrade_items import create_variant, generate_degradations  # noqa: E402


class DegradationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.image = Image.new("RGB", (128, 96), (180, 180, 180))
        draw = ImageDraw.Draw(self.image)
        draw.rectangle((12, 16, 24, 78), fill=(30, 30, 30))
        draw.rectangle((100, 16, 112, 78), fill=(30, 30, 30))
        self.image.save(self.root / "ink.png")
        Image.new("RGB", self.image.size, (180, 180, 180)).save(self.root / "empty.png")
        self.overlay = self.image.copy()
        draw = ImageDraw.Draw(self.overlay)
        draw.rectangle((12, 16, 24, 78), fill=(220, 30, 30))
        draw.rectangle((100, 16, 112, 78), fill=(220, 30, 30))
        self.overlay.save(self.root / "ink-traced.png")
        common = {
            "level": 2,
            "degradation": 0,
            "task": "detect",
            "alt": "Synthetic test fixture",
            "source": ["fixture-source"],
            "license": "CC BY-NC 4.0",
            "credit": "Vesuvius Challenge",
            "checked": "2026-10-28",
            "reading": "fixture reference",
            "explain": "Known fixture marks.",
        }
        self.bases = [
            {**common, "id": "ink", "image": "ink.png", "answer_image": "ink-traced.png", "truth": "*"},
            {**common, "id": "empty", "image": "empty.png", "truth": "none"},
            {
                **common,
                "id": "line",
                "image": "ink.png",
                "task": "read",
                "truth": "ΝΙ",
                "edition": "νι̣",
                "uncertain": [1],
                "edition_indices": [2, 3],
                "source_crop": [10, 20, 128, 96],
            },
        ]

    def save(self, image: Image.Image, name: str) -> str:
        filename = name + ".png"
        image.save(self.root / filename)
        return filename

    def generate(self, entries: list[dict], bases: list[dict] | None = None) -> list[dict]:
        return generate_degradations(
            {"set": "altered-fixtures", "level": 3, "items": entries},
            self.bases if bases is None else bases,
            self.root,
            self.save,
        )

    def test_same_identity_reproduces_pixels_and_serializable_recipe(self) -> None:
        first, first_recipe = create_variant(self.image, 3, variant_id="repeat-a", base_id="ink")
        again, again_recipe = create_variant(self.image, 3, variant_id="repeat-a", base_id="ink")
        self.assertEqual(first.tobytes(), again.tobytes())
        self.assertEqual(first_recipe, again_recipe)
        self.assertEqual(json.loads(json.dumps(first_recipe)), first_recipe)
        self.assertIn("seed", first_recipe)
        self.assertIn("version", first_recipe)
        self.assertIn("operation_order", first_recipe)

    def test_new_identity_changes_noisy_variant(self) -> None:
        first, first_recipe = create_variant(self.image, 3, variant_id="repeat-a", base_id="ink")
        other, other_recipe = create_variant(self.image, 3, variant_id="repeat-b", base_id="ink")
        self.assertNotEqual(first_recipe["seed"], other_recipe["seed"])
        self.assertNotEqual(first.tobytes(), other.tobytes())
        for key in ("blur_radius", "contrast", "noise_sigma", "coarsen", "occlusion"):
            self.assertEqual(first_recipe[key], other_recipe[key])

    def test_every_degree_preserves_frame_and_input_pixels(self) -> None:
        original = self.image.tobytes()
        for degree in range(1, 6):
            with self.subTest(degree=degree):
                altered, recipe = create_variant(
                    self.image,
                    degree,
                    variant_id=f"degree-{degree}",
                    base_id="ink",
                    reference_overlay=self.overlay,
                )
                self.assertEqual(altered.size, self.image.size)
                self.assertEqual(self.image.tobytes(), original)
                self.assertGreaterEqual(recipe["coarsen"], 1)
                self.assertGreater(recipe["contrast"], 0)

    def test_generated_items_keep_original_reference_and_provenance(self) -> None:
        before_items = copy.deepcopy(self.bases)
        before_files = {path.name: path.read_bytes() for path in self.root.iterdir()}
        entries = [
            {"id": "altered-ink", "base": "ink", "degradation": 2},
            {"id": "altered-empty", "base": "empty", "degradation": 2},
            {"id": "altered-line", "base": "line", "degradation": 2},
        ]
        output = self.generate(entries)
        again = self.generate(entries)
        self.assertEqual(output, again)
        self.assertEqual(self.bases, before_items)
        for name, content in before_files.items():
            self.assertEqual((self.root / name).read_bytes(), content)
        for item, base in zip(output, self.bases):
            with self.subTest(base=base["id"]):
                self.assertTrue(item["simulated"])
                self.assertEqual(item["base_item"], base["id"])
                self.assertEqual(item["reference_image"], base["image"])
                self.assertEqual(item["reference_truth"], base["truth"])
                self.assertNotEqual(item["image"], base["image"])
                for key in ("source", "license", "credit", "checked", "reading"):
                    self.assertEqual(item[key], base[key])
                self.assertEqual(
                    item["degradation_recipe"]["base_image_sha256"],
                    hashlib.sha256(before_files[base["image"]]).hexdigest(),
                )
                with Image.open(self.root / item["image"]) as image:
                    self.assertEqual(image.size, self.image.size)
        self.assertEqual(output[0]["reference_answer_image"], "ink-traced.png")
        for key in ("truth", "edition", "uncertain", "edition_indices", "source_crop"):
            self.assertEqual(output[2][key], self.bases[2][key])
        # Derived metadata must not alias editable original metadata.
        output[2]["uncertain"].append(0)
        output[2]["source"].append("another-source")
        self.assertEqual(self.bases, before_items)

    def test_rejects_too_few_empty_examples(self) -> None:
        entries = [{"id": f"positive-{i}", "base": "ink", "degradation": 1} for i in range(5)]
        entries.append({"id": "one-empty", "base": "empty", "degradation": 1})
        with self.assertRaisesRegex(ValueError, "20%"):
            self.generate(entries)

    def test_rejects_frame_that_discloses_answer(self) -> None:
        Image.new("RGB", (64, 96), (180, 180, 180)).save(self.root / "narrow-empty.png")
        bases = copy.deepcopy(self.bases)
        bases[1]["image"] = "narrow-empty.png"
        with self.assertRaisesRegex(ValueError, "size/degradation"):
            self.generate([
                {"id": "framed-ink", "base": "ink", "degradation": 2},
                {"id": "framed-empty", "base": "empty", "degradation": 2},
            ], bases)

    def test_rejects_difficulty_that_discloses_answer(self) -> None:
        with self.assertRaisesRegex(ValueError, "size/degradation"):
            self.generate([
                {"id": "easy-ink", "base": "ink", "degradation": 1},
                {"id": "harder-empty", "base": "empty", "degradation": 2},
            ])

    def test_rejects_reading_after_degree_three(self) -> None:
        for degree in (4, 5):
            with self.subTest(degree=degree), self.assertRaisesRegex(ValueError, "at most 3"):
                self.generate([{"id": "too-hard-line", "base": "line", "degradation": degree}])

    def test_occlusion_requires_reference_and_cannot_hide_all_known_ink(self) -> None:
        with self.assertRaisesRegex(ValueError, "requires.*overlay"):
            create_variant(self.image, 5, variant_id="no-proof", base_id="ink")
        # A narrow central ink mark lies wholly inside the deliberate covered strip.
        hidden_overlay = Image.new("RGB", self.image.size, (180, 180, 180))
        ImageDraw.Draw(hidden_overlay).rectangle((62, 20, 65, 70), fill=(220, 30, 30))
        with self.assertRaisesRegex(ValueError, "too much.*covered"):
            create_variant(
                self.image, 5, variant_id="hidden", base_id="ink", reference_overlay=hidden_overlay
            )

    def test_occlusion_accepts_retained_ink_and_matching_empty_frame(self) -> None:
        items = self.generate([
            {"id": "covered-ink", "base": "ink", "degradation": 5},
            {"id": "covered-empty", "base": "empty", "degradation": 5},
        ])
        self.assertEqual([item["truth"] for item in items], ["*", "none"])
        self.assertEqual(items[0]["degradation_recipe"]["occlusion"], items[1]["degradation_recipe"]["occlusion"])
        self.assertTrue(items[0]["degradation_recipe"]["occlusion"])
        self.assertEqual(items[0]["reference_answer_image"], "ink-traced.png")


if __name__ == "__main__":
    unittest.main()
