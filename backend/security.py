from fastapi import HTTPException, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import jwt
import re
from datetime import datetime, timezone, timedelta
from typing import Dict
import os
from dotenv import load_dotenv
from pathlib import Path
from motor.motor_asyncio import AsyncIOMotorClient

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection for security logs
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'lastgear_jwt_secret_key_2026_production')
JWT_ALGORITHM = 'HS256'

# Security
security = HTTPBearer()

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

# Get current user
async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Admin verification
async def verify_admin(current_user: Dict = Depends(get_current_user)) -> Dict:
    if not current_user.get('is_admin', False):
        # Log unauthorized access attempt
        await log_security_event(
            event_type="unauthorized_admin_access",
            user_id=current_user.get('id'),
            details={"email": current_user.get('email')}
        )
        raise HTTPException(status_code=403, detail="Admin access required")
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