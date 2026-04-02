import asyncio
import os
import uuid
from motor.motor_asyncio import AsyncIOMotorClient
import httpx

async def test_full_checkout():
    from dotenv import load_dotenv
    load_dotenv()
    
    # 1. Direct DB connection to spoof a user and cart if needed
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
    client = AsyncIOMotorClient(mongo_url)
    db = client["lastgear"]
    
    # Get any valid user
    user = await db.users.find_one({})
    if not user:
        print("No users in DB")
        return
        
    print(f"Using user: {user['email']}")
    
    # Generate token
    import jwt
    from datetime import datetime, timedelta, timezone
    payload = {
        'user_id': user['id'],
        'email': user['email'],
        'exp': datetime.now(timezone.utc) + timedelta(days=1)
    }
    token = jwt.encode(payload, os.environ.get('JWT_SECRET', 'lastgear_jwt_secret_key_2026_production'), algorithm='HS256')
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # Get checkout item
    product = await db.products.find_one({})
    
    # Create order via HTTP request to localhost:8000
    order_data = {
        "items": [{
            "product_id": product["id"],
            "name": product["name"],
            "price": product["price"],
            "quantity": 1,
            "size": "M",
            "color": "Black"
        }],
        "total_amount": product["price"],
        "shipping_address": {
            "full_name": "Test User",
            "address_line1": "123 Test St",
            "city": "Test",
            "state": "Test",
            "postal_code": "123456",
            "country": "India",
            "phone": "1234567890"
        },
        "payment_method": "razorpay"
    }
    
    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000") as http_client:
        print("Creating order...")
        resp = await http_client.post("/api/orders", json=order_data, headers=headers)
        print(resp.status_code, resp.text)
        if resp.status_code != 200:
            return
            
        order_id = resp.json()["id"]
        
        print("Creating razorpay order...")
        resp2 = await http_client.post("/api/razorpay/create-order", json={"order_id": order_id}, headers=headers)
        print(resp2.status_code, resp2.text)

if __name__ == "__main__":
    asyncio.run(test_full_checkout())
