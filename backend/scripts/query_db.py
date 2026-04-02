from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017/')
db = client['last_gear_db']

products = list(db.products.find({"impact_series_id": {"$exists": True}}))
print("PRODUCTS WITH IMPACT SERIES:")
for p in products:
    print(f"ID: {p.get('_id')} | Name: {p.get('name')} | impact_series_id: {p.get('impact_series_id')}")

