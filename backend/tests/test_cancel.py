import asyncio
import os
import jwt
from datetime import datetime, timedelta, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import requests
from dotenv import load_dotenv

load_dotenv()
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

async def main():
    admin = await db.users.find_one({"is_admin": True})
    if not admin:
        print("No admin found")
        return
    
    secret = os.environ.get('JWT_SECRET')
    if not secret:
        print("JWT_SECRET is required for this test")
        return
    payload = {
        'user_id': admin['id'],
        'email': admin['email'],
        'exp': datetime.now(timezone.utc) + timedelta(days=1)
    }
    token = jwt.encode(payload, secret, algorithm='HS256')
    
    order = await db.orders.find_one({"cancel_requested": True})
    if not order:
        print("No orders requesting cancellation")
        return
        
    url = f"http://localhost:8000/api/admin/orders/{order['id']}/approve-cancel"
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"Approving cancellation for order {order['id']}")
    res = requests.patch(url, headers=headers)
    print(res.status_code)
    try:
        print(res.json())
    except:
        print(res.text)

asyncio.run(main())
