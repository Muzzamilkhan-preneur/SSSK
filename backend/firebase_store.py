import json
import os
import uuid
from types import SimpleNamespace
from typing import Any

import firebase_admin
from firebase_admin import credentials, firestore


def _credentials():
    raw = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
    if raw:
        return credentials.Certificate(json.loads(raw))
    path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_FILE")
    if path:
        return credentials.Certificate(path)
    raise RuntimeError(
        "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_FILE"
    )


def initialize_firebase():
    if firebase_admin._apps:
        return firebase_admin.get_app()
    return firebase_admin.initialize_app(_credentials())


class _Cursor:
    def __init__(self, documents):
        self.documents = documents

    def sort(self, field: str, direction: int):
        self.documents.sort(
            key=lambda doc: doc.get(field) or (0 if direction < 0 else ""),
            reverse=direction < 0,
        )
        return self

    def limit(self, count: int):
        self.documents = self.documents[:count]
        return self

    async def to_list(self, limit: int):
        return self.documents[:limit]


def _get_path(document: dict, path: str):
    value: Any = document
    for part in path.split("."):
        if not isinstance(value, dict):
            return None
        value = value.get(part)
    return value


def _matches(document: dict, query: dict) -> bool:
    for key, expected in query.items():
        if key == "$or":
            if not any(_matches(document, item) for item in expected):
                return False
            continue
        actual = _get_path(document, key)
        if isinstance(expected, dict):
            if "$in" in expected and actual not in expected["$in"]:
                return False
            if "$eq" in expected and actual != expected["$eq"]:
                return False
        elif isinstance(actual, list):
            if expected not in actual:
                return False
        elif actual != expected:
            return False
    return True


class _Collection:
    def __init__(self, client, name: str):
        self.client = client
        self.name = name

    def _ref(self, document_id: str):
        return self.client.collection(self.name).document(document_id)

    async def find_one(self, query: dict, projection: dict | None = None):
        if set(query) == {"_id"} and isinstance(query["_id"], str):
            snap = self._ref(query["_id"]).get()
            candidates = [] if not snap.exists else [{"_id": snap.id, **snap.to_dict()}]
        else:
            candidates = [
                {"_id": snap.id, **snap.to_dict()}
                for snap in self.client.collection(self.name).stream()
            ]
        for document in candidates:
            if _matches(document, query):
                if projection:
                    return {"_id": document["_id"], **{
                        key: document[key] for key in projection if projection[key] and key in document
                    }}
                return document
        return None

    def find(self, query: dict | None = None):
        query = query or {}
        documents = [
            {"_id": snap.id, **snap.to_dict()}
            for snap in self.client.collection(self.name).stream()
        ]
        return _Cursor([doc for doc in documents if _matches(doc, query)])

    async def insert_one(self, document: dict):
        document = dict(document)
        document_id = str(document.pop("_id", "") or uuid.uuid4())
        self._ref(document_id).set(document)
        return SimpleNamespace(inserted_id=document_id)

    async def insert_many(self, documents: list[dict]):
        for document in documents:
            await self.insert_one(document)

    async def update_one(self, query: dict, update: dict, upsert: bool = False):
        current = await self.find_one(query)
        if not current:
            if not upsert:
                return SimpleNamespace(matched_count=0)
            current = {"_id": str(query.get("_id") or uuid.uuid4())}
        document_id = current["_id"]
        changes = update.get("$set", {})
        for key, value in update.get("$inc", {}).items():
            changes[key] = current.get(key, 0) + value
        current.update(changes)
        current.pop("_id", None)
        self._ref(document_id).set(current)
        return SimpleNamespace(matched_count=1)

    async def delete_many(self, query: dict):
        for document in await self.find(query).to_list(10000):
            self._ref(document["_id"]).delete()

    async def count_documents(self, query: dict):
        return len(await self.find(query).to_list(10000))


class FirestoreDatabase:
    def __init__(self):
        self._client = None

    @property
    def client(self):
        if self._client is None:
            initialize_firebase()
            self._client = firestore.client()
        return self._client

    def __getitem__(self, name: str):
        return _Collection(self.client, name)

    def __getattr__(self, name: str):
        return self[name]

    async def close(self):
        return None
