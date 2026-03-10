from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv("/Users/madhukk/Documents/LAST-GEAR/backend/.env")
client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

active_series = db.impact_series.find_one({"is_active": True})
if active_series:
    series_id = active_series["id"]
    print(f"Active Series ID: {series_id}")

    # Assign to NEW Impact Series 1
    res1 = db.products.update_many(
        {"name": {"$in": ["NEW Impact Series 1", "IMPACT 1"]}},
        {"$set": {"impact_series_id": series_id}}
    )
    print(f"Modified {res1.modified_count} products.")
else:
    print("No active series found!")

