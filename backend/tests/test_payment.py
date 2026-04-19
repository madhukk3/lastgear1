import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient
import razorpay

async def test_razorpay():
    from dotenv import load_dotenv
    load_dotenv()
    razorpay_key_id = os.environ.get("RAZORPAY_KEY_ID")
    razorpay_key_secret = os.environ.get("RAZORPAY_KEY_SECRET")

    if not razorpay_key_id or not razorpay_key_secret:
        print("Missing keys!")
        return

    client = razorpay.Client(auth=(razorpay_key_id, razorpay_key_secret))
    try:
        order = client.order.create({
            "amount": 50000, # 500 INR
            "currency": "INR",
            "receipt": "receipt_12345",
            "notes": {
                "test": "value"
            }
        })
        print(f"Successfully created order: {order['id']}")
    except Exception as e:
        print(f"Razorpay error: {e}")

if __name__ == "__main__":
    asyncio.run(test_razorpay())
