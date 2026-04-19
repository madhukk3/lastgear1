import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header, BackgroundTasks, UploadFile, File, Form, Query, Response, status
from fastapi.staticfiles import StaticFiles
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import HTMLResponse, JSONResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from fastapi.exceptions import RequestValidationError
from motor.motor_asyncio import AsyncIOMotorClient
import os
import shutil
import logging
import re
import io
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import bcrypt
import razorpay
import hmac
import hashlib
from urllib.parse import urlparse
from PIL import Image, UnidentifiedImageError
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from notifications import send_order_email, send_exchange_request_email, send_subscriber_welcome_email
from delhivery import fetch_delhivery_tracking, delhivery_tracking_enabled, DelhiveryTrackingError
# from emergentintegrations.llm.chat import LlmChat, UserMessage
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from security import (
    verify_admin, validate_password_strength,
    track_login_attempt, check_account_locked, log_security_event,
    sanitize_input, limiter, create_access_token, create_refresh_token,
    hash_refresh_token, store_refresh_token, revoke_refresh_token, verify_refresh_token,
    get_required_env, get_client_ip, is_trusted_proxy_request, enforce_otp_rate_limit,
    create_newsletter_unsubscribe_token, verify_newsletter_unsubscribe_token,
    NewsletterTokenError, emit_monitoring_event
)
from admin_routes import admin_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = get_required_env('JWT_SECRET')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '15'))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get('REFRESH_TOKEN_EXPIRE_DAYS', '14'))
ACCESS_COOKIE_NAME = os.environ.get('ACCESS_COOKIE_NAME', 'lastgear_access_token')
REFRESH_COOKIE_NAME = os.environ.get('REFRESH_COOKIE_NAME', 'lastgear_refresh_token')
COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN') or None
APP_ENV = os.environ.get('ENVIRONMENT', os.environ.get('ENV', 'development')).lower()
SENTRY_DSN = os.environ.get("SENTRY_DSN", "").strip()
COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'true' if APP_ENV == 'production' else 'false').lower() == 'true'
COOKIE_SAMESITE = os.environ.get('COOKIE_SAMESITE', 'none' if COOKIE_SECURE else 'lax')
TRUSTED_HOSTS = [host.strip() for host in os.environ.get('TRUSTED_HOSTS', '').split(',') if host.strip()]
FORCE_HTTPS = os.environ.get('FORCE_HTTPS', 'true' if APP_ENV == 'production' else 'false').lower() == 'true'
TRUST_PROXY_HEADERS = os.environ.get('TRUST_PROXY_HEADERS', 'false').lower() == 'true'
MAX_REQUEST_SIZE_MB = int(os.environ.get('MAX_REQUEST_SIZE_MB', '5'))
MAX_REQUEST_SIZE_BYTES = MAX_REQUEST_SIZE_MB * 1024 * 1024
MAX_IMAGE_UPLOAD_SIZE_BYTES = min(MAX_REQUEST_SIZE_BYTES, 5 * 1024 * 1024)
MAX_IMAGE_PIXELS = int(os.environ.get('MAX_IMAGE_PIXELS', '20000000'))
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_SINGLE_ITEM_QUANTITY = int(os.environ.get('MAX_SINGLE_ITEM_QUANTITY', '1000'))

if SENTRY_DSN:
    sentry_sdk.init(
        dsn=SENTRY_DSN,
        environment=APP_ENV,
        integrations=[FastApiIntegration()],
        traces_sample_rate=float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.05")),
        send_default_pii=False,
    )

IMAGE_FORMAT_DETAILS = {
    "jpeg": {
        "extensions": {".jpg", ".jpeg"},
        "content_type": "image/jpeg",
        "pil_format": "JPEG",
        "magic_prefixes": (b"\xff\xd8\xff",),
    },
    "png": {
        "extensions": {".png"},
        "content_type": "image/png",
        "pil_format": "PNG",
        "magic_prefixes": (b"\x89PNG\r\n\x1a\n",),
    },
    "webp": {
        "extensions": {".webp"},
        "content_type": "image/webp",
        "pil_format": "WEBP",
        "magic_prefixes": (b"RIFF",),
    },
}

SENSITIVE_RATE_LIMIT_RULES = (
    {"scope": "auth", "path_prefixes": ("/api/auth/",), "methods": {"POST"}, "limit": 20, "window_seconds": 60},
    {"scope": "checkout", "path_prefixes": ("/api/orders", "/api/razorpay/"), "methods": {"POST"}, "limit": 12, "window_seconds": 60},
    {"scope": "exchange", "path_prefixes": ("/api/help/request-exchange",), "methods": {"POST"}, "limit": 6, "window_seconds": 3600},
    {"scope": "admin", "path_prefixes": ("/api/admin/",), "methods": {"POST", "PUT", "PATCH", "DELETE"}, "limit": 120, "window_seconds": 60},
)

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    # Vite dev + preview defaults for local verification and production-like testing.
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
]

DISPOSABLE_EMAIL_DOMAINS = {
    "mailinator.com", "guerrillamail.com", "10minutemail.com", "tempmail.com",
    "temp-mail.org", "yopmail.com", "sharklasers.com", "throwawaymail.com",
    "getnada.com", "maildrop.cc", "mintemail.com", "dispostable.com"
}
BLOCKED_NEWSLETTER_LOCAL_PARTS = {
    "asdf", "qwer", "test", "admin", "zdda", "abcd", "abcde", "qwerty", "zxca", "hello"
}

PRODUCT_SEARCH_CATEGORY_ALIASES = {
    "tshirts": ["t-shirts", "t shirts", "tshirt", "t shirt", "tee", "tees", "crew tee", "v neck tee"],
    "hoodies": ["hoodies", "hoodie", "pullover hoodie", "zip hoodie"],
    "impactseries": ["impact series", "impact", "series"],
}

# Razorpay Configuration
razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID')
razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))

# Google Auth Configuration
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', 'YOUR_GOOGLE_CLIENT_ID')

security = HTTPBearer(auto_error=False)


def _get_effective_scheme(request: Request) -> str:
    if TRUST_PROXY_HEADERS and is_trusted_proxy_request(request):
        forwarded_proto = request.headers.get("x-forwarded-proto", "").split(",")[0].strip()
        if forwarded_proto:
            return forwarded_proto
    return request.url.scheme


def _matches_allowed_origin(source: str) -> bool:
    if not source:
        return True

    try:
        parsed = urlparse(source)
    except Exception:
        return False

    if not parsed.scheme or not parsed.netloc:
        return False

    normalized = f"{parsed.scheme}://{parsed.netloc}"
    return normalized in ALLOWED_ORIGINS


def _normalize_search_term(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower()).strip()


def _build_product_search_query(search: str) -> List[Dict[str, Any]]:
    raw_search = search.strip()
    if not raw_search:
        return []

    safe_search = re.escape(raw_search)
    search_conditions: List[Dict[str, Any]] = [
        {"name": {"$regex": safe_search, "$options": "i"}},
        {"description": {"$regex": safe_search, "$options": "i"}},
        {"category": {"$regex": safe_search, "$options": "i"}},
    ]

    normalized_search = _normalize_search_term(raw_search)

    for _, aliases in PRODUCT_SEARCH_CATEGORY_ALIASES.items():
        normalized_aliases = {_normalize_search_term(alias) for alias in aliases}
        if normalized_search in normalized_aliases:
            search_conditions.append({"category": {"$in": [alias for alias in aliases if "-" in alias or " " not in alias]}})
            search_conditions.extend(
                {"name": {"$regex": re.escape(alias), "$options": "i"}}
                for alias in aliases
                if len(alias) > 2
            )

    return search_conditions


def _sanitize_shipping_address_payload(data: Dict[str, Any]) -> Dict[str, str]:
    return {
        "full_name": sanitize_input(data.get("full_name") or ""),
        "address_line1": sanitize_input(data.get("address_line1") or ""),
        "address_line2": sanitize_input(data.get("address_line2") or "") or None,
        "city": sanitize_input(data.get("city") or ""),
        "state": sanitize_input(data.get("state") or ""),
        "postal_code": re.sub(r"[^0-9]", "", str(data.get("postal_code") or ""))[:6],
        "country": sanitize_input(data.get("country") or "India"),
        "phone": sanitize_input(data.get("phone") or ""),
    }


def _extract_image_extension(filename: Optional[str]) -> str:
    return Path(filename or "").suffix.lower()


def _parse_iso_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        clean_value = value.replace("Z", "+00:00")
        parsed = datetime.fromisoformat(clean_value)
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed
    except ValueError:
        return None


def _matches_magic_bytes(file_bytes: bytes, detected_format: str) -> bool:
    if detected_format == "webp":
        return len(file_bytes) > 12 and file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP"

    format_details = IMAGE_FORMAT_DETAILS.get(detected_format) or {}
    return any(file_bytes.startswith(prefix) for prefix in format_details.get("magic_prefixes", ()))


def _canonicalize_image_bytes(file_bytes: bytes, extension: str, content_type: str) -> tuple[bytes, str, str]:
    if extension not in ALLOWED_IMAGE_EXTENSIONS or content_type not in ALLOWED_IMAGE_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, and WEBP are allowed.")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > MAX_IMAGE_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size must be 5MB or less.")

    try:
        with Image.open(io.BytesIO(file_bytes)) as image_probe:
            image_probe.verify()
        with Image.open(io.BytesIO(file_bytes)) as image:
            image.load()
            detected_format = (image.format or "").lower()
            format_details = IMAGE_FORMAT_DETAILS.get(detected_format)
            if not format_details:
                raise HTTPException(status_code=400, detail="Unsupported image format.")
            if extension not in format_details["extensions"] or content_type != format_details["content_type"]:
                raise HTTPException(status_code=400, detail="Image content does not match the declared file type.")
            if not _matches_magic_bytes(file_bytes, detected_format):
                raise HTTPException(status_code=400, detail="Image signature validation failed.")

            width, height = image.size
            if width <= 0 or height <= 0 or width * height > MAX_IMAGE_PIXELS:
                raise HTTPException(status_code=400, detail="Image dimensions are not allowed.")

            has_alpha = "A" in image.getbands()
            normalized_image = image.convert("RGBA" if has_alpha else "RGB")
            output = io.BytesIO()
            save_kwargs: Dict[str, Any] = {"format": format_details["pil_format"]}
            if detected_format == "jpeg":
                normalized_image = image.convert("RGB")
                save_kwargs.update({"quality": 90, "optimize": True})
            elif detected_format == "png":
                save_kwargs.update({"optimize": True})
            elif detected_format == "webp":
                save_kwargs.update({"quality": 90, "method": 6})

            # Re-encoding strips appended payloads, reducing polyglot/script risks.
            normalized_image.save(output, **save_kwargs)
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.") from exc

    canonical_bytes = output.getvalue()
    if len(canonical_bytes) > MAX_IMAGE_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size must be 5MB or less.")

    return canonical_bytes, extension, format_details["content_type"]


