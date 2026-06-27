from __future__ import annotations

from .model import KEYWORD_SCORES
from .resources import normalize


def explain_prediction(text: str, limit: int = 5) -> list[str]:
    clean = normalize(text)
    hits = [(keyword, abs(weight)) for keyword, weight in KEYWORD_SCORES.items() if keyword in clean]
    hits.sort(key=lambda item: item[1], reverse=True)
    return [keyword for keyword, _ in hits[:limit]]

