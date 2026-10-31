"""Guard the boundary between an edition, an original crop and a quiz answer."""

import copy
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from corpus_items import edition_positions, generate_corpus


class CorpusTests(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.path = Path(directory.name) / "original.png"
        self.image = Image.new("RGB", (12, 8))
        self.image.putdata([(x * 15, y * 25, x + y) for y in range(8) for x in range(12)])
        self.image.save(self.path)
        self.manifest = {
            "sources": {"original": {"url": "https://example.org/original.png", "sha256": hashlib.sha256(self.path.read_bytes()).hexdigest(),
                "size": [12, 8], "papyrus": "Published papyrus", "source_ids": ["edition"], "credit": "Vesuvius Challenge", "license": "CC BY-NC 4.0"}},
            "items": [{"id": "reading-a", "source_key": "original", "column": "I", "line": 2,
                "edition": "[τὸ] καὶ", "line_truth": "ΤΟΚΑΙ", "indices": [2, 5], "rect": [1, 1, 11, 7],
                "letter_regions": [[0, 0, .3, 1], [.3, 0, .6, 1], [.6, 0, 1, 1]],
                "difficulty": "medium", "hint": "Compare the strokes.", "explain": "A published group.", "checked": "2026-10-31"}],
        }
        self.lessons = {"lessons": [{"id": "new-readings", "level": 4, "title": "New readings", "intro": "Read a short group.", "items": ["reading-a"]}]}
        self.saved = []

    def generate(self):
        def save(image, name):
            self.saved.append(image.copy())
            return name + ".webp"
        return generate_corpus([self.manifest], self.lessons, lambda *_: self.path, save)

    def test_safe_group_beside_restoration_keeps_original_pixels(self):
        items, _ = self.generate()
        self.assertEqual(items[0]["truth"], "ΚΑΙ")
        self.assertEqual(items[0]["edition"], "[τὸ] καὶ")
        self.assertEqual(self.saved[0].tobytes(), self.image.crop((1, 1, 11, 7)).tobytes())
        self.assertEqual(items[0]["letter_regions"], self.manifest["items"][0]["letter_regions"])

    def test_uncertain_and_editorially_supplied_letters_never_become_targets(self):
        for edition in ("[τὸ κ]αὶ", "τὸ κ̣αὶ", "τὸ <κ>αὶ", "τὸ ⟨κ⟩αὶ"):
            with self.subTest(edition=edition):
                self.manifest["items"][0]["edition"] = edition
                with self.assertRaisesRegex(ValueError, "Uncertain or restored"):
                    self.generate()
        with self.assertRaisesRegex(ValueError, "brackets"):
            edition_positions("[καὶ")

    def test_changed_source_or_positions_require_rechecking(self):
        self.manifest["items"][0]["letter_regions"][0] = [0, 0, 1.2, 1]
        with self.assertRaisesRegex(ValueError, "letter positions"):
            self.generate()
        Image.new("RGB", (12, 8), "red").save(self.path)
        with self.assertRaisesRegex(ValueError, "source changed"):
            self.generate()

    def test_duplicate_region_is_not_counted_as_another_original(self):
        duplicate = copy.deepcopy(self.manifest["items"][0])
        duplicate["id"] = "reading-b"
        self.manifest["items"].append(duplicate)
        self.lessons["lessons"][0]["items"].append("reading-b")
        with self.assertRaisesRegex(ValueError, "Duplicate source region"):
            self.generate()

    def test_empty_region_is_an_ordinary_reading_without_fake_letters(self):
        self.manifest["items"][0] = {"id": "reading-a", "source_key": "original", "rect": [1, 1, 11, 7],
            "truth": "none", "blank": True, "reading": "Space between columns", "difficulty": "medium",
            "hint": "Compare with the reference.", "explain": "No visible writing in this region.", "checked": "2026-10-31"}
        items, _ = self.generate()
        self.assertEqual((items[0]["task"], items[0]["truth"]), ("read", "none"))
        self.assertNotIn("letter_regions", items[0])
        self.assertNotIn("guide", items[0])


if __name__ == "__main__":
    unittest.main()
