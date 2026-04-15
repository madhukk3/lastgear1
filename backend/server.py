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
    hash_refresh_token, store_refresh_token, revoke_refresh_token, verify_refresh_token
)
from admin_routes import admin_router

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'lastgear_jwt_secret_key_2026_production')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '15'))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get('REFRESH_TOKEN_EXPIRE_DAYS', '14'))
ACCESS_COOKIE_NAME = os.environ.get('ACCESS_COOKIE_NAME', 'lastgear_access_token')
REFRESH_COOKIE_NAME = os.environ.get('REFRESH_COOKIE_NAME', 'lastgear_refresh_token')
COOKIE_DOMAIN = os.environ.get('COOKIE_DOMAIN') or None
APP_ENV = os.environ.get('ENVIRONMENT', os.environ.get('ENV', 'development')).lower()
COOKIE_SECURE = os.environ.get('COOKIE_SECURE', 'true' if APP_ENV == 'production' else 'false').lower() == 'true'
COOKIE_SAMESITE = os.environ.get('COOKIE_SAMESITE', 'none' if COOKIE_SECURE else 'lax')
TRUSTED_HOSTS = [host.strip() for host in os.environ.get('TRUSTED_HOSTS', '').split(',') if host.strip()]
FORCE_HTTPS = os.environ.get('FORCE_HTTPS', 'true' if APP_ENV == 'production' else 'false').lower() == 'true'
TRUST_PROXY_HEADERS = os.environ.get('TRUST_PROXY_HEADERS', 'true').lower() == 'true'
MAX_REQUEST_SIZE_MB = int(os.environ.get('MAX_REQUEST_SIZE_MB', '5'))
MAX_REQUEST_SIZE_BYTES = MAX_REQUEST_SIZE_MB * 1024 * 1024

DEFAULT_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
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
    if TRUST_PROXY_HEADERS:
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
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class CouponCreate(BaseModel):
    code: str
    discount_percentage: int
    is_active: bool = True

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
    client_ip = request.client.host if request.client else None

    if not user or not verify_password(credentials.password, user['password']):
        await track_login_attempt(credentials.email, False, client_ip)
        raise HTTPException(status_code=401, detail="Invalid email or password")
    await track_login_attempt(credentials.email, True, client_ip)
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
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

def send_otp_email(to_email: str, otp: str):
    email_user = os.environ.get("OTP_EMAIL_USERNAME")
    email_pass = os.environ.get("OTP_EMAIL_PASSWORD")
    smtp_server = os.environ.get("SMTP_SERVER", "smtp.gmail.com")
    smtp_port = int(os.environ.get("SMTP_PORT", 587))
    
    if not email_user or not email_pass:
        logging.warning("OTP_EMAIL_USERNAME or OTP_EMAIL_PASSWORD not set. Logging OTP instead.")
        print(f"\n{'='*40}\nEMAIL OTP FOR {to_email}: {otp}\n{'='*40}\n")
        return
        
    msg = MIMEMultipart()
    msg['From'] = email_user
    msg['To'] = to_email
    msg['Subject'] = "Verify your LAST GEAR account"
    
    body = f"Your verification code is: {otp}\n\nThis code expires in 5 minutes."
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        server = smtplib.SMTP(smtp_server, smtp_port)
        server.starttls()
        server.login(email_user, email_pass)
        text = msg.as_string()
        server.sendmail(email_user, to_email, text)
        server.quit()
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
async def send_otp(request: SendOTPRequest):
    phone = request.phone
    
    # Generate a random 6-digit OTP
    otp = str(random.randint(100000, 999999))
    
    # Store OTP in the database with a 5-minute expiration
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
    
    await db.otps.update_one(
        {"phone": phone},
        {"$set": {"otp": otp, "expires_at": expires_at.isoformat()}},
        upsert=True
    )
    
    # In a real application, you would send this OTP via SMS here.
    # For now, we print it to the console for testing.
    print(f"\n{'='*40}\nOTP FOR PHONE {phone}: {otp}\n{'='*40}\n")
    
    return {"message": "OTP sent successfully"}

@api_router.post("/auth/send-email-otp")
@limiter.limit("3/minute")
async def send_email_otp(request: Request, body: SendEmailOTPRequest):
    email = body.email
    
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
    
    # Send email
    send_otp_email(email, otp)
    
    return {"message": "OTP sent successfully"}

