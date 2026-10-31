"""What vendors can list, and what each kind of listing must say."""

from dataclasses import dataclass

from app.modules.vendors.rules import CAPABILITIES

# Vendor offering (approved in review) → kind of listing it allows
KIND_BY_GROUP = {"products": "product", "rental": "rental", "services": "service", "labour": "labour"}


def kind_for(capability_code: str) -> str:
    return KIND_BY_GROUP[CAPABILITIES[capability_code].group]


# Prices are per one of these units. Products are priced per pack ("45 kg bag" is the variant's label).
UNITS: dict[str, tuple[str, ...]] = {
    "product": ("pack",),
    "rental": ("hour", "day", "acre"),
    "service": ("acre", "hour", "sample", "trip"),
    "labour": ("worker_day",),
}

# What is being offered, for listings that aren't products
ITEM_TYPES: dict[str, dict[str, str]] = {
    "equipment_rental": {
        "tractor": "Tractor",
        "rotavator": "Rotavator",
        "harvester": "Combine harvester",
        "sprayer": "Power sprayer",
        "seed_drill": "Seed drill",
        "trailer": "Trailer",
        "other_equipment": "Other equipment",
    },
    "farm_services": {
        "ploughing": "Ploughing",
        "rotavation": "Rotavation",
        "harvesting": "Harvesting",
        "soil_testing": "Soil testing",
        "transport": "Transport",
        "other_service": "Other service",
    },
    "drone_spraying": {"drone_spraying": "Drone spraying"},
    "labour": {
        "sowing": "Sowing",
        "transplanting": "Transplanting",
        "weeding": "Weeding",
        "harvesting": "Harvesting",
        "spraying": "Spraying",
        "general": "General farm work",
    },
}


@dataclass(frozen=True)
class Attribute:
    key: str
    label: str
    required: bool = False


# Extra details per product category. Required ones are what the law or a farmer's safety needs on the listing.
ATTRIBUTES: dict[str, tuple[Attribute, ...]] = {
    "pesticides": (
        Attribute("cib_registration_number", "CIB&RC registration number", required=True),
        Attribute("technical_name", "Technical name (active ingredient)", required=True),
        Attribute("formulation", "Formulation (e.g. 25% EC)"),
        Attribute("target_pests", "Target pests / diseases"),
    ),
    "fertilizers": (
        Attribute("grade", "Grade / composition (e.g. NPK 20:20:0:13)", required=True),
        Attribute("fertilizer_type", "Type (straight, complex, organic, bio, micronutrient)"),
    ),
    "seeds": (
        Attribute("variety", "Variety / hybrid name", required=True),
        Attribute("crop", "Crop", required=True),
        Attribute("germination_percent", "Germination %"),
        Attribute("lot_number", "Lot number"),
    ),
    "veterinary": (
        Attribute("drug_name", "Medicine (generic name)", required=True),
        Attribute("animal", "For which animals"),
    ),
    "animal_feed": (Attribute("animal", "For which animals"),),
}

# Above this price a product shows "Send enquiry" instead of "Buy" (expensive equipment needs a conversation).
ENQUIRY_ABOVE_PAISE = 50_000 * 100

MAX_VARIANTS = 10
MAX_IMAGES = 8
LANGUAGES = ("en", "te", "hi")
