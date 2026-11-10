from collections import Counter

from dispatch_demo_data import generate_synthetic_dispatch_dataset


def test_dataset_has_100_reports_with_20_labeled_incidents() -> None:
    dataset = generate_synthetic_dispatch_dataset()
    reports = dataset["reports"]
    labels = dataset["expected_incident_by_report_id"]

    assert len(reports) == 100
    assert len({report["id"] for report in reports}) == 100
    assert len(labels) == 100
    assert set(labels) == {report["id"] for report in reports}
    assert Counter(labels.values()) == {
        f"synthetic-incident-{incident_number:02d}": 5
        for incident_number in range(1, 21)
    }


def test_reports_use_only_dispatch_inputs_and_supported_damage_types() -> None:
    dataset = generate_synthetic_dispatch_dataset()
    reports = dataset["reports"]
    supported_damage_types = {
        "pothole",
        "cracking",
        "sunken_road",
        "broken_manhole",
        "waterlogged",
        "other",
    }
    expected_report_fields = {
        "id",
        "lat",
        "lng",
        "address",
        "description",
        "damage_type",
        "severity",
        "severity_score",
        "reporter_count",
        "status",
        "created_at",
    }

    assert {report["damage_type"] for report in reports} == supported_damage_types
    assert all(set(report) == expected_report_fields for report in reports)
    assert all(report["id"].startswith("synthetic-report-") for report in reports)
    assert all(report["status"] == "pending_review" for report in reports)


def test_dataset_generation_is_deterministic() -> None:
    assert generate_synthetic_dispatch_dataset() == generate_synthetic_dispatch_dataset()


def test_garbage_dump_reports_are_present_without_new_live_categories() -> None:
    dataset = generate_synthetic_dispatch_dataset()
    garbage_reports = [
        report
        for report in dataset["reports"]
        if "garbage" in report["description"].lower()
        or "waste" in report["description"].lower()
        or "rubbish" in report["description"].lower()
    ]

    assert len(garbage_reports) == 10
    assert all(report["damage_type"] == "other" for report in garbage_reports)
    assert len(
        {
            dataset["expected_incident_by_report_id"][report["id"]]
            for report in garbage_reports
        }
    ) == 2
