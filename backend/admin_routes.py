from fastapi import APIRouter, HTTPException, Depends, Query, UploadFile, File, BackgroundTasks, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import uuid
import mimetypes
import io
from security import verify_admin, log_admin_action, sanitize_input, log_security_event, get_client_ip, emit_monitoring_event
from notifications import send_order_status_email, send_order_cancellation_email, send_exchange_approved_email, send_subscriber_broadcast_email
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
from PIL import Image, UnidentifiedImageError

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')
import shutil

# Ensure uploads directory exists
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
ALLOWED_UPLOAD_MIME_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_UPLOAD_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024
MAX_UPLOAD_PIXELS = int(os.environ.get("MAX_IMAGE_PIXELS", "20000000"))

IMAGE_FORMAT_DETAILS = {
    "jpeg": {"extensions": {".jpg", ".jpeg"}, "content_type": "image/jpeg", "pil_format": "JPEG"},
    "png": {"extensions": {".png"}, "content_type": "image/png", "pil_format": "PNG"},
    "webp": {"extensions": {".webp"}, "content_type": "image/webp", "pil_format": "WEBP"},
}


def _matches_magic_bytes(file_bytes: bytes, detected_format: str) -> bool:
    if detected_format == "jpeg":
        return file_bytes.startswith(b"\xff\xd8\xff")
    if detected_format == "png":
        return file_bytes.startswith(b"\x89PNG\r\n\x1a\n")
    if detected_format == "webp":
        return len(file_bytes) > 12 and file_bytes.startswith(b"RIFF") and file_bytes[8:12] == b"WEBP"
    return False

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

ALLOWED_TRANSITIONS = {
    "order_locked": ["processing", "cancelled"],
    "processing": ["packed", "cancelled"],
    "packed": ["shipped", "cancelled"],
    "shipped": ["out_for_delivery"],
    "out_for_delivery": ["delivered"],
    "delivered": ["exchange_requested"],
    "exchange_requested": ["exchange_approved", "exchange_rejected"],
    "exchange_approved": ["return_received"],
    "return_received": ["replacement_processing"],
    "replacement_processing": ["replacement_shipped"],
    "replacement_shipped": ["exchange_completed"]
}

# --- ADMIN MODELS ---
class ProductAdmin(BaseModel):
    name: str
    description: str
    detail_points: List[str] = []
    material_details: Optional[str] = None
    fit_details: Optional[str] = None
    care_instructions: Optional[str] = None
    price: float
    category: str
    sizes: List[str]
    colors: List[str]
    images: List[str]
    size_stock: Dict[str, int] = {}
    stock: int
    featured: bool = False
    badge: Optional[str] = None
    impact_series_id: Optional[str] = None
    discount_percentage: int = 0
    cod_available: bool = True
    video: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    detail_points: Optional[List[str]] = None
    material_details: Optional[str] = None
    fit_details: Optional[str] = None
    care_instructions: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    sizes: Optional[List[str]] = None
    colors: Optional[List[str]] = None
    images: Optional[List[str]] = None
    size_stock: Optional[Dict[str, int]] = None
    stock: Optional[int] = None
    featured: Optional[bool] = None
    badge: Optional[str] = None
    is_free_shipping: Optional[bool] = None
    discount_percentage: Optional[int] = None
    cod_available: Optional[bool] = None
    video: Optional[str] = None
    video: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    order_status: str  # processing, shipped, delivered, cancelled
    tracking_number: Optional[str] = None
    force_update: Optional[bool] = False

class AnnouncementUpdate(BaseModel):
    announcements: List[str]
    announcement_active: bool
    global_discount_percentage: int = 0
    shipping_charge: int = 99
    free_shipping_threshold: int = 1500
    cod_enabled: bool = True
    cod_max_amount: int = 3000
    cod_charge: int = 50

class SubscriberBroadcastRequest(BaseModel):
    subject: str
    preheader: Optional[str] = None
    message: str
    cta_label: Optional[str] = None
    cta_link: Optional[str] = None
    recipient_emails: Optional[List[str]] = None


