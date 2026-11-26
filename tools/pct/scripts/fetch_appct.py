#!/usr/bin/env python3
"""
Đồng bộ danh sách Phiếu công tác (PCT) và Lệnh công tác (LCT)
từ hệ thống appct.evnhcmc.vn ra data/tickets.json và data/tickets.js
để hiển thị trên GitHub Pages (index.html) không cần Antigravity.

Biến môi trường bắt buộc:
  APPCT_USERNAME - Tên đăng nhập (VD: deptc)
  APPCT_PASSWORD - Mật khẩu

Tùy chọn:
  APPCT_FROM_DATE - Ngày bắt đầu (YYYY-MM-DD, mặc định: hôm qua theo giờ VN UTC+7)
  APPCT_TO_DATE   - Ngày kết thúc (YYYY-MM-DD, mặc định: hôm nay theo giờ VN UTC+7)
"""

from __future__ import annotations

import argparse
import html
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

API_BASE = "https://appctapi.evnhcmc.vn/core-service/api"
VN_TZ = timezone(timedelta(hours=7))
TAG_RE = re.compile(r"<[^>]+>")


def strip_html(value: Any) -> str:
    if not value:
        return ""
    text = TAG_RE.sub("", str(value))
    text = html.unescape(text)
    return " ".join(text.replace("•", "").split()).strip()


def post_json(url: str, payload: dict[str, Any], token: str | None = None) -> dict[str, Any]:
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "locale": "vi",
        "language": "vi",
        "User-Agent": "Mozilla/5.0 (compatible; AppCT-Sync/1.0)",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:500]
        raise RuntimeError(f"HTTP {exc.code} khi gọi {url}: {detail}") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Lỗi kết nối tới {url}: {exc.reason}") from exc


def login(username: str, password: str) -> str:
    res = post_json(
        f"{API_BASE}/auth/login",
        {"username": username, "password": password, "remember": True},
    )
    data = res.get("data") or {}
    if res.get("code") != 1 or data.get("resultCode") == -1 or not data.get("accessToken"):
        msg = res.get("message") or data.get("message") or "Đăng nhập thất bại"
        raise RuntimeError(f"Đăng nhập không thành công: {msg}")
    return str(data["accessToken"])


def fetch_all_pages(
    token: str,
    ticket_type: str,
    payload: dict[str, Any],
    page_size: int = 100,
) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    page = 1
    while True:
        query = urllib.parse.urlencode(
            {
                "page": page,
                "pageSize": page_size,
                "typeTicket": ticket_type,
                "client": "Web",
            }
        )
        res = post_json(f"{API_BASE}/ticket/list?{query}", payload, token=token)
        data = res.get("data") or {}
        batch = data.get("list") or []
        items.extend(batch)

        pagination = data.get("pagination") or {}
        total_pages = int(pagination.get("totalPages") or 1)
        if page >= total_pages or not batch:
            break
        page += 1
    return items


def normalize_pct(item: dict[str, Any]) -> dict[str, Any]:
    status_obj = item.get("status") or {}
    level_obj = item.get("levelDangerous") or {}
    moderation_obj = item.get("moderation") or {}
    return {
        "id": item.get("id"),
        "ticketType": "PCT",
        "code": item.get("code") or "",
        "createdAt": item.get("createdAt") or "",
        "updatedAt": item.get("updatedAt") or "",
        "dateStart": item.get("dateStart") or "",
        "dateEnd": item.get("dateEnd") or "",
        "department": item.get("DEPARTMENT") or "",
        "organization": item.get("AUTHORIZATION_ORGANIZATIONCODE") or "",
        "content": (item.get("CONTENT_BUSINESS_TRIP") or "").strip(),
        "businessType": item.get("TYPE_BUSINESS") or "",
        "workType": "",
        "scope": item.get("SCOPE_DEPARTMENT") or "",
        "commander": item.get("R_CHTT") or "",
        "approver": item.get("R_CHO_PHEP") or "",
        "issuer": item.get("createdBy") or "",
        "crmCode": "",
        "riskLevel": (level_obj.get("name") or "").strip(),
        "riskColor": level_obj.get("value") or "",
        "violation": strip_html(item.get("violateTag")) or "Không vi phạm",
        "moderation": moderation_obj.get("status") or strip_html(item.get("moderationStatus")),
        "status": status_obj.get("name") or strip_html(item.get("statusTag")),
        "statusCode": item.get("statusCode") or status_obj.get("code") or "",
        "statusColor": status_obj.get("color") or "#64748b",
    }


def normalize_lct(item: dict[str, Any], is_crm: bool = False) -> dict[str, Any]:
    status_obj = item.get("status") or {}
    level_obj = item.get("levelDangerous") or {}
    moderation_obj = item.get("moderation") or {}
    return {
        "id": item.get("id"),
        "ticketType": "LCT",
        "isCrm": is_crm,
        "code": item.get("code") or "",
        "createdAt": item.get("createdAt") or "",
        "updatedAt": item.get("updatedAt") or "",
        "dateStart": item.get("time") or "",
        "dateEnd": "",
        "department": item.get("DEPARTMENT") or "",
        "organization": item.get("ORGANIZATION") or "",
        "content": (item.get("CONTENT_BUSINESS_TRIP") or "").strip(),
        "businessType": item.get("TYPE_LCT") or "",
        "workType": item.get("TYPE_WORK") or "",
        "scope": "",
        "commander": item.get("R_CHTT") or "",
        "approver": "",
        "issuer": item.get("createdBy") or "",
        "crmCode": item.get("CRM_CODE") or "",
        "riskLevel": (level_obj.get("name") or "").strip(),
        "riskColor": level_obj.get("value") or "",
        "violation": "",
        "moderation": moderation_obj.get("status") or strip_html(item.get("moderationStatus")),
        "status": status_obj.get("name") or strip_html(item.get("statusTag")),
        "statusCode": item.get("statusCode") or status_obj.get("code") or "",
        "statusColor": status_obj.get("color") or "#64748b",
    }