async def _store_validated_image(upload: UploadFile, prefix: str = "") -> str:
    extension = _extract_image_extension(upload.filename)
    content_type = (upload.content_type or "").lower()
    file_bytes = await upload.read()
    canonical_bytes, canonical_extension, _ = _canonicalize_image_bytes(file_bytes, extension, content_type)

    uploads_dir = Path(__file__).parent / "uploads"
    uploads_dir.mkdir(exist_ok=True)
    filename_prefix = f"{prefix}_" if prefix else ""
    unique_filename = f"{filename_prefix}{uuid.uuid4().hex}{canonical_extension}"
    file_path = uploads_dir / unique_filename
    with open(file_path, "wb") as buffer:
        buffer.write(canonical_bytes)

    return f"/uploads/{unique_filename}"


async def _build_authoritative_order(
    order_data: "OrderCreate",
    current_user: Dict
) -> Dict[str, Any]:
    if not order_data.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item.")

    settings = await db.settings.find_one({"id": "global"}, {"_id": 0}) or {}
    global_discount_percentage = max(0, int(settings.get("global_discount_percentage", 0) or 0))
    shipping_charge = max(0, int(settings.get("shipping_charge", 99) or 0))
    free_shipping_threshold = max(0, int(settings.get("free_shipping_threshold", 1500) or 0))
    cod_charge = max(0, int(settings.get("cod_charge", 50) or 0))

    requested_items: Dict[tuple[str, str, str], Dict[str, Any]] = {}
    for client_item in order_data.items:
        if client_item.quantity <= 0:
            raise HTTPException(status_code=400, detail="Item quantity must be greater than zero.")
        if int(client_item.quantity) > MAX_SINGLE_ITEM_QUANTITY:
            raise HTTPException(status_code=400, detail="Requested quantity exceeds the allowed per-item limit.")

        item_key = (client_item.product_id, client_item.size, client_item.color)
        if item_key in requested_items:
            requested_items[item_key]["quantity"] += client_item.quantity
        else:
            requested_items[item_key] = {
                "product_id": client_item.product_id,
                "size": client_item.size,
                "color": client_item.color,
                "quantity": client_item.quantity,
            }

    coupon_code = (order_data.coupon_code or "").strip().upper()
    coupon_discount_percentage = 0
    if coupon_code:
        coupon = await db.coupons.find_one({"code": coupon_code, "is_active": True}, {"_id": 0})
        if not coupon:
            raise HTTPException(status_code=400, detail="Invalid or expired coupon code")

        starts_at = _parse_iso_datetime(coupon.get("starts_at"))
        expires_at = _parse_iso_datetime(coupon.get("expires_at"))
        now = datetime.now(timezone.utc)
        if starts_at and starts_at > now:
            raise HTTPException(status_code=400, detail="This coupon is not active yet")
        if expires_at and expires_at < now:
            raise HTTPException(status_code=400, detail="Invalid or expired coupon code")

        eligible_user_ids = [
            str(user_id).strip()
            for user_id in (coupon.get("eligible_user_ids") or coupon.get("allowed_user_ids") or [])
            if str(user_id).strip()
        ]
        if eligible_user_ids and current_user.get("id") not in eligible_user_ids:
            raise HTTPException(status_code=403, detail="This coupon is not available for this account")

        usage_limit = coupon.get("usage_limit")
        if usage_limit is not None:
            normalized_usage_limit = max(0, int(usage_limit or 0))
            usage_count = max(
                int(coupon.get("usage_count", 0) or 0),
                await db.orders.count_documents({
                    "coupon_code": coupon_code,
                    "order_status": {"$ne": "cancelled"}
                })
            )
            if usage_count >= normalized_usage_limit:
                raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")

        max_uses_per_user = int(coupon.get("max_uses_per_user", 0) or 0)
        if max_uses_per_user > 0:
            existing_user_uses = await db.orders.count_documents({
                "user_id": current_user["id"],
                "coupon_code": coupon_code,
                "order_status": {"$ne": "cancelled"}
            })
            if existing_user_uses >= max_uses_per_user:
                raise HTTPException(status_code=400, detail="This coupon has already been used for this account")

        coupon_discount_percentage = max(0, int(coupon.get("discount_percentage", 0) or 0))

    first_purchase_discount = 5 if current_user.get("has_used_first_purchase_discount", False) is False else 0

    order_items: List[OrderItem] = []
    subtotal = 0.0
    raw_discount_amount = 0.0
    has_free_shipping_item = False

    for requested in requested_items.values():
        product = await db.products.find_one({"id": requested["product_id"]}, {"_id": 0})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{requested['product_id']}' not found")

        if requested["size"] not in product.get("sizes", []):
            raise HTTPException(status_code=400, detail=f"Invalid size selected for '{product.get('name')}'")
        if requested["color"] not in product.get("colors", []):
            raise HTTPException(status_code=400, detail=f"Invalid color selected for '{product.get('name')}'")

        current_stock = int(product.get("stock", 0) or 0)
        current_size_stock = int((product.get("size_stock") or {}).get(requested["size"], 0) or 0)
        available_quantity = current_size_stock if current_size_stock > 0 else current_stock
        if available_quantity < requested["quantity"]:
            raise HTTPException(
                status_code=400,
                detail=f"'{product.get('name')}' (Size: {requested['size']}) is out of stock. Available: {available_quantity}, Requested: {requested['quantity']}"
            )

        server_price = float(product.get("price", 0) or 0)
        item_subtotal = server_price * requested["quantity"]
        subtotal += item_subtotal

        combined_discount_percentage = (
            global_discount_percentage
            + coupon_discount_percentage
            + first_purchase_discount
            + max(0, int(product.get("discount_percentage", 0) or 0))
        )
        combined_discount_percentage = min(combined_discount_percentage, 100)
        raw_discount_amount += item_subtotal * (combined_discount_percentage / 100)
        has_free_shipping_item = has_free_shipping_item or bool(product.get("is_free_shipping"))

        product_images = product.get("images") or []
        order_items.append(
            OrderItem(
                product_id=product["id"],
                name=product.get("name") or requested["product_id"],
                price=server_price,
                quantity=requested["quantity"],
                size=requested["size"],
                color=requested["color"],
                image=product_images[0] if product_images else product.get("image")
            )
        )

    discount_applied = int(round(raw_discount_amount))
    subtotal_after_discount = max(subtotal - discount_applied, 0)
    shipping_fee = 0 if has_free_shipping_item or subtotal_after_discount >= free_shipping_threshold else shipping_charge
    cod_fee = cod_charge if order_data.payment_method == "cod" else 0
    total_amount = float(round(subtotal_after_discount + shipping_fee + cod_fee, 2))

    return {
        "items": order_items,
        "discount_applied": discount_applied,
        "coupon_code": coupon_code or None,
        "shipping_fee": shipping_fee,
        "cod_fee": cod_fee,
        "total_amount": total_amount,
        "shipping_address": ShippingAddress(**_sanitize_shipping_address_payload(order_data.shipping_address.model_dump()))
    }


async def _reserve_coupon_usage(coupon_code: Optional[str]) -> bool:
    if not coupon_code:
        return False

    coupon = await db.coupons.find_one({"code": coupon_code}, {"_id": 0})
    if not coupon or coupon.get("usage_limit") is None:
        return False

    # Conditional increment keeps usage-limit enforcement race-safe without
    # changing the checkout payload or admin coupon API shape.
    result = await db.coupons.update_one(
        {
            "code": coupon_code,
            "is_active": True,
            "$expr": {
                "$lt": [
                    {"$ifNull": ["$usage_count", 0]},
                    int(coupon.get("usage_limit", 0) or 0)
                ]
            }
        },
        {"$inc": {"usage_count": 1}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="This coupon has reached its usage limit")
    return True


async def _release_coupon_usage(coupon_code: Optional[str], reserved: bool):
    if not coupon_code or not reserved:
        return

    await db.coupons.update_one(
        {"code": coupon_code, "usage_count": {"$gt": 0}},
        {"$inc": {"usage_count": -1}}
    )


def _match_sensitive_rate_limit_rule(request: Request) -> Optional[Dict[str, Any]]:
    request_path = request.url.path
    request_method = request.method.upper()
    for rule in SENSITIVE_RATE_LIMIT_RULES:
        if request_method not in rule["methods"]:
            continue
        if any(request_path.startswith(prefix) for prefix in rule["path_prefixes"]):
            return rule
    return None

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup execution
    yield
    # Shutdown execution
    client.close()

app = FastAPI(lifespan=lifespan)
api_router = APIRouter(prefix="/api")

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    response.headers["Cross-Origin-Embedder-Policy"] = "unsafe-none"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self' https:; "
        "base-uri 'self'; "
        "object-src 'none'; "
        "frame-ancestors 'none'; "
        "script-src 'self' 'unsafe-inline' https://checkout.razorpay.com https://accounts.google.com https://apis.google.com; "
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
        "font-src 'self' https://fonts.gstatic.com data:; "
        "img-src 'self' https: data: blob:; "
        "connect-src 'self' https: wss:; "
        "frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com https://accounts.google.com;"
    )
    if FORCE_HTTPS or COOKIE_SECURE:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    return response

@app.middleware("http")
async def enforce_browser_origin(request: Request, call_next):
    if request.method not in {"GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"}:
        return JSONResponse(status_code=405, content={"detail": "Method not allowed"})

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_REQUEST_SIZE_BYTES:
                return JSONResponse(
                    status_code=413,
                    content={"detail": f"Request too large. Max {MAX_REQUEST_SIZE_MB}MB allowed."}
                )
        except ValueError:
            return JSONResponse(status_code=400, content={"detail": "Invalid Content-Length header"})

    if FORCE_HTTPS and _get_effective_scheme(request) != "https":
        return JSONResponse(status_code=400, content={"detail": "HTTPS is required"})

    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        referer = request.headers.get("referer")

        if origin and not _matches_allowed_origin(origin):
            return JSONResponse(status_code=403, content={"detail": "Blocked origin"})
        if not origin and referer and not _matches_allowed_origin(referer):
            return JSONResponse(status_code=403, content={"detail": "Blocked referer"})

    return await call_next(request)


