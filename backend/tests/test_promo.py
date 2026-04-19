import subprocess
import requests
import os

BACKEND_URL = "http://localhost:8000/api"
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

if not ADMIN_EMAIL or not ADMIN_PASSWORD:
    raise SystemExit("ADMIN_EMAIL and ADMIN_PASSWORD must be set for this test")

# 1. Login to get Admin Token
login_res = requests.post(
    f"{BACKEND_URL}/auth/login",
    json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD, "role": "admin"}
)

if login_res.status_code == 200:
    token = login_res.json().get("token")
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Add Coupon
    coupon_data = {
        "code": "WINTER20",
        "discount_percentage": 20,
        "is_active": True
    }
    coupon_res = requests.post(f"{BACKEND_URL}/admin/coupons", json=coupon_data, headers=headers)
    print("COUPON CREATE:", coupon_res.status_code, coupon_res.text)
    
    # 3. Apply Global Discount
    settings_data = {
        "announcement_text": "🚚 2-DAY DELIVERY!",
        "announcement_active": True,
        "global_discount_percentage": 5
    }
    settings_res = requests.put(f"{BACKEND_URL}/admin/settings/announcement", json=settings_data, headers=headers)
    print("SETTINGS UPDATE:", settings_res.status_code, settings_res.text)

    # 4. Verify Promo code validation endpoint
    validate_res = requests.get(f"{BACKEND_URL}/coupons/WINTER20")
    print("COUPON VALIDATION:", validate_res.status_code, validate_res.text)
    
else:
    print("Failed to login", login_res.text)
