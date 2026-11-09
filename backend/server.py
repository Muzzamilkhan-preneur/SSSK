import asyncio
import hashlib
import json
import logging
import math
import os
import uuid
from contextlib import suppress
from datetime import datetime, timezone
from pathlib import Path
from typing import Annotated, List, Optional

import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, File, Form, HTTPException, Query, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, BeforeValidator, ConfigDict, Field
from firebase_store import FirestoreDatabase
from supabase_storage import get_object, put_object
from starlette.concurrency import run_in_threadpool
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

from decisions import (
    DecisionsUnavailable,
    choice,
    decide,
    image_part,
    predicate,
    prob,
    score,
    text_part,
    verify_selfie,
)  # noqa: E402

db = FirestoreDatabase()
SEED_VERSION = "v3"
SEED_DIR = ROOT_DIR / "seed_images"
MERGE_RADIUS_M = 5
OPEN_STATUSES = ["pending_review", "assigned", "in_progress", "rework"]
AI_UNAVAILABLE = "AI check unavailable, try again"
logger = logging.getLogger(__name__)

APP_NAME = "saaf-sarak"


def valid_id(value: Optional[str]) -> bool:
    return bool(value and value.strip())


# --- Firestore models -------------------------------------------------------
PyObjectId = Annotated[
    str, BeforeValidator(lambda v: str(v) if not isinstance(v, str) else v)
]