def parse_date_range(from_str: str | None, to_str: str | None) -> tuple[datetime, datetime]:
    now_vn = datetime.now(VN_TZ)
    today_vn = now_vn.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_vn = today_vn - timedelta(days=1)

    if from_str:
        start_vn = datetime.strptime(from_str, "%Y-%m-%d").replace(tzinfo=VN_TZ)
    else:
        start_vn = yesterday_vn

    if to_str:
        end_vn = datetime.strptime(to_str, "%Y-%m-%d").replace(
            hour=23, minute=59, second=59, microsecond=999000, tzinfo=VN_TZ
        )
    else:
        end_vn = today_vn.replace(hour=23, minute=59, second=59, microsecond=999000)

    return start_vn, end_vn


def to_utc_iso(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def main() -> int:
    parser = argparse.ArgumentParser(description="Đồng bộ PCT & LCT từ appct.evnhcmc.vn")
    parser.add_argument("--from-date", default=os.getenv("APPCT_FROM_DATE") or None, help="YYYY-MM-DD")
    parser.add_argument("--to-date", default=os.getenv("APPCT_TO_DATE") or None, help="YYYY-MM-DD")
    parser.add_argument("--out-dir", default="data", help="Thư mục lưu file JSON/JS")
    args = parser.parse_args()

    username = (os.getenv("APPCT_USERNAME") or "").strip()
    password = os.getenv("APPCT_PASSWORD") or ""
    if not username or not password:
        print(
            "Lỗi: Thiếu biến môi trường APPCT_USERNAME hoặc APPCT_PASSWORD.",
            file=sys.stderr,
        )
        return 1

    start_vn, end_vn = parse_date_range(args.from_date, args.to_date)
    from_iso = to_utc_iso(start_vn)
    to_iso = to_utc_iso(end_vn)

    print(
        f"Đang đăng nhập và lấy dữ liệu từ {start_vn.strftime('%d/%m/%Y')} "
        f"đến {end_vn.strftime('%d/%m/%Y')} (UTC: {from_iso} -> {to_iso})..."
    )

    token = login(username, password)

    pct_raw = fetch_all_pages(
        token,
        "PCT",
        {
            "fromDate": from_iso,
            "toDate": to_iso,
            "search": "",
            "status": [],
            "level": [],
        },
    )

    lct_raw = fetch_all_pages(
        token,
        "LCT",
        {
            "fromDate": from_iso,
            "toDate": to_iso,
            "search": "",
            "status": [],
            "typeLCT": [],
            "typeWork": [],
            "level": [],
            "crm": False,
            "organization": [],
            "department": [],
        },
    )

    lct_crm_raw = fetch_all_pages(
        token,
        "LCT",
        {
            "fromDate": from_iso,
            "toDate": to_iso,
            "search": "",
            "status": [],
            "typeLCT": [],
            "typeWork": [],
            "level": [],
            "crm": True,
            "organization": [],
            "department": [],
        },
    )

    pct_list = [normalize_pct(item) for item in pct_raw]
    lct_list = [normalize_lct(item, is_crm=False) for item in lct_raw]
    seen_lct_ids = {item["id"] for item in lct_list}
    for item in lct_crm_raw:
        if item.get("id") not in seen_lct_ids:
            lct_list.append(normalize_lct(item, is_crm=True))

    now_vn = datetime.now(VN_TZ)
    output = {
        "generatedAt": now_vn.isoformat(),
        "generatedAtDisplay": now_vn.strftime("%H:%M:%S %d/%m/%Y (GMT+7)"),
        "source": "https://appct.evnhcmc.vn",
        "dateRange": {
            "from": start_vn.strftime("%Y-%m-%d"),
            "to": end_vn.strftime("%Y-%m-%d"),
            "fromDisplay": start_vn.strftime("%d/%m/%Y"),
            "toDisplay": end_vn.strftime("%d/%m/%Y"),
        },
        "summary": {
            "total": len(pct_list) + len(lct_list),
            "pctCount": len(pct_list),
            "lctCount": len(lct_list),
        },
        "pct": pct_list,
        "lct": lct_list,
    }

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    json_path = out_dir / "tickets.json"
    js_path = out_dir / "tickets.js"

    json_text = json.dumps(output, ensure_ascii=False, indent=2)
    json_path.write_text(json_text + "\n", encoding="utf-8")
    js_path.write_text(f"window.APPCT_DATA = {json_text};\n", encoding="utf-8")

    print(
        f"Hoàn tất! PCT: {len(pct_list)}, LCT: {len(lct_list)}, "
        f"Tổng: {len(pct_list) + len(lct_list)} -> {json_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
