"""Short source-backed readings in the main path; whole lines remain optional."""


def apply_short_curriculum(items: list[dict], references: list[dict], sets: list[dict]) -> None:
    by_id = {item["id"]: item for item in [*items, *references]}
    for item in items:
        if item["task"] == "read" and len(item["truth"]) > 4:
            if item.get("simulated"):
                item["practice_only"] = True
            else:
                item["set"] = "long-lines"
                item["practice_only"] = False
                item.pop("optional_challenge", None)

    # Keep identities and source images intact. These are further encounters with
    # reviewed regions, not new independent samples merely because IDs differ.
    bases = [
        "first-line-extra-l12-iota-eta",
        "first-line-extra-l16-iota-eta",
        "first-line-gamma-epsilon-iota-nu",
        "alphabet-paris4-12-kai",
        "alphabet-paris4-12-ton",
        "alphabet-paris4-12-eta-mu-iota-nu",
        "alphabet-paris4-12-phi-upsilon-rho",
    ]
    groups = []
    for index, source_id in enumerate(bases):
        base = by_id[source_id]
        if not 1 < len(base["truth"]) <= 4 or base.get("uncertain") or base.get("simulated"):
            raise ValueError(f"Unusable short reading: {source_id}")
        item = {**base, "id": f"short-reading-{index + 1:02d}", "set": "paris4-col-8",
                "base_item": source_id, "level": 2, "task": "read", "practice_only": False,
                "optional_challenge": False, "guide": base["truth"],
                "stage": "Read a short group", "assisted": False,
                "hint": base.get("hint") or base["explain"],
                "preparation": "Read a few letters from left to right. The reading guide is available whenever you need it."}
        for field in ("choices", "question", "compare_with"):
            item.pop(field, None)
        groups.append(item)
    # Interleave short readings and the existing ink/empty windows. The latter
    # retain their IDs, image sizes, answers and distinction from letter tasks.
    windows = [item for item in items if item["set"] == "paris4-col-8" and item["task"] == "detect"]
    items[:] = [item for item in items if item not in windows]
    for index in range(max(len(groups), len(windows))):
        if index < len(groups):
            items.append(groups[index])
        if index < len(windows):
            items.append(windows[index])

    for lesson in sets:
        if lesson["id"] == "paris4-col-8":
            lesson.update(title="Read short groups", ordered=True,
                          intro="Read two to four letters at a time, with occasional windows of ink or empty papyrus. Whole lines are an optional challenge.")
    if not any(lesson["id"] == "long-lines" for lesson in sets):
        sets.append({"id": "long-lines", "level": 2, "title": "Whole lines · optional challenge",
                     "practice_only": True, "intro": "A longer challenge with the published reading on request. Return to short groups whenever you like."})
