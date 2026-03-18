import asyncio
import os
from motor.motor_asyncio import AsyncIOMotorClient

async def test_order_stock():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017/')
    client = AsyncIOMotorClient(mongo_url)
    db = client["lastgear"]

    # 1. pick a random product
    product = await db.products.find_one()
    print(f"Testing product: {product['id']} ({product['name']})")
    print(f"Current Stock: {product.get('stock')} Size Stock: {product.get('size_stock')}")

    # 2. find user
    user = await db.users.find_one()

    # 3. fake an order
    from server import update_product_stock
    
    class FakeItem:
        def __init__(self, pid, name, size, qty):
            self.product_id = pid
            self.name = name
            self.size = size
            self.quantity = qty

    sz = list(product.get('size_stock', {}).keys())[0] if product.get('size_stock') else 'M'
    items = [FakeItem(product['id'], product['name'], sz, 1)]

    print("Attempting to run update_product_stock...")
    try:
        await update_product_stock(items)
        print("update_product_stock executed without raising exception")
    except Exception as e:
        print(f"Exception raised: {e}")

    # 4. Check stock again
    product2 = await db.products.find_one({"id": product['id']})
    print(f"New Stock: {product2.get('stock')} Size Stock: {product2.get('size_stock')}")

if __name__ == "__main__":
    from dotenv import load_dotenv
    load_dotenv()
    asyncio.run(test_order_stock())
