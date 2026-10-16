from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.farmer import CropRef

IssueCategory = Literal[
    "disease", "pest", "nutrient_deficiency", "water_stress", "weather_damage", "weed", "other", "none"
]


class Issue(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str
    category: IssueCategory
    confidence: Literal["low", "medium", "high"]


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid")

    step: str
    type: Literal["cultural", "organic", "chemical", "monitor"]


class DiagnosisResult(BaseModel):
    """What Claude returns (enforced via JSON schema), and what the app renders.

    Free-text fields are in the farmer's language."""

    model_config = ConfigDict(extra="forbid")

    is_plant_image: bool
    image_quality: Literal["good", "poor"]
    crop_identified: str
    matches_expected_crop: bool
    health_status: Literal["healthy", "problem_found", "uncertain"]
    issue: Issue
    symptoms: list[str]
    actions: list[Action]
    prevention: list[str]
    consult_expert: bool
    summary: str


class DiagnosisOut(BaseModel):
    id: int
    field_id: int | None
    crop: CropRef | None
    language: str
    notes: str | None
    result: DiagnosisResult
    created_at: datetime


def strict_json_schema(model: type[BaseModel]) -> dict:
    """Pydantic's schema, inlined and made strict, for Claude structured outputs."""
    schema = model.model_json_schema()
    defs = schema.pop("$defs", {})

    def resolve(node):
        if isinstance(node, dict):
            if "$ref" in node:
                return resolve(defs[node["$ref"].split("/")[-1]])
            out = {k: resolve(v) for k, v in node.items() if k != "title"}
            if out.get("type") == "object":
                out["additionalProperties"] = False
                out["required"] = list(out.get("properties", {}))
            return out
        if isinstance(node, list):
            return [resolve(v) for v in node]
        return node

    return resolve(schema)
