import requests

BACKEND_URL = "http://localhost:8000/api"

print("1. Testing valid coupon API")
res = requests.get(f"{BACKEND_URL}/coupons/TEST50")
print(res.status_code, res.text)

print("2. Testing invalid coupon API")
res = requests.get(f"{BACKEND_URL}/coupons/INVALID")
print(res.status_code, res.text)