async def _store_validated_admin_image(upload: UploadFile) -> str:
    extension = Path(upload.filename or "").suffix.lower()
    detected_type = (upload.content_type or mimetypes.guess_type(upload.filename or "")[0] or "").lower()
    file_bytes = await upload.read()

    if extension not in ALLOWED_UPLOAD_EXTENSIONS or detected_type not in ALLOWED_UPLOAD_MIME_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type. Only JPG, PNG, and WEBP are allowed.")

    if not file_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > MAX_UPLOAD_SIZE_BYTES:
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
            if extension not in format_details["extensions"] or detected_type != format_details["content_type"]:
                raise HTTPException(status_code=400, detail="Image content does not match the declared file type.")
            if not _matches_magic_bytes(file_bytes, detected_format):
                raise HTTPException(status_code=400, detail="Image signature validation failed.")

            width, height = image.size
            if width <= 0 or height <= 0 or width * height > MAX_UPLOAD_PIXELS:
                raise HTTPException(status_code=400, detail="Image dimensions are not allowed.")

            has_alpha = "A" in image.getbands()
            normalized_image = image.convert("RGBA" if has_alpha else "RGB")
            output = io.BytesIO()
            save_kwargs = {"format": format_details["pil_format"]}
            if detected_format == "jpeg":
                normalized_image = image.convert("RGB")
                save_kwargs.update({"quality": 90, "optimize": True})
            elif detected_format == "png":
                save_kwargs.update({"optimize": True})
            elif detected_format == "webp":
                save_kwargs.update({"quality": 90, "method": 6})

            # Re-encoding strips appended payloads instead of storing raw bytes.
            normalized_image.save(output, **save_kwargs)
    except (UnidentifiedImageError, OSError) as exc:
        raise HTTPException(status_code=400, detail="Uploaded file is not a valid image.") from exc

    canonical_bytes = output.getvalue()
    if len(canonical_bytes) > MAX_UPLOAD_SIZE_BYTES:
        raise HTTPException(status_code=400, detail="File size must be 5MB or less.")

    unique_filename = f"{uuid.uuid4().hex}{extension}"
    file_path = UPLOADS_DIR / unique_filename
    with open(file_path, "wb") as buffer:
        buffer.write(canonical_bytes)

    return f"/uploads/{unique_filename}"


@admin_router.get("/session")
async def admin_session(admin_user: Dict = Depends(verify_admin)):
    return {
        "ok": True,
        "user": {
            "id": admin_user.get("id"),
            "email": admin_user.get("email"),
            "name": admin_user.get("name"),
            "is_admin": True
        }
    }

# --- IMPACT SERIES MODELS ---
class ImpactSeries(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    edition: str
    title: str
    subtitle: str
    description: str
    image: str
    link: str
    is_active: bool = False
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class ImpactSeriesCreate(BaseModel):
    edition: str
    title: str
    subtitle: str
    description: str
    image: str
    link: str
    is_active: bool = False

# --- IMAGE UPLOAD ROUTE ---
@admin_router.post("/upload")
async def upload_image(
    request: Request,
    file: UploadFile = File(...),
    admin_user: Dict = Depends(verify_admin)
):
    """Upload an image file and return its public URL."""
    try:
        # Admin uploads are still served from /uploads for the existing UI, so
        # we validate both declared metadata and the actual image bytes.
        return {"url": await _store_validated_admin_image(file)}
    except HTTPException as exc:
        emit_monitoring_event(
            "upload_blocked",
            user_id=admin_user.get("id"),
            ip_address=get_client_ip(request),
            surface="admin",
            filename=Path(file.filename or "").name,
            reason=exc.detail
        )
        await log_security_event(
            event_type="blocked_admin_upload",
            user_id=admin_user.get("id"),
            details={
                "ip_address": get_client_ip(request),
                "filename": Path(file.filename or "").name,
                "reason": exc.detail
            }
        )
        raise
    except Exception as e:
        print(f"Upload error: {e}")
        raise HTTPException(status_code=500, detail="Failed to upload image")

    
# --- DASHBOARD STATS ---
@admin_router.get("/dashboard/stats")
async def get_dashboard_stats(admin_user: Dict = Depends(verify_admin)):
    """Get overview statistics for admin dashboard"""
    
    # Total revenue
    pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
    ]
    revenue_result = await db.orders.aggregate(pipeline).to_list(1)
    total_revenue = revenue_result[0]['total'] if revenue_result else 0
    
    # Total orders
    total_orders = await db.orders.count_documents({})
    paid_orders = await db.orders.count_documents({"payment_status": "paid"})
    pending_orders = await db.orders.count_documents({"payment_status": "pending"})
    
    # Total customers
    total_customers = await db.users.count_documents({"is_admin": {"$ne": True}})
    
    # Total products
    total_products = await db.products.count_documents({})
    low_stock_products = await db.products.count_documents({"stock": {"$lt": 10}})
    
    # Recent orders (last 24 hours)
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
    recent_orders = await db.orders.count_documents({
        "created_at": {"$gte": yesterday}
    })
    
    # Revenue by category
    category_pipeline = [
        {"$match": {"payment_status": "paid"}},
        {"$unwind": "$items"},
        {"$lookup": {
            "from": "products",
            "localField": "items.product_id",
            "foreignField": "id",
            "as": "product_info"
        }},
        {"$unwind": "$product_info"},
        {"$group": {
            "_id": "$product_info.category",
            "revenue": {"$sum": {"$multiply": ["$items.price", "$items.quantity"]}},
            "orders": {"$sum": 1}
        }}
    ]
    category_stats = await db.orders.aggregate(category_pipeline).to_list(10)
    
    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "paid_orders": paid_orders,
        "pending_orders": pending_orders,
        "total_customers": total_customers,
        "total_products": total_products,
        "low_stock_products": low_stock_products,
        "recent_orders_24h": recent_orders,
        "category_stats": category_stats
    }

