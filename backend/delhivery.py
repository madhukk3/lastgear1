import os
from typing import Any, Dict, List, Optional

import httpx


DELHIVERY_API_TOKEN = os.environ.get("DELHIVERY_API_TOKEN", "").strip()
DELHIVERY_TRACKING_BASE_URL = os.environ.get(
    "DELHIVERY_TRACKING_BASE_URL",
    "https://track.delhivery.com/api/v1/packages/json/"
).strip()


class DelhiveryTrackingError(Exception):
    pass


def delhivery_tracking_enabled() -> bool:
    return bool(DELHIVERY_API_TOKEN)


def _build_tracking_url(tracking_number: str) -> str:
    return f"https://www.delhivery.com/track/package/{tracking_number}"


def _extract_packages(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    shipment_data = payload.get("ShipmentData")
    if isinstance(shipment_data, list):
        packages: List[Dict[str, Any]] = []
        for entry in shipment_data:
            if isinstance(entry, dict):
                for key in ("Shipment", "Packages", "package"):
                    value = entry.get(key)
                    if isinstance(value, list):
                        packages.extend([item for item in value if isinstance(item, dict)])
                    elif isinstance(value, dict):
                        packages.append(value)
        if packages:
            return packages

    packages = payload.get("packages")
    if isinstance(packages, list):
        return [item for item in packages if isinstance(item, dict)]

    package = payload.get("package")
    if isinstance(package, dict):
        return [package]

    return []


def _extract_scans(package: Dict[str, Any]) -> List[Dict[str, Any]]:
    scans = package.get("Scans") or package.get("scans") or package.get("scan")
    if isinstance(scans, list):
        return [scan for scan in scans if isinstance(scan, dict)]
    return []


def _parse_latest_scan(scan: Dict[str, Any]) -> Dict[str, Any]:
    status = (
        scan.get("Scan")
        or scan.get("status")
        or scan.get("Status")
        or scan.get("Instructions")
        or scan.get("Remarks")
    )
    location = (
        scan.get("ScannedLocation")
        or scan.get("location")
        or scan.get("Location")
        or scan.get("Origin")
    )
    time = (
        scan.get("ScanDateTime")
        or scan.get("time")
        or scan.get("StatusDateTime")
        or scan.get("Date")
    )
    instructions = scan.get("Instructions") or scan.get("Remarks")
    return {
        "status": status,
        "location": location,
        "time": time,
        "instructions": instructions,
    }


def _normalize_tracking_payload(payload: Dict[str, Any], tracking_number: str) -> Dict[str, Any]:
    packages = _extract_packages(payload)
    package = packages[0] if packages else {}
    scans = _extract_scans(package)
    latest_scan = _parse_latest_scan(scans[0]) if scans else {
        "status": package.get("Status") or package.get("status"),
        "location": package.get("CurrentLocation") or package.get("location"),
        "time": package.get("StatusDateTime") or package.get("updated_at"),
        "instructions": None,
    }

    return {
        "tracking_number": tracking_number,
        "tracking_url": _build_tracking_url(tracking_number),
        "status": (
            package.get("Status")
            or package.get("CurrentStatus")
            or latest_scan.get("status")
            or "Tracking pending"
        ),
        "status_code": package.get("StatusCode") or package.get("status_code"),
        "origin": package.get("Origin") or package.get("origin"),
        "destination": package.get("Destination") or package.get("destination"),
        "delivered_at": package.get("DeliveredDate") or package.get("delivered_at"),
        "last_scan": latest_scan,
        "scan_count": len(scans),
        "scans": scans[:10],
        "raw": payload,
    }


async def fetch_delhivery_tracking(tracking_number: str) -> Dict[str, Any]:
    if not delhivery_tracking_enabled():
        raise DelhiveryTrackingError("Delhivery tracking is not configured")

    params = {
        "waybill": tracking_number,
        "verbose": "2",
        "token": DELHIVERY_API_TOKEN,
    }
    headers = {
        "Authorization": f"Token {DELHIVERY_API_TOKEN}",
        "Accept": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            response = await client.get(DELHIVERY_TRACKING_BASE_URL, params=params, headers=headers)
            response.raise_for_status()
            payload = response.json()
    except httpx.HTTPError as exc:
        raise DelhiveryTrackingError(f"Failed to fetch Delhivery tracking: {exc}") from exc

    return _normalize_tracking_payload(payload, tracking_number)
