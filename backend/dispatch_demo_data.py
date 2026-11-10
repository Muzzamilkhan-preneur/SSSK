from datetime import datetime, timedelta, timezone
from typing import NamedTuple, TypedDict


class SyntheticReport(TypedDict):
    id: str
    lat: float
    lng: float
    address: str
    description: str
    damage_type: str
    severity: str
    severity_score: float
    reporter_count: int
    status: str
    created_at: str


class SyntheticDispatchDataset(TypedDict):
    reports: list[SyntheticReport]
    expected_incident_by_report_id: dict[str, str]


class IncidentSpec(NamedTuple):
    address: str
    lat: float
    lng: float
    damage_type: str
    severity: str
    severity_score: float
    descriptions: tuple[str, str, str, str, str]


_INCIDENTS: tuple[IncidentSpec, ...] = (
    IncidentSpec(
        "Kh-e-Ittehad, DHA Phase 2",
        24.8175,
        67.0640,
        "pothole",
        "severe",
        0.86,
        (
            "A deep pothole has opened in the left lane.",
            "Large road crater is damaging vehicles.",
            "Broken asphalt leaves a deep hole in the carriageway.",
            "A wide, sharp-edged pothole is hard to avoid.",
            "The road surface has collapsed into a deep hole.",
        ),
    ),
    IncidentSpec(
        "Korangi Road near Qayyumabad",
        24.8305,
        67.1050,
        "pothole",
        "dangerous",
        0.96,
        (
            "A very deep pothole spans most of the lane.",
            "A large crater creates a serious crash risk.",
            "Road collapse has left a dangerous hole.",
            "Vehicles are swerving around a deep road crater.",
            "A severe pothole is exposed in the traffic lane.",
        ),
    ),
    IncidentSpec(
        "University Road near NED University",
        24.9345,
        67.1130,
        "pothole",
        "moderate",
        0.67,
        (
            "A round pothole has formed beside the lane marking.",
            "A broken patch of road is catching motorcycle wheels.",
            "A new hole in the road is making traffic swerve.",
            "The asphalt is missing in a small, defined patch.",
            "A pothole has appeared in the outer traffic lane.",
        ),
    ),
    IncidentSpec(
        "M.A. Jinnah Road near Saddar",
        24.8580,
        67.0210,
        "pothole",
        "severe",
        0.84,
        (
            "A deep road hole is slowing buses and cars.",
            "A broken section of asphalt has become a large pothole.",
            "A crater in the road is dangerous for motorcycles.",
            "A wide pothole is forming in a busy lane.",
            "The road has a deep cavity with loose edges.",
        ),
    ),
    IncidentSpec(
        "Liaquatabad No. 10",
        24.9060,
        67.0410,
        "pothole",
        "moderate",
        0.63,
        (
            "A shallow pothole is growing near the junction.",
            "The road has a broken patch that needs repair.",
            "A small crater is causing vehicles to brake suddenly.",
            "A rough hole has formed in the neighborhood road.",
            "Missing asphalt has left a pothole in the lane.",
        ),
    ),
    IncidentSpec(
        "Korangi Industrial Area, Sector 6",
        24.8150,
        67.1320,
        "pothole",
        "severe",
        0.88,
        (
            "A deep crater is affecting trucks on the service road.",
            "A large pothole has formed along the industrial route.",
            "Broken road surface leaves a hole in the truck lane.",
            "A deep road cavity is disrupting the service road.",
            "Heavy vehicles are encountering a dangerous pothole.",
        ),
    ),
    IncidentSpec(
        "North Nazimabad, Block H",
        24.9510,
        67.0390,
        "pothole",
        "dangerous",
        0.93,
        (
            "A large pothole is difficult to see after dark.",
            "A deep crater in the road could cause a serious accident.",
            "A dangerous hole has opened near the residential lane.",
            "The road has collapsed around a deep pothole.",
            "A wide road crater is forcing drivers into oncoming traffic.",
        ),
    ),
    IncidentSpec(
        "Malir, Model Colony Road",
        24.9065,
        67.1870,
        "pothole",
        "moderate",
        0.69,
        (
            "A pothole has formed where the road surface is worn.",
            "A broken patch is making the road uncomfortable to cross.",
            "A defined hole is visible near the road shoulder.",
            "The asphalt has broken away in a small area.",
            "A moderate pothole is affecting traffic near the turn.",
        ),
    ),
    IncidentSpec(
        "Clifton, Block 5",
        24.8110,
        67.0290,
        "cracking",
        "minor",
        0.38,
        (
            "Several cracks are spreading across the road surface.",
            "The asphalt has a web of surface cracks.",
            "Long cracks are visible beside the curb.",
            "The road surface is splitting but has no deep hole.",
            "Small cracks are appearing across the lane.",
        ),
    ),
    IncidentSpec(
        "PECHS, Shahrah-e-Quaideen",
        24.8670,
        67.0650,
        "cracking",
        "moderate",
        0.57,
        (
            "Cracks run across the lane and are widening.",
            "The road has interconnected cracks near the junction.",
            "A cracked surface is beginning to break apart.",
            "Long asphalt cracks are affecting the traffic lane.",
            "The road is cracked across a broad patch.",
        ),
    ),
    IncidentSpec(
        "Shah Faisal Colony, Green Town",
        24.8770,
        67.1630,
        "cracking",
        "severe",
        0.77,
        (
            "Deep cracks have broken up a large section of road.",
            "The road surface is badly fractured near the crossing.",
            "A network of wide cracks is breaking apart the asphalt.",
            "Severe cracking is visible across the carriageway.",
            "The damaged surface has deep, connected cracks.",
        ),
    ),
    IncidentSpec(
        "Gulistan-e-Johar, Block 13",
        24.9260,
        67.1370,
        "cracking",
        "minor",
        0.34,
        (
            "Fine cracks are visible in the road surface.",
            "The asphalt is starting to crack near the side street.",
            "A narrow surface crack runs along the lane.",
            "Small road cracks have appeared by the junction.",
            "The road has early signs of surface cracking.",
        ),
    ),
    IncidentSpec(
        "Buffer Zone, Sector 15-A",
        24.9820,
        67.0650,
        "sunken_road",
        "dangerous",
        0.91,
        (
            "A section of road has sunk and left a steep drop.",
            "The carriageway has collapsed into a low depression.",
            "A sunken section creates a dangerous height difference.",
            "The road has dropped sharply near the intersection.",
            "A collapsed road section is difficult for vehicles to cross.",
        ),
    ),
    IncidentSpec(
        "Korangi Crossing, Sector 33",
        24.8290,
        67.1660,
        "sunken_road",
        "severe",
        0.82,
        (
            "The road has sunk around a damaged patch.",
            "A depressed section is disrupting the flow of traffic.",
            "The carriageway has settled and become uneven.",
            "A sunken road surface is hazardous for motorcycles.",
            "Part of the lane has dropped below the surrounding road.",
        ),
    ),
    IncidentSpec(
        "Nazimabad No. 3",
        24.9150,
        67.0330,
        "broken_manhole",
        "dangerous",
        0.94,
        (
            "A broken manhole cover leaves an opening in the road.",
            "The drain cover is missing and traffic must avoid the hole.",
            "A damaged manhole is exposed in the carriageway.",
            "The road has an uncovered drain opening.",
            "A sunken, broken manhole cover creates a serious hazard.",
        ),
    ),
    IncidentSpec(
        "Orangi Town, Sector 11",
        24.9540,
        67.0100,
        "broken_manhole",
        "severe",
        0.87,
        (
            "A cracked manhole cover is sinking into the road.",
            "The drain cover has broken and is unsafe to cross.",
            "A damaged manhole is creating a deep road opening.",
            "The manhole cover is loose and partly collapsed.",
            "A broken drain cover is disrupting the street.",
        ),
    ),
    IncidentSpec(
        "Lyari, near Lee Market",
        24.8710,
        66.9950,
        "waterlogged",
        "moderate",
        0.61,
        (
            "Standing water hides a damaged patch of road.",
            "Water has collected over a rough section of the lane.",
            "A waterlogged road patch is difficult to inspect.",
            "The road is flooded around a broken surface.",
            "Pooled water is covering a damaged section of asphalt.",
        ),
    ),
    IncidentSpec(
        "Landhi, Sherpao Colony",
        24.8430,
        67.1990,
        "waterlogged",
        "severe",
        0.79,
        (
            "Deep standing water is covering a damaged road section.",
            "Flood water has collected in a large road depression.",
            "A waterlogged stretch is unsafe for two-wheelers.",
            "The flooded lane may conceal a deep pothole.",
            "A large pool covers the damaged carriageway.",
        ),
    ),
    IncidentSpec(
        "Burns Road, near Bohri Bazaar",
        24.8620,
        67.0270,
        "other",
        "moderate",
        0.65,
        (
            "An illegal garbage dump is blocking part of the street.",
            "A large pile of dumped waste is obstructing the road.",
            "Uncollected rubbish has formed a dump beside the lane.",
            "Garbage has been illegally left across the roadside.",
            "A waste pile is creating an obstruction for traffic.",
        ),
    ),
    IncidentSpec(
        "Gulshan-e-Iqbal, near University Road",
        24.9200,
        67.0910,
        "other",
        "severe",
        0.81,
        (
            "A large illegal waste dump is spreading into the road.",
            "Dumped garbage is blocking the street and sidewalk.",
            "A roadside rubbish pile is obstructing passing vehicles.",
            "A substantial garbage dump has accumulated near the junction.",
            "Illegal waste dumping is narrowing the traffic lane.",
        ),
    ),
)