# --- PRODUCT MANAGEMENT ---
@admin_router.get("/products")
async def admin_get_all_products(
    skip: int = 0,
    limit: int = 50,
    category: Optional[str] = None,
    low_stock: bool = False,
    admin_user: Dict = Depends(verify_admin)
):
    """Get all products with filters for admin"""
    query = {}
    if category:
        query["category"] = category
    if low_stock:
        query["stock"] = {"$lt": 10}
    
    products = await db.products.find(query, {"_id": 0}).skip(skip).limit(limit).to_list(limit)
    total = await db.products.count_documents(query)
    
    return {
        "products": products,
        "total": total,
        "page": skip // limit + 1,
        "pages": (total + limit - 1) // limit
    }

@admin_router.post("/products")
async def admin_create_product(product_data: ProductAdmin, admin_user: Dict = Depends(verify_admin)):
    """Create new product"""
    # Sanitize inputs
    product_data.name = sanitize_input(product_data.name)
    product_data.description = sanitize_input(product_data.description)
    product_data.detail_points = [sanitize_input(point) for point in (product_data.detail_points or []) if point.strip()]
    if product_data.material_details:
        product_data.material_details = sanitize_input(product_data.material_details)
    if product_data.fit_details:
        product_data.fit_details = sanitize_input(product_data.fit_details)
    if product_data.care_instructions:
        product_data.care_instructions = sanitize_input(product_data.care_instructions)
    
    product_id = str(uuid.uuid4())
    
    # Clean size_stock to ensure no negative values
    if product_data.size_stock:
        product_data.size_stock = {k: max(0, v) for k, v in product_data.size_stock.items()}

    # Compute total stock from size_stock
    total_stock = sum(product_data.size_stock.values()) if product_data.size_stock else max(0, product_data.stock)
    
    product = {
        "id": product_id,
        **product_data.model_dump(),
        "stock": total_stock,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.products.insert_one(product)
    await log_admin_action(admin_user, "create_product", product_id, {"name": product_data.name})
    
    return {"message": "Product created", "product_id": product_id}

@admin_router.put("/products/{product_id}")
async def admin_update_product(
    product_id: str,
    product_data: ProductUpdate,
    admin_user: Dict = Depends(verify_admin)
):
    """Update existing product"""
    existing_product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not existing_product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Build update dict
    update_data = {k: v for k, v in product_data.model_dump(exclude_unset=True).items() if v is not None}
    
    # Compute total stock if size_stock is updated
    if 'size_stock' in update_data:
        update_data['size_stock'] = {k: max(0, v) for k, v in update_data['size_stock'].items()}
        update_data['stock'] = sum(update_data['size_stock'].values())
    elif 'stock' in update_data:
        update_data['stock'] = max(0, update_data['stock'])
    
    # Sanitize string inputs
    if 'name' in update_data:
        update_data['name'] = sanitize_input(update_data['name'])
    if 'description' in update_data:
        update_data['description'] = sanitize_input(update_data['description'])
    if 'detail_points' in update_data:
        update_data['detail_points'] = [sanitize_input(point) for point in (update_data['detail_points'] or []) if point.strip()]
    if 'material_details' in update_data and update_data['material_details'] is not None:
        update_data['material_details'] = sanitize_input(update_data['material_details'])
    if 'fit_details' in update_data and update_data['fit_details'] is not None:
        update_data['fit_details'] = sanitize_input(update_data['fit_details'])
    if 'care_instructions' in update_data and update_data['care_instructions'] is not None:
        update_data['care_instructions'] = sanitize_input(update_data['care_instructions'])
    
    if update_data:
        update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
        await db.products.update_one({"id": product_id}, {"$set": update_data})
        await log_admin_action(admin_user, "update_product", product_id, update_data)
    
    return {"message": "Product updated"}

@admin_router.delete("/products/{product_id}")
async def admin_delete_product(product_id: str, admin_user: Dict = Depends(verify_admin)):
    """Delete product"""
    result = await db.products.delete_one({"id": product_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await log_admin_action(admin_user, "delete_product", product_id)
    return {"message": "Product deleted"}

# --- ORDER MANAGEMENT ---
@admin_router.get("/orders")
async def admin_get_all_orders(
    skip: int = 0,
    limit: int = 50,
    status: Optional[str] = None,
    payment_status: Optional[str] = None,
    admin_user: Dict = Depends(verify_admin)
):
    """Get all orders with filters"""
    query = {}
    if status:
        query["order_status"] = status
    if payment_status:
        query["payment_status"] = payment_status
    
    orders = await db.orders.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.orders.count_documents(query)
    
    return {
        "orders": orders,
        "total": total,
        "page": skip // limit + 1,
        "pages": (total + limit - 1) // limit
    }

@admin_router.get("/orders/{order_id}")
async def admin_get_order(order_id: str, admin_user: Dict = Depends(verify_admin)):
    """Get order details with customer info"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    # Get customer info
    customer = await db.users.find_one({"id": order['user_id']}, {"_id": 0, "password": 0})
    
    # Get payment transaction
    payment = await db.payment_transactions.find_one({"order_id": order_id}, {"_id": 0})
    
    return {
        "order": order,
        "customer": customer,
        "payment": payment
    }

@admin_router.put("/orders/{order_id}/status")
async def admin_update_order_status(
    order_id: str,
    status_update: OrderStatusUpdate,
    background_tasks: BackgroundTasks,
    admin_user: Dict = Depends(verify_admin)
):
    """Update order status and tracking"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    current_status = order.get("order_status", "order_locked")
    new_status = status_update.order_status
    
    if current_status != new_status:
        if not status_update.force_update:
            allowed = ALLOWED_TRANSITIONS.get(current_status, [])
            if new_status not in allowed:
                raise HTTPException(status_code=400, detail=f"Invalid status transition from '{current_status}' to '{new_status}'")
            
    update_data = {
        "order_status": new_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if new_status == "delivered" and current_status != "delivered":
        update_data["delivered_at"] = datetime.now(timezone.utc).isoformat()
    
    if status_update.tracking_number:
        update_data["tracking_number"] = status_update.tracking_number
        update_data["courier_partner"] = "delhivery"
        update_data["tracking_url"] = f"https://www.delhivery.com/track/package/{status_update.tracking_number}"
        
    update_query = {"$set": update_data}
    if current_status != new_status:
        update_query["$push"] = {
            "order_timeline": {
                "status": new_status,
                "time": update_data["updated_at"]
            }
        }
        
        # Intercept exchange specific inventory triggers 
        if new_status == "return_received":
            exchange = await db.exchange_requests.find_one({"order_id": order_id, "status": "approved"}, sort=[("request_time", -1)])
            if exchange:
                target_item = next((item for item in order.get("items", []) if item.get("name") == exchange["product_name"]), None)
                if target_item:
                    await db.products.update_one(
                        {"id": target_item.get("product_id")},
                        {"$inc": {
                            "stock": target_item.get("quantity", 1),
                            f"size_stock.{exchange.get('size_purchased')}": target_item.get("quantity", 1)
                        }}
                    )

        if new_status == "replacement_shipped":
            # The replacement stock was reserved (decremented) during the initial `approve` phase
            # But the plan specifies "replacement_shipped fully decrements reserved replacement stock."
            # Actually, if we already deducted it at `approve`, we don't strictly need to deduct again. 
            # If the architecture requires it here, we will just log it. (Leaving as no-op since deduction happened at `approve`).
            pass

        if new_status == "exchange_completed":
            exchange = await db.exchange_requests.find_one({"order_id": order_id, "status": "approved"}, sort=[("request_time", -1)])
            if exchange:
                await db.exchange_requests.update_one(
                    {"request_id": exchange["request_id"]},
                    {"$set": {"status": "completed"}}
                )

    await db.orders.update_one({"id": order_id}, update_query)
    await log_admin_action(admin_user, "update_order_status", order_id, update_data)
    
    # Trigger customer notification
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if updated_order:
        background_tasks.add_task(send_order_status_email, updated_order)
    
    return {"message": "Order status updated"}

@admin_router.patch("/orders/{order_id}/approve-cancel")
async def admin_approve_cancel(order_id: str, background_tasks: BackgroundTasks, admin_user: Dict = Depends(verify_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if not order.get("cancel_requested"):
        raise HTTPException(status_code=400, detail="Cancellation not requested for this order")
        
    # Determine new payment status based on payment method
    payment_method = order.get("payment_method", "razorpay")
    new_payment_status = "cancelled" if payment_method == "cod" else "refund_pending"
    
    update_data = {
        "cancel_requested": False,
        "order_status": "cancelled",
        "payment_status": new_payment_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one(
        {"id": order_id}, 
        {
            "$set": update_data,
            "$push": {
                "order_timeline": {
                    "status": "cancelled",
                    "time": update_data["updated_at"]
                }
            }
        }
    )
    
    # Restore stock safely via $inc
    for item in order.get("items", []):
        product_id = item.get("product_id")
        qty = item.get("quantity", 0)
        size = item.get("size")
        
        if product_id and qty > 0:
            inc_query = {"stock": qty}
            if size:
                inc_query[f"size_stock.{size}"] = qty
                
            await db.products.update_one(
                {"id": product_id},
                {"$inc": inc_query}
            )
            
    await log_admin_action(admin_user, "approve_cancellation", order_id, update_data)
    
    # Notify User conditionally
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if updated_order:
        background_tasks.add_task(send_order_cancellation_email, updated_order)
        
    return {"message": "Cancellation approved and stock restored"}

@admin_router.patch("/orders/{order_id}/reject-cancel")
async def admin_reject_cancel(order_id: str, background_tasks: BackgroundTasks, admin_user: Dict = Depends(verify_admin)):
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
        
    if not order.get("cancel_requested"):
        raise HTTPException(status_code=400, detail="Cancellation not requested for this order")
        
    restored_status = order.get("previous_order_status") or "processing"
    update_data = {
        "cancel_requested": False,
        "cancel_rejected": True,
        "order_status": restored_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.orders.update_one(
        {"id": order_id},
        {
            "$set": update_data,
            "$unset": {"previous_order_status": ""}
        }
    )
    await log_admin_action(admin_user, "reject_cancellation", order_id, update_data)
    
    # Notify User conditionally
    updated_order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if updated_order:
        background_tasks.add_task(send_order_status_email, updated_order)
    
    return {"message": "Cancellation request rejected"}

# --- CUSTOMER MANAGEMENT ---
@admin_router.get("/customers")
async def admin_get_customers(
    skip: int = 0,
    limit: int = 50,
    admin_user: Dict = Depends(verify_admin)
):
    """Get all customers"""
    customers = await db.users.find(
        {"is_admin": {"$ne": True}},
        {"_id": 0, "password": 0}
    ).skip(skip).limit(limit).to_list(limit)
    
    # Get order count for each customer
    for customer in customers:
        order_count = await db.orders.count_documents({"user_id": customer['id']})
        total_spent = await db.orders.aggregate([
            {"$match": {"user_id": customer['id'], "payment_status": "paid"}},
            {"$group": {"_id": None, "total": {"$sum": "$total_amount"}}}
        ]).to_list(1)
        customer['order_count'] = order_count
        customer['total_spent'] = total_spent[0]['total'] if total_spent else 0
    
    total = await db.users.count_documents({"is_admin": {"$ne": True}})
    
    return {
        "customers": customers,
        "total": total,
        "page": skip // limit + 1,
        "pages": (total + limit - 1) // limit
    }

@admin_router.get("/customers/{user_id}/orders")
async def admin_get_customer_orders(user_id: str, admin_user: Dict = Depends(verify_admin)):
    """Get all orders for a specific customer"""
    orders = await db.orders.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return orders

# --- INVENTORY MANAGEMENT ---
@admin_router.get("/inventory/low-stock")
async def get_low_stock_products(threshold: int = 10, admin_user: Dict = Depends(verify_admin)):
    """Get products with low stock"""
    products = await db.products.find(
        {"stock": {"$lt": threshold}},
        {"_id": 0}
    ).sort("stock", 1).to_list(100)
    
    return products

@admin_router.put("/inventory/{product_id}/stock")
async def update_product_stock(
    product_id: str,
    stock: int,
    size: Optional[str] = None,
    admin_user: Dict = Depends(verify_admin)
):
    """Update product stock globally or for a specific size"""
    stock = max(0, stock)
    
    if size:
        # First get the product to calculate the new total stock
        product = await db.products.find_one({"id": product_id})
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
            
        # Update the size_stock dict and recalculate total
        size_stock = product.get("size_stock", {})
        size_stock[size] = stock
        total_stock = sum(size_stock.values())
        
        result = await db.products.update_one(
            {"id": product_id},
            {"$set": {
                f"size_stock.{size}": stock, 
                "stock": total_stock, 
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        await log_admin_action(admin_user, "update_stock_size", product_id, {"size": size, "new_stock": stock, "total_stock": total_stock})
    else:
        # Backward compatible global stock update
        result = await db.products.update_one(
            {"id": product_id},
            {"$set": {"stock": stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
        await log_admin_action(admin_user, "update_stock", product_id, {"new_stock": stock})
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
        
    return {"message": "Stock updated"}

# --- AUDIT LOGS ---
@admin_router.get("/logs/admin-actions")
async def get_admin_logs(
    skip: int = 0,
    limit: int = 100,
    admin_user: Dict = Depends(verify_admin)
):
    """Get admin action logs"""
    logs = await db.admin_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

@admin_router.get("/logs/security")
async def get_security_logs(
    skip: int = 0,
    limit: int = 100,
    admin_user: Dict = Depends(verify_admin)
):
    """Get security event logs"""
    logs = await db.security_logs.find({}, {"_id": 0}).sort("timestamp", -1).skip(skip).limit(limit).to_list(limit)
    return logs

# --- SETTINGS MANAGEMENT ---
@admin_router.put("/settings/announcement")
async def admin_update_announcement(
    setup_data: AnnouncementUpdate,
    admin_user: Dict = Depends(verify_admin)
):
    """Update global announcement banner"""
    update_data = setup_data.model_dump()
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.settings.update_one(
        {"id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    await log_admin_action(admin_user, "update_announcement", "global", update_data)
    return {"message": "Announcement updated"}

@admin_router.get("/subscribers")
async def admin_get_subscribers(admin_user: Dict = Depends(verify_admin)):
    subscribers = await db.subscribers.find(
        {"is_active": True, "is_verified": True},
        {"_id": 0}
    ).sort("subscribed_at", -1).to_list(500)

    return {
        "total": len(subscribers),
        "subscribers": subscribers[:100]
    }

@admin_router.post("/subscribers/send-notification")
async def admin_send_subscriber_notification(
    payload: SubscriberBroadcastRequest,
    admin_user: Dict = Depends(verify_admin)
):
    requested_emails = [email.strip().lower() for email in (payload.recipient_emails or []) if email and email.strip()]

    query = {"is_active": True, "is_verified": True}
    if requested_emails:
        query["email"] = {"$in": requested_emails}

    subscribers = await db.subscribers.find(
        query,
        {"_id": 0, "email": 1}
    ).to_list(2000)
    recipient_emails = [subscriber.get("email", "").strip().lower() for subscriber in subscribers if subscriber.get("email")]

    if not recipient_emails:
        raise HTTPException(status_code=400, detail="No active subscribers found")

    send_result = await send_subscriber_broadcast_email(
        sanitize_input(payload.subject),
        sanitize_input(payload.message),
        recipient_emails,
        sanitize_input(payload.preheader) if payload.preheader else None,
        sanitize_input(payload.cta_label) if payload.cta_label else None,
        sanitize_input(payload.cta_link) if payload.cta_link else None
    )

    await log_admin_action(
        admin_user,
        "send_subscriber_notification",
        "newsletter",
        {
            "subject": sanitize_input(payload.subject),
            "subscriber_count": len(recipient_emails),
            "sent_count": send_result["sent_count"],
            "failed_count": send_result["failed_count"]
        }
    )

    if send_result["sent_count"] == 0:
        raise HTTPException(status_code=500, detail="Notification failed for all subscribers")

    return {
        "message": f"Notification sent to {send_result['sent_count']} subscribers",
        "subscriber_count": len(recipient_emails),
        "sent_count": send_result["sent_count"],
        "failed_count": send_result["failed_count"],
        "failed_recipients": send_result["failed_recipients"][:10]
    }

# --- ADMIN ROUTES FOR IMPACT SERIES ---

@admin_router.get("/impact-series")
async def admin_get_impact_series(admin_user: Dict = Depends(verify_admin)):
    """Get all Impact Series editions for admin panel."""
    series = []
    async for s in db.impact_series.find():
        s['_id'] = str(s['_id'])
        series.append(s)
    return series

@admin_router.post("/impact-series")
async def admin_create_impact_series(series: ImpactSeriesCreate, admin_user: Dict = Depends(verify_admin)):
    """Create a new Impact Series edition."""
    new_series = ImpactSeries(**series.model_dump())
    
    # If this one is meant to be active, deactivate all others first
    if new_series.is_active:
        await db.impact_series.update_many({}, {"$set": {"is_active": False}})
        
    await db.impact_series.insert_one(new_series.model_dump())
    return new_series.model_dump()

@admin_router.put("/impact-series/{series_id}")
async def admin_update_impact_series(series_id: str, series_update: ImpactSeriesCreate, admin_user: Dict = Depends(verify_admin)):
    """Update an existing Impact Series edition."""
    # Check if exists
    existing = await db.impact_series.find_one({"id": series_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Impact Series not found")
        
    # If setting to active, deactivate all others first
    if series_update.is_active:
        await db.impact_series.update_many({}, {"$set": {"is_active": False}})
        
    update_data = series_update.model_dump()
    result = await db.impact_series.update_one(
        {"id": series_id},
        {"$set": update_data}
    )
    
    if result.modified_count == 0:
        # Might not have changed any fields, return the updated object anyway by merging
        updated = {**existing, **update_data}
        updated.pop('_id', None)
        return updated
        
    updated = await db.impact_series.find_one({"id": series_id})
    updated.pop('_id', None)
    return updated

@admin_router.delete("/impact-series/{series_id}")
async def admin_delete_impact_series(series_id: str, admin_user: Dict = Depends(verify_admin)):
    """Delete an Impact Series edition."""
    result = await db.impact_series.delete_one({"id": series_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Impact Series not found")
    return {"message": "Impact series deleted successfully"}

@admin_router.post("/impact-series/{series_id}/activate")
async def admin_activate_impact_series(series_id: str, admin_user: Dict = Depends(verify_admin)):
    """Activate a specific Impact Series (and deactivate all others)."""
    # Verify it exists
    existing = await db.impact_series.find_one({"id": series_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Impact Series not found")
        
    # Deactivate all
    await db.impact_series.update_many({}, {"$set": {"is_active": False}})
    # Activate target
    await db.impact_series.update_one({"id": series_id}, {"$set": {"is_active": True}})
    
    return {"message": f"Impact series {series_id} activated successfully"}

# --- HERO BANNER MODELS & ROUTES ---

class HeroBanner(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    subtitle: str
    image: str
    link: str
    button_text: str = "SHOP NOW"
    is_active: bool = True
    order: int = 0
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())

class HeroBannerCreate(BaseModel):
    title: str
    subtitle: str
    image: str
    link: str
    button_text: str = "SHOP NOW"
    is_active: bool = True
    order: int = 0

@admin_router.post("/hero-banners")
async def admin_create_hero_banner(banner: HeroBannerCreate, admin_user: Dict = Depends(verify_admin)):
    """Create a new Hero Banner."""
    new_banner = HeroBanner(**banner.model_dump())
    banner_dict = new_banner.model_dump()
    
    await db.hero_banners.insert_one(banner_dict)
    
    banner_dict.pop('_id', None)
    return banner_dict

@admin_router.get("/hero-banners")
async def admin_get_hero_banners(admin_user: Dict = Depends(verify_admin)):
    """Get all Hero Banners."""
    cursor = db.hero_banners.find({}).sort("order", 1)
    banners = await cursor.to_list(length=100)
    
    for banner in banners:
        banner.pop('_id', None)
        
    return banners

@admin_router.put("/hero-banners/{banner_id}")
async def admin_update_hero_banner(banner_id: str, banner_update: HeroBannerCreate, admin_user: Dict = Depends(verify_admin)):
    """Update an existing Hero Banner."""
    existing = await db.hero_banners.find_one({"id": banner_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Hero Banner not found")
        
    update_data = banner_update.model_dump()
    result = await db.hero_banners.update_one(
        {"id": banner_id},
        {"$set": update_data}
    )
    
    updated = await db.hero_banners.find_one({"id": banner_id})
    updated.pop('_id', None)
    return updated

@admin_router.delete("/hero-banners/{banner_id}")
async def admin_delete_hero_banner(banner_id: str, admin_user: Dict = Depends(verify_admin)):
    """Delete a Hero Banner."""
    result = await db.hero_banners.delete_one({"id": banner_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Hero Banner not found")
    return {"message": "Hero Banner deleted successfully"}

@admin_router.post("/hero-banners/{banner_id}/toggle-active")
async def admin_toggle_banner_active(banner_id: str, admin_user: Dict = Depends(verify_admin)):
    """Toggle the active status of a specific Hero Banner."""
    existing = await db.hero_banners.find_one({"id": banner_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Hero Banner not found")
        
    new_status = not existing.get('is_active', False)
    await db.hero_banners.update_one({"id": banner_id}, {"$set": {"is_active": new_status}})
    
    return {"message": f"Hero Banner active status set to {new_status}"}

# --- COUPON MANAGEMENT ---
@admin_router.get("/coupons")
async def admin_get_all_coupons(admin_user: Dict = Depends(verify_admin)):
    """Get all coupons"""
    coupons = await db.coupons.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return coupons

@admin_router.post("/coupons")
async def admin_create_coupon(coupon_data: dict, admin_user: Dict = Depends(verify_admin)):
    """Create new coupon"""
    from server import Coupon
    
    # Check if code already exists
    existing = await db.coupons.find_one({"code": coupon_data['code'].upper()})
    if existing:
        raise HTTPException(status_code=400, detail="Coupon code already exists")
        
    coupon_id = str(uuid.uuid4())
    coupon = Coupon(
        id=coupon_id,
        code=coupon_data['code'].upper(),
        discount_percentage=coupon_data['discount_percentage'],
        is_active=coupon_data.get('is_active', True),
        usage_limit=coupon_data.get('usage_limit'),
        max_uses_per_user=coupon_data.get('max_uses_per_user'),
        starts_at=coupon_data.get('starts_at'),
        expires_at=coupon_data.get('expires_at'),
        eligible_user_ids=coupon_data.get('eligible_user_ids')
    )
    
    await db.coupons.insert_one(coupon.model_dump())
    return {"message": "Coupon created", "coupon_id": coupon_id}

@admin_router.put("/coupons/{coupon_id}")
async def admin_update_coupon(coupon_id: str, coupon_data: dict, admin_user: Dict = Depends(verify_admin)):
    """Update existing coupon"""
    existing_coupon = await db.coupons.find_one({"id": coupon_id})
    if not existing_coupon:
        raise HTTPException(status_code=404, detail="Coupon not found")
        
    # Check code uniqueness if changing code
    if 'code' in coupon_data and coupon_data['code'].upper() != existing_coupon['code']:
        code_check = await db.coupons.find_one({"code": coupon_data['code'].upper()})
        if code_check:
            raise HTTPException(status_code=400, detail="Coupon code already exists")
            
    update_data = {}
    if 'code' in coupon_data:
        update_data['code'] = coupon_data['code'].upper()
    if 'discount_percentage' in coupon_data:
        update_data['discount_percentage'] = coupon_data['discount_percentage']
    if 'is_active' in coupon_data:
        update_data['is_active'] = coupon_data['is_active']
    if 'usage_limit' in coupon_data:
        update_data['usage_limit'] = coupon_data['usage_limit']
    if 'max_uses_per_user' in coupon_data:
        update_data['max_uses_per_user'] = coupon_data['max_uses_per_user']
    if 'starts_at' in coupon_data:
        update_data['starts_at'] = coupon_data['starts_at']
    if 'expires_at' in coupon_data:
        update_data['expires_at'] = coupon_data['expires_at']
    if 'eligible_user_ids' in coupon_data:
        update_data['eligible_user_ids'] = coupon_data['eligible_user_ids']
        
    if update_data:
        await db.coupons.update_one({"id": coupon_id}, {"$set": update_data})
        
    return {"message": "Coupon updated"}

@admin_router.delete("/coupons/{coupon_id}")
async def admin_delete_coupon(coupon_id: str, admin_user: Dict = Depends(verify_admin)):
    """Delete coupon"""
    result = await db.coupons.delete_one({"id": coupon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Coupon not found")
        
    return {"message": "Coupon deleted"}

# --- EXCHANGE MANAGEMENT ---
@admin_router.get("/exchanges")
async def admin_get_exchanges(admin_user: Dict = Depends(verify_admin)):
    """Get all exchange requests"""
    exchanges = await db.exchange_requests.find({}, {"_id": 0}).sort("request_time", -1).to_list(100)
    return exchanges

@admin_router.patch("/exchanges/{request_id}/approve")
async def admin_approve_exchange(request_id: str, background_tasks: BackgroundTasks, admin_user: Dict = Depends(verify_admin)):
    """Approve an exchange request"""
    exchange = await db.exchange_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not exchange:
        raise HTTPException(status_code=404, detail="Exchange request not found")
    if exchange.get("status") != "pending":
        raise HTTPException(status_code=400, detail="Only pending exchange requests can be approved")

    order = await db.orders.find_one({"id": exchange["order_id"]}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Associated order not found")

    target_item = next((item for item in order.get("items", []) if item.get("name") == exchange["product_name"]), None)
    if not target_item:
        raise HTTPException(status_code=400, detail="Unable to match the requested product in the order")

    product_id = target_item.get("product_id")
    new_size = exchange.get("size_requested")
    qty = target_item.get("quantity", 1)
    product = await db.products.find_one({"id": product_id}, {"_id": 0})
    if not product:
        raise HTTPException(status_code=404, detail="Replacement product not found")

    size_stock = product.get("size_stock") or {}
    available_stock = size_stock.get(new_size, product.get("stock", 0))
    if available_stock < qty:
        raise HTTPException(
            status_code=400,
            detail=f"Not enough stock for size {new_size}. Available: {available_stock}, required: {qty}"
        )
        
    # Reserve replacement stock first so status changes only happen when inventory is available.
    await db.products.update_one(
        {"id": product_id},
        {"$inc": {
            "stock": -qty,
            f"size_stock.{new_size}": -qty
        }}
    )

    await db.exchange_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "approved"}}
    )
    
    time_now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": exchange["order_id"]},
        {
            "$set": {
                "exchange_requested": False,
                "order_status": "exchange_approved",
                "updated_at": time_now
            },
            "$push": {
                "order_timeline": {
                    "status": "exchange_approved",
                    "time": time_now
                }
            }
        }
    )
    await log_admin_action(admin_user, "approve_exchange", request_id, {"order_id": exchange["order_id"]})
    background_tasks.add_task(send_exchange_approved_email, exchange)
    return {"message": "Exchange request approved successfully"}

@admin_router.patch("/exchanges/{request_id}/reject")
async def admin_reject_exchange(request_id: str, admin_user: Dict = Depends(verify_admin)):
    """Reject an exchange request"""
    exchange = await db.exchange_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not exchange:
        raise HTTPException(status_code=404, detail="Exchange request not found")
        
    await db.exchange_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "rejected"}}
    )
    
    time_now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": exchange["order_id"]},
        {
            "$set": {
                "exchange_requested": False,
                "order_status": "exchange_rejected",
                "updated_at": time_now
            },
            "$push": {
                "order_timeline": {
                    "status": "exchange_rejected",
                    "time": time_now
                }
            }
        }
    )
    
    await log_admin_action(admin_user, "reject_exchange", request_id, {"order_id": exchange["order_id"]})
    return {"message": "Exchange request rejected successfully"}

@admin_router.patch("/exchanges/{request_id}/complete")
async def admin_complete_exchange(request_id: str, admin_user: Dict = Depends(verify_admin)):
    """Mark an exchange as completed"""
    exchange = await db.exchange_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not exchange:
        raise HTTPException(status_code=404, detail="Exchange request not found")
        
    if exchange.get("status") != "approved":
        raise HTTPException(status_code=400, detail="Exchange must be approved before it can be completed")
        
    await db.exchange_requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "completed"}}
    )
    
    time_now = datetime.now(timezone.utc).isoformat()
    await db.orders.update_one(
        {"id": exchange["order_id"]},
        {
            "$set": {
                "order_status": "exchange_completed",
                "updated_at": time_now
            },
            "$push": {
                "order_timeline": {
                    "status": "exchange_completed",
                    "time": time_now
                }
            }
        }
    )
    
    await log_admin_action(admin_user, "complete_exchange", request_id, {"order_id": exchange["order_id"]})
    return {"message": "Exchange completed."}
