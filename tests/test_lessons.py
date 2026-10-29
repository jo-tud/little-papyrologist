"""Edition/provenance and optional-challenge contracts for the short reading path.

The source fixture has synthetic pixels. No downloads or private caches are used;
these checks protect coordinate preservation, not the philological identification.
"""

from __future__ import annotations

import copy
from pathlib import Path
import sys
import tempfile
import unittest

from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))
from lesson_items import generate_lesson, generate_reading_practice  # noqa: E402


class LessonTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.temp = tempfile.TemporaryDirectory()
        cls.root = Path(cls.temp.name)
        source = Image.new("RGB", (16000, 1932), (12, 13, 14))
        draw = ImageDraw.Draw(source)
        # Distinct horizontal and vertical marks detect accidental shifts,
        # resizing or use of a neighbouring line in any of the short rectangles.
        for x in range(8190, 9220, 11):
            draw.line((x, 400, x, 1700), fill=(x % 255, 80, 90))
        for y in range(400, 1700, 13):
            draw.line((8190, y, 9220, y), fill=(80, y % 255, 90))
        cls.source = source
        source.save(cls.root / "source.png")
        for line in (5, 12, 16):
            Image.new("RGB", (1020, 100)).save(cls.root / f"line-{line}.png")

    @classmethod
    def tearDownClass(cls) -> None:
        cls.source.close()
        cls.temp.cleanup()

    def setUp(self) -> None:
        common = {
            "set": "paris4-col-8", "level": 2, "task": "read", "degradation": 0,
            "source": ["grandprize", "cerc54"], "license": "CC BY-NC 4.0",
            "credit": "Vesuvius Challenge; EduceLab, University of Kentucky",
            "checked": "2026-10-28", "changes": "original crop",
        }
        readings = (
            (5, "γείνεϲθαι, παραπλη-", "ΓΕΙΝΕϹΘΑΙΠΑΡΑΠΛΗ", []),
            (12, "πάντωϲ κα̣ὶ ἡδίω", "ΠΑΝΤΩϹΚΑΙΗΔΙΩ", [7]),
            (16, "λοϲ ε̣ἴη{ι}, καὶ κάπ̣πα-", "ΛΟϹΕΙΗΙΚΑΙΚΑΠΠΑ", [3, 12]),
        )
        self.bases = [
            {
                **common, "id": f"paris4-col-8-l{line:02d}", "image": f"line-{line}.png",
                "edition": edition, "truth": truth, "uncertain": uncertain,
                "reading": f"Edition, column −8, line {line}",
            }
            for line, edition, truth, uncertain in readings
        ]
        self.saved = {}

    def save(self, image: Image.Image, name: str) -> str:
        self.saved[name] = image.copy()
        return name + ".png"

    def generate(self, bases: list[dict] | None = None) -> list[dict]:
        return generate_lesson(
            {"set": "first-line", "level": 2, "source_path": self.root / "source.png"},
            self.bases if bases is None else bases,
            self.root,
            self.save,
        )

    def test_short_path_ends_before_optional_whole_line(self) -> None:
        lesson = self.generate()
        self.assertEqual(len(lesson), 9)
        self.assertEqual(lesson[-1]["id"], "first-line-read")
        self.assertTrue(lesson[-1]["optional_challenge"])
        self.assertEqual(lesson[-1]["truth"], "ΓΕΙΝΕϹΘΑΙΠΑΡΑΠΛΗ")
        required = [item for item in lesson if not item.get("optional_challenge")]
        self.assertTrue(all(len(item["truth"]) <= 4 for item in required if item["task"] != "study"))
        self.assertEqual([item["truth"] for item in lesson[-4:-1]], ["ΙΗ", "ΙΗ", "ΠΛΗ"])
        self.assertEqual(lesson[-2]["task"], "study")

    def test_each_fragment_keeps_its_own_edition_and_source_pixels(self) -> None:
        before = copy.deepcopy(self.bases)
        lesson = self.generate()
        bases = {base["id"]: base for base in self.bases}
        for item in lesson[1:-1]:
            with self.subTest(item=item["id"]):
                base = bases[item["base_item"]]
                self.assertEqual(item["edition"], base["edition"])
                self.assertEqual(item["reading"], base["reading"])
                start, end = item["edition_indices"]
                self.assertEqual(item["truth"], base["truth"][start:end])
                self.assertFalse(any(start <= index < end for index in base["uncertain"]))
                self.assertEqual(item["uncertain"], [])
                self.assertEqual(self.saved[item["id"]].tobytes(), self.source.crop(item["source_crop"]).tobytes())
                self.assertNotIn("answer_image", item)
        self.assertEqual(self.bases, before)

    def test_connected_form_is_scored_only_in_voluntary_recall(self) -> None:
        lesson = self.generate()
        practice = generate_reading_practice(self.bases + lesson)
        self.assertEqual(len(practice), 7)
        connected = next(item for item in practice if item["truth"] == "ΠΛΗ")
        self.assertEqual(connected["task"], "read")
        self.assertTrue(connected["practice_only"])
        self.assertEqual(connected["guide"], "ΠΛΗ")
        self.assertIn("unscored comparison", connected["preparation"])
        self.assertTrue(all(item["practice_group"] == "first-line" for item in lesson + practice))
        self.assertFalse(any(item.get("optional_challenge") for item in practice))

    def test_changed_edition_or_uncertainty_requires_rechecking(self) -> None:
        for field, value in (("edition", "different edition"), ("uncertain", [7, 8]), ("truth", "ΠΑΝΤΩϹΚΑΝΗΔΙΩ")):
            with self.subTest(field=field):
                bases = copy.deepcopy(self.bases)
                bases[1][field] = value
                with self.assertRaisesRegex(ValueError, "edition changed"):
                    self.generate(bases)

    def test_missing_edition_source_and_duplicate_recall_are_rejected(self) -> None:
        bases = copy.deepcopy(self.bases)
        bases[2]["source"] = ["grandprize"]
        with self.assertRaisesRegex(ValueError, "edition and original image sources"):
            self.generate(bases)
        lesson = self.generate()
        practice = generate_reading_practice(self.bases + lesson)
        with self.assertRaisesRegex(ValueError, "duplicate recall item"):
            generate_reading_practice(self.bases + lesson + practice)


if __name__ == "__main__":
    unittest.main()
