import os

filepath = "/Users/madhukk/Documents/LAST-GEAR/frontend/src/pages/admin/AdminCoupons.js"
with open(filepath, "r") as f:
    content = f.read()

# Fix the JSX typo causing React compilation failure
content = content.replace("onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}", "onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\\s/g, '') })}")

with open(filepath, "w") as f:
    f.write(content)