_REPORT_OFFSETS: tuple[tuple[float, float], ...] = (
    (-0.00012, -0.00010),
    (-0.00005, 0.00008),
    (0.00000, 0.00000),
    (0.00006, -0.00004),
    (0.00013, 0.00010),
)
_STARTED_AT = datetime(2025, 1, 15, tzinfo=timezone.utc)


def generate_synthetic_dispatch_dataset() -> SyntheticDispatchDataset:
    reports: list[SyntheticReport] = []
    expected_incident_by_report_id: dict[str, str] = {}

    for incident_number, incident in enumerate(_INCIDENTS, start=1):
        incident_id = f"synthetic-incident-{incident_number:02d}"
        for report_index, (lat_offset, lng_offset) in enumerate(_REPORT_OFFSETS):
            report_number = len(reports) + 1
            report_id = f"synthetic-report-{report_number:03d}"
            created_at = _STARTED_AT + timedelta(minutes=report_number * 11)
            reports.append(
                {
                    "id": report_id,
                    "lat": round(incident.lat + lat_offset, 6),
                    "lng": round(incident.lng + lng_offset, 6),
                    "address": incident.address,
                    "description": incident.descriptions[report_index],
                    "damage_type": incident.damage_type,
                    "severity": incident.severity,
                    "severity_score": incident.severity_score,
                    "reporter_count": 1,
                    "status": "pending_review",
                    "created_at": created_at.isoformat().replace("+00:00", "Z"),
                }
            )
            expected_incident_by_report_id[report_id] = incident_id

    return {
        "reports": reports,
        "expected_incident_by_report_id": expected_incident_by_report_id,
    }
