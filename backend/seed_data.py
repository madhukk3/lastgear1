import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv
from pathlib import Path
import bcrypt

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

products = [
    {
        "id": "prod_001",
        "name": "ESSENTIAL CREW TEE",
        "description": "Premium cotton crew neck t-shirt. Comfortable fit for everyday wear.",
        "price": 999.00,
        "category": "t-shirts",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Black", "White", "Gray"],
        "images": ["https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800"],
        "stock": 100,
        "featured": True
    },
    {
        "id": "prod_002",
        "name": "URBAN V-NECK TEE",
        "description": "Modern v-neck design with superior fabric quality.",
        "price": 1199.00,
        "category": "t-shirts",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Navy", "Charcoal", "Olive"],
        "images": ["https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800"],
        "stock": 85,
        "featured": True
    },
    {
        "id": "prod_003",
        "name": "PERFORMANCE ZIP HOODIE",
        "description": "Technical hoodie with moisture-wicking fabric. Perfect for active lifestyle.",
        "price": 2499.00,
        "category": "hoodies",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Black", "Navy", "Charcoal"],
        "images": ["https://images.unsplash.com/photo-1590759483822-b2fee5aa6bd3?w=800"],
        "stock": 60,
        "featured": True
    },
    {
        "id": "prod_004",
        "name": "SIGNATURE PULLOVER HOODIE",
        "description": "Classic pullover hoodie with premium fleece interior.",
        "price": 2199.00,
        "category": "hoodies",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Gray", "Black", "Burgundy"],
        "images": ["https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=800"],
        "stock": 75,
        "featured": True
    },
    {
        "id": "prod_005",
        "name": "GRAPHIC PRINT TEE",
        "description": "Bold graphic design on premium cotton fabric.",
        "price": 1299.00,
        "category": "t-shirts",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Black", "White"],
        "images": ["https://images.unsplash.com/photo-1503341504253-dff4815485f1?w=800"],
        "stock": 90,
        "featured": False
    },
    {
        "id": "prod_006",
        "name": "TECH FLEECE HOODIE",
        "description": "Lightweight tech fleece for ultimate comfort.",
        "price": 2799.00,
        "category": "hoodies",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Black", "Navy", "Olive"],
        "images": ["https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800"],
        "stock": 50,
        "featured": False
    },
    {
        "id": "prod_007",
        "name": "LONGLINE TEE",
        "description": "Extended length tee with modern streetwear fit.",
        "price": 1499.00,
        "category": "t-shirts",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Sand", "Black", "White"],
        "images": ["https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800"],
        "stock": 70,
        "featured": False
    },
    {
        "id": "prod_008",
        "name": "OVERSIZED HOODIE",
        "description": "Relaxed oversized fit for maximum comfort.",
        "price": 2399.00,
        "category": "hoodies",
        "sizes": ["S", "M", "L", "XL", "XXL"],
        "colors": ["Cream", "Black", "Gray"],
        "images": ["https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=800"],
        "stock": 65,
        "featured": False
    }
]

async def seed_database():
    # Clear existing products
    await db.products.delete_many({})
    
    # Insert new products with INR prices
    await db.products.insert_many(products)
    
    # Create admin user
    admin_email = (os.environ.get('ADMIN_EMAIL') or '').strip()
    admin_password = (os.environ.get('ADMIN_PASSWORD') or '').strip()
    
    existing_admin = await db.users.find_one({"email": admin_email}) if admin_email else None
    if admin_email and admin_password and not existing_admin:
        hashed_pw = bcrypt.hashpw(admin_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        from datetime import datetime, timezone
        import uuid
        admin_doc = {
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "password": hashed_pw,
            "name": "Admin",
            "phone": "+91-6360893940",
            "is_admin": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        print(f"Admin user created: {admin_email}")
    elif not admin_email or not admin_password:
        print("Admin user not created: ADMIN_EMAIL and ADMIN_PASSWORD must be set explicitly.")
    
    print(f"Successfully seeded {len(products)} products with INR prices")
    client.close()

if __name__ == "__main__":
    asyncio.run(seed_database())
