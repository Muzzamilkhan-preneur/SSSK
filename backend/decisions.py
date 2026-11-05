"""OpenAI vision client using the official Chat Completions API."""

import base64
import json
import logging
import os
import time

import requests

DECISIONS_URL = "https://api.openai.com/v1/chat/completions"
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
logger = logging.getLogger(__name__)


class DecisionsUnavailable(Exception):
    """The configured AI provider could not produce a valid answer."""


def image_part(data: bytes, mime: str = "image/jpeg") -> dict:
    if not mime.startswith("image/"):
        mime = "image/jpeg"
    return {
        "type": "input_image",
        "image_url": f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}",
    }


def text_part(text: str) -> dict:
    return {"type": "input_text", "text": text}


def predicate(name: str, instructions: str) -> dict:
    return {"type": "predicate", "name": name, "instructions": instructions}


def choice(name: str, instructions: str, choices: list[tuple[str, str]]) -> dict:
    return {
        "type": "choice",
        "name": name,
        "instructions": instructions,
        "choices": [{"value": value, "description": desc} for value, desc in choices],
    }


def score(name: str, instructions: str, levels: list[tuple[str, str]]) -> dict:
    return {
        "type": "score",
        "name": name,
        "instructions": instructions,
        "levels": [{"label": label, "description": desc} for label, desc in levels],
    }


def _prompt(questions: list[dict]) -> str:
    details = "\n".join(
        f"- {q['name']} ({q['type']}): {q.get('instructions', '')}"
        for q in questions
    )
    return (
        "Return ONLY valid JSON with the exact question names as keys. "
        "For predicate, return {\"type\":\"predicate\",\"probability\":number} "
        "where probability is 0 to 1. For choice, return "
        "{\"type\":\"choice\",\"choice\":string,\"confidence\":number}. "
        "For score, return {\"type\":\"score\",\"score\":integer,"
        "\"probabilities\":[{\"value\":integer,\"probability\":number}]}. "
        "Do not include markdown.\n\nQuestions:\n" + details
    )


def decide(content: list[dict], questions: list[dict]) -> dict[str, dict]:
    """Run one structured vision request and return answers by question name."""
    key = os.environ.get("OPENAI_API_KEY") or ""
    if not key:
        raise DecisionsUnavailable("OPENAI_API_KEY is not set")
    message_content = []
    for part in content:
        if part.get("type") == "input_image":
            message_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": part["image_url"], "detail": "low"},
                }
            )
        elif part.get("type") == "input_text":
            message_content.append({"type": "text", "text": part["text"]})
    message_content.append({"type": "text", "text": _prompt(questions)})

    response = None
    for attempt in range(2):
        try:
            response = requests.post(
                DECISIONS_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": MODEL,
                    "messages": [{"role": "user", "content": message_content}],
                    "response_format": {"type": "json_object"},
                },
                timeout=60,
            )
        except requests.RequestException as exc:
            logger.error("OpenAI request failed: %s", exc)
            if attempt == 1:
                raise DecisionsUnavailable("network error") from exc
            continue
        if response.status_code < 500:
            break
        time.sleep(1)

    if response is None or response.status_code != 200:
        status = response.status_code if response is not None else "no response"
        detail = response.text[:400] if response is not None else ""
        logger.error("OpenAI %s: %s", status, detail)
        raise DecisionsUnavailable(f"status {status}")
    try:
        payload = response.json()
        text = payload["choices"][0]["message"]["content"]
        answers = json.loads(text)
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise DecisionsUnavailable("invalid response") from exc
    if not isinstance(answers, dict):
        raise DecisionsUnavailable("invalid response shape")
    return answers


def prob(answers: dict, name: str, default: float = 0.0) -> float:
    answer = answers.get(name) or {}
    if answer.get("type") != "predicate":
        return default
    try:
        return float(answer.get("probability", default))
    except (TypeError, ValueError):
        return default
