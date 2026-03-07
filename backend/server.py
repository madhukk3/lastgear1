from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import jwt
import bcrypt
import razorpay
import hmac
import hashlib
from emergentintegrations.llm.chat import LlmChat, UserMessage
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from security import (
    verify_jwt_token, get_current_user, validate_password_strength,
    track_login_attempt, check_account_locked, log_security_event,
    sanitize_input, limiter
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
JWT_EXPIRATION_DAYS = 30

# Razorpay Configuration
razorpay_key_id = os.environ.get('RAZORPAY_KEY_ID')
razorpay_key_secret = os.environ.get('RAZORPAY_KEY_SECRET')
razorpay_client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))

# Security
security = HTTPBearer()

app = FastAPI()
api_router = APIRouter(prefix="/api")

# Add rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Prevent clickjacking
    response.headers["X-Frame-Options"] = "DENY"
    # Prevent MIME sniffing
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Enable XSS protection
    response.headers["X-XSS-Protection"] = "1; mode=block"
    # Content Security Policy
    response.headers["Content-Security-Policy"] = "default-src 'self' https:; script-src 'self' 'unsafe-inline' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' https: data:; connect-src 'self' https:;"
    # Strict Transport Security
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    # Referrer Policy
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Permissions Policy
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    return response

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

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

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
    stock: int = 100
    featured: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ProductCreate(BaseModel):
    name: str
    description: str
    price: float
    category: str
    sizes: List[str] = ["S", "M", "L", "XL", "XXL"]
    colors: List[str]
    images: List[str]
    stock: int = 100
    featured: bool = False

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

# --- ORDER MODELS ---
class OrderItem(BaseModel):
    product_id: str
    name: str
    price: float
    quantity: int
    size: str
    color: str

class ShippingAddress(BaseModel):
    full_name: str
    address_line1: str
    address_line2: Optional[str] = None
    city: str
    state: str
    postal_code: str
    country: str
    phone: str

