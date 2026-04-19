from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import jwt
import re
import hashlib
import secrets
import json
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Optional, Any
import os
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient
from ipaddress import ip_address

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection for security logs
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]
monitoring_logger = logging.getLogger("monitoring")


def get_required_env(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value

# JWT Configuration
JWT_SECRET = get_required_env('JWT_SECRET')
JWT_ALGORITHM = 'HS256'
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get('ACCESS_TOKEN_EXPIRE_MINUTES', '15'))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.environ.get('REFRESH_TOKEN_EXPIRE_DAYS', '14'))
ACCESS_COOKIE_NAME = os.environ.get('ACCESS_COOKIE_NAME', 'lastgear_access_token')
REFRESH_COOKIE_NAME = os.environ.get('REFRESH_COOKIE_NAME', 'lastgear_refresh_token')
TRUST_PROXY_HEADERS = os.environ.get('TRUST_PROXY_HEADERS', 'false').lower() == 'true'
TRUSTED_PROXY_IPS = {ip.strip() for ip in os.environ.get('TRUSTED_PROXY_IPS', '').split(',') if ip.strip()}
ADMIN_ALLOWED_IPS = {ip.strip() for ip in os.environ.get('ADMIN_ALLOWED_IPS', '').split(',') if ip.strip()}
NEWSLETTER_TOKEN_SECRET = (os.environ.get('NEWSLETTER_TOKEN_SECRET') or JWT_SECRET).strip()
NEWSLETTER_TOKEN_TTL_DAYS = int(os.environ.get('NEWSLETTER_TOKEN_TTL_DAYS', '30'))

# Security
security = HTTPBearer(auto_error=False)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

# Password validation
def validate_password_strength(password: str) -> bool:
    """Enforce strong password policy"""
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if not re.search(r'[A-Z]', password):
        raise HTTPException(status_code=400, detail="Password must contain uppercase letter")
    if not re.search(r'[a-z]', password):
        raise HTTPException(status_code=400, detail="Password must contain lowercase letter")
    if not re.search(r'[0-9]', password):
        raise HTTPException(status_code=400, detail="Password must contain a number")
    if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        raise HTTPException(status_code=400, detail="Password must contain special character")
    return True

# Input sanitization
def sanitize_input(text: str) -> str:
    """Remove potentially harmful characters"""
    if not text:
        return text
    # Remove HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Remove script tags
    text = re.sub(r'<script.*?</script>', '', text, flags=re.DOTALL)
    return text.strip()

# Verify JWT token
def verify_jwt_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


class NewsletterTokenError(Exception):
    pass

def create_access_token(user_id: str, email: str, is_admin: bool = False) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'is_admin': is_admin,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)

def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def create_newsletter_unsubscribe_token(email: str) -> str:
    payload = {
        "purpose": "newsletter_unsubscribe",
        "email": email.strip().lower(),
        "exp": datetime.now(timezone.utc) + timedelta(days=NEWSLETTER_TOKEN_TTL_DAYS),
    }
    return jwt.encode(payload, NEWSLETTER_TOKEN_SECRET, algorithm=JWT_ALGORITHM)


def verify_newsletter_unsubscribe_token(token: str) -> str:
    try:
        payload = jwt.decode(token, NEWSLETTER_TOKEN_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError as exc:
        raise NewsletterTokenError("Unsubscribe link has expired") from exc
    except jwt.InvalidTokenError as exc:
        raise NewsletterTokenError("Invalid unsubscribe link") from exc

    if payload.get("purpose") != "newsletter_unsubscribe":
        raise NewsletterTokenError("Invalid unsubscribe link")

    email = (payload.get("email") or "").strip().lower()
    if not email:
        raise NewsletterTokenError("Invalid unsubscribe link")
    return email

async def store_refresh_token(user_id: str, refresh_token: str, request: Optional[Request] = None):
    await db.refresh_tokens.insert_one({
        "user_id": user_id,
        "token_hash": hash_refresh_token(refresh_token),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)).isoformat(),
        "revoked_at": None,
        "user_agent": request.headers.get("user-agent") if request else None,
        "ip_address": request.client.host if request and request.client else None
    })

async def revoke_refresh_token(refresh_token: str):
    await db.refresh_tokens.update_one(
        {"token_hash": hash_refresh_token(refresh_token), "revoked_at": None},
        {"$set": {"revoked_at": datetime.now(timezone.utc).isoformat()}}
    )

