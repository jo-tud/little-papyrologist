"""Protect source-image identity, edition uncertainty and untouched crop pixels."""

import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from alphabet_items import reference_groups


class AlphabetSourcesTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.path = Path(self.directory.name) / "source.png"
        self.image = Image.new("RGB", (8, 6))
        self.image.putdata([(x * 20, y * 30, x + y) for y in range(6) for x in range(8)])
        self.image.save(self.path)
        self.config = {
            "source_sha256": hashlib.sha256(self.path.read_bytes()).hexdigest(),
            "source_size": [8, 6],
            "groups": [{"id": "test-reference", "edition": "καί", "line_truth": "ΚΑΙ",
                        "column": "−12", "line": 4, "indices": [1, 3], "rect": [2, 1, 7, 5],
                        "explain": "The last two letters in a published group."}],
        }
        self.source = {"source_ids": ["grandprize"], "credit": "Vesuvius Challenge; EduceLab, University of Kentucky",
                       "license": "CC BY-NC 4.0"}
        self.saved = []

    def generate(self, uncertain=()):
        def save(image, name):
            self.saved.append(image.copy())
            return name + ".webp"
        return reference_groups(self.config, self.path, self.source,
                                lambda _: ("ΚΑΙ", list(uncertain)), save, "2026-10-31")

    def test_keeps_published_group_and_original_pixels(self):
        item, = self.generate()
        self.assertEqual(item["truth"], "ΑΙ")
        self.assertEqual(item["edition_indices"], [1, 3])
        self.assertEqual(item["source"], ["cerc54", "grandprize"])
        self.assertEqual(item["task"], "study")
        self.assertEqual(item["set"], "alphabet-reference")
        self.assertEqual(self.saved[0].tobytes(), self.image.crop((2, 1, 7, 5)).tobytes())

    def test_rejects_uncertain_target_but_allows_uncertainty_elsewhere(self):
        self.generate(uncertain=[0])
        with self.assertRaisesRegex(ValueError, "uncertain"):
            self.generate(uncertain=[1])

    def test_rejects_changed_source_or_edition(self):
        self.config["groups"][0]["line_truth"] = "ΚΑΤ"
        with self.assertRaisesRegex(ValueError, "edition changed"):
            self.generate()
        self.config["groups"][0]["line_truth"] = "ΚΑΙ"
        Image.new("RGB", (8, 6), "red").save(self.path)
        with self.assertRaisesRegex(ValueError, "source image changed"):
            self.generate()


if __name__ == "__main__":
    unittest.main()
