import re
import os

filepath = "/Users/madhukk/Documents/LAST-GEAR/frontend/src/pages/CheckoutNew.js"
with open(filepath, "r") as f:
    content = f.read()

# 1. Add new state variables for discounts
state_insertion = """
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
"""

content = content.replace("const [loading, setLoading] = useState(false);", "const [loading, setLoading] = useState(false);" + state_insertion)

# 2. Add useEffect to fetch global discount
fetch_discount = """
  useEffect(() => {
    const fetchGlobalDiscount = async () => {
      try {
        const response = await axios.get(`${API}/settings/announcement`);
        if (response.data.global_discount_percentage > 0) {
          setGlobalDiscount(response.data.global_discount_percentage);
        }
      } catch (error) {
        console.error('Failed to fetch global settings:', error);
      }
    };
    fetchGlobalDiscount();
  }, []);
"""

content = content.replace("  const API = `${BACKEND_URL}/api`;", "  const API = `${BACKEND_URL}/api`;\n" + fetch_discount)

# 3. Add function to validate coupon
apply_coupon = """
  const handleApplyCoupon = async () => {
    setCouponError('');
    if (!couponCode.trim()) return;
    
    try {
      const response = await axios.get(`${API}/coupons/${couponCode.trim()}`);
      setAppliedCoupon({
        code: couponCode.trim().toUpperCase(),
        discount: response.data.discount_percentage
      });
      toast.success(`Promo code applied: ${response.data.discount_percentage}% OFF`);
    } catch (error) {
      setCouponError(error.response?.data?.detail || 'Invalid or expired promo code');
      setAppliedCoupon(null);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
  };
"""

content = content.replace("  const handleChange = (e) =>", apply_coupon + "\n  const handleChange = (e) =>")

# 4. Update the order creation logic
order_creation_search = """      const shippingCost = cartTotal >= 1500 ? 0 : 99;
      const totalAmount = parseFloat((cartTotal + shippingCost).toFixed(2));

      // Create order
      const orderResponse = await axios.post(`${API}/orders`, {"""

order_creation_replace = """
      // Calculate final pricing
      let subtotal = cartTotal;
      let totalDiscountPercent = globalDiscount;
      if (appliedCoupon) {
        totalDiscountPercent += appliedCoupon.discount;
      }
      
      const discountAmount = subtotal * (totalDiscountPercent / 100);
      const subtotalAfterDiscount = subtotal - discountAmount;
      const shippingCost = subtotalAfterDiscount >= 1500 ? 0 : 99;
      const totalAmount = parseFloat((subtotalAfterDiscount + shippingCost).toFixed(2));

      // Create order
      const orderResponse = await axios.post(`${API}/orders`, {
        discount_applied: Math.round(discountAmount),
        coupon_code: appliedCoupon ? appliedCoupon.code : null,"""

content = content.replace(order_creation_search, order_creation_replace)

# 5. Pre-calculate values for the UI display
ui_calc_search = """  const shippingCost = cartTotal >= 1500 ? 0 : 99;
  const totalAmount = cartTotal + shippingCost;"""

ui_calc_replace = """  let totalDiscountPercent = globalDiscount;
  if (appliedCoupon) {
    totalDiscountPercent += appliedCoupon.discount;
  }
  
  const discountAmount = cartTotal * (totalDiscountPercent / 100);
  const subtotalAfterDiscount = cartTotal - discountAmount;
  const shippingCost = subtotalAfterDiscount >= 1500 ? 0 : 99;
  const totalAmount = subtotalAfterDiscount + shippingCost;"""

content = content.replace(ui_calc_search, ui_calc_replace)


# 6. Inject the Promo Code UI into the Order Summary
order_summary_search = """              <div className="border-t border-gray-300 pt-4 space-y-2">
                <div className="flex justify-between">"""

order_summary_replace = """
              {/* Promo Code Section */}
              <div className="border-t border-gray-300 pt-4 pb-2">
                <label className="block text-sm font-bold mb-2">PROMO CODE</label>
                {!appliedCoupon ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                      placeholder="Enter code"
                      className="w-full px-3 py-2 border border-gray-300 focus:outline-none focus:ring-1 focus:ring-black uppercase text-sm"
                    />
                    <button
                      type="button"
                      onClick={handleApplyCoupon}
                      className="bg-black text-white px-4 py-2 text-sm font-bold hover:bg-gray-800 transition-colors"
                    >
                      APPLY
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between bg-green-50 border border-green-200 px-3 py-2 rounded">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-800">{appliedCoupon.code}</span>
                      <span className="text-sm border ml-2 border-green-600 px-1 rounded text-green-700 bg-white">-{appliedCoupon.discount}%</span>
                    </div>
                    <button type="button" onClick={removeCoupon} className="text-sm font-medium text-red-500 hover:text-red-700">Remove</button>
                  </div>
                )}
                {couponError && <p className="text-red-500 text-xs mt-1">{couponError}</p>}
                {globalDiscount > 0 && !appliedCoupon && (
                   <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100 flex items-center justify-between">
                     <span>✨ Storewide Discount Active</span>
                     <span className="font-bold border border-green-600 px-1 rounded bg-white">-{globalDiscount}%</span>
                   </div>
                )}
              </div>

              <div className="border-t border-gray-300 pt-4 space-y-2">
                <div className="flex justify-between">"""

content = content.replace(order_summary_search, order_summary_replace)

# 7. Add discount lines to the totals calculation display
totals_search = """                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{cartTotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>"""

totals_replace = """                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{cartTotal.toFixed(0)}</span>
                </div>
                
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                    <span className="font-bold">-₹{discountAmount.toFixed(0)}</span>
                  </div>
                )}
                
                <div className="flex justify-between">
                  <span>Shipping</span>"""

content = content.replace(totals_search, totals_replace)

with open(filepath, "w") as f:
    f.write(content)