async def verify_refresh_token(refresh_token: str) -> Optional[Dict]:
    token_record = await db.refresh_tokens.find_one(
        {"token_hash": hash_refresh_token(refresh_token), "revoked_at": None},
        {"_id": 0}
    )
    if not token_record:
        return None

    expires_at = token_record.get("expires_at")
    if expires_at and datetime.fromisoformat(expires_at) < datetime.now(timezone.utc):
        await revoke_refresh_token(refresh_token)
        return None

    return token_record

def _extract_bearer_token(request: Request, credentials: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    if request.cookies.get(ACCESS_COOKIE_NAME):
        return request.cookies.get(ACCESS_COOKIE_NAME)
    if credentials and credentials.scheme.lower() == "bearer":
        return credentials.credentials
    return None


def _normalize_ip(value: str) -> Optional[str]:
    try:
        return str(ip_address(value.strip()))
    except ValueError:
        return None


def _coerce_utc_datetime(value) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, str):
        try:
            value = datetime.fromisoformat(value.replace("Z", "+00:00"))
        except ValueError:
            return None
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value if isinstance(value, datetime) else None


def is_trusted_proxy_request(request: Optional[Request]) -> bool:
    if not request or not TRUST_PROXY_HEADERS or not TRUSTED_PROXY_IPS or not request.client:
        return False

    client_ip = _normalize_ip(request.client.host)
    return bool(client_ip and client_ip in TRUSTED_PROXY_IPS)

# Get current user
async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Dict:
    token = _extract_bearer_token(request, credentials)
    if not token:
        raise HTTPException(status_code=401, detail="Authentication required")
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

def get_client_ip(request: Optional[Request]) -> Optional[str]:
    if not request:
        return None

    # Forwarded headers are only authoritative when the immediate peer is an
    # explicitly trusted reverse proxy. Otherwise callers could spoof them.
    if is_trusted_proxy_request(request):
        forwarded_for = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        normalized_forwarded_ip = _normalize_ip(forwarded_for)
        if normalized_forwarded_ip:
            return normalized_forwarded_ip

    if request.client:
        return _normalize_ip(request.client.host) or request.client.host

    return None

# Admin verification
async def verify_admin(request: Request, current_user: Dict = Depends(get_current_user)) -> Dict:
    client_ip = get_client_ip(request)

    if not current_user.get('is_admin', False):
        emit_monitoring_event(
            "admin_access_denied",
            user_id=current_user.get("id"),
            ip_address=client_ip,
            reason="not_admin"
        )
        # Log unauthorized access attempt
        await log_security_event(
            event_type="unauthorized_admin_access",
            user_id=current_user.get('id'),
            details={"email": current_user.get('email'), "ip_address": client_ip}
        )
        raise HTTPException(status_code=403, detail="Admin access required")

    if ADMIN_ALLOWED_IPS and client_ip not in ADMIN_ALLOWED_IPS:
        emit_monitoring_event(
            "admin_access_denied",
            user_id=current_user.get("id"),
            ip_address=client_ip,
            reason="blocked_ip"
        )
        await log_security_event(
            event_type="blocked_admin_ip",
            user_id=current_user.get('id'),
            details={"email": current_user.get('email'), "ip_address": client_ip}
        )
        raise HTTPException(status_code=403, detail="Admin access blocked from this network")

    return current_user

# Login attempt tracking
async def track_login_attempt(email: str, success: bool, ip_address: str = None):
    """Track login attempts to prevent brute force"""
    attempt = {
        "email": email,
        "success": success,
        "ip_address": ip_address,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.login_attempts.insert_one(attempt)
    
    # Check for multiple failed attempts
    if not success:
        recent_attempts = await db.login_attempts.count_documents({
            "email": email,
            "success": False,
            "timestamp": {"$gte": (datetime.now(timezone.utc) - timedelta(minutes=15)).isoformat()}
        })
        
        if recent_attempts >= 5:
            # Lock account
            await db.users.update_one(
                {"email": email},
                {"$set": {"locked_until": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat()}}
            )
            raise HTTPException(status_code=429, detail="Account locked due to multiple failed attempts. Try again in 1 hour.")


def emit_monitoring_event(
    event_type: str,
    user_id: Optional[str] = None,
    ip_address: Optional[str] = None,
    **details: Any
):
    """Emit structured monitoring logs while excluding credentials."""
    blocked_keys = {
        "otp", "password", "token", "access_token", "refresh_token",
        "credential", "secret", "razorpay_signature"
    }
    payload: Dict[str, Any] = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "event_type": event_type,
    }
    if user_id:
        payload["user_id"] = user_id
    normalized_ip = _normalize_ip(ip_address)
    if normalized_ip:
        payload["ip"] = normalized_ip
    for key, value in details.items():
        if value is not None and key not in blocked_keys:
            payload[key] = value
    monitoring_logger.info(json.dumps(payload, default=str, separators=(",", ":")))


