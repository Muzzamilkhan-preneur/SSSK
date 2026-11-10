import asyncio

import pytest
from fastapi import HTTPException

import server
from decisions import DecisionsUnavailable


def test_dispatch_demo_route_returns_simulation_result(monkeypatch) -> None:
    expected = {"mode": "synthetic_only", "report_count": 100}
    monkeypatch.setattr(server, "run_synthetic_dispatch", lambda: expected)

    assert asyncio.run(server.run_dispatch_demo()) == expected


def test_dispatch_demo_route_surfaces_provider_errors(monkeypatch) -> None:
    def fail() -> None:
        raise DecisionsUnavailable("AI_AUTH_ERROR")

    monkeypatch.setattr(server, "run_synthetic_dispatch", fail)

    with pytest.raises(HTTPException) as error:
        asyncio.run(server.run_dispatch_demo())

    assert error.value.status_code == 503
    assert error.value.detail == "AI_AUTH_ERROR"
