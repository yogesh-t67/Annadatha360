"""The one place the backend calls Claude. Every call goes through the budget guard and is logged to ai_usage."""

import logging
from datetime import UTC, datetime, timedelta
from decimal import Decimal

import anthropic
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.errors import AppError
from app.core.security import utcnow
from app.models import AiUsage

log = logging.getLogger("annadata.ai")

# USD per million tokens: (input, output, cache read). Cache writes (5-minute TTL) cost 1.25x input.
# Keep in sync with https://www.anthropic.com/pricing when models or prices change.
PRICES: dict[str, tuple[Decimal, Decimal, Decimal]] = {
    "claude-opus-5-5": (Decimal("4"), Decimal("20"), Decimal("0.20")),
    "claude-sonnet-5-5": (Decimal("2"), Decimal("10"), Decimal("0.20")),
    "claude-haiku-5-5": (Decimal("0.10"), Decimal("0.50"), Decimal("0.01")),
    "claude-opus-4-8": (Decimal("5"), Decimal("25"), Decimal("0.50")),
    "claude-fable-5-1": (Decimal("10"), Decimal("50"), Decimal("0.25")),
}
# Unknown model (e.g. a new fallback target): assume the most expensive so the guard errs on the safe side.
_FALLBACK_PRICE = max(PRICES.values(), key=lambda p: p[1])
_CACHE_WRITE_MULTIPLIER = Decimal("1.25")
_MILLION = Decimal(1_000_000)

FALLBACK_BETA = "server-side-fallback-2026-07-01"


def _price(model: str) -> tuple[Decimal, Decimal, Decimal]:
    price = PRICES.get(model)
    if price is None:
        log.warning("No price for model %s; using the most expensive known price", model)
        return _FALLBACK_PRICE
    return price


def cost_usd(models: list[str], usage) -> Decimal:
    """Cost of one response. If a fallback model served it, price at the dearer of the models involved."""
    inp, out, read = max((_price(m) for m in models), key=lambda p: p[1])
    tokens_in = usage.input_tokens or 0
    tokens_out = usage.output_tokens or 0
    cache_write = getattr(usage, "cache_creation_input_tokens", 0) or 0
    cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
    total = tokens_in * inp + tokens_out * out + cache_write * inp * _CACHE_WRITE_MULTIPLIER + cache_read * read
    return (total / _MILLION).quantize(Decimal("0.000001"))


def month_start(now: datetime) -> datetime:
    return now.astimezone(UTC).replace(day=1, hour=0, minute=0, second=0, microsecond=0)


def month_spend(db: Session, now: datetime | None = None) -> Decimal:
    now = now or utcnow()
    total = db.scalar(select(func.coalesce(func.sum(AiUsage.cost_usd), 0)).where(AiUsage.created_at >= month_start(now)))
    return Decimal(str(total))


def check_budget(db: Session, farmer_id: int) -> None:
    settings = get_settings()
    spent = month_spend(db)
    if spent + Decimal(str(settings.ai_call_reserve_usd)) > Decimal(str(settings.ai_monthly_budget_usd)):
        log.error("AI monthly budget reached: spent $%s of $%s", spent, settings.ai_monthly_budget_usd)
        raise AppError(503, "ai_budget_exceeded", "The AI assistant is paused for this month")

    since = utcnow() - timedelta(days=1)
    used_today = db.scalar(
        select(func.count()).select_from(AiUsage).where(AiUsage.farmer_id == farmer_id, AiUsage.created_at >= since)
    )
    if used_today >= settings.ai_farmer_daily_request_limit:
        raise AppError(429, "ai_daily_limit", "Daily AI limit reached. Try again tomorrow.")


def get_ai_client() -> anthropic.Anthropic:
    settings = get_settings()
    if not settings.anthropic_api_key:
        raise AppError(503, "ai_not_configured", "AI is not configured on this server")
    return anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=90.0, max_retries=2)


def call_claude(client, db: Session, *, farmer_id: int, feature: str, **params):
    """Budget-checked Claude call with server-side refusal fallback. Returns the response message.

    Raises AppError for budget/limit, refusal, and provider failures. Usage is recorded for every
    response the API returned (including refusals), since those can be billed.
    """
    check_budget(db, farmer_id)
    model = params.pop("model", None) or get_settings().ai_model
    try:
        response = client.beta.messages.create(
            model=model,
            betas=[FALLBACK_BETA],
            fallbacks="default",  # on a policy decline, re-run on Anthropic's recommended fallback model
            **params,
        )
    except anthropic.RateLimitError as exc:
        log.warning("Claude rate limited: %s", exc)
        raise AppError(503, "ai_busy", "The AI assistant is busy. Try again in a minute.") from exc
    except anthropic.APIStatusError as exc:
        log.error("Claude API error %s: %s", exc.status_code, exc.message)
        raise AppError(503, "ai_unavailable", "The AI assistant is unavailable right now") from exc
    except anthropic.APIConnectionError as exc:
        log.error("Claude connection error: %s", exc)
        raise AppError(503, "ai_unavailable", "The AI assistant is unavailable right now") from exc

    served_by = getattr(response, "model", None) or model
    cost = cost_usd([model, served_by], response.usage)
    db.add(
        AiUsage(
            farmer_id=farmer_id,
            feature=feature,
            model=served_by,
            input_tokens=response.usage.input_tokens or 0,
            output_tokens=response.usage.output_tokens or 0,
            cache_creation_input_tokens=getattr(response.usage, "cache_creation_input_tokens", 0) or 0,
            cache_read_input_tokens=getattr(response.usage, "cache_read_input_tokens", 0) or 0,
            cost_usd=cost,
            request_id=getattr(response, "_request_id", None),
            created_at=utcnow(),
        )
    )
    db.commit()

    if response.stop_reason == "refusal":
        details = getattr(response, "stop_details", None)
        log.warning("Claude declined (%s): %s", feature, getattr(details, "category", None))
        raise AppError(422, "ai_declined", "The assistant can't help with that request")
    if served_by != model:
        log.info("Claude %s request served by fallback model %s", feature, served_by)
    return response


def response_text(response) -> str:
    return "".join(b.text for b in response.content if getattr(b, "type", None) == "text").strip()