@app.middleware("http")
async def harden_upload_responses(request: Request, call_next):
    # Static file range parsing has had prior CPU-amplification issues. Rejecting
    # multi-range requests keeps the public /uploads path on a safer subset.
    if request.url.path.startswith("/uploads"):
        range_header = request.headers.get("range", "")
        if "," in range_header:
            return JSONResponse(status_code=416, content={"detail": "Multiple ranges are not supported"})
        if _extract_image_extension(request.url.path) not in ALLOWED_IMAGE_EXTENSIONS:
            return JSONResponse(status_code=404, content={"detail": "File not found"})

    response = await call_next(request)
    if request.url.path.startswith("/uploads"):
        safe_name = re.sub(r"[^A-Za-z0-9._-]", "_", Path(request.url.path).name)
        # Uploads remain public for existing UI flows, so tighten browser
        # behavior instead of forcing download-only semantics that would break images.
        response.headers["Content-Disposition"] = f'inline; filename="{safe_name}"'
        response.headers["Content-Security-Policy"] = "default-src 'none'; img-src 'self' data: blob:; sandbox"
        response.headers["Cross-Origin-Resource-Policy"] = "same-origin"
        response.headers["Cache-Control"] = "no-transform"
    return response


@app.middleware("http")
async def enforce_sensitive_api_rate_limits(request: Request, call_next):
    rule = _match_sensitive_rate_limit_rule(request)
    if not rule:
        return await call_next(request)

    client_ip = get_client_ip(request) or (request.client.host if request.client else "unknown")
    window_start = datetime.now(timezone.utc) - timedelta(seconds=rule["window_seconds"])
    recent_hits = await db.request_rate_limits.count_documents({
        "scope": rule["scope"],
        "ip_address": client_ip,
        "created_at": {"$gte": window_start}
    })
    if recent_hits >= rule["limit"]:
        await log_security_event(
            event_type="request_rate_limited",
            details={
                "scope": rule["scope"],
                "ip_address": client_ip,
                "path": request.url.path,
                "method": request.method
            }
        )
        return JSONResponse(status_code=429, content={"detail": "Too many requests. Please try again later."})

    await db.request_rate_limits.insert_one({
        "scope": rule["scope"],
        "ip_address": client_ip,
        "path": request.url.path,
        "method": request.method,
        "created_at": datetime.now(timezone.utc)
    })
    return await call_next(request)

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.warning("Validation error on %s: %s", request.url.path, exc.errors())
    return Response(
        content='{"detail":"Invalid request payload"}',
        media_type="application/json",
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY
    )

@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    if SENTRY_DSN:
        sentry_sdk.capture_exception(exc)
    logger.exception("Unhandled error on %s", request.url.path)
    return Response(
        content='{"detail":"Something went wrong"}',
        media_type="application/json",
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR
    )

# --- AUTH MODELS ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    phone: Optional[str] = None
    created_at: str
    has_used_first_purchase_discount: bool = False
    is_admin: bool = False

class AuthResponse(BaseModel):
    token: Optional[str] = None
    user: UserResponse
    is_new_user: bool = False

class SendOTPRequest(BaseModel):
    phone: str

class VerifyOTPRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str
    phone: str
    otp: str

class SendEmailOTPRequest(BaseModel):
    email: EmailStr

class VerifyEmailOTPRequest(BaseModel):
    email: EmailStr
    otp: str

class VerifyOTPLoginRequest(BaseModel):
    phone: str
    otp: str

class VerifyGoogleRequest(BaseModel):
    credential: str

