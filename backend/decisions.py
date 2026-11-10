"""OpenAI vision client using the official Chat Completions API."""

import base64
from io import BytesIO
import json
import logging
import os
import time

import requests
from PIL import Image, UnidentifiedImageError

OPENAI_URL = "https://api.openai.com/v1/chat/completions"
MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")
logger = logging.getLogger(__name__)


class DecisionsUnavailable(Exception):
    """The OpenAI provider could not produce a valid answer."""


def _jpeg_bytes(data: bytes, max_size: int = 1200, quality: int = 82) -> bytes:
    try:
        with Image.open(BytesIO(data)) as image:
            image.thumbnail((max_size, max_size))
            output = BytesIO()
            image.convert("RGB").save(
                output, format="JPEG", quality=quality, optimize=True
            )
            return output.getvalue()
    except (UnidentifiedImageError, OSError) as exc:
        raise DecisionsUnavailable("AI_INVALID_IMAGE") from exc


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
    formatted_questions = []
    for q in questions:
        detail = f"- {q['name']} ({q['type']}): {q.get('instructions', '')}"
        if q["type"] == "choice":
            choices = "; ".join(
                f"{item['value']}: {item['description']}"
                for item in q.get("choices", [])
            )
            detail += f"\n  Allowed choices: {choices}"
        elif q["type"] == "score":
            levels = "; ".join(
                f"{index} = {item['label']}: {item['description']}"
                for index, item in enumerate(q.get("levels", []))
            )
            detail += f"\n  Score levels: {levels}"
        elif q["type"] == "observations":
            detail += (
                "\n  Return 3 or 4 concise visible-evidence factors in an items array. "
                "Each item must contain label and confidence (0 to 1)."
            )
        formatted_questions.append(detail)
    details = "\n".join(formatted_questions)
    return (
        "Return only valid JSON with the exact question names as keys. "
        "For predicate, return {\"type\":\"predicate\",\"probability\":number}. "
        "For choice, return {\"type\":\"choice\",\"choice\":string,"
        "\"confidence\":number}. For score, return {\"type\":\"score\","
        "\"score\":integer,\"probabilities\":[{\"value\":integer,"
        "\"probability\":number}]}. For observations, return "
        "{\"type\":\"observations\",\"items\":[{\"label\":string,"
        "\"confidence\":number}]}. For score questions, use the numbered "
        "levels provided and make probabilities reflect the visible evidence. "
        "Do not include markdown.\n\nQuestions:\n"
        + details
    )


def _request_with_usage(payload: dict, key: str) -> tuple[dict, dict | None]:
    response = None
    for attempt in range(2):
        try:
            response = requests.post(
                OPENAI_URL,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=60,
            )
        except requests.RequestException as exc:
            logger.error("OpenAI request failed: %s", exc)
            if attempt == 1:
                raise DecisionsUnavailable("AI_NETWORK_ERROR") from exc
            continue
        if response.status_code < 500:
            break
        time.sleep(1)
    if response is None:
        raise DecisionsUnavailable("AI_NETWORK_ERROR")
    if response.status_code != 200:
        logger.error("OpenAI %s: %s", response.status_code, response.text[:400])
        if response.status_code == 401:
            code = "AI_AUTH_ERROR"
        elif response.status_code == 429:
            code = "AI_RATE_LIMITED"
        elif response.status_code == 400:
            code = "AI_INVALID_REQUEST"
        elif response.status_code >= 500:
            code = "AI_PROVIDER_ERROR"
        else:
            code = "AI_REQUEST_ERROR"
        raise DecisionsUnavailable(code)
    try:
        response_body = response.json()
        if not isinstance(response_body, dict):
            raise DecisionsUnavailable("AI_INVALID_RESPONSE")
        content = response_body["choices"][0]["message"]["content"]
        result = json.loads(content)
    except (ValueError, KeyError, IndexError, TypeError) as exc:
        raise DecisionsUnavailable("AI_INVALID_RESPONSE") from exc
    if not isinstance(result, dict):
        raise DecisionsUnavailable("AI_INVALID_RESPONSE")
    usage = response_body.get("usage")
    return result, usage if isinstance(usage, dict) else None


def _request(payload: dict, key: str) -> dict:
    result, _ = _request_with_usage(payload, key)
    return result


def complete_json(system_prompt: str, user_content: str) -> tuple[dict, dict | None]:
    """Request a JSON object and return provider usage when it is available."""
    key = os.environ.get("OPENAI_API_KEY") or ""
    if not key:
        raise DecisionsUnavailable("AI_AUTH_ERROR")
    return _request_with_usage(
        {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_content},
            ],
            "response_format": {"type": "json_object"},
        },
        key,
    )


def decide(content: list[dict], questions: list[dict]) -> dict[str, dict]:
    """Call the official OpenAI vision API for structured image analysis."""
    key = os.environ.get("OPENAI_API_KEY") or ""
    if not key:
        raise DecisionsUnavailable("AI_AUTH_ERROR")
    message_content = []
    for part in content:
        if part.get("type") == "input_image":
            message_content.append(
                {
                    "type": "image_url",
                    "image_url": {"url": part["image_url"], "detail": "high"},
                }
            )
        elif part.get("type") == "input_text":
            message_content.append({"type": "text", "text": part["text"]})
    message_content.append({"type": "text", "text": _prompt(questions)})
    return _request(
        {
            "model": MODEL,
            "messages": [{"role": "user", "content": message_content}],
            "response_format": {"type": "json_object"},
        },
        key,
    )


def verify_selfie(data: bytes, mime: str = "image/jpeg") -> dict[str, float]:
    """Call OpenAI directly for the four selfie checks."""
    key = os.environ.get("OPENAI_API_KEY") or ""
    if not key:
        raise DecisionsUnavailable("AI_AUTH_ERROR")
    data = _jpeg_bytes(data, max_size=800, quality=72)
    mime = "image/jpeg"
    prompt = (
        "Assess this citizen registration selfie. Return only JSON with exactly "
        "these numeric keys from 0 to 1: has_face, single_person, face_clear, "
        "real_capture. The last key means a direct camera photo of a real person, "
        "not a screen, print, poster, drawing, or cartoon. For face_clear, use "
        "only whether the person's face is sufficiently visible and in focus for "
        "this basic check: the eyes, nose, and mouth should be reasonably visible "
        "with usable lighting. Do not penalize a neutral expression, hairstyle, "
        "ordinary camera softness, background clutter, or a slightly off-center "
        "face. If those facial features are plainly visible, return at least 0.7."
    )
    result = _request(
        {
            "model": MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{mime};base64,{base64.b64encode(data).decode('ascii')}",
                                "detail": "high",
                            },
                        },
                    ],
                }
            ],
            "response_format": {"type": "json_object"},
        },
        key,
    )
    try:
        return {
            name: max(0.0, min(1.0, float(result.get(name, 0.0))))
            for name in ("has_face", "single_person", "face_clear", "real_capture")
        }
    except (TypeError, ValueError) as exc:
        raise DecisionsUnavailable("AI_INVALID_RESPONSE") from exc


def prob(answers: dict, name: str, default: float = 0.0) -> float:
    answer = answers.get(name) or {}
    if not isinstance(answer, dict):
        return default
    if answer.get("type") != "predicate":
        return default
    try:
        return float(answer.get("probability", default))
    except (TypeError, ValueError):
        return default
