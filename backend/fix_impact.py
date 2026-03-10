from pymongo import MongoClient

client = MongoClient('mongodb://localhost:27017/')
db = client['last_gear_db']

# Get active impact series
active_series = db.impact_series.find_one({"is_active": True})
if active_series:
    series_id = active_series['id']
    # Find the latest product and update it
    latest_product = db.products.find_one(sort=[("_id", -1)])
    if latest_product:
        db.products.update_one({"_id": latest_product["_id"]}, {"$set": {"impact_series_id": series_id}})
        print(f"Updated product {latest_product['name']} to impact series {active_series['title']}")
    else:
        print("No products found")
else:
    print("No active impact series found")