# --- PRODUCT MODELS ---
class Product(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: str
    detail_points: List[str] = []
    material_details: Optional[str] = None
    fit_details: Optional[str] = None
    care_instructions: Optional[str] = None
    price: float
    category: str  # "t-shirts" or "hoodies"
    sizes: List[str] = ["S", "M", "L", "XL", "XXL"]
    colors: List[str]
    images: List[str]
    size_stock: Dict[str, int] = {}
    stock: int = 100
    featured: bool = False
    badge: Optional[str] = None
    impact_series_id: Optional[str] = None
    is_free_shipping: bool = False
    discount_percentage: int = 0
    cod_available: bool = True
    video: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProductCreate(BaseModel):
    name: str
    description: str
    detail_points: List[str] = []
    material_details: Optional[str] = None
    fit_details: Optional[str] = None
    care_instructions: Optional[str] = None
    price: float
    category: str
    sizes: List[str] = ["S", "M", "L", "XL", "XXL"]
    colors: List[str]
    images: List[str]
    size_stock: Dict[str, int] = {}
    stock: int = 100
    featured: bool = False
    badge: Optional[str] = None
    impact_series_id: Optional[str] = None
    is_free_shipping: bool = False
    discount_percentage: int = 0
    cod_available: bool = True
    video: Optional[str] = None

# --- CART MODELS ---
class CartItem(BaseModel):
    product_id: str
    quantity: int
    size: str
    color: str

class CartItemResponse(BaseModel):
    product_id: str
    quantity: int
    size: str
    color: str
    product: Optional[Dict] = None

class Cart(BaseModel):
    user_id: str
    items: List[CartItem] = []
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    size: str
    color: str
    image: Optional[str] = None

class ShippingAddress(BaseModel):
    full_name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str
    phone: str

class SavedAddress(ShippingAddress):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    label: str = "Home"
    is_default: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SavedAddressCreate(ShippingAddress):
    label: Optional[str] = "Home"
    is_default: bool = False

class SavedAddressUpdate(BaseModel):
    label: Optional[str] = None
    full_name: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    phone: Optional[str] = None
    is_default: Optional[bool] = None

class Order(BaseModel):
    id: str = Field(default_factory=lambda: f"LG-{str(uuid.uuid4())[:8].upper()}")
    user_id: str
    items: List[OrderItem]
    total_amount: float
    shipping_address: ShippingAddress
    payment_status: str = "pending"  # pending, paid, failed, refund_pending, cancelled, pending_cod
    order_status: str = "order_locked"  # order_locked, processing, packed, shipped, out_for_delivery, delivered, cancelled
    order_timeline: List[Dict] = []
    payment_method: str = "razorpay"
    cancel_requested: bool = False
    cancel_request_time: Optional[str] = None
    cancel_rejected: bool = False
    delivered_at: Optional[str] = None
    exchange_requested: bool = False
    session_id: Optional[str] = None
    discount_applied: int = 0
    coupon_code: Optional[str] = None
    tracking_number: Optional[str] = None
    tracking_url: Optional[str] = None
    courier_partner: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderCreate(BaseModel):
    items: List[OrderItem]
    total_amount: float
    shipping_address: ShippingAddress
    payment_method: str = "razorpay" 
    discount_applied: int = 0
    coupon_code: Optional[str] = None

class CancelRequest(BaseModel):
    reason: str

# --- EXCHANGE MODELS ---
class ExchangeSubmit(BaseModel):
    order_id: str
    customer_name: str
    customer_email: str
    phone_number: str
    product_name: str
    size_purchased: str
    size_requested: str
    reason: str
    image_url: Optional[str] = None

class ExchangeRequest(ExchangeSubmit):
    request_id: str = Field(default_factory=lambda: f"EX-{str(uuid.uuid4())[:8].upper()}")
    request_time: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    status: str = "pending"  # pending, approved, rejected, completed

# --- WISHLIST MODELS ---
class Wishlist(BaseModel):
    user_id: str
    product_ids: List[str] = []
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

# --- SETTINGS MODELS ---
class SiteSettings(BaseModel):
    id: str = "global"
    announcements: List[str] = ["🚚 2-DAY DELIVERY IN CHIKKAMAGALURU, BENGALURU, HASSAN, MYSORE "]
    announcement_active: bool = True
    global_discount_percentage: int = 0
    shipping_charge: int = 99
    free_shipping_threshold: int = 1500
    cod_enabled: bool = True
    cod_max_amount: int = 3000
    cod_charge: int = 50
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class SubscriberCreate(BaseModel):
    email: EmailStr

def get_allowed_origins() -> List[str]:
    configured = [origin.strip() for origin in os.environ.get('CORS_ORIGINS', '').split(',') if origin.strip()]
    if configured:
        return configured
    return DEFAULT_ALLOWED_ORIGINS

ALLOWED_ORIGINS = get_allowed_origins()

# --- COUPON MODELS ---
class Coupon(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    code: str
    discount_percentage: int
    is_active: bool = True
    usage_limit: Optional[int] = None
    usage_count: int = 0
    max_uses_per_user: Optional[int] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    eligible_user_ids: Optional[List[str]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CouponCreate(BaseModel):
    code: str
    discount_percentage: int
    is_active: bool = True
    usage_limit: Optional[int] = None
    max_uses_per_user: Optional[int] = None
    starts_at: Optional[str] = None
    expires_at: Optional[str] = None
    eligible_user_ids: Optional[List[str]] = None

# --- IMPACT SERIES MODELS ---
from admin_routes import ImpactSeries, ImpactSeriesCreate


# --- PAYMENT MODELS ---
class PaymentTransaction(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    order_id: str
    razorpay_order_id: str
    razorpay_payment_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    amount: float
    currency: str = "INR"
    payment_status: str = "pending"  # pending, paid, failed
    metadata: Optional[Dict[str, str]] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class RazorpayOrderRequest(BaseModel):
    order_id: str

class RazorpayPaymentVerification(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

# --- AUTH HELPER FUNCTIONS ---
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def verify_jwt_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def _cookie_kwargs(max_age: int) -> Dict[str, Any]:
    return {
        "httponly": True,
        "secure": COOKIE_SECURE,
        "samesite": COOKIE_SAMESITE,
        "domain": COOKIE_DOMAIN,
        "path": "/",
        "max_age": max_age
    }

def set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    response.set_cookie(ACCESS_COOKIE_NAME, access_token, **_cookie_kwargs(ACCESS_TOKEN_EXPIRE_MINUTES * 60))
    response.set_cookie(REFRESH_COOKIE_NAME, refresh_token, **_cookie_kwargs(REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60))

def clear_auth_cookies(response: Response):
    response.delete_cookie(ACCESS_COOKIE_NAME, domain=COOKIE_DOMAIN, path="/")
    response.delete_cookie(REFRESH_COOKIE_NAME, domain=COOKIE_DOMAIN, path="/")

def _extract_request_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    cookie_token = request.cookies.get(ACCESS_COOKIE_NAME)
    if cookie_token:
        return cookie_token
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return None

def _build_user_response(user: Dict) -> UserResponse:
    return UserResponse(
        id=user['id'],
        email=user['email'],
        name=user.get('name', ''),
        phone=user.get('phone'),
        created_at=user['created_at'],
        has_used_first_purchase_discount=user.get('has_used_first_purchase_discount', False),
        is_admin=user.get('is_admin', False)
    )

def _sanitize_saved_address_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "label": sanitize_input(data.get("label") or "Home"),
        "full_name": sanitize_input(data.get("full_name") or ""),
        "address_line1": sanitize_input(data.get("address_line1") or ""),
        "address_line2": sanitize_input(data.get("address_line2") or "") or None,
        "city": sanitize_input(data.get("city") or ""),
        "state": sanitize_input(data.get("state") or ""),
        "postal_code": re.sub(r"[^0-9]", "", str(data.get("postal_code") or ""))[:6],
        "country": sanitize_input(data.get("country") or "India"),
        "phone": sanitize_input(data.get("phone") or ""),
        "is_default": bool(data.get("is_default", False)),
    }

def _sort_saved_addresses(addresses: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return sorted(
        addresses,
        key=lambda address: (
            0 if address.get("is_default") else 1,
            address.get("updated_at", ""),
            address.get("created_at", "")
        )
    )

async def _persist_saved_addresses(user_id: str, addresses: List[Dict[str, Any]]):
    if addresses:
        has_default = any(address.get("is_default") for address in addresses)
        if not has_default:
            addresses[0]["is_default"] = True
    await db.users.update_one({"id": user_id}, {"$set": {"saved_addresses": addresses}})

async def issue_auth_session(
    response: Response,
    user: Dict,
    request: Optional[Request] = None,
    is_new_user: bool = False
) -> AuthResponse:
    access_token = create_access_token(user['id'], user['email'], user.get('is_admin', False))
    refresh_token = create_refresh_token()
    await store_refresh_token(user['id'], refresh_token, request)
    set_auth_cookies(response, access_token, refresh_token)
    return AuthResponse(token=None, user=_build_user_response(user), is_new_user=is_new_user)

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict:
    token = _extract_request_token(request, credentials)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# --- AUTH ENDPOINTS ---
@api_router.post("/auth/register", response_model=AuthResponse)
@limiter.limit("5/minute")
async def register(request: Request, response: Response, user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Check if email is verified
    verified_email = await db.verified_emails.find_one({"email": user_data.email})
    if not verified_email:
        raise HTTPException(status_code=401, detail="Email not verified. Please verify your email first.")

    validate_password_strength(user_data.password)
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hashed_pw,
        "name": sanitize_input(user_data.name),
        "phone": sanitize_input(user_data.phone) if user_data.phone else None,
        "email_verified": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "has_used_first_purchase_discount": False,
        "saved_addresses": []
    }
    
    await db.users.insert_one(user_doc)
    
    # Create empty cart and wishlist
    await db.carts.insert_one({"user_id": user_id, "items": []})
    await db.wishlists.insert_one({"user_id": user_id, "product_ids": []})
    
    # Remove from verified_emails collection
    await db.verified_emails.delete_one({"email": user_data.email})
    return await issue_auth_session(response, user_doc, request, is_new_user=True)

@api_router.post("/auth/login", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login(request: Request, response: Response, credentials: UserLogin):
    await check_account_locked(credentials.email)
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    client_ip = get_client_ip(request)

    if not user or not verify_password(credentials.password, user['password']):
        await track_login_attempt(credentials.email, False, client_ip)
        emit_monitoring_event("login_failed", ip_address=client_ip, auth_method="password")
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await track_login_attempt(credentials.email, True, client_ip)
    emit_monitoring_event("login_success", user_id=user["id"], ip_address=client_ip, auth_method="password")
    return await issue_auth_session(response, user, request, is_new_user=False)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: Dict = Depends(get_current_user)):
    return UserResponse(**current_user)

@api_router.get("/account/addresses", response_model=List[SavedAddress])
async def get_saved_addresses(current_user: Dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "saved_addresses": 1})
    addresses = _sort_saved_addresses(user.get("saved_addresses", []) if user else [])
    return addresses

@api_router.post("/account/addresses", response_model=SavedAddress)
async def create_saved_address(address_data: SavedAddressCreate, current_user: Dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "saved_addresses": 1})
    existing_addresses = user.get("saved_addresses", []) if user else []
    sanitized = _sanitize_saved_address_payload(address_data.model_dump())
    timestamp = datetime.now(timezone.utc).isoformat()

    should_be_default = sanitized["is_default"] or len(existing_addresses) == 0
    if should_be_default:
        for address in existing_addresses:
            address["is_default"] = False

    sanitized["is_default"] = should_be_default

    address = SavedAddress(
        **sanitized,
        created_at=timestamp,
        updated_at=timestamp
    )
    updated_addresses = [*existing_addresses, address.model_dump()]
    await _persist_saved_addresses(current_user["id"], updated_addresses)
    return address

@api_router.put("/account/addresses/{address_id}", response_model=SavedAddress)
async def update_saved_address(address_id: str, address_data: SavedAddressUpdate, current_user: Dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "saved_addresses": 1})
    existing_addresses = user.get("saved_addresses", []) if user else []
    target_address = next((address for address in existing_addresses if address.get("id") == address_id), None)

    if not target_address:
        raise HTTPException(status_code=404, detail="Saved address not found")

    update_payload = address_data.model_dump(exclude_unset=True)
    sanitized = _sanitize_saved_address_payload({**target_address, **update_payload})
    should_be_default = sanitized["is_default"]

    if should_be_default:
        for address in existing_addresses:
            address["is_default"] = False

    target_address.update({
        **sanitized,
        "id": target_address["id"],
        "created_at": target_address.get("created_at", datetime.now(timezone.utc).isoformat()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "is_default": should_be_default,
    })

    await _persist_saved_addresses(current_user["id"], existing_addresses)
    return SavedAddress(**target_address)

@api_router.patch("/account/addresses/{address_id}/default", response_model=List[SavedAddress])
async def set_default_saved_address(address_id: str, current_user: Dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "saved_addresses": 1})
    existing_addresses = user.get("saved_addresses", []) if user else []
    found = False

    for address in existing_addresses:
        is_target = address.get("id") == address_id
        address["is_default"] = is_target
        if is_target:
            address["updated_at"] = datetime.now(timezone.utc).isoformat()
            found = True

    if not found:
        raise HTTPException(status_code=404, detail="Saved address not found")

    await _persist_saved_addresses(current_user["id"], existing_addresses)
    return _sort_saved_addresses(existing_addresses)

@api_router.delete("/account/addresses/{address_id}")
async def delete_saved_address(address_id: str, current_user: Dict = Depends(get_current_user)):
    user = await db.users.find_one({"id": current_user["id"]}, {"_id": 0, "saved_addresses": 1})
    existing_addresses = user.get("saved_addresses", []) if user else []
    filtered_addresses = [address for address in existing_addresses if address.get("id") != address_id]

    if len(filtered_addresses) == len(existing_addresses):
        raise HTTPException(status_code=404, detail="Saved address not found")

    await _persist_saved_addresses(current_user["id"], filtered_addresses)
    return {"message": "Address removed successfully"}

@api_router.post("/auth/refresh", response_model=AuthResponse)
@limiter.limit("10/minute")
async def refresh_auth_session(request: Request, response: Response):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Refresh token missing")

    token_record = await verify_refresh_token(refresh_token)
    if not token_record:
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="Session expired")

    user = await db.users.find_one({"id": token_record["user_id"]}, {"_id": 0})
    if not user:
        await revoke_refresh_token(refresh_token)
        clear_auth_cookies(response)
        raise HTTPException(status_code=401, detail="User not found")

    await revoke_refresh_token(refresh_token)
    return await issue_auth_session(response, user, request, is_new_user=False)

@api_router.post("/auth/logout")
async def logout(response: Response, request: Request):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)
    if refresh_token:
        await revoke_refresh_token(refresh_token)
    clear_auth_cookies(response)
    return {"message": "Logged out successfully"}

# --- OTP ENDPOINTS ---
import random
import smtplib
from email.message import EmailMessage

def send_otp_email(to_email: str, otp: str):
    email_user = os.environ.get("OTP_EMAIL_USERNAME") or os.environ.get("EMAIL_USERNAME")
    email_pass = os.environ.get("OTP_EMAIL_PASSWORD") or os.environ.get("EMAIL_PASSWORD")
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 465))
    
    if not email_user or not email_pass:
        logging.warning("OTP email delivery is not configured.")
        raise HTTPException(status_code=503, detail="OTP delivery is not configured")

    msg = EmailMessage()
    msg['Subject'] = "Welcome to LAST GEAR - Verify your account"
    msg['From'] = f"LAST GEAR <{email_user}>"
    msg['To'] = to_email
    msg['Reply-To'] = email_user

    html_body = f"""
    <html>
      <body style="margin:0;padding:0;background:#f4efe7;font-family:Arial,sans-serif;color:#16120d;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4efe7;padding:32px 16px;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border:1px solid #e7decf;">
                <tr>
                  <td style="background:#120e0b;padding:26px 28px;">
                    <div style="font-size:28px;line-height:1;font-weight:700;letter-spacing:0.18em;color:#f8f2ea;text-transform:uppercase;">
                      LAST GEAR
                    </div>
                    <div style="margin-top:8px;font-size:11px;letter-spacing:0.38em;text-transform:uppercase;color:rgba(248,242,234,0.58);">
                      Fashion Division
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:36px 28px 18px;">
                    <div style="font-size:12px;font-weight:700;letter-spacing:0.26em;text-transform:uppercase;color:#8d5f32;">
                      Welcome to LAST GEAR
                    </div>
                    <h1 style="margin:14px 0 12px;font-size:34px;line-height:1.05;font-weight:700;color:#16120d;">
                      Verify your account
                    </h1>
                    <p style="margin:0;font-size:16px;line-height:1.7;color:#4d463f;">
                      Your account is almost ready. Use the verification code below to complete your sign up and step into LAST GEAR.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 28px 8px;">
                    <div style="border:1px solid #e7decf;background:#faf6ef;padding:20px 22px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#8d5f32;">
                        Verification code
                      </div>
                      <div style="margin-top:12px;font-size:34px;font-weight:700;letter-spacing:0.22em;color:#16120d;">
                        {otp}
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 28px 34px;">
                    <p style="margin:0;font-size:14px;line-height:1.7;color:#5e564f;">
                      This code expires in 5 minutes. If you did not request this, you can safely ignore this email.
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="border-top:1px solid #ece3d7;padding:18px 28px 24px;">
                    <div style="font-size:13px;line-height:1.7;color:#5e564f;">
                      LAST GEAR Team
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """
    msg.set_content(
        f"Welcome to LAST GEAR.\n\n"
        f"Your verification code is: {otp}\n\n"
        f"This code expires in 5 minutes."
    )
    msg.add_alternative(html_body, subtype="html")
    
    try:
        if smtp_port == 465:
            with smtplib.SMTP_SSL(smtp_server, smtp_port) as server:
                server.login(email_user, email_pass)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_server, smtp_port) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(email_user, email_pass)
                server.send_message(msg)
        logger.info("OTP email handed off successfully to %s", to_email)
    except Exception as e:
        logging.error(f"Failed to send email OTP to {to_email}: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP email")

