import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def get_latest_order():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
    client = AsyncIOMotorClient(mongo_url)
    db = client["lastgear"]
    
    order = await db.orders.find_one({}, sort=[("created_at", -1)])
    if order:
        print("LATEST ORDER ID:", order.get("id"))
        print("PAYMENT METHOD:", order.get("payment_method"))
        print("STATUS:", order.get("payment_status"))
        print("ITEMS:")
        for item in order.get("items", []):
            print(f" - {item.get('name')} (ID: {item.get('product_id')}) (Qty: {item.get('quantity')}) (Size: {item.get('size')})")
    else:
        print("No orders found.")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(get_latest_order())