async def enforce_otp_rate_limit(
    scope: str,
    subject: str,
    ip_address: Optional[str],
    max_subject_attempts: int,
    max_ip_attempts: int,
    window_minutes: int = 15,
    cooldown_base_seconds: int = 0,
    cooldown_max_seconds: int = 300
):
    now = datetime.now(timezone.utc)
    window_start = now - timedelta(minutes=window_minutes)
    clean_subject = sanitize_input(subject or "").lower()
    normalized_ip = _normalize_ip(ip_address or "")

    if clean_subject:
        subject_attempts = await db.otp_rate_limits.count_documents({
            "scope": scope,
            "subject": clean_subject,
            "created_at": {"$gte": window_start}
        })
        if cooldown_base_seconds > 0:
            last_subject_attempt = await db.otp_rate_limits.find_one(
                {
                    "scope": scope,
                    "subject": clean_subject,
                    "created_at": {"$gte": window_start}
                },
                sort=[("created_at", -1)]
            )
            if last_subject_attempt and last_subject_attempt.get("created_at"):
                last_attempt_at = _coerce_utc_datetime(last_subject_attempt.get("created_at"))
                if not last_attempt_at:
                    last_attempt_at = now
                cooldown_seconds = min(
                    cooldown_max_seconds,
                    cooldown_base_seconds * (2 ** min(subject_attempts, 5))
                )
                retry_after = int(
                    cooldown_seconds - (now - last_attempt_at).total_seconds()
                )
                if retry_after > 0:
                    await log_security_event(
                        event_type="otp_cooldown_blocked",
                        details={
                            "scope": scope,
                            "subject": clean_subject,
                            "ip_address": normalized_ip,
                            "retry_after_seconds": retry_after
                        }
                    )
                    emit_monitoring_event(
                        "otp_blocked",
                        ip_address=normalized_ip,
                        scope=scope,
                        reason="cooldown",
                        retry_after_seconds=retry_after
                    )
                    raise HTTPException(
                        status_code=429,
                        detail=f"Please wait {retry_after} seconds before requesting another OTP attempt."
                    )
        if subject_attempts >= max_subject_attempts:
            await log_security_event(
                event_type="otp_subject_rate_limited",
                details={"scope": scope, "subject": clean_subject, "ip_address": normalized_ip}
            )
            emit_monitoring_event(
                "otp_blocked",
                ip_address=normalized_ip,
                scope=scope,
                reason="subject_rate_limit"
            )
            raise HTTPException(status_code=429, detail="Too many OTP attempts. Please try again later.")

    if normalized_ip:
        ip_attempts = await db.otp_rate_limits.count_documents({
            "scope": scope,
            "ip_address": normalized_ip,
            "created_at": {"$gte": window_start}
        })
        if ip_attempts >= max_ip_attempts:
            await log_security_event(
                event_type="otp_ip_rate_limited",
                details={"scope": scope, "subject": clean_subject or None, "ip_address": normalized_ip}
            )
            emit_monitoring_event(
                "otp_blocked",
                ip_address=normalized_ip,
                scope=scope,
                reason="ip_rate_limit"
            )
            raise HTTPException(status_code=429, detail="Too many OTP attempts from this network. Please try again later.")

    await db.otp_rate_limits.insert_one({
        "scope": scope,
        "subject": clean_subject or None,
        "ip_address": normalized_ip,
        "created_at": now
    })

# Check if account is locked
async def check_account_locked(email: str):
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user and user.get('locked_until'):
        locked_until = datetime.fromisoformat(user['locked_until'])
        if locked_until > datetime.now(timezone.utc):
            raise HTTPException(status_code=423, detail=f"Account locked. Try again later.")
        else:
            # Unlock account
            await db.users.update_one(
                {"email": email},
                {"$unset": {"locked_until": ""}}
            )

# Security audit logging
async def log_security_event(event_type: str, user_id: str = None, details: Dict = None):
    """Log security-related events for audit trail"""
    event = {
        "event_type": event_type,
        "user_id": user_id,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.security_logs.insert_one(event)
    emit_monitoring_event(
        event_type,
        user_id=user_id,
        ip_address=(details or {}).get("ip_address"),
        details=details or {}
    )

# Admin action logging
async def log_admin_action(admin_user: Dict, action: str, target: str = None, details: Dict = None):
    """Log all admin actions for accountability"""
    log_entry = {
        "admin_id": admin_user['id'],
        "admin_email": admin_user['email'],
        "action": action,
        "target": target,
        "details": details or {},
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    await db.admin_logs.insert_one(log_entry)

from datetime import timedelta
