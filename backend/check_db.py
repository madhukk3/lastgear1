from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv("/Users/madhukk/Documents/LAST-GEAR/backend/.env")

client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

print("--- Active Impact Series ---")
active = db.impact_series.find_one({"is_active": True})
print(active)

print("\n--- Products with impact_series_id ---")
for p in db.products.find({"impact_series_id": {"$exists": True, "$ne": None, "$ne": ""}}):
    print(f"Product: {p.get('name')}, impact_series_id: {p.get('impact_series_id')}")

print("\n--- All Products (first 5) ---")
for p in db.products.find().limit(5):
    print(f"Product: {p.get('name')}, impact_series_id: {p.get('impact_series_id', 'MISSING')}")
