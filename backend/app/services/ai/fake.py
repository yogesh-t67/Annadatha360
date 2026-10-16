"""AI_PROVIDER=fake: canned responses shaped exactly like Claude's, so the app can be built and tested with
no API key. Replies are clearly labelled as test output. Refused in production (see config)."""

import json
from types import SimpleNamespace

CHAT_REPLY = {
    "te": ("[పరీక్ష సమాధానం — AI ఇంకా కనెక్ట్ కాలేదు]\nమీ ప్రశ్న అందింది. AI కనెక్ట్ అయిన తర్వాత ఇక్కడ నిజమైన సలహా వస్తుంది."),
    "en": (
        "[Test reply — AI not connected yet]\n"
        "Your question was received. Real advice will appear here once AI is connected."
    ),
}

DIAGNOSIS = {
    "te": {
        "crop_identified": "వరి",
        "issue_name": "పరీక్ష ఫలితం (నిజమైన నిర్ధారణ కాదు)",
        "symptoms": ["ఇది నమూనా లక్షణం"],
        "actions": ["ఇది నమూనా సూచన — పాటించవద్దు"],
        "prevention": ["ఇది నమూనా నివారణ చిట్కా"],
        "summary": "[పరీక్ష] AI ఇంకా కనెక్ట్ కాలేదు. ఇది నమూనా ఫలితం మాత్రమే.",
    },
    "en": {
        "crop_identified": "Paddy",
        "issue_name": "Test result (not a real diagnosis)",
        "symptoms": ["Sample symptom"],
        "actions": ["Sample step — do not follow"],
        "prevention": ["Sample prevention tip"],
        "summary": "[Test] AI is not connected yet. This is a sample result only.",
    },
}


def _language(system_blocks) -> str:
    text = " ".join(b.get("text", "") for b in system_blocks or [])
    return "te" if "Reply language: Telugu" in text else "en"


def _diagnosis_json(lang: str) -> str:
    d = DIAGNOSIS[lang]
    return json.dumps(
        {
            "is_plant_image": True,
            "image_quality": "good",
            "crop_identified": d["crop_identified"],
            "matches_expected_crop": True,
            "health_status": "uncertain",
            "issue": {"name": d["issue_name"], "category": "other", "confidence": "low"},
            "symptoms": d["symptoms"],
            "actions": [{"step": d["actions"][0], "type": "monitor"}],
            "prevention": d["prevention"],
            "consult_expert": True,
            "summary": d["summary"],
        },
        ensure_ascii=False,
    )


class FakeClaudeClient:
    """Implements the one SDK call we use: client.beta.messages.create(...)."""

    def __init__(self):
        self.beta = SimpleNamespace(messages=SimpleNamespace(create=self._create))

    def _create(self, *, model: str, system=None, output_config=None, **_):
        lang = _language(system)
        structured = bool((output_config or {}).get("format"))
        text = _diagnosis_json(lang) if structured else CHAT_REPLY[lang]
        return SimpleNamespace(
            content=[SimpleNamespace(type="text", text=text)],
            stop_reason="end_turn",
            stop_details=None,
            model=model,
            usage=SimpleNamespace(
                input_tokens=0, output_tokens=0, cache_creation_input_tokens=0, cache_read_input_tokens=0
            ),
            _request_id="fake",
        )
