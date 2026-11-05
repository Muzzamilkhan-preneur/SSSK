import os

import requests


def _config() -> tuple[str, str, str]:
    url = (os.environ.get("SUPABASE_URL") or "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or ""
    bucket = os.environ.get("SUPABASE_STORAGE_BUCKET") or ""
    if not url or not key or not bucket:
        raise RuntimeError(
            "Set SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and "
            "SUPABASE_STORAGE_BUCKET"
        )
    return url, key, bucket


def _headers(key: str, content_type: str | None = None) -> dict[str, str]:
    headers = {"Authorization": f"Bearer {key}", "apikey": key}
    if content_type:
        headers["Content-Type"] = content_type
    return headers


def put_object(path: str, data: bytes, content_type: str) -> dict:
    url, key, bucket = _config()
    response = requests.post(
        f"{url}/storage/v1/object/{bucket}/{path}",
        headers=_headers(key, content_type),
        data=data,
        timeout=120,
    )
    if not response.ok:
        detail = response.text[:200].replace("\n", " ")
        raise RuntimeError(
            f"Supabase storage upload failed ({response.status_code}): {detail}"
        )
    return {"path": path}


def get_object(path: str) -> tuple[bytes, str]:
    url, key, bucket = _config()
    response = requests.get(
        f"{url}/storage/v1/object/{bucket}/{path}",
        headers=_headers(key),
        timeout=120,
    )
    if response.status_code == 404:
        raise FileNotFoundError(path)
    response.raise_for_status()
    return response.content, response.headers.get(
        "Content-Type", "application/octet-stream"
    )
