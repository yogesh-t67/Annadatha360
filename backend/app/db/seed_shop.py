"""Agri Mart categories. Telugu names need native-speaker review (docs/development/localization-review.md).
Migration 0005 inserts these; later edits need a new data migration."""

CATEGORIES: list[dict] = [
    {"code": "seeds", "sort_order": 1, "name": {"en": "Seeds", "te": "విత్తనాలు"}},
    {"code": "fertilizers", "sort_order": 2, "name": {"en": "Fertilizers", "te": "ఎరువులు"}},
    {"code": "pesticides", "sort_order": 3, "name": {"en": "Pesticides", "te": "పురుగుమందులు"}},
    {"code": "equipment", "sort_order": 4, "name": {"en": "Equipment", "te": "పరికరాలు"}},
]
