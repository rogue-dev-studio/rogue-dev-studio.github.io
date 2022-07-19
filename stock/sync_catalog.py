#!/usr/bin/env python3
"""Sync Shutterstock contributor assets into catalog.json for the static stock gallery.

Requires free API credentials from https://www.shutterstock.com/account/developers/apps
Environment:
  SHUTTERSTOCK_CONSUMER_KEY
  SHUTTERSTOCK_CONSUMER_SECRET

Optional:
  SHUTTERSTOCK_CONTRIBUTOR  (default: ArisHadisopiyan)

Do NOT put login password in this script or in the website frontend.
"""

from __future__ import annotations

import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

OUT = Path(__file__).with_name("catalog.json")
CONTRIBUTOR = os.environ.get("SHUTTERSTOCK_CONTRIBUTOR", "ArisHadisopiyan")
PROFILE = f"https://www.shutterstock.com/g/{CONTRIBUTOR}"
API = "https://api.shutterstock.com/v2/images/search"
PER_PAGE = 100


def auth_header(key: str, secret: str) -> str:
    token = base64.b64encode(f"{key}:{secret}".encode("utf-8")).decode("ascii")
    return f"Basic {token}"


def fetch_page(page: int, key: str, secret: str) -> dict:
    params = urllib.parse.urlencode(
        {
            "contributor": CONTRIBUTOR,
            "per_page": str(PER_PAGE),
            "page": str(page),
            "sort": "popular",
            "view": "full",
        }
    )
    req = urllib.request.Request(
        f"{API}?{params}",
        headers={
            "Authorization": auth_header(key, secret),
            "User-Agent": "rogue-dev-stock-sync/1.0",
            "Accept": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))


def pick_thumb(assets: dict) -> str:
    if not isinstance(assets, dict):
        return ""
    for name in ("huge_thumb", "preview", "large_thumb", "small_thumb"):
        node = assets.get(name)
        if isinstance(node, dict) and node.get("url"):
            return node["url"]
    return ""


def normalize(item: dict) -> dict | None:
    image_id = item.get("id")
    if not image_id:
        return None

    media = (item.get("media_type") or "image").lower()
    image_type = (item.get("image_type") or "stock").lower()
    description = (item.get("description") or "").strip()
    title = description.split(".")[0].strip() if description else f"Stock {image_id}"
    if len(title) > 80:
        title = title[:77] + "..."

    thumb = pick_thumb(item.get("assets") or {})
    if not thumb:
        return None

    path_type = "vector" if image_type == "vector" else "photo"
    url = item.get("url") or f"https://www.shutterstock.com/image-{path_type}/{image_id}"

    return {
        "id": str(image_id),
        "title": title,
        "kind": image_type.title(),
        "url": url,
        "thumb": thumb,
        "media": media,
    }


def main() -> int:
    key = os.environ.get("SHUTTERSTOCK_CONSUMER_KEY", "").strip()
    secret = os.environ.get("SHUTTERSTOCK_CONSUMER_SECRET", "").strip()

    if not key or not secret:
        print(
            "Set SHUTTERSTOCK_CONSUMER_KEY and SHUTTERSTOCK_CONSUMER_SECRET first.\n"
            "Create an app at https://www.shutterstock.com/account/developers/apps",
            file=sys.stderr,
        )
        return 1

    items: list[dict] = []
    page = 1
    total_count = None

    try:
        while True:
            data = fetch_page(page, key, secret)
            if total_count is None:
                total_count = data.get("total_count")

            batch = data.get("data") or []
            if not batch:
                break

            for raw in batch:
                normalized = normalize(raw)
                if normalized:
                    items.append(normalized)

            if len(batch) < PER_PAGE:
                break
            if total_count is not None and len(items) >= int(total_count):
                break

            page += 1
            if page > 50:
                break
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", "replace")
        print(f"API error {exc.code}: {body}", file=sys.stderr)
        return 1

    payload = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "profile": PROFILE,
        "total": len(items),
        "items": items,
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(items)} items -> {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
