from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict
from datetime import datetime, timezone, timedelta
import uuid
from security import verify_admin, log_admin_action, sanitize_input
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

admin_router = APIRouter(prefix="/api/admin", tags=["admin"])

# --- ADMIN MODELS ---
class ProductAdmin(BaseModel):
    name: str
    description: str
    price: float
    category: str
    sizes: List[str]
    colors: List[str]
    images: List[str]
    stock: int
    featured: bool = False

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    sizes: Optional[List[str]] = None
    colors: Optional[List[str]] = None
    images: Optional[List[str]] = None
    stock: Optional[int] = None
    featured: Optional[bool] = None

class OrderStatusUpdate(BaseModel):
    order_status: str  # processing, shipped, delivered, cancelled
    tracking_number: Optional[str] = None

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
    
    product_id = str(uuid.uuid4())
    product = {
        "id": product_id,
        **product_data.model_dump(),
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
    
    # Sanitize string inputs
    if 'name' in update_data:
        update_data['name'] = sanitize_input(update_data['name'])
    if 'description' in update_data:
        update_data['description'] = sanitize_input(update_data['description'])
    
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
    admin_user: Dict = Depends(verify_admin)
):
    """Update order status and tracking"""
    order = await db.orders.find_one({"id": order_id}, {"_id": 0})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {
        "order_status": status_update.order_status,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    if status_update.tracking_number:
        update_data["tracking_number"] = status_update.tracking_number
    
    await db.orders.update_one({"id": order_id}, {"$set": update_data})
    await log_admin_action(admin_user, "update_order_status", order_id, update_data)
    
    return {"message": "Order status updated"}

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
    admin_user: Dict = Depends(verify_admin)
):
    """Update product stock"""
    result = await db.products.update_one(
        {"id": product_id},
        {"$set": {"stock": stock, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Product not found")
    
    await log_admin_action(admin_user, "update_stock", product_id, {"new_stock": stock})
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