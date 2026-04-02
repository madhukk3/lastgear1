from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv("/Users/madhukk/Documents/LAST-GEAR/backend/.env")

client = MongoClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]

print(f"Total products in DB: {db.products.count_documents({})}")
for p in db.products.find():
    print(p.get("name"), "->", p.get("impact_series_id"))
