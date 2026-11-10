import json

import pytest

import dispatch_agent
from decisions import DecisionsUnavailable
from dispatch_demo_data import (
    SyntheticDispatchDataset,
    SyntheticReport,
    generate_synthetic_dispatch_dataset,
)


@pytest.fixture(autouse=True)
def clear_dispatch_cache(monkeypatch) -> None:
    monkeypatch.setattr(dispatch_agent, "_CACHE_CREATED_AT", 0.0)
    monkeypatch.setattr(dispatch_agent, "_CACHE_RESULT", None)


def _exact_groups(dataset: SyntheticDispatchDataset) -> list[dict]:
    reports_by_incident: dict[str, list[SyntheticReport]] = {}
    labels = dataset["expected_incident_by_report_id"]
    reports_by_id = {report["id"]: report for report in dataset["reports"]}
    for report_id, incident_id in labels.items():
        reports_by_incident.setdefault(incident_id, []).append(
            reports_by_id[report_id]
        )

    groups = []
    for report_ids in reports_by_incident.values():
        sample = reports_by_id[report_ids[0]["id"]]
        if sample["damage_type"] in {"pothole", "cracking", "sunken_road"}:
            category = "road_damage"
        elif sample["damage_type"] in {"broken_manhole", "waterlogged"}:
            category = "drainage"
        else:
            category = "garbage_dump"
        groups.append(
            {
                "report_ids": [report["id"] for report in report_ids],
                "category": category,
                "priority": "high",
                "summary": f"{category} incident near {sample['address']}",
                "recommended_action": "Inspect the location and arrange the appropriate response.",
            }
        )
    return groups


def test_run_uses_separate_synthetic_labels_and_scores_model_output(monkeypatch) -> None:
    dataset = generate_synthetic_dispatch_dataset()
    captured: dict[str, str] = {}

    def fake_complete_json(system_prompt: str, user_content: str):
        captured["system_prompt"] = system_prompt
        captured["user_content"] = user_content
        return (
            {"groups": _exact_groups(dataset)},
            {
                "prompt_tokens": 1200,
                "completion_tokens": 450,
                "total_tokens": 1650,
            },
        )

    monkeypatch.setattr(dispatch_agent, "complete_json", fake_complete_json)
    result = dispatch_agent.run_synthetic_dispatch()

    assert result["mode"] == "synthetic_only"
    assert result["cached"] is False
    assert result["report_count"] == 100
    assert result["metrics"]["exact_incident_accuracy"] == 1
    assert result["metrics"]["pairwise_f1"] == 1
    assert result["token_usage"]["total_tokens"] == 1650
    assert len(result["groups"]) == 20
    assert all(group["assignment_status"] == "suggested" for group in result["groups"])
    assert "expected_incident_by_report_id" not in captured["user_content"]
    assert "synthetic-incident-" not in captured["user_content"]
    assert len(json.loads(captured["user_content"])["reports"]) == 100
    assert all(
        crew["assigned_groups"] <= crew["capacity"]
        for crew in result["crew_workload"]
    )


def test_repeat_run_uses_short_lived_cache(monkeypatch) -> None:
    dataset = generate_synthetic_dispatch_dataset()
    calls = 0

    def fake_complete_json(system_prompt: str, user_content: str):
        nonlocal calls
        assert system_prompt
        assert len(json.loads(user_content)["reports"]) == 100
        calls += 1
        return {"groups": _exact_groups(dataset)}, None

    monkeypatch.setattr(dispatch_agent, "complete_json", fake_complete_json)

    first = dispatch_agent.run_synthetic_dispatch()
    second = dispatch_agent.run_synthetic_dispatch()

    assert calls == 1
    assert first["cached"] is False
    assert second["cached"] is True
    assert second["groups"] == first["groups"]


def test_run_rejects_duplicate_report_assignments(monkeypatch) -> None:
    report_ids = [
        report["id"]
        for report in generate_synthetic_dispatch_dataset()["reports"]
    ]
    def fake_complete_json(system_prompt: str, user_content: str):
        assert system_prompt and user_content
        return (
            {
                "groups": [
                    {
                        "report_ids": report_ids,
                        "category": "road_damage",
                        "priority": "high",
                        "summary": "Duplicate assignment",
                        "recommended_action": "Review this group.",
                    },
                    {
                        "report_ids": [report_ids[0]],
                        "category": "road_damage",
                        "priority": "high",
                        "summary": "Duplicate report",
                        "recommended_action": "Review this group.",
                    },
                ]
            },
            None,
        )

    monkeypatch.setattr(dispatch_agent, "complete_json", fake_complete_json)

    with pytest.raises(DecisionsUnavailable, match="DISPATCH_INVALID_RESPONSE"):
        dispatch_agent.run_synthetic_dispatch()


def test_run_rejects_unknown_categories_without_crashing(monkeypatch) -> None:
    report_ids = [
        report["id"]
        for report in generate_synthetic_dispatch_dataset()["reports"]
    ]
    def fake_complete_json(system_prompt: str, user_content: str):
        assert system_prompt and user_content
        return (
            {
                "groups": [
                    {
                        "report_ids": report_ids,
                        "category": [],
                        "priority": "high",
                        "summary": "Invalid category",
                        "recommended_action": "Review this group.",
                    }
                ]
            },
            None,
        )

    monkeypatch.setattr(dispatch_agent, "complete_json", fake_complete_json)

    with pytest.raises(DecisionsUnavailable, match="DISPATCH_INVALID_RESPONSE"):
        dispatch_agent.run_synthetic_dispatch()