@api_router.post("/auth/verify-email-otp")
async def verify_email_otp(body: VerifyEmailOTPRequest):
    email = body.email
    otp = body.otp
    
    otp_record = await db.email_otps.find_one({"email": email, "otp": otp})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
        
    if datetime.fromisoformat(otp_record['expires_at']) < datetime.now(timezone.utc):
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
    # Verify OTP
    otp_record = await db.otps.find_one({"phone": user_data.phone, "otp": user_data.otp})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.fromisoformat(otp_record['expires_at']) < datetime.now(timezone.utc):
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
    # Verify OTP
    otp_record = await db.otps.find_one({"phone": payload.phone, "otp": payload.otp})
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    if datetime.fromisoformat(otp_record['expires_at']) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="OTP has expired")
        
    user = await db.users.find_one({"phone": payload.phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User with this phone number not found")
    
    # Delete the used OTP
    await db.otps.delete_one({"phone": payload.phone})
    
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

@api_router.get("/products/{product_id}")
async def get_product(product_id: str):
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product

@api_router.post("/products", response_model=Product)
async def create_product(product_data: ProductCreate):
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

    # 2. Deduction pass (perform atomic $inc decrement)
    for item in items:
        product_id = item.product_id if hasattr(item, 'product_id') else item.get('product_id')
        item_size = item.size if hasattr(item, 'size') else item.get('size')
        item_qty = item.quantity if hasattr(item, 'quantity') else item.get('quantity')

        update_query = {"$inc": {"stock": -item_qty}}
        # If the specific size exists in size_stock dict, decrement it too
        product = await db.products.find_one({"id": product_id})
        if item_size in product.get("size_stock", {}):
            update_query["$inc"][f"size_stock.{item_size}"] = -item_qty

        await db.products.update_one(
            {"id": product_id},
            update_query
        )

@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks, current_user: Dict = Depends(get_current_user)):
    # 1. Fetch site settings to validate COD if selected
    settings = await db.settings.find_one({"id": "global"}) or {}
    cod_enabled = settings.get("cod_enabled", True)
    cod_max_amount = settings.get("cod_max_amount", 3000)
    cod_charge = settings.get("cod_charge", 50)

    # 2. Check COD conditions if payment method is "cod"
    if order_data.payment_method == "cod":
        logging.info("--> COD CHECKOUT TRIGGERED")
        if not cod_enabled:
            logging.error("--> COD IS DISABLED GLOBALLY")
            raise HTTPException(status_code=400, detail="Cash on Delivery is currently disabled globally")
        
        # Verify order total limit for COD
        if order_data.total_amount > cod_max_amount:
            logging.error(f"--> COD MAX AMOUNT EXCEEDED: {order_data.total_amount}")
            raise HTTPException(status_code=400, detail=f"Cash on Delivery limit is ₹{cod_max_amount}. Please use online payment.")

        # Check per-product availability for COD
        for item in order_data.items:
            product = await db.products.find_one({"id": item.product_id})
            if product and not product.get("cod_available", True):
                logging.error(f"--> COD UNAVAILABLE FOR PRODUCT: {item.product_id}")
                raise HTTPException(status_code=400, detail=f"Cash on Delivery is not available for '{product.get('name')}'")
        
        # Deduct stock immediately since COD order goes straight to processing
        logging.info("--> ATTEMPTING COD STOCK DEDUCTION")
        try:
            await update_product_stock(order_data.items)
            logging.info("--> COD STOCK DEDUCTION SUCCESS")
        except Exception as e:
            logging.error(f"--> COD STOCK DEDUCTION FAILED: {str(e)}")
            raise e
        
        # If valid COD, the frontend already added the cod_charge to the total. Set payment status.
        payment_status = "pending_cod"
    else:
        # Standard Razorpay configuration
        logging.info("--> RAZORPAY CHECKOUT TRIGGERED")
        payment_status = "pending"

    # 3. Create Order
    order = Order(
        user_id=current_user['id'],
        payment_status=payment_status,
        **order_data.model_dump()
    )
    order_dict = order.model_dump()
    
    # Inject genesis timeline event
    order_dict['order_timeline'] = [{
        "status": "order_locked",
        "time": datetime.now(timezone.utc).isoformat()
    }]
    
    await db.orders.insert_one(order_dict)
    
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
            uploads_dir = Path(__file__).parent / "uploads"
            uploads_dir.mkdir(exist_ok=True)
            extension = image.filename.split('.')[-1] if '.' in image.filename else ''
            unique_filename = f"defect_ex_{uuid.uuid4().hex[:8]}.{extension}"
            file_path = uploads_dir / unique_filename
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(image.file, buffer)
            # Use absolute or complete domain url if possible, but standard is /uploads/filename
            # We will use the full backend URL in notifications, but store relative in DB
            image_url = f"/uploads/{unique_filename}"
        except Exception as e:
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
async def create_razorpay_order(order_req: RazorpayOrderRequest, current_user: Dict = Depends(get_current_user)):
    # Get order details
    order = await db.orders.find_one({"id": order_req.order_id, "user_id": current_user['id']}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order['payment_status'] == 'paid':
        raise HTTPException(status_code=400, detail="Order already paid")
    
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
        
        return {
            "razorpay_order_id": razorpay_order['id'],
            "amount": amount_in_paise,
            "currency": "INR",
            "key_id": razorpay_key_id
        }
    except Exception as e:
        logging.error(f"Razorpay order creation failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to create payment order")

@api_router.post("/razorpay/verify-payment")
async def verify_razorpay_payment(verification: RazorpayPaymentVerification, background_tasks: BackgroundTasks, current_user: Dict = Depends(get_current_user)):
    try:
        # Verify signature
        generated_signature = hmac.new(
            razorpay_key_secret.encode('utf-8'),
            f"{verification.razorpay_order_id}|{verification.razorpay_payment_id}".encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        if generated_signature != verification.razorpay_signature:
            raise HTTPException(status_code=400, detail="Invalid payment signature")
        
        # Update transaction
        transaction = await db.payment_transactions.find_one(
            {"razorpay_order_id": verification.razorpay_order_id},
            {"_id": 0}
        )
        
        if not transaction:
            raise HTTPException(status_code=404, detail="Transaction not found")
        
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
        order = await db.orders.find_one({"id": transaction['order_id']}, {"_id": 0})
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
        
        return {
            "status": "success",
            "message": "Payment verified successfully",
            "order_id": transaction['order_id']
        }
    except HTTPException:
        raise
    except Exception as e:
        logging.error(f"Payment verification failed: {e}")
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
        
        if signature != expected_signature:
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
async def unsubscribe_from_newsletter(email: str = Query(...)):
    normalized_email = email.strip().lower()
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
