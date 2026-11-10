import decisions
import pytest

from decisions import DecisionsUnavailable


class FakeResponse:
    status_code = 200
    text = ""

    def __init__(self, body: object) -> None:
        self.body = body

    def json(self) -> object:
        return self.body


def test_complete_json_returns_usage_and_uses_configured_model(monkeypatch) -> None:
    captured: dict = {}

    def fake_post(url: str, **kwargs):
        captured["url"] = url
        captured["payload"] = kwargs["json"]
        return FakeResponse(
            {
                "choices": [{"message": {"content": '{"groups": []}'}}],
                "usage": {
                    "prompt_tokens": 15,
                    "completion_tokens": 8,
                    "total_tokens": 23,
                },
            }
        )

    monkeypatch.setenv("OPENAI_API_KEY", "unit-test-key")
    monkeypatch.setattr(decisions.requests, "post", fake_post)

    result, usage = decisions.complete_json("system", "synthetic input")

    assert result == {"groups": []}
    assert usage == {
        "prompt_tokens": 15,
        "completion_tokens": 8,
        "total_tokens": 23,
    }
    assert captured["url"] == decisions.OPENAI_URL
    assert captured["payload"]["model"] == decisions.MODEL
    assert captured["payload"]["messages"] == [
        {"role": "system", "content": "system"},
        {"role": "user", "content": "synthetic input"},
    ]


def test_complete_json_rejects_non_object_provider_response(monkeypatch) -> None:
    def fake_post(url: str, **kwargs):
        assert url == decisions.OPENAI_URL
        assert kwargs
        return FakeResponse([])

    monkeypatch.setenv("OPENAI_API_KEY", "unit-test-key")
    monkeypatch.setattr(decisions.requests, "post", fake_post)

    with pytest.raises(DecisionsUnavailable, match="AI_INVALID_RESPONSE"):
        decisions.complete_json("system", "synthetic input")