@api_router.post("/auth/google", response_model=AuthResponse)
@limiter.limit("5/minute")
async def google_auth(request: Request, response: Response, payload: VerifyGoogleRequest):
    try:
        idinfo = id_token.verify_oauth2_token(payload.credential, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo['email']
        name = sanitize_input(idinfo.get('name', ''))
        
        user = await db.users.find_one({"email": email}, {"_id": 0})
        
        is_new_user = False
        if not user:
            user_id = str(uuid.uuid4())
            user_doc = {
                "id": user_id,
                "email": email,
                "password": hash_password(str(uuid.uuid4())), # dummy password for google users
                "name": name,
                "phone": None,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "has_used_first_purchase_discount": False,
                "saved_addresses": []
            }
            await db.users.insert_one(user_doc)
            await db.carts.insert_one({"user_id": user_id, "items": []})
            await db.wishlists.insert_one({"user_id": user_id, "product_ids": []})
            user = user_doc
            is_new_user = True

        return await issue_auth_session(response, user, request, is_new_user=is_new_user)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid Google token")

@api_router.post("/auth/send-otp")
@limiter.limit("5/minute")
async def send_otp(request: Request, body: SendOTPRequest):
    phone = sanitize_input(body.phone)
    client_ip = get_client_ip(request)
    await enforce_otp_rate_limit(
        "send_phone_otp",
        phone,
        client_ip,
        max_subject_attempts=3,
        max_ip_attempts=10,
        cooldown_base_seconds=30
    )
    
    # Generate a random 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Store OTP in the database with a 5-minute expiration
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"otp": otp, "expires_at": expires_at.isoformat()}},
        upsert=True
    )
    emit_monitoring_event("otp_sent", ip_address=client_ip, channel="phone")
    
    # OTP delivery must happen out-of-band (e.g. SMS provider). The API stores
    # the one-time code but never logs it, which avoids credential leakage.
    return {"message": "OTP sent successfully"}

