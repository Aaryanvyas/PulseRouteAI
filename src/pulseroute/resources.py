from __future__ import annotations

import re


RESOURCE_KEYWORDS: dict[str, tuple[str, ...]] = {
    "ambulance": ("ambulance", "bleeding", "pregnant", "oxygen", "clinic", "medical"),
    "rescue": ("trapped", "stuck", "roof", "debris", "boat", "missing", "rescue"),
    "food": ("food", "packets", "hungry"),
    "water": ("water", "drinking", "dehydration"),
    "shelter": ("shelter", "blankets", "camp", "temporary"),
    "electricity": ("power", "electric", "electricity", "transformer", "sparks", "streetlight"),
    "fire": ("fire", "smoke", "blast", "spreading"),
    "road_clearance": ("road", "tree", "lane", "blocked", "landslide", "traffic"),
}


def normalize(text: str) -> str:
    return re.sub(r"[^a-z0-9\s]", " ", text.lower())


def extract_resources(text: str) -> list[str]:
    clean = normalize(text)
    found = [
        resource
        for resource, keywords in RESOURCE_KEYWORDS.items()
        if any(keyword in clean for keyword in keywords)
    ]
    return sorted(found)