class Order(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    user_id: str
    items: List[OrderItem]
    total_amount: float
    shipping_address: ShippingAddress
    payment_status: str = "pending"  # pending, paid, failed
    order_status: str = "processing"  # processing, shipped, delivered, cancelled
    session_id: Optional[str] = None
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class OrderCreate(BaseModel):
    items: List[OrderItem]
    total_amount: float
    shipping_address: ShippingAddress

# --- WISHLIST MODELS ---
class Wishlist(BaseModel):
    user_id: str
    product_ids: List[str] = []
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

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

def create_jwt_token(user_id: str, email: str) -> str:
    payload = {
        'user_id': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRATION_DAYS)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def verify_jwt_token(token: str) -> Dict:
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict:
    token = credentials.credentials
    payload = verify_jwt_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# --- AUTH ENDPOINTS ---
@api_router.post("/auth/register", response_model=AuthResponse)
async def register(user_data: UserRegister):
    existing_user = await db.users.find_one({"email": user_data.email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = str(uuid.uuid4())
    hashed_pw = hash_password(user_data.password)
    
    user_doc = {
        "id": user_id,
        "email": user_data.email,
        "password": hashed_pw,
        "name": user_data.name,
        "phone": user_data.phone,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create empty cart and wishlist
    await db.carts.insert_one({"user_id": user_id, "items": []})
    await db.wishlists.insert_one({"user_id": user_id, "product_ids": []})
    
    token = create_jwt_token(user_id, user_data.email)
    
    user_response = UserResponse(
        id=user_id,
        email=user_data.email,
        name=user_data.name,
        phone=user_data.phone,
        created_at=user_doc["created_at"]
    )
    
    return AuthResponse(token=token, user=user_response)

@api_router.post("/auth/login", response_model=AuthResponse)
async def login(credentials: UserLogin):
    user = await db.users.find_one({"email": credentials.email}, {"_id": 0})
    if not user or not verify_password(credentials.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    token = create_jwt_token(user['id'], user['email'])
    
    user_response = UserResponse(
        id=user['id'],
        email=user['email'],
        name=user['name'],
        phone=user.get('phone'),
        created_at=user['created_at']
    )
    
    return AuthResponse(token=token, user=user_response)

@api_router.get("/auth/me", response_model=UserResponse)
async def get_me(current_user: Dict = Depends(get_current_user)):
    return UserResponse(**current_user)

# --- PRODUCT ENDPOINTS ---
@api_router.get("/products")
async def get_products(
    category: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    color: Optional[str] = None,
    size: Optional[str] = None,
    search: Optional[str] = None,
    featured: Optional[bool] = None
):
    query = {}
    if category:
        query["category"] = category
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
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"description": {"$regex": search, "$options": "i"}}
        ]
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
    
    items = cart.get('items', [])
    
    # Check if item already exists
    existing_item = None
    for i, existing in enumerate(items):
        if (existing['product_id'] == item.product_id and 
            existing['size'] == item.size and 
            existing['color'] == item.color):
            existing_item = i
            break
    
    if existing_item is not None:
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

# --- ORDER ENDPOINTS ---
@api_router.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, current_user: Dict = Depends(get_current_user)):
    order = Order(
        user_id=current_user['id'],
        **order_data.model_dump()
    )
    await db.orders.insert_one(order.model_dump())
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
async def verify_razorpay_payment(verification: RazorpayPaymentVerification, current_user: Dict = Depends(get_current_user)):
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
        
        # Update order
        await db.orders.update_one(
            {"id": transaction['order_id']},
            {"$set": {"payment_status": "paid"}}
        )
        
        # Clear cart
        await db.carts.update_one(
            {"user_id": current_user['id']},
            {"$set": {"items": []}}
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
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook processing failed: {e}")
        raise HTTPException(status_code=400, detail="Webhook processing failed")
# --- AI RECOMMENDATIONS ENDPOINT ---
@api_router.get("/recommendations")
async def get_recommendations(current_user: Dict = Depends(get_current_user)):
    # Get user's order history
    orders = await db.orders.find({"user_id": current_user['id']}, {"_id": 0}).limit(5).to_list(5)
    
    # Get all products
    products = await db.products.find({}, {"_id": 0}).to_list(100)
    
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
    
    # Use AI to generate personalized recommendations
    try:
        llm_api_key = os.environ.get('EMERGENT_LLM_KEY')
        chat = LlmChat(
            api_key=llm_api_key,
            session_id=f"recommendations_{current_user['id']}",
            system_message="You are a helpful shopping assistant. Given user purchase history, recommend product IDs."
        ).with_model("openai", "gpt-5.2")
        
        product_list = "\n".join([f"{p['id']}: {p['name']} ({p['category']}) - ${p['price']}" for p in products])
        user_message = UserMessage(
            text=f"User has purchased from categories: {', '.join(purchased_categories)}. Here are available products:\n{product_list}\n\nRecommend 4 product IDs (comma-separated, just IDs)."
        )
        
        response = await chat.send_message(user_message)
        recommended_ids = [pid.strip() for pid in response.split(',')[:4]]
        
        recommendations = []
        for pid in recommended_ids:
            product = await db.products.find_one({"id": pid}, {"_id": 0})
            if product:
                recommendations.append(product)
        
        if recommendations:
            return recommendations
    except Exception as e:
        logging.error(f"AI recommendation error: {e}")
    
    # Fallback: return products from purchased categories
    recommended = [p for p in products if p['category'] in purchased_categories][:4]
    if not recommended:
        recommended = products[:4]
    
    return recommended

app.include_router(api_router)
app.include_router(admin_router)

# CORS with stricter configuration
allowed_origins = os.environ.get('CORS_ORIGINS', '*').split(',')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=allowed_origins if '*' not in allowed_origins else ["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=3600,
)

# Add Trusted Host middleware for production
# app.add_middleware(TrustedHostMiddleware, allowed_hosts=["lastgear.in", "www.lastgear.in", "*.emergentagent.com"])

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()