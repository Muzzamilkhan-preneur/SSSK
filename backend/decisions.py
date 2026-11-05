"""OpenAI Decisions API client (user's own OPENAI_API_KEY).

POST https://api.openai.com/v1/decisions with model gpt-6-luna. Returns typed
answers: predicate -> probability, choice -> choice + probabilities + confidence,
score -> score + per-level probabilities + confidence.
"""

import base64
import logging
import os
import time

import requests

DECISIONS_URL = "https://api.openai.com/v1/decisions"
MODEL = "gpt-6-luna"

logger = logging.getLogger(__name__)


class DecisionsUnavailable(Exception):
    """Key missing, out of credit, or the service failed: the app must not guess."""


def image_part(data: bytes, mime: str = "image/jpeg") -> dict:
    return {
        "type": "input_image",
        "image_url": f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}",
    }


def text_part(text: str) -> dict:
    return {"type": "input_text", "text": text}


def predicate(name: str, instructions) -> dict:
    return {"type": "predicate", "name": name, "instructions": instructions}


def choice(name: str, instructions: str, choices: list[tuple[str, str]]) -> dict:
    return {
        "type": "choice",
        "name": name,
        "instructions": instructions,
        "choices": [{"value": v, "description": d} for v, d in choices],
    }


def score(name: str, instructions: str, levels: list[tuple[str, str]]) -> dict:
    return {
        "type": "score",
        "name": name,
        "instructions": instructions,
        "levels": [{"label": l, "description": d} for l, d in levels],
    }


def decide(content: list[dict], questions: list[dict]) -> dict[str, dict]:
    """Synchronous call; run via run_in_threadpool. Returns {name: answer}."""
    key = os.environ.get("OPENAI_API_KEY") or ""
    if not key:
        raise DecisionsUnavailable("OPENAI_API_KEY is not set")
    resp = None
    for attempt in range(2):  # one retry on transient 5xx
        try:
            resp = requests.post(
                DECISIONS_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "input": [{"role": "user", "content": content}],
                    "questions": questions,
                },
                timeout=45,
            )
        except requests.RequestException as exc:
            logger.error("decisions request failed: %s", exc)
            if attempt == 1:
                raise DecisionsUnavailable("network error") from exc
            continue
        if resp.status_code < 500:
            break
        logger.warning(
            "decisions %s (attempt %d): %s",
            resp.status_code,
            attempt + 1,
            resp.text[:200],
        )
        time.sleep(1.0)
    if resp is None or resp.status_code != 200:
        status = resp.status_code if resp is not None else "no response"
        detail = resp.text[:400] if resp is not None else ""
        logger.error("decisions %s: %s", status, detail)
        raise DecisionsUnavailable(f"status {status}")
    try:
        payload = resp.json()
    except ValueError as exc:
        raise DecisionsUnavailable("invalid response") from exc
    answers = {}
    for answer in payload.get("answers", []):
        if isinstance(answer, dict) and isinstance(answer.get("name"), str):
            answers[answer["name"]] = answer
    return answers


def prob(answers: dict, name: str, default: float = 0.0) -> float:
    a = answers.get(name) or {}
    if a.get("type") != "predicate":
        return default
    try:
        return float(a.get("probability", default))
    except (TypeError, ValueError):
        return default
