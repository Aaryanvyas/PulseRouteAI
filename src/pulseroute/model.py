from __future__ import annotations

from dataclasses import dataclass

from .data import Report
from .resources import normalize


URGENCY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


KEYWORD_SCORES: dict[str, int] = {
    "trapped": 3,
    "bleeding": 3,
    "collapsed": 3,
    "oxygen": 3,
    "missing": 3,
    "pregnant": 3,
    "injured": 3,
    "victim": 3,
    "fire": 2,
    "flooded": 2,
    "rescue": 2,
    "dehydration": 2,
    "shelter": 2,
    "food": 2,
    "water": 2,
    "blocked": 1,
    "sparks": 1,
    "landslide": 1,
    "traffic": 1,
    "safe": -1,
    "minor": -1,
    "waiting": -1,
}


def score_to_label(score: int) -> str:
    if score >= 5:
        return "critical"
    if score >= 3:
        return "high"
    if score >= 1:
        return "medium"
    return "low"


@dataclass
class RulesUrgencyModel:
    """Small deterministic baseline used when scikit-learn is unavailable."""

    def fit(self, reports: list[Report]) -> "RulesUrgencyModel":
        return self

    def predict_one(self, text: str) -> str:
        clean = normalize(text)
        score = sum(weight for keyword, weight in KEYWORD_SCORES.items() if keyword in clean)
        return score_to_label(score)

    def predict(self, texts: list[str]) -> list[str]:
        return [self.predict_one(text) for text in texts]


class SklearnUrgencyModel:
    def __init__(self) -> None:
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.linear_model import LogisticRegression
        from sklearn.pipeline import Pipeline

        self.pipeline = Pipeline(
            [
                ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=1)),
                ("clf", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        )

    def fit(self, reports: list[Report]) -> "SklearnUrgencyModel":
        labeled = [report for report in reports if report.urgency]
        self.pipeline.fit([report.text for report in labeled], [report.urgency for report in labeled])
        return self

    def predict(self, texts: list[str]) -> list[str]:
        return list(self.pipeline.predict(texts))


def build_model() -> RulesUrgencyModel | SklearnUrgencyModel:
    try:
        import sklearn  # noqa: F401
    except Exception:
        return RulesUrgencyModel()
    return SklearnUrgencyModel()

