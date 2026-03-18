import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
from datetime import datetime, timezone

load_dotenv()

async def backfill():
    client = AsyncIOMotorClient(os.getenv("MONGO_URL"))
    db = client[os.getenv("DB_NAME")]
    
    orders = db.orders.find({})
    count = 0
    async for order in orders:
        timeline = order.get("order_timeline", [])
        if not timeline:
            print(f"Backfilling order {order.get('id')} with status {order.get('order_status')}")
            new_timeline = [{
                "status": "order_locked",
                "time": order.get("created_at", datetime.now(timezone.utc).isoformat())
            }]
            
            current_status = order.get("order_status", "processing")
                
            if current_status != "order_locked":
                time_to_use = order.get("updated_at", order.get("created_at", datetime.now(timezone.utc).isoformat()))
                if current_status == "delivered" and order.get("delivered_at"):
                    time_to_use = order.get("delivered_at")
                    
                new_timeline.append({
                    "status": current_status,
                    "time": time_to_use
                })
            
            await db.orders.update_one(
                {"_id": order["_id"]},
                {"$set": {"order_timeline": new_timeline}}
            )
            count += 1
            
    print(f"Backfilled {count} orders.")

if __name__ == "__main__":
    asyncio.run(backfill())