class BaseDocument(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    id: Optional[PyObjectId] = None

    def to_firestore(self) -> dict:
        d = self.model_dump(exclude_none=True)
        if d.get("id"):
            d["_id"] = d.pop("id")
        else:
            d.pop("id", None)
        return d

    @classmethod
    def from_firestore(cls, doc: dict):
        d = dict(doc)
        if "_id" in d:
            d["id"] = str(d.pop("_id"))
        return cls(**d)


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimelineEvent(BaseModel):
    status: str
    label: str
    note: Optional[str] = None
    actor: Optional[str] = None
    at: datetime = Field(default_factory=utcnow)


class Finding(BaseModel):
    key: str
    label: str
    probability: float


class Verification(BaseModel):
    verified: bool
    confidence: float
    reason: str
    checks: List[Finding] = Field(default_factory=list)


class Reporter(BaseModel):
    citizen_id: str
    name: str
    at: datetime = Field(default_factory=utcnow)


class Report(BaseDocument):
    citizen_id: str
    citizen_name: str
    reporters: List[Reporter] = Field(default_factory=list)
    reporter_count: int = 1
    image_path: str
    image_hash: Optional[str] = None
    extra_hashes: List[str] = Field(default_factory=list)
    extra_image_paths: List[str] = Field(default_factory=list)
    after_image_path: Optional[str] = None
    lat: float
    lng: float
    address: Optional[str] = None
    description: Optional[str] = None
    severity: Optional[str] = None  # minor | moderate | severe | dangerous
    severity_score: Optional[float] = None  # 0..1
    severity_confidence: Optional[float] = None
    damage_type: Optional[str] = None
    findings: List[Finding] = Field(default_factory=list)
    needs_review: bool = False
    status: str = "pending_review"
    verdict: Optional[str] = None
    contractor_id: Optional[str] = None
    contractor_name: Optional[str] = None
    verification: Optional[Verification] = None
    timeline: List[TimelineEvent] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Contractor(BaseDocument):
    name: str
    company: str
    phone: str = ""
    specialty: str = ""
    rating: float = 4.5
    completed_jobs: int = 0
    is_verified: bool = False


class Citizen(BaseDocument):
    name: str
    selfie_path: Optional[str] = None
    selfie_verified: bool = False
    created_at: datetime = Field(default_factory=utcnow)


class ReviewInput(BaseModel):
    verdict: str
    contractor_id: Optional[str] = None
    note: Optional[str] = None


async def ensure_indexes() -> None:
    return None


# --- AI: OpenAI Decisions API ----------------------------------------------
SEVERITY_LEVELS = [
    (
        "minor",
        "Minor",
        "Surface cracks or a shallow dip under about 3 cm deep, smaller than a dinner plate. No real risk to vehicles.",
    ),
    (
        "moderate",
        "Moderate",
        "A defined pothole a few centimetres deep and up to about half a metre across. Uncomfortable but passable; small risk to two-wheelers.",
    ),
    (
        "severe",
        "Severe",
        "A deep pothole (roughly 5 to 10 cm) or wider than half a metre, often with exposed gravel or base layer. Can damage tyres and unbalance motorbikes.",
    ),
    (
        "dangerous",
        "Dangerous",
        "A very deep or large crater, collapsed road, open or broken manhole, or damage across most of the lane. Serious accident risk for two-wheelers and cars.",
    ),
]
DAMAGE_TYPES = [
    ("pothole", "A bowl-shaped hole where the road surface has broken away."),
    ("cracking", "Cracks or alligator cracking without a real hole."),
    ("sunken_road", "A sunken, collapsed or depressed section of road."),
    ("broken_manhole", "A missing, broken or sunken manhole or drain cover."),
    ("waterlogged", "A damaged patch mostly hidden under standing water."),
    ("other", "Some other kind of road surface damage."),
]
def analyze_road_image(data: bytes, mime: str) -> dict:
    questions = [
        predicate(
            "is_road_damage",
            "Does this photo show damaged road or street surface, such as a pothole, cracking, a sunken patch, a broken manhole or a water-logged damaged patch? Illegal garbage dumps, roadside rubbish, construction debris, and overflowing bins are not road damage; answer no unless the road surface itself is visibly damaged. Also answer no for selfies, people, vehicles, walls, indoor scenes, screens or undamaged roads.",
        ),
        score(
            "severity",
            "How severe is the road damage in this photo?",
            [(lbl, desc) for _, lbl, desc in SEVERITY_LEVELS],
        ),
        choice("damage_type", "What type of road damage is this?", DAMAGE_TYPES),
        {
            "type": "observations",
            "name": "observations",
            "instructions": (
                "For a confirmed road-damage image, describe 3 or 4 distinct "
                "visible factors that support the assessment and indicate severity. "
                "Use only evidence visible in the image; do not infer hidden causes, "
                "exact dimensions, or nearby hazards that cannot be seen."
            ),
        },
    ]
    a = decide(
        [
            text_part("Citizen photo submitted for a road-damage assessment in Karachi."),
            image_part(data, mime),
        ],
        questions,
    )
    road_p = prob(a, "is_road_damage")
    result = {"is_road_damage": road_p >= 0.5, "road_probability": round(road_p, 3)}
    if not result["is_road_damage"]:
        return result

    sev = a.get("severity") or {}
    if not isinstance(sev, dict):
        sev = {}
    probabilities = []
    for item in sev.get("probabilities", []):
        try:
            value = int(item["value"])
            probability = float(item["probability"])
        except (KeyError, TypeError, ValueError):
            continue
        if 0 <= value < len(SEVERITY_LEVELS) and 0 <= probability <= 1:
            probabilities.append((value, probability))
    if probabilities:
        top_value, sev_conf = max(probabilities, key=lambda item: item[1])
    else:
        top_value, sev_conf = 1, 0.0
    try:
        model_severity_score = float(sev.get("score", top_value)) / (
            len(SEVERITY_LEVELS) - 1
        )
    except (TypeError, ValueError):
        model_severity_score = top_value / (len(SEVERITY_LEVELS) - 1)

    dt = a.get("damage_type") or {}
    dt_value = (
        dt.get("choice")
        if isinstance(dt, dict) and dt.get("type") == "choice"
        else "other"
    )
    try:
        dt_conf = (
            max(0.0, min(1.0, float(dt.get("confidence", 0))))
            if isinstance(dt, dict) and dt.get("type") == "choice"
            else 0.0
        )
    except (TypeError, ValueError):
        dt_conf = 0.0

    sev_key = SEVERITY_LEVELS[top_value][0]
    severity_score = max(model_severity_score, top_value / (len(SEVERITY_LEVELS) - 1))

    observations = a.get("observations")
    if not isinstance(observations, dict) or observations.get("type") != "observations":
        raise DecisionsUnavailable("AI_INVALID_RESPONSE")
    items = observations.get("items")
    if not isinstance(items, list) or not 3 <= len(items) <= 4:
        raise DecisionsUnavailable("AI_INVALID_RESPONSE")
    findings = []
    for index, item in enumerate(items):
        if not isinstance(item, dict) or not isinstance(item.get("label"), str):
            raise DecisionsUnavailable("AI_INVALID_RESPONSE")
        label = item["label"].strip()
        try:
            confidence = float(item["confidence"])
        except (KeyError, TypeError, ValueError) as exc:
            raise DecisionsUnavailable("AI_INVALID_RESPONSE") from exc
        if not label or not 0 <= confidence <= 1:
            raise DecisionsUnavailable("AI_INVALID_RESPONSE")
        findings.append(
            {
                "key": f"observation_{index + 1}",
                "label": label,
                "probability": round(confidence, 3),
            }
        )

    result.update(
        {
            "severity": sev_key,
            "severity_score": round(max(0.0, min(1.0, severity_score)), 3),
            "severity_confidence": round(sev_conf, 3),
            "damage_type": dt_value,
            "findings": findings,
            "needs_review": (
                road_p < 0.75
                or sev_conf < 0.5
                or dt_conf < 0.45
                or (top_value >= 2 and sev_conf < 0.65)
            ),
        }
    )
    return result


SELFIE_CHECKS = [
    (
        "has_face",
        "Face found",
        "No human face found",
        "Does this photo contain a clearly human face?",
    ),
    (
        "single_person",
        "Exactly one person",
        "More than one person in the photo",
        "Is exactly one person's face visible in this photo?",
    ),
    (
        "face_clear",
        "Face is clear enough",
        "The face is difficult to assess. Try brighter light and face the camera",
        "Are the eyes, nose and mouth reasonably visible and in focus with usable lighting? Do not require a perfectly centered face or high-resolution image.",
    ),
    (
        "real_capture",
        "Real person, not a screen or print",
        "Looks like a photo of a screen or print",
        "Is this a direct photo of a real person in front of the camera, rather than a photo of a screen, a printed photo, a poster, a painting, a drawing or a cartoon?",
    ),
]


def check_selfie(data: bytes, mime: str) -> dict:
    probabilities = verify_selfie(data, mime)
    checks, reason = [], None
    for key, label, fail_reason, _ in SELFIE_CHECKS:
        p = probabilities[key]
        threshold = 0.5 if key == "face_clear" else 0.6
        passed = p >= threshold
        checks.append(
            {"key": key, "label": label, "probability": round(p, 3), "passed": passed}
        )
        if (
            key in {"has_face", "single_person", "real_capture"}
            and not passed
            and reason is None
        ):
            reason = fail_reason
    return {"passed": reason is None, "reason": reason, "checks": checks}


REPAIR_CHECKS = [
    (
        "same_spot",
        "Same spot as the report",
        "The after photo doesn't appear to show the same spot.",
        "Do the BEFORE and AFTER photos show the same stretch of road (matching surroundings, kerbs, markings or road layout)? Allow for a different angle, lighting and time of day.",
    ),
    (
        "filled",
        "Pothole filled",
        "The pothole still looks open in the after photo.",
        "In the AFTER photo, has the damage seen in the BEFORE photo been filled or patched so no open hole remains?",
    ),
    (
        "level",
        "Surface level with the road",
        "The patch isn't level with the surrounding road.",
        "In the AFTER photo, is the repaired surface level and flush with the surrounding road, with no bump or remaining dip?",
    ),
]


def verify_repair(
    before: bytes, before_mime: str, after: bytes, after_mime: str
) -> dict:
    content = [
        text_part("Photo 1 is the BEFORE photo: the pothole a citizen reported."),
        image_part(before, before_mime),
        text_part("Photo 2 is the AFTER photo: the contractor's proof of repair."),
        image_part(after, after_mime),
    ]
    a = decide(content, [predicate(k, q) for k, _, _, q in REPAIR_CHECKS])
    checks, reason = [], None
    thresholds = {"same_spot": 0.5, "filled": 0.6, "level": 0.5}
    for key, label, fail_reason, _ in REPAIR_CHECKS:
        p = prob(a, key)
        checks.append({"key": key, "label": label, "probability": round(p, 3)})
        if p < thresholds[key] and reason is None:
            reason = fail_reason
    confidence = sum(c["probability"] for c in checks) / len(checks)
    return {
        "verified": reason is None,
        "confidence": round(confidence, 3),
        "reason": reason
        or "Repair confirmed: the damage is filled and the surface is level with the road.",
        "checks": checks,
    }


# --- Geo helpers -------------------------------------------------------------
_geo_cache: dict[str, str] = {}


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371000
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = math.radians(lat2 - lat1), math.radians(lng2 - lng1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def reverse_geocode(lat: float, lng: float) -> str:
    key = f"{lat:.4f},{lng:.4f}"
    if key in _geo_cache:
        return _geo_cache[key]
    try:
        resp = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={
                "lat": lat,
                "lon": lng,
                "format": "jsonv2",
                "zoom": 17,
                "accept-language": "en",
            },
            headers={
                "User-Agent": "SaafSarakKarachi/1.0 (civic road-maintenance demo)"
            },
            timeout=10,
        )
        addr = resp.json().get("address", {}) if resp.ok else {}
    except Exception as exc:
        logger.error("reverse_geocode failed: %s", exc)
        addr = {}
    road = addr.get("road") or addr.get("pedestrian") or addr.get("footway")
    area = (
        addr.get("neighbourhood")
        or addr.get("suburb")
        or addr.get("quarter")
        or addr.get("city_district")
    )
    city = (
        (addr.get("city") or addr.get("town") or "Karachi")
        .replace(" Division", "")
        .replace(" District", "")
    )
    if area:
        area = area.replace(" District", "").replace(" Division", "")
    parts = [p for p in (road, area, city) if p]
    label = ", ".join(dict.fromkeys(parts)) or "Karachi"
    _geo_cache[key] = label
    return label


def _ext(filename: Optional[str], default: str = "jpg") -> str:
    if filename and "." in filename:
        return filename.rsplit(".", 1)[1].lower()[:5] or default
    return default


async def save_report(report: Report) -> None:
    payload = report.model_dump(exclude={"id", "created_at"})
    await db.reports.update_one({"_id": report.id}, {"$set": payload})


async def load_report(report_id: str) -> Report:
    if not valid_id(report_id):
        raise HTTPException(status_code=400, detail="Invalid report id")
    doc = await db.reports.find_one({"_id": report_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Report not found")
    return Report.from_firestore(doc)


def nearby_report_matches(
    lat: float, lng: float, documents: list[dict]
):
    matches = []
    for document in documents:
        try:
            distance_m = haversine_m(
                lat, lng, float(document["lat"]), float(document["lng"])
            )
        except (KeyError, TypeError, ValueError):
            continue
        if distance_m <= MERGE_RADIUS_M:
            matches.append((distance_m, document))
    return sorted(matches, key=lambda item: item[0])


# --- Seed --------------------------------------------------------------------
SEED_CONTRACTORS = [
    {
        "name": "Karachi RoadWorks Co.",
        "company": "Karachi RoadWorks Co.",
        "phone": "+92 21 3455 1200",
        "specialty": "Asphalting & patch work",
        "rating": 4.6,
        "completed_jobs": 128,
        "is_verified": True,
    },
    {
        "name": "Indus Infra Solutions",
        "company": "Indus Infra Solutions",
        "phone": "+92 21 3453 8890",
        "specialty": "Road milling & resurfacing",
        "rating": 4.4,
        "completed_jobs": 87,
        "is_verified": True,
    },
    {
        "name": "Metro Asphalt Works",
        "company": "Metro Asphalt Works",
        "phone": "+92 21 111 638 762",
        "specialty": "Emergency pothole crews",
        "rating": 4.8,
        "completed_jobs": 204,
        "is_verified": True,
    },
]
SEED_CITIZENS = ["Ahmed Raza", "Sana Qureshi", "Bilal Khan"]
SEED_REPORTS = [
    {
        "file": "p1.jpg",
        "status": "pending_review",
        "lat": 24.8615,
        "lng": 67.0099,
        "address": "Abdullah Haroon Road, Saddar, Karachi",
        "reporters": 3,
        "description": "Pothole near the Saddar intersection; rickshaws swerve around it.",
    },
    {
        "file": "p2.jpg",
        "status": "pending_review",
        "lat": 24.8722,
        "lng": 67.0815,
        "address": "Shahrah-e-Faisal, PECHS, Karachi",
        "reporters": 1,
        "description": "Large crater in the left lane, two-wheelers are falling in at night.",
    },
    {
        "file": "p3.jpg",
        "status": "assigned",
        "lat": 24.9180,
        "lng": 67.0971,
        "address": "University Road, Gulshan-e-Iqbal, Karachi",
        "reporters": 2,
        "description": "Deep hole outside the bus stop, getting worse every week.",
    },
    {
        "file": "p4.jpg",
        "status": "in_progress",
        "lat": 24.9415,
        "lng": 67.0435,
        "address": "Shahrah-e-Pakistan, North Nazimabad, Karachi",
        "reporters": 1,
        "description": "Water collects in this pothole after every rain.",
    },
    {
        "file": "p5.jpg",
        "status": "verified",
        "lat": 24.8138,
        "lng": 67.0336,
        "address": "Khayaban-e-Ittehad, DHA Phase 6, Karachi",
        "reporters": 1,
        "description": "Broken patch outside the school gate.",
        "after": "after1.jpg",
    },
]


async def seed_demo_data() -> None:
    try:
        for contractor_spec in SEED_CONTRACTORS:
            contractor_doc = await db.contractors.find_one(
                {"name": contractor_spec["name"]}
            )
            if contractor_doc and "is_verified" not in contractor_doc:
                await db.contractors.update_one(
                    {"_id": contractor_doc["_id"]},
                    {"$set": {"is_verified": True}},
                )
        missing = [
            spec["file"]
            for spec in SEED_REPORTS
            if not (SEED_DIR / spec["file"]).is_file()
        ]
        missing_after = [
            spec["after"]
            for spec in SEED_REPORTS
            if spec.get("after") and not (SEED_DIR / spec["after"]).is_file()
        ]
        missing.extend(missing_after)
        if missing:
            logger.warning(
                "demo seed skipped; missing optional files: %s",
                ", ".join(sorted(set(missing))),
            )
            return
        meta = await db.meta.find_one({"_id": "seed"})
        if meta and meta.get("version") == SEED_VERSION:
            return
        for coll in ("reports", "contractors", "citizens"):
            await db[coll].delete_many({})

        await db.contractors.insert_many(
            [Contractor(**c).to_firestore() for c in SEED_CONTRACTORS]
        )
        contractor = Contractor.from_firestore(
            await db.contractors.find_one({"name": "Karachi RoadWorks Co."})
        )
        citizen_ids = []
        for name in SEED_CITIZENS:
            res = await db.citizens.insert_one(Citizen(name=name).to_firestore())
            citizen_ids.append(str(res.inserted_id))

        now = utcnow()
        for spec in SEED_REPORTS:
            data = (SEED_DIR / spec["file"]).read_bytes()
            path = (
                await run_in_threadpool(
                    put_object,
                    f"{APP_NAME}/seed/{uuid.uuid4()}.jpg",
                    data,
                    "image/jpeg",
                )
            )["path"]
            try:
                a = await run_in_threadpool(analyze_road_image, data, "image/jpeg")
            except DecisionsUnavailable:
                a = {
                    "is_road_damage": True,
                    "severity": "severe",
                    "severity_score": 0.66,
                    "severity_confidence": 0.5,
                    "damage_type": "pothole",
                    "findings": [],
                    "needs_review": True,
                }
            reporters = [
                Reporter(citizen_id=citizen_ids[i], name=SEED_CITIZENS[i], at=now)
                for i in range(spec["reporters"])
            ]
            sev_label = a["severity"].title()
            timeline = [
                TimelineEvent(
                    status="pending_review",
                    label="Report Submitted",
                    note=spec["address"],
                    actor=SEED_CITIZENS[0],
                    at=now,
                ),
                TimelineEvent(
                    status="pending_review",
                    label="AI Inspection Complete",
                    note=f"{sev_label} severity ({round(a['severity_confidence'] * 100)}% confident)",
                    actor="AI Inspector",
                    at=now,
                ),
            ]
            for r in reporters[1:]:
                timeline.append(
                    TimelineEvent(
                        status="pending_review",
                        label="Another Citizen Reported This",
                        note=f"{r.name} reported the same pothole",
                        actor=r.name,
                        at=now,
                    )
                )
            report = Report(
                citizen_id=citizen_ids[0],
                citizen_name=SEED_CITIZENS[0],
                reporters=reporters,
                reporter_count=len(reporters),
                image_path=path,
                image_hash=hashlib.sha256(data).hexdigest(),
                lat=spec["lat"],
                lng=spec["lng"],
                address=spec["address"],
                description=spec["description"],
                severity=a["severity"],
                severity_score=a["severity_score"],
                severity_confidence=a["severity_confidence"],
                damage_type=a["damage_type"],
                findings=[Finding(**f) for f in a["findings"]],
                needs_review=a["needs_review"],
                status="pending_review",
                timeline=timeline,
                created_at=now,
                updated_at=now,
            )
            if spec["status"] != "pending_review":
                report.verdict, report.contractor_id, report.contractor_name = (
                    "genuine",
                    contractor.id,
                    contractor.name,
                )
                report.timeline.append(
                    TimelineEvent(
                        status="assigned",
                        label="Marked Genuine, Contractor Assigned",
                        note=f"Assigned to {contractor.name}",
                        actor="Mayor Office",
                        at=now,
                    )
                )
                report.status = "assigned"
            if spec["status"] in ("in_progress", "verified"):
                report.timeline.append(
                    TimelineEvent(
                        status="in_progress",
                        label="Repair Started",
                        actor=contractor.name,
                        at=now,
                    )
                )
                report.status = "in_progress"
            if spec["status"] == "verified":
                after = (SEED_DIR / spec["after"]).read_bytes()
                report.after_image_path = (
                    await run_in_threadpool(
                        put_object,
                        f"{APP_NAME}/seed/{uuid.uuid4()}.jpg",
                        after,
                        "image/jpeg",
                    )
                )["path"]
                report.verification = Verification(
                    verified=True,
                    confidence=0.9,
                    reason="Demo record with sample photos. Live repairs are checked by AI against the citizen's photo.",
                    checks=[],
                )
                report.timeline.append(
                    TimelineEvent(
                        status="verified",
                        label="Repair Verified",
                        note="Demo record with sample photos",
                        actor="Mayor Office",
                        at=now,
                    )
                )
                report.status = "verified"
            await db.reports.insert_one(report.to_firestore())
        await db.meta.update_one(
            {"_id": "seed"}, {"$set": {"version": SEED_VERSION}}, upsert=True
        )
        logger.info("seeded demo data %s", SEED_VERSION)
    except Exception as exc:
        logger.exception("seed_demo_data failed: %s", exc)


# --- App / router ------------------------------------------------------------
app = FastAPI()
api_router = APIRouter(prefix="/api")


@app.get("/health", include_in_schema=False)
@app.head("/health", include_in_schema=False)
async def health():
    return {"status": "ok"}


@api_router.get("/")
async def root():
    return {"message": "Saaf Sarak, Saaf Karachi API"}


@api_router.get("/files/{path:path}")
async def serve_file(path: str):
    try:
        data, content_type = await run_in_threadpool(get_object, path)
    except Exception:
        raise HTTPException(status_code=404, detail="File not found")
    return Response(
        content=data,
        media_type=content_type,
        headers={"Cache-Control": "public, max-age=86400"},
    )


@api_router.get("/geocode")
async def geocode(lat: float, lng: float):
    return {"address": await run_in_threadpool(reverse_geocode, lat, lng)}


# --- Citizens ----------------------------------------------------------------
@api_router.post("/citizens/register")
async def register_citizen(name: str = Form(...), image: UploadFile = File(...)):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    mime = image.content_type or "image/jpeg"
    try:
        result = await run_in_threadpool(check_selfie, data, mime)
    except DecisionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.exception("selfie verification failed unexpectedly")
        raise HTTPException(status_code=503, detail=AI_UNAVAILABLE)
    if not result["passed"]:
        return {**result, "citizen": None}
    citizen = Citizen(name=name, selfie_verified=True)
    try:
        res = await db.citizens.insert_one(citizen.to_firestore())
        citizen.id = str(res.inserted_id)
    except Exception:
        logger.exception("citizen persistence failed after successful verification")
        citizen.id = uuid.uuid4().hex
        return {**result, "citizen": citizen.model_dump()}
    try:
        citizen.selfie_path = (
            await run_in_threadpool(
                put_object,
                f"{APP_NAME}/selfies/{citizen.id}.{_ext(image.filename)}",
                data,
                mime,
            )
        )["path"]
        await db.citizens.update_one(
            {"_id": res.inserted_id}, {"$set": {"selfie_path": citizen.selfie_path}}
        )
    except Exception:
        logger.exception("selfie archival failed after successful verification")
    return {**result, "citizen": citizen.model_dump()}


@api_router.post("/citizens/register-without-selfie")
async def register_citizen_without_selfie(name: str = Form(...)):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Name is required")
    citizen = Citizen(name=name, selfie_verified=False)
    try:
        res = await db.citizens.insert_one(citizen.to_firestore())
    except Exception as exc:
        logger.exception("unverified citizen persistence failed")
        raise HTTPException(
            status_code=503, detail="Profile could not be saved. Please try again."
        ) from exc
    citizen.id = str(res.inserted_id)
    return {"citizen": citizen.model_dump()}


# --- AI analysis (no DB write) ----------------------------------------------
@api_router.post("/ai/analyze-pothole")
async def analyze_pothole(image: UploadFile = File(...)):
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    try:
        return await run_in_threadpool(
            analyze_road_image, data, image.content_type or "image/jpeg"
        )
    except DecisionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))
    except Exception:
        logger.exception("pothole analysis failed unexpectedly")
        raise HTTPException(status_code=503, detail="AI_INVALID_RESPONSE")


# --- Reports -----------------------------------------------------------------
@api_router.post("/reports")
async def create_report(
    image: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    citizen_id: str = Form(...),
    citizen_name: str = Form(...),
    description: str = Form(""),
    analysis: str = Form(""),
    confirmed_match_id: str = Form(""),
    separate_match_id: str = Form(""),
):
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    image_hash = hashlib.sha256(data).hexdigest()

    now = utcnow()
    mime = image.content_type or "image/jpeg"
    # Reuse the completed inspection from the previous screen. This avoids
    # sending the same image to OpenAI twice during one report flow.
    try:
        a = json.loads(analysis) if analysis else None
    except json.JSONDecodeError:
        a = None
    required = {"is_road_damage", "severity", "severity_score", "severity_confidence", "damage_type", "findings", "needs_review"}
    if not isinstance(a, dict) or not required.issubset(a):
        try:
            a = await run_in_threadpool(analyze_road_image, data, mime)
        except DecisionsUnavailable as exc:
            raise HTTPException(status_code=503, detail=str(exc))
    if not a["is_road_damage"]:
        raise HTTPException(
            status_code=422,
            detail="This doesn't look like road damage. Please photograph the pothole.",
        )

    if confirmed_match_id and separate_match_id:
        raise HTTPException(
            status_code=400, detail="Choose whether this is the same pothole."
        )

    nearby = []
    selected_match_id = confirmed_match_id or separate_match_id
    if selected_match_id:
        selected_doc = await db.reports.find_one({"_id": selected_match_id})
        if not selected_doc or (
            confirmed_match_id and selected_doc.get("status") not in OPEN_STATUSES
        ):
            raise HTTPException(
                status_code=409,
                detail="The nearby report changed. Please submit again.",
            )
        try:
            distance_m = haversine_m(
                lat, lng, float(selected_doc["lat"]), float(selected_doc["lng"])
            )
        except (KeyError, TypeError, ValueError):
            distance_m = MERGE_RADIUS_M + 1
        if distance_m > MERGE_RADIUS_M:
            raise HTTPException(
                status_code=409,
                detail=f"The report is no longer within {MERGE_RADIUS_M} metres of this pin. Please submit again.",
            )
        if confirmed_match_id:
            nearby = [(distance_m, selected_doc)]
    else:
        open_docs = await db.reports.find(
            {"status": {"$in": OPEN_STATUSES}}
        ).to_list(1000)
        nearby = nearby_report_matches(lat, lng, open_docs)
        if nearby:
            distance_m, candidate_doc = nearby[0]
            candidate = Report.from_firestore(candidate_doc)
            already_reported = candidate.citizen_id == citizen_id or any(
                reporter.citizen_id == citizen_id for reporter in candidate.reporters
            )
            return {
                "match_required": True,
                "candidate": {
                    "id": candidate.id,
                    "address": candidate.address,
                    "distance_m": round(distance_m),
                    "reporter_count": candidate.reporter_count,
                    "already_reported": already_reported,
                },
            }

    if nearby:
        existing = Report.from_firestore(nearby[0][1])
        already_reported = existing.citizen_id == citizen_id or any(
            reporter.citizen_id == citizen_id for reporter in existing.reporters
        )
        if already_reported:
            return {
                "merged": True,
                "already_reported": True,
                "report": existing.model_dump(),
            }

        existing.reporters.append(
            Reporter(citizen_id=citizen_id, name=citizen_name, at=now)
        )
        existing.reporter_count = max(
            existing.reporter_count + 1, len(existing.reporters)
        )
        existing.timeline.append(
            TimelineEvent(
                status=existing.status,
                label="Another Citizen Reported This",
                note=f"{citizen_name} reported this pothole. {existing.reporter_count} citizen profiles have reported it.",
                actor=citizen_name,
                at=now,
            )
        )
        existing.updated_at = now
        await save_report(existing)
        return {
            "merged": True,
            "already_reported": False,
            "report": existing.model_dump(),
        }

    # Archive evidence for a new report.
    try:
        path = (
            await run_in_threadpool(
                put_object,
                f"{APP_NAME}/uploads/{citizen_id}/{uuid.uuid4()}.{_ext(image.filename)}",
                data,
                mime,
            )
        )["path"]
    except Exception as exc:
        logger.exception("report image archival failed")
        raise HTTPException(
            status_code=503, detail=f"Report image storage failed: {exc}"
        ) from exc

    address = await run_in_threadpool(reverse_geocode, lat, lng)
    report = Report(
        citizen_id=citizen_id,
        citizen_name=citizen_name,
        reporters=[Reporter(citizen_id=citizen_id, name=citizen_name, at=now)],
        reporter_count=1,
        image_path=path,
        image_hash=image_hash,
        lat=lat,
        lng=lng,
        address=address,
        description=description.strip() or None,
        severity=a["severity"],
        severity_score=a["severity_score"],
        severity_confidence=a["severity_confidence"],
        damage_type=a["damage_type"],
        findings=[Finding(**f) for f in a["findings"]],
        needs_review=a["needs_review"],
        timeline=[
            TimelineEvent(
                status="pending_review",
                label="Report Submitted",
                note=address,
                actor=citizen_name,
                at=now,
            ),
            TimelineEvent(
                status="pending_review",
                label="AI Inspection Complete",
                note=f"{a['severity'].title()} severity ({round(a['severity_confidence'] * 100)}% confident)"
                + (". Needs Mayor review" if a["needs_review"] else ""),
                actor="AI Inspector",
                at=now,
            ),
        ],
        created_at=now,
        updated_at=now,
    )
    try:
        res = await db.reports.insert_one(report.to_firestore())
    except Exception as exc:
        logger.exception("report persistence failed")
        raise HTTPException(
            status_code=503, detail="Report database is temporarily unavailable"
        ) from exc
    report.id = str(res.inserted_id)
    return {"merged": False, "report": report.model_dump()}


@api_router.get("/reports", response_model=List[Report])
async def list_reports(
    citizen_id: Optional[str] = None,
    contractor_id: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = Query(100, ge=1, le=200),
):
    q: dict = {}
    if citizen_id:
        q["$or"] = [{"citizen_id": citizen_id}, {"reporters.citizen_id": citizen_id}]
    if contractor_id:
        q["contractor_id"] = contractor_id
    if status:
        q["status"] = status
    docs = (
        await db.reports.find(q)
        .sort("created_at", -1)
        .limit(limit)
        .to_list(limit)
    )
    return [Report.from_firestore(d) for d in docs]


@api_router.get("/reports/{report_id}", response_model=Report)
async def get_report(report_id: str):
    return await load_report(report_id)


@api_router.post("/reports/{report_id}/review", response_model=Report)
async def review_report(report_id: str, input: ReviewInput):
    if input.verdict not in ("genuine", "fake"):
        raise HTTPException(status_code=400, detail="verdict must be genuine or fake")
    report = await load_report(report_id)
    if report.status != "pending_review":
        raise HTTPException(
            status_code=400, detail=f"Report already reviewed (status: {report.status})"
        )
    now = utcnow()
    if input.verdict == "fake":
        report.status, report.verdict = "rejected", "fake"
        report.timeline.append(
            TimelineEvent(
                status="rejected",
                label="Marked Fake",
                note=input.note or "Not a genuine road damage report",
                actor="Mayor Office",
                at=now,
            )
        )
    else:
        if not valid_id(input.contractor_id):
            raise HTTPException(
                status_code=400, detail="contractor_id is required to assign"
            )
        cdoc = await db.contractors.find_one({"_id": input.contractor_id})
        if not cdoc:
            raise HTTPException(status_code=404, detail="Contractor not found")
        contractor = Contractor.from_firestore(cdoc)
        report.status, report.verdict = "assigned", "genuine"
        report.contractor_id, report.contractor_name = contractor.id, contractor.name
        report.timeline.append(
            TimelineEvent(
                status="assigned",
                label="Marked Genuine, Contractor Assigned",
                note=f"Assigned to {contractor.name}"
                + (f". {input.note}" if input.note else ""),
                actor="Mayor Office",
                at=now,
            )
        )
    report.updated_at = now
    await save_report(report)
    return report


@api_router.post("/reports/{report_id}/start", response_model=Report)
async def start_repair(report_id: str):
    report = await load_report(report_id)
    if report.status != "assigned":
        raise HTTPException(
            status_code=400, detail=f"Cannot start a report in status: {report.status}"
        )
    now = utcnow()
    report.status = "in_progress"
    report.timeline.append(
        TimelineEvent(
            status="in_progress",
            label="Repair Started",
            actor=report.contractor_name,
            at=now,
        )
    )
    report.updated_at = now
    await save_report(report)
    return report


@api_router.post("/reports/{report_id}/complete", response_model=Report)
async def complete_repair(report_id: str, image: UploadFile = File(...)):
    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty image")
    report = await load_report(report_id)
    if report.status not in ("in_progress", "rework"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot submit proof for a report in status: {report.status}",
        )

    mime = image.content_type or "image/jpeg"
    before, before_mime = await run_in_threadpool(get_object, report.image_path)
    try:
        v = await run_in_threadpool(verify_repair, before, before_mime, data, mime)
    except DecisionsUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    report.after_image_path = (
        await run_in_threadpool(
            put_object,
            f"{APP_NAME}/uploads/{report.citizen_id}/{uuid.uuid4()}.{_ext(image.filename)}",
            data,
            mime,
        )
    )["path"]
    report.verification = Verification(**v)
    now = utcnow()
    if report.verification.verified:
        report.status = "verified"
        report.timeline.append(
            TimelineEvent(
                status="verified",
                label="Repair Verified by AI",
                note=f"Pothole filled and surface level ({round(v['confidence'] * 100)}% confident)",
                actor="AI Auditor",
                at=now,
            )
        )
        if report.contractor_id:
            await db.contractors.update_one(
                {"_id": report.contractor_id}, {"$inc": {"completed_jobs": 1}}
            )
    else:
        report.status = "rework"
        report.timeline.append(
            TimelineEvent(
                status="rework",
                label="Rework Needed",
                note=v["reason"],
                actor="AI Auditor",
                at=now,
            )
        )
    report.updated_at = now
    await save_report(report)
    return report


@api_router.get("/contractors", response_model=List[Contractor])
async def list_contractors():
    docs = await db.contractors.find().sort("rating", -1).to_list(100)
    return [Contractor.from_firestore(d) for d in docs]


@api_router.get("/stats")
async def get_stats():
    total = await db.reports.count_documents({})
    by_status = {
        s: await db.reports.count_documents({"status": s})
        for s in (
            "pending_review",
            "assigned",
            "in_progress",
            "rework",
            "verified",
            "rejected",
        )
    }
    by_severity = {
        s: await db.reports.count_documents({"severity": s})
        for s, _, _ in SEVERITY_LEVELS
    }
    fixed = by_status["verified"]
    return {
        "total": total,
        "by_status": by_status,
        "by_severity": by_severity,
        "fixed": fixed,
        "fixed_rate": round(fixed / total, 2) if total else 0.0,
    }


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=False,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://sssk-q4p9.onrender.com",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    if os.environ.get("DEMO_SEED", "").lower() == "true":
        app.state.seed_task = asyncio.create_task(seed_demo_data())
    else:
        app.state.seed_task = None


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    if app.state.seed_task:
        app.state.seed_task.cancel()
        with suppress(asyncio.CancelledError):
            await app.state.seed_task
    await db.close()
