import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
import json

load_dotenv()

async def main():
    client = AsyncIOMotorClient(os.environ['MONGO_URL'])
    db = client[os.environ['DB_NAME']]
    order = await db.orders.find_one({"id": "LG-AB6C20CB"})
    
    if not order:
        print("Order not found.")
        return
        
    print(f"Status: {order.get('order_status')}")
    print(f"Timeline: {json.dumps(order.get('order_timeline', []), indent=2)}")

asyncio.run(main())