@api_router.post("/auth/send-email-otp")
@limiter.limit("3/minute")
async def send_email_otp(request: Request, body: SendEmailOTPRequest):
    email = body.email
    client_ip = get_client_ip(request)
    await enforce_otp_rate_limit(
        "send_email_otp",
        email,
        client_ip,
        max_subject_attempts=3,
        max_ip_attempts=10,
        cooldown_base_seconds=30
    )
    
    # Check if email is already registered
    existing_user = await db.users.find_one({"email": email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # 5 min expiration
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    await db.email_otps.update_one(
        {"email": email},
        {"$set": {"otp": otp, "expires_at": expires_at.isoformat()}},
        upsert=True
    )
    emit_monitoring_event("otp_sent", ip_address=client_ip, channel="email")
    
    # Send email
    send_otp_email(email, otp)
    
    return {"message": "OTP sent successfully"}

@api_router.post("/auth/verify-email-otp")
@limiter.limit("10/minute")
async def verify_email_otp(request: Request, body: VerifyEmailOTPRequest):
    email = body.email
    otp = body.otp
    client_ip = get_client_ip(request)
    await enforce_otp_rate_limit(
        "verify_email_otp",
        email,
        client_ip,
        max_subject_attempts=10,
        max_ip_attempts=25,
        cooldown_base_seconds=5
    )
    
    otp_record = await db.email_otps.find_one({"email": email, "otp": otp})
    if not otp_record:
        await log_security_event(
            event_type="otp_verification_failed",
            details={"scope": "email", "subject": email.lower(), "ip_address": client_ip, "reason": "invalid"}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if datetime.fromisoformat(otp_record['expires_at']) < datetime.now(timezone.utc):
        await db.email_otps.delete_one({"email": email})
        await log_security_event(
            event_type="otp_verification_failed",
            details={"scope": "email", "subject": email.lower(), "ip_address": client_ip, "reason": "expired"}
        )
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    # Valid OTP. Delete the OTP record.
    await db.email_otps.delete_one({"email": email})
    
    # Add to verified emails to authorize registration
    await db.verified_emails.update_one(
        {"email": email},
        {"$set": {"verified_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Email verified successfully"}

@api_router.post("/auth/register-otp", response_model=AuthResponse)
@limiter.limit("5/minute")
async def register_otp(request: Request, response: Response, user_data: VerifyOTPRegisterRequest):
    client_ip = get_client_ip(request)
    await enforce_otp_rate_limit(
        "register_phone_otp",
        user_data.phone,
        client_ip,
        max_subject_attempts=5,
        max_ip_attempts=15,
        cooldown_base_seconds=5
    )
    # Verify OTP
    otp_record = await db.otps.find_one({"phone": user_data.phone, "otp": user_data.otp})
    if not otp_record:
        emit_monitoring_event("login_failed", ip_address=client_ip, auth_method="otp_register", reason="invalid_otp")
        await log_security_event(
            event_type="otp_verification_failed",
            details={"scope": "phone_register", "subject": user_data.phone, "ip_address": client_ip, "reason": "invalid"}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.fromisoformat(otp_record['expires_at']) < datetime.now(timezone.utc):
        await db.otps.delete_one({"phone": user_data.phone})
        emit_monitoring_event("login_failed", ip_address=client_ip, auth_method="otp_register", reason="expired_otp")
        await log_security_event(
            event_type="otp_verification_failed",
            details={"scope": "phone_register", "subject": user_data.phone, "ip_address": client_ip, "reason": "expired"}
        )
        raise HTTPException(status_code=400, detail="OTP has expired")

    # Check for existing email
    existing_user_email = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user_email:
        raise HTTPException(status_code=400, detail="Email already registered")
        
    # Check for existing phone
    existing_user_phone = await db.users.find_one({"phone": user_data.phone}, {"_id": 0})
    if existing_user_phone:
        raise HTTPException(status_code=400, detail="Phone number already registered")

    validate_password_strength(user_data.password)
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hashed_pw,
        "name": sanitize_input(user_data.name),
        "phone": sanitize_input(user_data.phone),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "has_used_first_purchase_discount": False,
        "saved_addresses": []
    }
    
    await db.users.insert_one(user_doc)
    
    # Create empty cart and wishlist
    await db.carts.insert_one({"user_id": user_id, "items": []})
    await db.wishlists.insert_one({"user_id": user_id, "product_ids": []})
    
    # Delete the used OTP
    await db.otps.delete_one({"phone": user_data.phone})
    
    return await issue_auth_session(response, user_doc, request, is_new_user=True)

@api_router.post("/auth/login-otp", response_model=AuthResponse)
@limiter.limit("5/minute")
async def login_otp(request: Request, response: Response, payload: VerifyOTPLoginRequest):
    client_ip = get_client_ip(request)
    await enforce_otp_rate_limit(
        "login_phone_otp",
        payload.phone,
        client_ip,
        max_subject_attempts=5,
        max_ip_attempts=15,
        cooldown_base_seconds=5
    )
    # Verify OTP
    otp_record = await db.otps.find_one({"phone": payload.phone, "otp": payload.otp})
    if not otp_record:
        emit_monitoring_event("login_failed", ip_address=client_ip, auth_method="otp", reason="invalid_otp")
        await log_security_event(
            event_type="otp_verification_failed",
            details={"scope": "phone_login", "subject": payload.phone, "ip_address": client_ip, "reason": "invalid"}
        )
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.fromisoformat(otp_record['expires_at']) < datetime.now(timezone.utc):
        await db.otps.delete_one({"phone": payload.phone})
        emit_monitoring_event("login_failed", ip_address=client_ip, auth_method="otp", reason="expired_otp")
        await log_security_event(
            event_type="otp_verification_failed",
            details={"scope": "phone_login", "subject": payload.phone, "ip_address": client_ip, "reason": "expired"}
        )
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    user = await db.users.find_one({"phone": payload.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User with this phone number not found")
    
    # Delete the used OTP
    await db.otps.delete_one({"phone": payload.phone})
    emit_monitoring_event("login_success", user_id=user["id"], ip_address=client_ip, auth_method="otp")
    
    return await issue_auth_session(response, user, request, is_new_user=False)

# --- PUBLIC ROUTES FOR IMPACT SERIES ---

@api_router.get("/impact-series/active")
async def get_active_impact_series():
    """Get the currently active Impact Series for the homepage."""
    active_series = await db.impact_series.find_one({"is_active": True})
    if not active_series:
        # Return a fallback or 404. 404 is better so frontend knows not to render it.
        raise HTTPException(status_code=404, detail="No active Impact Series found")
        
    active_series['_id'] = str(active_series['_id'])
    return active_series


# --- PRODUCT ENDPOINTS ---
@api_router.get("/products")
async def get_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    color: Optional[str] = None,
    size: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None,
    impact_series_id: Optional[str] = None
):
    query: Dict[str, Any] = {}
    if category:
        query["category"] = category
    if impact_series_id:
        query["impact_series_id"] = impact_series_id
    if min_price is not None or max_price is not None:
        query["price"] = {}
        if min_price is not None:
            query["price"]["$gte"] = min_price
        if max_price is not None:
            query["price"]["$lte"] = max_price
    if color:
        query["colors"] = {"$in": [color]}
    if size:
        query["sizes"] = {"$in": [size]}
    if search:
        search_conditions = _build_product_search_query(search)
        if search_conditions:
            query["$or"] = search_conditions
    if featured is not None:
        query["featured"] = featured
    
    products = await db.products.find(query, {"_id": 0}).to_list(100)
    return products

@api_router.get("/health")
async def health_check():
    try:
        await db.command("ping")
    except Exception as exc:
        logger.exception("Health check failed")
        if SENTRY_DSN:
            sentry_sdk.capture_exception(exc)
        return JSONResponse(status_code=503, content={"status": "error"})
    return {"status": "ok"}

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate, admin_user: Dict = Depends(verify_admin)):
    product = Product(**product_data.model_dump())
    await db.products.insert_one(product.model_dump())
    return product

# --- PUBLIC HERO BANNERS ---
@api_router.get("/hero-banners")
async def get_active_hero_banners():
    """Fetch active hero banners for the homepage carousel."""
    cursor = db.hero_banners.find({"is_active": True}).sort("order", 1)
    banners = await cursor.to_list(length=20)
    
    for banner in banners:
        banner.pop('_id', None)
        
    return banners

# --- CART ENDPOINTS ---
@api_router.get("/cart")
async def get_cart(current_user: Dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user['id']}, {"_id": 0})
    if not cart:
        return {"user_id": current_user['id'], "items": []}
    
    # Populate product details
    cart_items = []
    for item in cart.get('items', []):
        product = await db.products.find_one({"id": item['product_id']}, {"_id": 0})
        cart_items.append({
            **item,
            "product": product
        })
    
    return {"user_id": cart['user_id'], "items": cart_items}

@api_router.post("/cart")
async def add_to_cart(item: CartItem, current_user: Dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user['id']}, {"_id": 0})
    
    if not cart:
        cart = {"user_id": current_user['id'], "items": []}
    
    items: List[Dict[str, Any]] = cart.get('items', [])
    
    # Check if item already exists
    existing_item: int = -1
    for i, existing in enumerate(items):
        if (existing['product_id'] == item.product_id and 
            existing['size'] == item.size and 
            existing['color'] == item.color):
            existing_item = i
            break
    
    if existing_item != -1:
        items[existing_item]['quantity'] += item.quantity
    else:
        items.append(item.model_dump())
    
    await db.carts.update_one(
        {"user_id": current_user['id']},
        {"$set": {"items": items, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True
    )
    
    return {"message": "Item added to cart"}

@api_router.delete("/cart/{product_id}")
async def remove_from_cart(product_id: str, size: str, color: str, current_user: Dict = Depends(get_current_user)):
    cart = await db.carts.find_one({"user_id": current_user['id']}, {"_id": 0})
    
    if not cart:
        raise HTTPException(status_code=404, detail="Cart not found")
    
    items = [item for item in cart.get('items', []) 
             if not (item['product_id'] == product_id and item['size'] == size and item['color'] == color)]
    
    await db.carts.update_one(
        {"user_id": current_user['id']},
        {"$set": {"items": items}}
    )
    
    return {"message": "Item removed from cart"}

@api_router.delete("/cart")
async def clear_cart(current_user: Dict = Depends(get_current_user)):
    await db.carts.update_one(
        {"user_id": current_user['id']},
        {"$set": {"items": []}}
    )
    return {"message": "Cart cleared"}

# --- WISHLIST ENDPOINTS ---
@api_router.get("/wishlist")
async def get_wishlist(current_user: Dict = Depends(get_current_user)):
    wishlist = await db.wishlists.find_one({"user_id": current_user['id']}, {"_id": 0})
    if not wishlist:
        return {"user_id": current_user['id'], "products": []}
    
    products = []
    for product_id in wishlist.get('product_ids', []):
        product = await db.products.find_one({"id": product_id}, {"_id": 0})
        if product:
            products.append(product)
    
    return {"user_id": current_user['id'], "products": products}

@api_router.post("/wishlist/{product_id}")
async def add_to_wishlist(product_id: str, current_user: Dict = Depends(get_current_user)):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await db.wishlists.update_one(
        {"user_id": current_user['id']},
        {"$addToSet": {"product_ids": product_id}},
        upsert=True
    )
    
    return {"message": "Added to wishlist"}

@api_router.delete("/wishlist/{product_id}")
async def remove_from_wishlist(product_id: str, current_user: Dict = Depends(get_current_user)):
    await db.wishlists.update_one(
        {"user_id": current_user['id']},
        {"$pull": {"product_ids": product_id}}
    )
    return {"message": "Removed from wishlist"}

# --- COUPON ENDPOINTS ---
@api_router.get("/coupons/{code}")
async def validate_coupon(code: str):
    """Validate a coupon code and return its discount percentage"""
    coupon = await db.coupons.find_one({"code": code.upper(), "is_active": True}, {"_id": 0})
    if not coupon:
        raise HTTPException(status_code=404, detail="Invalid or expired coupon code")

    starts_at = _parse_iso_datetime(coupon.get("starts_at"))
    expires_at = _parse_iso_datetime(coupon.get("expires_at"))
    now = datetime.now(timezone.utc)
    if starts_at and starts_at > now:
        raise HTTPException(status_code=404, detail="Invalid or expired coupon code")
    if expires_at and expires_at < now:
        raise HTTPException(status_code=404, detail="Invalid or expired coupon code")
    
    return {"discount_percentage": coupon["discount_percentage"]}

# --- ORDER ENDPOINTS ---
async def update_product_stock(items: List[Any]):
    """Validates and reduces stock for each item in the order. Supports both Pydantic models and dicts."""
    # 1. Validation pass (all-or-nothing check)
    for item in items:
        # Handle both Pydantic model (from create_order) and dict (from verify_payment DB pull)
        product_id = item.product_id if hasattr(item, 'product_id') else item.get('product_id')
        item_name = item.name if hasattr(item, 'name') else item.get('name')
        item_size = item.size if hasattr(item, 'size') else item.get('size')
        item_qty = item.quantity if hasattr(item, 'quantity') else item.get('quantity')
        if item_qty is None or int(item_qty) <= 0:
            raise HTTPException(status_code=400, detail=f"'{item_name}' must have a quantity greater than zero")

        product = await db.products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail=f"Product '{item_name}' not found")
        
        # Check overall stock
        current_stock = product.get("stock", 0)
        current_size_stock = product.get("size_stock", {}).get(item_size, 0)

        # Fallback to general stock if size_stock is 0 but general stock is > 0 (to handle un-migrated DBs)
        available_qty = current_size_stock if current_size_stock > 0 else current_stock

        if available_qty < item_qty:
            raise HTTPException(status_code=400, detail=f"'{item_name}' (Size: {item_size}) is out of stock. Available: {available_qty}, Requested: {item_qty}")

    # 2. Deduction pass (perform conditional atomic decrements)
    applied_updates: List[Dict[str, Any]] = []
    for item in items:
        product_id = item.product_id if hasattr(item, 'product_id') else item.get('product_id')
        item_name = item.name if hasattr(item, 'name') else item.get('name')
        item_size = item.size if hasattr(item, 'size') else item.get('size')
        item_qty = item.quantity if hasattr(item, 'quantity') else item.get('quantity')
        item_qty = int(item_qty)

        update_query = {"$inc": {"stock": -item_qty}}
        # If the specific size exists in size_stock dict, decrement it too
        product = await db.products.find_one({"id": product_id})
        filter_query: Dict[str, Any] = {"id": product_id, "stock": {"$gte": item_qty}}
        if item_size in product.get("size_stock", {}):
            update_query["$inc"][f"size_stock.{item_size}"] = -item_qty
            filter_query[f"size_stock.{item_size}"] = {"$gte": item_qty}

        update_result = await db.products.update_one(filter_query, update_query)
        if update_result.modified_count == 0:
            for applied in reversed(applied_updates):
                await db.products.update_one({"id": applied["product_id"]}, {"$inc": applied["rollback"]})
            raise HTTPException(
                status_code=400,
                detail=f"'{item_name}' (Size: {item_size}) is no longer available in the requested quantity"
            )
        applied_updates.append({"product_id": product_id, "rollback": {field: -delta for field, delta in update_query["$inc"].items()}})

@api_router.post("/orders", response_model=Order)
async def create_order(request: Request, order_data: OrderCreate, background_tasks: BackgroundTasks, current_user: Dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    try:
        authoritative_order = await _build_authoritative_order(order_data, current_user)
    except HTTPException as exc:
        emit_monitoring_event(
            "checkout_blocked",
            user_id=current_user["id"],
            ip_address=client_ip,
            reason=exc.detail,
            item_count=len(order_data.items or [])
        )
        await log_security_event(
            event_type="blocked_checkout_attempt",
            user_id=current_user["id"],
            details={
                "ip_address": client_ip,
                "reason": exc.detail,
                "item_count": len(order_data.items or [])
            }
        )
        raise

    coupon_reserved = False
    # 1. Fetch site settings to validate COD if selected
    settings = await db.settings.find_one({"id": "global"}) or {}
    cod_enabled = settings.get("cod_enabled", True)
    cod_max_amount = settings.get("cod_max_amount", 3000)

    # 2. Check COD conditions if payment method is "cod"
    if order_data.payment_method == "cod":
        logging.info("--> COD CHECKOUT TRIGGERED")
        if not cod_enabled:
            logging.error("--> COD IS DISABLED GLOBALLY")
            emit_monitoring_event(
                "checkout_blocked",
                user_id=current_user["id"],
                ip_address=client_ip,
                reason="cod_disabled"
            )
            raise HTTPException(status_code=400, detail="Cash on Delivery is currently disabled globally")
        
        # Verify order total limit for COD
        if authoritative_order["total_amount"] > cod_max_amount:
            logging.error(f"--> COD MAX AMOUNT EXCEEDED: {authoritative_order['total_amount']}")
            emit_monitoring_event(
                "checkout_blocked",
                user_id=current_user["id"],
                ip_address=client_ip,
                reason="cod_amount_limit",
                amount=authoritative_order["total_amount"]
            )
            raise HTTPException(status_code=400, detail=f"Cash on Delivery limit is ₹{cod_max_amount}. Please use online payment.")

        # Check per-product availability for COD
        for item in authoritative_order["items"]:
            product = await db.products.find_one({"id": item.product_id})
            if product and not product.get("cod_available", True):
                logging.error(f"--> COD UNAVAILABLE FOR PRODUCT: {item.product_id}")
                emit_monitoring_event(
                    "checkout_blocked",
                    user_id=current_user["id"],
                    ip_address=client_ip,
                    reason="cod_unavailable_item",
                    product_id=item.product_id
                )
                raise HTTPException(status_code=400, detail=f"Cash on Delivery is not available for '{product.get('name')}'")
        
        # Deduct stock immediately since COD order goes straight to processing
        logging.info("--> ATTEMPTING COD STOCK DEDUCTION")
        try:
            await update_product_stock(authoritative_order["items"])
            logging.info("--> COD STOCK DEDUCTION SUCCESS")
        except Exception as e:
            logging.error(f"--> COD STOCK DEDUCTION FAILED: {str(e)}")
            emit_monitoring_event(
                "checkout_blocked",
                user_id=current_user["id"],
                ip_address=client_ip,
                reason="stock_deduction_failed"
            )
            await log_security_event(
                event_type="blocked_checkout_attempt",
                user_id=current_user["id"],
                details={"ip_address": client_ip, "reason": "stock_deduction_failed"}
            )
            raise e
        
        # The backend is authoritative for COD totals and fees, so the stored
        # order amount already includes the validated COD charge.
        payment_status = "pending_cod"
    else:
        # Standard Razorpay configuration
        logging.info("--> RAZORPAY CHECKOUT TRIGGERED")
        payment_status = "pending"

    # 3. Create Order
    order = Order(
        user_id=current_user['id'],
        items=authoritative_order["items"],
        total_amount=authoritative_order["total_amount"],
        shipping_address=authoritative_order["shipping_address"],
        payment_status=payment_status,
        payment_method=order_data.payment_method,
        discount_applied=authoritative_order["discount_applied"],
        coupon_code=authoritative_order["coupon_code"]
    )
    order_dict = order.model_dump()
    
    # Inject genesis timeline event
    order_dict['order_timeline'] = [{
        "status": "order_locked",
        "time": datetime.now(timezone.utc).isoformat()
    }]
    
    try:
        coupon_reserved = await _reserve_coupon_usage(authoritative_order["coupon_code"])
        await db.orders.insert_one(order_dict)
    except Exception:
        await _release_coupon_usage(authoritative_order["coupon_code"], coupon_reserved)
        raise

    emit_monitoring_event(
        "order_created",
        user_id=current_user["id"],
        ip_address=client_ip,
        order_id=order.id,
        amount=order.total_amount,
        payment_method=order.payment_method,
        item_count=len(order.items)
    )
    
    # 4. Trigger Email Notification if COD
    if order_data.payment_method == "cod":
        background_tasks.add_task(send_order_email, order_dict)
        
    return order

@api_router.get("/orders")
async def get_orders(current_user: Dict = Depends(get_current_user)):
    orders = await db.orders.find({"user_id": current_user['id']}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

@api_router.get("/orders/{order_id}")
async def get_order(order_id: str, current_user: Dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": current_user['id']}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return order


@api_router.get("/orders/{order_id}/tracking")
async def get_order_tracking(order_id: str, current_user: Dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": current_user['id']}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    tracking_number = (order.get("tracking_number") or "").strip()
    if not tracking_number:
        return {
            "enabled": False,
            "configured": delhivery_tracking_enabled(),
            "tracking_number": None,
            "message": "Tracking number not available for this order yet."
        }

    if not delhivery_tracking_enabled():
        return {
            "enabled": False,
            "configured": False,
            "tracking_number": tracking_number,
            "tracking_url": order.get("tracking_url"),
            "message": "Live courier tracking is not configured yet."
        }

    try:
        tracking_data = await fetch_delhivery_tracking(tracking_number)
        await db.orders.update_one(
            {"id": order_id},
            {"$set": {
                "courier_partner": "delhivery",
                "tracking_url": tracking_data.get("tracking_url"),
                "courier_status": tracking_data.get("status"),
                "courier_status_code": tracking_data.get("status_code"),
                "courier_last_scan": tracking_data.get("last_scan"),
                "courier_last_synced_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        return {
            "enabled": True,
            "configured": True,
            "courier_partner": "delhivery",
            **tracking_data
        }
    except DelhiveryTrackingError as exc:
        return {
            "enabled": False,
            "configured": True,
            "tracking_number": tracking_number,
            "tracking_url": order.get("tracking_url"),
            "message": str(exc)
        }

@api_router.post("/orders/{order_id}/request-cancel")
async def request_order_cancellation(order_id: str, payload: CancelRequest, current_user: Dict = Depends(get_current_user)):
    order = await db.orders.find_one({"id": order_id, "user_id": current_user['id']}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if order.get("order_status") not in ["order_locked", "processing", "confirmed"]:
        raise HTTPException(status_code=400, detail="Order cannot be cancelled at this stage.")
        
    if order.get("cancel_rejected") is True:
        raise HTTPException(status_code=400, detail="Your previous cancellation request for this order was rejected.")
        
    update_data = {
        "cancel_requested": True,
        "cancel_request_time": datetime.now(timezone.utc).isoformat(),
        "previous_order_status": order.get("order_status"),
        "order_status": "cancel_requested",
        "cancel_reason": payload.reason
    }
    
    await db.orders.update_one(
        {"id": order_id, "user_id": current_user['id']},
        {"$set": update_data}
    )
    
    return {"message": "Cancellation requested successfully", "status": "cancel_requested"}

# --- HELP / EXCHANGE ENDPOINTS ---
@api_router.post("/help/request-exchange")
async def request_exchange(
    request: Request,
    order_id: str = Form(...),
    customer_name: str = Form(...),
    customer_email: str = Form(...),
    phone_number: str = Form(...),
    product_name: str = Form(...),
    size_purchased: str = Form(...),
    size_requested: str = Form(...),
    reason: str = Form(...),
    image: Optional[UploadFile] = File(None),
    background_tasks: BackgroundTasks = BackgroundTasks()
):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    user = await db.users.find_one({"id": order["user_id"]}, {"_id": 0})
    if not user or user.get("email", "").lower() != customer_email.lower():
        raise HTTPException(status_code=403, detail="Email does not match the order's registered account.")
        
    if order.get("order_status") != "delivered":
        raise HTTPException(status_code=400, detail="Exchange is only available for delivered orders.")
        
    delivered_at = order.get("delivered_at")
    if not delivered_at:
        # Fallback for legacy orders marked delivered before the timestamp feature
        delivered_at = order.get("updated_at") or order.get("created_at")
    
    if not delivered_at:
        raise HTTPException(status_code=400, detail="Delivery timestamp not found for this order. Please contact support.")
        
    try:
        clean_date = delivered_at.replace("Z", "+00:00")
        delivery_date = datetime.fromisoformat(clean_date)
        if delivery_date.tzinfo is None:
            delivery_date = delivery_date.replace(tzinfo=timezone.utc)
    except ValueError:
        # Fallback if isoformat fails
        delivery_date = datetime.now(timezone.utc) - timedelta(days=1)
        
    if datetime.now(timezone.utc) > delivery_date + timedelta(days=8):
        raise HTTPException(status_code=400, detail="The 7-Day exchange window has closed for this order.")
        
    if order.get("exchange_requested"):
        raise HTTPException(status_code=400, detail="An exchange has already been requested for this order.")

    # Process image upload if exists
    image_url = None
    if image and image.filename:
        try:
            # User uploads remain publicly accessible via /uploads for the
            # existing admin workflow, so we strictly constrain them to images.
            image_url = await _store_validated_image(image, prefix="defect_ex")
        except HTTPException as exc:
            emit_monitoring_event(
                "upload_blocked",
                ip_address=get_client_ip(request),
                surface="exchange",
                order_id=order_id,
                filename=Path(image.filename or "").name,
                reason=exc.detail
            )
            await log_security_event(
                event_type="blocked_exchange_upload",
                details={
                    "ip_address": get_client_ip(request),
                    "order_id": order_id,
                    "filename": Path(image.filename or "").name,
                    "reason": exc.detail
                }
            )
            raise
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to upload image")

    exchange_req = ExchangeRequest(
        order_id=order_id,
        customer_name=customer_name,
        customer_email=customer_email,
        phone_number=phone_number,
        product_name=product_name,
        size_purchased=size_purchased,
        size_requested=size_requested,
        reason=reason,
        image_url=image_url
    )
    exchange_dict = exchange_req.model_dump()
    
    await db.exchange_requests.insert_one(exchange_dict)
    
    await db.orders.update_one(
        {"id": order_id},
        {"$set": {"exchange_requested": True}}
    )
    
    # Send absolute URL strictly to email for easy viewing
    email_exchange_dict = exchange_dict.copy()
    raw_env_url = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8000")
    if image_url:
        email_exchange_dict['image_url'] = f"{raw_env_url}{image_url}"

    background_tasks.add_task(send_exchange_request_email, email_exchange_dict)
    return {"message": "Exchange request submitted successfully", "request_id": exchange_req.request_id}

# --- PAYMENT ENDPOINTS ---
@api_router.post("/razorpay/create-order")
async def create_razorpay_order(request: Request, order_req: RazorpayOrderRequest, current_user: Dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    # Get order details
    order = await db.orders.find_one({"id": order_req.order_id, "user_id": current_user['id']}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order['payment_status'] == 'paid':
        raise HTTPException(status_code=400, detail="Order already paid")
    if order.get('payment_method') == 'cod':
        raise HTTPException(status_code=400, detail="Cash on Delivery orders do not require online payment")
    
    # Convert to paise (Razorpay uses smallest currency unit)
    amount_in_paise = int(order['total_amount'] * 100)
    
    # Create Razorpay order
    try:
        razorpay_order = razorpay_client.order.create({
            "amount": amount_in_paise,
            "currency": "INR",
            "receipt": order['id'][:40],  # Max 40 chars
            "notes": {
                "order_id": order['id'],
                "user_id": current_user['id']
            }
        })
        
        # Create payment transaction
        payment_transaction = PaymentTransaction(
            user_id=current_user['id'],
            order_id=order['id'],
            razorpay_order_id=razorpay_order['id'],
            amount=order['total_amount'],
            currency="INR",
            payment_status="pending",
            metadata={"order_id": order['id']}
        )
        await db.payment_transactions.insert_one(payment_transaction.model_dump())
        
        # Update order with razorpay_order_id
        await db.orders.update_one(
            {"id": order['id']},
            {"$set": {"razorpay_order_id": razorpay_order['id']}}
        )

        emit_monitoring_event(
            "payment_order_created",
            user_id=current_user["id"],
            ip_address=client_ip,
            order_id=order["id"],
            razorpay_order_id=razorpay_order["id"],
            amount=order["total_amount"]
        )
        
        return {
            "razorpay_order_id": razorpay_order['id'],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": razorpay_key_id
        }
    except Exception as e:
        logging.error(f"Razorpay order creation failed: {e}")
        emit_monitoring_event(
            "payment_failed",
            user_id=current_user["id"],
            ip_address=client_ip,
            order_id=order_req.order_id,
            reason="order_creation_failed"
        )
        raise HTTPException(status_code=500, detail="Failed to create payment order")

@api_router.post("/razorpay/verify-payment")
async def verify_razorpay_payment(request: Request, verification: RazorpayPaymentVerification, background_tasks: BackgroundTasks, current_user: Dict = Depends(get_current_user)):
    client_ip = get_client_ip(request)
    try:
        # Verify signature
        generated_signature = hmac.new(
            razorpay_key_secret.encode('utf-8'),
            f"{verification.razorpay_order_id}|{verification.razorpay_payment_id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(generated_signature, verification.razorpay_signature):
            emit_monitoring_event(
                "payment_failed",
                user_id=current_user["id"],
                ip_address=client_ip,
                razorpay_order_id=verification.razorpay_order_id,
                reason="invalid_signature"
            )
            raise HTTPException(status_code=400, detail="Invalid payment signature")
        
        # Update transaction
        transaction = await db.payment_transactions.find_one(
            {"razorpay_order_id": verification.razorpay_order_id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        if transaction.get("user_id") != current_user["id"]:
            raise HTTPException(status_code=403, detail="Payment verification is not allowed for this order")
        
        # Check if already processed
        if transaction['payment_status'] == 'paid':
            return {
                "status": "success",
                "message": "Payment already processed",
                "order_id": transaction['order_id']
            }
        
        # Update payment transaction
        await db.payment_transactions.update_one(
            {"razorpay_order_id": verification.razorpay_order_id},
            {"$set": {
                "razorpay_payment_id": verification.razorpay_payment_id,
                "razorpay_signature": verification.razorpay_signature,
                "payment_status": "paid",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
        # Update order status to paid
        await db.orders.update_one(
            {"id": transaction['order_id']},
            {"$set": {"payment_status": "paid"}}
        )

        # Trigger Notifications and Deduct Stock
        order = await db.orders.find_one({"id": transaction['order_id'], "user_id": current_user["id"]}, {"_id": 0})
        if order:
            await update_product_stock(order.get('items', []))
            background_tasks.add_task(send_order_email, order)
        
        # Clear cart
        await db.carts.update_one(
            {"user_id": current_user['id']},
            {"$set": {"items": []}}
        )
        
        # Expire first purchase discount
        await db.users.update_one(
            {"id": current_user['id']},
            {"$set": {"has_used_first_purchase_discount": True}}
        )

        emit_monitoring_event(
            "payment_success",
            user_id=current_user["id"],
            ip_address=client_ip,
            order_id=transaction["order_id"],
            razorpay_order_id=verification.razorpay_order_id,
            amount=transaction.get("amount")
        )
        
        return {
            "status": "success",
            "message": "Payment verified successfully",
            "order_id": transaction['order_id']
        }
    except HTTPException as exc:
        if exc.status_code >= 400:
            emit_monitoring_event(
                "payment_failed",
                user_id=current_user.get("id"),
                ip_address=client_ip,
                razorpay_order_id=verification.razorpay_order_id,
                reason=exc.detail
            )
        raise
    except Exception as e:
        logging.error(f"Payment verification failed: {e}")
        emit_monitoring_event(
            "payment_failed",
            user_id=current_user["id"],
            ip_address=client_ip,
            razorpay_order_id=verification.razorpay_order_id,
            reason="verification_failed"
        )
        raise HTTPException(status_code=500, detail="Payment verification failed")

@api_router.post("/razorpay/webhook")
async def razorpay_webhook(request: Request):
    try:
        body = await request.body()
        signature = request.headers.get('X-Razorpay-Signature', '')
        
        # Verify webhook signature
        webhook_secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET', razorpay_key_secret)
        expected_signature = hmac.new(
            webhook_secret.encode('utf-8'),
            body,
            hashlib.sha256
        ).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")
        
        import json
        payload = json.loads(body.decode('utf-8'))
        event = payload.get('event')
        
        if event == 'payment.captured':
            payment = payload['payload']['payment']['entity']
            razorpay_order_id = payment['order_id']
            
            # Update transaction
            await db.payment_transactions.update_one(
                {"razorpay_order_id": razorpay_order_id},
                {"$set": {
                    "razorpay_payment_id": payment['id'],
                    "payment_status": "paid",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Get transaction to find order_id
            transaction = await db.payment_transactions.find_one(
                {"razorpay_order_id": razorpay_order_id},
                {"_id": 0}
            )
            
            if transaction:
                await db.orders.update_one(
                    {"id": transaction['order_id']},
                    {"$set": {"payment_status": "paid"}}
                )
                
                # Expire first purchase discount
                await db.users.update_one(
                    {"id": transaction['user_id']},
                    {"$set": {"has_used_first_purchase_discount": True}}
                )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")

# --- SETTINGS ENDPOINTS ---
@api_router.get("/settings/announcement")
async def get_announcement_settings():
    settings = await db.settings.find_one({"id": "global"}, {"_id": 0})
    if not settings:
        return {
            "announcement_text": "🚚 2-DAY DELIVERY IN MUMBAI, PUNE, HYDERABAD, CHENNAI, CHANDIGARH & LUCKNOW!",
            "announcement_active": True,
            "global_discount_percentage": 0
        }
    return settings

@api_router.post("/newsletter/subscribe")
async def subscribe_to_newsletter(subscriber: SubscriberCreate):
    email = subscriber.email.strip().lower()
    local_part = email.split("@")[0]
    domain = email.split("@")[-1]
    existing_subscriber = await db.subscribers.find_one({"email": email}, {"_id": 0})
    now = datetime.now(timezone.utc).isoformat()

    if domain in DISPOSABLE_EMAIL_DOMAINS or len(local_part) < 5 or local_part in BLOCKED_NEWSLETTER_LOCAL_PARTS:
        raise HTTPException(status_code=400, detail="Please use a real email address")

    if existing_subscriber and existing_subscriber.get("is_active", True) and existing_subscriber.get("is_verified", False):
        welcome_result = await send_subscriber_welcome_email(email)
        if not welcome_result.get("delivered"):
            raise HTTPException(status_code=400, detail="Invalid email entered")
        return {"message": "You are already subscribed.", "already_subscribed": True}

    welcome_result = await send_subscriber_welcome_email(email)
    if not welcome_result.get("delivered"):
        raise HTTPException(status_code=400, detail="Invalid email entered")

    if existing_subscriber:
        await db.subscribers.update_one(
            {"email": email},
            {"$set": {"is_active": True, "is_verified": True, "verified_at": now, "updated_at": now}}
        )
    else:
        subscriber_doc = {
            "id": str(uuid.uuid4()),
            "email": email,
            "is_active": True,
            "is_verified": True,
            "source": "homepage",
            "subscribed_at": now,
            "verified_at": now,
            "updated_at": now
        }
        await db.subscribers.insert_one(subscriber_doc)

    return {"message": "You are in. Stay ready for the next drop.", "verified": True}

@api_router.get("/newsletter/unsubscribe", response_class=HTMLResponse)
async def unsubscribe_from_newsletter(token: str = Query(...)):
    try:
        normalized_email = verify_newsletter_unsubscribe_token(token)
    except NewsletterTokenError as exc:
        return HTMLResponse(
            status_code=400,
            content=f"""
            <html>
                <body style="margin:0;padding:24px;background:#f5efe6;font-family:'Helvetica Neue',Arial,sans-serif;color:#18120d;">
                    <div style="max-width:640px;margin:0 auto;background:#fffaf3;border:1px solid #eadbc9;border-radius:22px;overflow:hidden;box-shadow:0 14px 36px rgba(18,14,11,0.08);">
                        <div style="height:4px;background:linear-gradient(90deg,#b7814d 0%,#efc28c 50%,#b7814d 100%);"></div>
                        <div style="padding:22px 22px 24px;">
                            <p style="margin:0 0 10px;color:#9c6a3b;letter-spacing:0.2em;text-transform:uppercase;font-size:10px;font-weight:700;">LAST GEAR</p>
                            <h1 style="margin:0 0 12px;font-size:28px;line-height:1;text-transform:uppercase;color:#18120d;">Link Invalid</h1>
                            <p style="margin:0;font-size:15px;line-height:1.7;color:#18120d;">{sanitize_input(str(exc))}</p>
                        </div>
                    </div>
                </body>
            </html>
            """
        )

    subscriber = await db.subscribers.find_one({"email": normalized_email}, {"_id": 0})
    if subscriber:
        await db.subscribers.update_one(
            {"email": normalized_email},
            {"$set": {"is_active": False, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )

    return """
    <html>
        <body style="margin:0;padding:24px;background:#f5efe6;font-family:'Helvetica Neue',Arial,sans-serif;color:#18120d;">
            <div style="max-width:640px;margin:0 auto;background:#fffaf3;border:1px solid #eadbc9;border-radius:22px;overflow:hidden;box-shadow:0 14px 36px rgba(18,14,11,0.08);">
                <div style="height:4px;background:linear-gradient(90deg,#b7814d 0%,#efc28c 50%,#b7814d 100%);"></div>
                <div style="padding:22px 22px 24px;">
                    <p style="margin:0 0 10px;color:#9c6a3b;letter-spacing:0.2em;text-transform:uppercase;font-size:10px;font-weight:700;">LAST GEAR</p>
                    <h1 style="margin:0 0 12px;font-size:28px;line-height:1;text-transform:uppercase;color:#18120d;">You’re Unsubscribed</h1>
                    <p style="margin:0;font-size:15px;line-height:1.7;color:#18120d;">You will no longer receive LAST GEAR subscriber updates at this email.</p>
                </div>
            </div>
        </body>
    </html>
    """
# --- AI RECOMMENDATIONS ENDPOINT ---
@api_router.get("/recommendations")
async def get_recommendations(current_user: Dict = Depends(get_current_user)):
    # Get user's order history
    orders_dump = await db.orders.find({"user_id": current_user['id']}, {"_id": 0}).limit(5).to_list(5)
    orders: List[Dict[str, Any]] = list(orders_dump)
    
    # Get all products
    products_dump = await db.products.find({}, {"_id": 0}).to_list(100)
    products: List[Dict[str, Any]] = list(products_dump)
    
    if not products:
        return []
    
    # If user has no orders, return featured products
    if not orders:
        featured = [p for p in products if p.get('featured', False)][:4]
        if featured:
            return featured
        return products[:4]
    
    # Extract purchased categories
    purchased_categories = set()
    for order in orders:
        for item in order.get('items', []):
            product = await db.products.find_one({"id": item['product_id']}, {"_id": 0})
            if product:
                purchased_categories.add(product['category'])
    

    
    # Fallback: return products from purchased categories
    recommended = [p for p in products if p['category'] in purchased_categories][:4]
    if not recommended:
        recommended = products[:4]
    
    return recommended

app.include_router(api_router)
app.include_router(admin_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "Referer", "X-Requested-With", "X-CSRF-Token"],
    max_age=3600,
)

# Mount uploads directory for static file serving
uploads_dir = Path(__file__).parent / "uploads"
uploads_dir.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

if TRUSTED_HOSTS:
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=TRUSTED_HOSTS)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8000, reload=True)
