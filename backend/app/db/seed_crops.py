"""Initial crop catalog for AP/Telangana. Telugu names need native-speaker review before launch.

Add languages by adding keys (e.g. "hi") — the column is a JSON LocalizedText, no schema change needed.

Migration 0001 inserts this list. Editing it does NOT update existing databases — ship
changes as a new data migration as well.
"""

CROPS: list[dict] = [
    {"code": "paddy", "category": "cereal", "name": {"en": "Paddy", "te": "వరి"}},
    {"code": "maize", "category": "cereal", "name": {"en": "Maize", "te": "మొక్కజొన్న"}},
    {"code": "jowar", "category": "cereal", "name": {"en": "Jowar", "te": "జొన్న"}},
    {"code": "red_gram", "category": "pulse", "name": {"en": "Red Gram (Tur)", "te": "కంది"}},
    {"code": "bengal_gram", "category": "pulse", "name": {"en": "Bengal Gram", "te": "శనగ"}},
    {"code": "black_gram", "category": "pulse", "name": {"en": "Black Gram", "te": "మినుము"}},
    {"code": "green_gram", "category": "pulse", "name": {"en": "Green Gram", "te": "పెసర"}},
    {"code": "groundnut", "category": "oilseed", "name": {"en": "Groundnut", "te": "వేరుశనగ"}},
    {"code": "sunflower", "category": "oilseed", "name": {"en": "Sunflower", "te": "పొద్దుతిరుగుడు"}},
    {"code": "castor", "category": "oilseed", "name": {"en": "Castor", "te": "ఆముదం"}},
    {"code": "oil_palm", "category": "oilseed", "name": {"en": "Oil Palm", "te": "ఆయిల్ పామ్"}},
    {"code": "cotton", "category": "commercial", "name": {"en": "Cotton", "te": "పత్తి"}},
    {"code": "sugarcane", "category": "commercial", "name": {"en": "Sugarcane", "te": "చెరకు"}},
    {"code": "chilli", "category": "spice", "name": {"en": "Chilli", "te": "మిరప"}},
    {"code": "turmeric", "category": "spice", "name": {"en": "Turmeric", "te": "పసుపు"}},
    {"code": "tomato", "category": "vegetable", "name": {"en": "Tomato", "te": "టమాటా"}},
    {"code": "onion", "category": "vegetable", "name": {"en": "Onion", "te": "ఉల్లి"}},
    {"code": "mango", "category": "fruit", "name": {"en": "Mango", "te": "మామిడి"}},
    {"code": "banana", "category": "fruit", "name": {"en": "Banana", "te": "అరటి"}},
]
