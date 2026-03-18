import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, cartTotal } = useCart();
  const { user } = useAuth();
  const { globalDiscount, shippingCharge, freeShippingThreshold, codEnabled, codMaxAmount, codCharge } = useSettings() || { globalDiscount: 0, shippingCharge: 99, freeShippingThreshold: 1500, codEnabled: true, codMaxAmount: 3000, codCharge: 50 };
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');

  // Direct buy logic
  const [directItem, setDirectItem] = useState(
    location.state?.directBuyItem || JSON.parse(sessionStorage.getItem('directBuyItem')) || null
  );

  useEffect(() => {
    if (location.state?.directBuyItem) {
      sessionStorage.setItem('directBuyItem', JSON.stringify(location.state.directBuyItem));
      setDirectItem(location.state.directBuyItem);
    }
  }, [location.state]);

  const isDirectBuy = !!directItem;
  const checkoutItems = isDirectBuy ? [directItem] : (cart.items || []);
  const checkoutTotal = isDirectBuy ? (directItem.price * directItem.quantity) : cartTotal;
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('razorpay');

  // Verify if COD is available for this specific cart
  const isCodAvailableForCart = checkoutItems.every(item => {
    // Check if the individual product permits COD
    return item.product?.cod_available !== false;
  });

  // Master COD eligibility check
  const canUseCod = codEnabled && (checkoutTotal <= codMaxAmount) && isCodAvailableForCart;

  useEffect(() => {
    console.log("COD Eligibility Debug:", {
      codEnabled,
      checkoutTotal,
      codMaxAmount,
      isCodAvailableForCart,
      canUseCod
    });
  }, [codEnabled, checkoutTotal, codMaxAmount, isCodAvailableForCart, canUseCod]);

  // React to COD eligibility changes
  useEffect(() => {
    if (!canUseCod && paymentMethod === 'cod') {
      setPaymentMethod('razorpay');
    }
  }, [canUseCod, paymentMethod]);

  const [formData, setFormData] = useState({
    full_name: user?.name || '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'United States',
    phone: user?.phone || '',
  });
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (!user) {
      toast.error('Please login to checkout');
      navigate('/login?redirect=/checkout');
      return;
    }
    if (!isDirectBuy && (!cart.items || cart.items.length === 0)) {
      toast.error('Your cart is empty');
      navigate('/cart');
    }
  }, [user, cart, isDirectBuy, navigate]);


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

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Create order items
      const orderItems = checkoutItems.map(item => ({
        product_id: item.product_id,
        name: item.product?.name || item.name,
        price: item.product?.price || item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        image: item.product?.images?.[0] || item.product?.image || item.image || null,
      }));

      // Calculate final pricing
      let subtotal = checkoutTotal;
      let totalDiscountPercent = globalDiscount;
      if (appliedCoupon) {
        totalDiscountPercent += appliedCoupon.discount;
      }

      const discountAmount = subtotal * (totalDiscountPercent / 100);
      const subtotalAfterDiscount = subtotal - discountAmount;
      const shippingCost = subtotalAfterDiscount >= 50 ? 0 : 5;
      const totalAmount = parseFloat((subtotalAfterDiscount + shippingCost).toFixed(2));

      // Create order
      const orderResponse = await axios.post(`${API}/orders`, {
        discount_applied: Math.round(discountAmount),
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
        items: orderItems,
        total_amount: totalAmount,
        shipping_address: formData,
        payment_method: paymentMethod,
      });

      const orderId = orderResponse.data.id;

      if (paymentMethod === 'cod') {
        // Clear cart or direct buy and redirect to success page directly
        if (isDirectBuy) {
          sessionStorage.removeItem('directBuyItem');
        }
        navigate(`/payment-success?order_id=${orderId}`);
        toast.success(`Order placed successfully using Cash on Delivery!`);
        return; // Prevent fallthrough to Razorpay
      }

      // Create checkout session for Razorpay
      const checkoutResponse = await axios.post(`${API}/razorpay/create-order`, {
        order_id: orderId
      });

      // Initialize Razorpay
      const loadRazorpay = () => {
        return new Promise((resolve) => {
          const script = document.createElement('script');
          script.src = 'https://checkout.razorpay.com/v1/checkout.js';
          script.onload = () => resolve(true);
          script.onerror = () => resolve(false);
          document.body.appendChild(script);
        });
      };

      const res = await loadRazorpay();
      if (!res) {
        toast.error("Razorpay SDK failed to load. Are you online?");
        setLoading(false);
        return;
      }

      const options = {
        key: checkoutResponse.data.key_id,
        amount: checkoutResponse.data.amount,
        currency: checkoutResponse.data.currency,
        name: "LAST GEAR",
        description: "Order Payment",
        order_id: checkoutResponse.data.razorpay_order_id,
        handler: async function (response) {
          try {
            await axios.post(`${API}/razorpay/verify-payment`, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature
            });

            if (isDirectBuy) {
              sessionStorage.removeItem('directBuyItem');
            }
            navigate(`/payment-success?order_id=${orderId}`);
          } catch (err) {
            toast.error("Payment verification failed");
            navigate(`/payment-failed?order_id=${orderId}`);
          }
        },
        prefill: {
          name: formData.full_name,
          contact: formData.phone
        },
        theme: {
          color: "#000000"
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response) {
        toast.error("Payment Failed");
        setLoading(false);
      });
      rzp1.open();
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error(error.response?.data?.detail || 'Checkout failed');
      setLoading(false);
    }
  };

  if (!user || (!isDirectBuy && (!cart.items || cart.items.length === 0))) {
    return null;
  }

  let totalDiscountPercent = globalDiscount;
  if (appliedCoupon) {
    totalDiscountPercent += appliedCoupon.discount;
  }

  const discountAmount = checkoutTotal * (totalDiscountPercent / 100);
  const subtotalAfterDiscount = checkoutTotal - discountAmount;
  const shippingCost = subtotalAfterDiscount >= freeShippingThreshold ? 0 : shippingCharge;
  const totalAmount = subtotalAfterDiscount + shippingCost;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="checkout-page">
      <h1 className="text-4xl font-bold mb-8">CHECKOUT</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12" data-testid="checkout-form">
        {/* Checkout Steps */}
        <div className="lg:col-span-2 space-y-12">
          <div>
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
              <h2 className="text-2xl font-bold">SHIPPING INFORMATION</h2>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="full_name" className="block text-sm font-medium mb-2">
                  FULL NAME *
                </label>
                <input
                  type="text"
                  id="full_name"
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="full-name-input"
                />
              </div>

              <div>
                <label htmlFor="phone" className="block text-sm font-medium mb-2">
                  PHONE *
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="phone-input"
                />
              </div>

              <div>
                <label htmlFor="address_line1" className="block text-sm font-medium mb-2">
                  ADDRESS LINE 1 *
                </label>
                <input
                  type="text"
                  id="address_line1"
                  name="address_line1"
                  value={formData.address_line1}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="address-line1-input"
                />
              </div>

              <div>
                <label htmlFor="address_line2" className="block text-sm font-medium mb-2">
                  ADDRESS LINE 2
                </label>
                <input
                  type="text"
                  id="address_line2"
                  name="address_line2"
                  value={formData.address_line2}
                  onChange={handleChange}
                  className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="address-line2-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="city" className="block text-sm font-medium mb-2">
                    CITY *
                  </label>
                  <input
                    type="text"
                    id="city"
                    name="city"
                    value={formData.city}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="city-input"
                  />
                </div>
                <div>
                  <label htmlFor="state" className="block text-sm font-medium mb-2">
                    STATE *
                  </label>
                  <input
                    type="text"
                    id="state"
                    name="state"
                    value={formData.state}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="state-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="postal_code" className="block text-sm font-medium mb-2">
                    POSTAL CODE *
                  </label>
                  <input
                    type="text"
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="postal-code-input"
                  />
                </div>
                <div>
                  <label htmlFor="country" className="block text-sm font-medium mb-2">
                    COUNTRY *
                  </label>
                  <input
                    type="text"
                    id="country"
                    name="country"
                    value={formData.country}
                    onChange={handleChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="country-input"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Payment Method Section */}
          <div>
            <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-200">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">2</span>
              <h2 className="text-xl font-bold">PAYMENT METHOD</h2>
            </div>
            <div className="space-y-4">
              <label className={`block border ${paymentMethod === 'razorpay' ? 'border-black bg-gray-50' : 'border-gray-200'} p-4 cursor-pointer transition-colors`}>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="payment_method"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300 pointer-events-none"
                  />
                  <span className="ml-3 font-medium">Pay Online (Razorpay)</span>
                </div>
                <p className="ml-7 mt-1 text-sm text-gray-500">Credit Card, Debit Card, Netbanking, UPI</p>
              </label>

              <label className={`block border ${!canUseCod ? 'border-gray-100 opacity-50 cursor-not-allowed bg-gray-50' : paymentMethod === 'cod' ? 'border-black bg-gray-50' : 'border-gray-200'} p-4 ${canUseCod ? 'cursor-pointer hover:bg-gray-50' : ''} transition-colors relative`}>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="payment_method"
                    value="cod"
                    checked={paymentMethod === 'cod'}
                    disabled={!canUseCod}
                    onChange={() => canUseCod && setPaymentMethod('cod')}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300 pointer-events-none disabled:opacity-50"
                  />
                  <span className={`ml-3 font-medium ${!canUseCod ? 'text-gray-400' : ''}`}>Cash on Delivery (COD)</span>
                  {canUseCod && codCharge > 0 && (
                    <span className="ml-auto text-sm font-bold">+₹{codCharge} Fee</span>
                  )}
                </div>
                <p className={`ml-7 mt-1 text-sm ${!canUseCod ? 'text-gray-400' : 'text-gray-500'}`}>Pay in cash when your order is delivered</p>

                {!canUseCod && (
                  <div className="ml-7 mt-2 text-xs text-red-500 font-medium">
                    {!codEnabled ? 'COD is currently disabled' :
                      (checkoutTotal > codMaxAmount) ? `COD not available for orders above ₹${codMaxAmount}` :
                        'COD is not available for one or more items in your cart'}
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-8 sticky top-32" data-testid="order-summary">
            <div className="flex items-center gap-3 mb-6">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">3</span>
              <h2 className="text-2xl font-bold">ORDER SUMMARY</h2>
            </div>
            <div className="space-y-4 mb-6">
              {checkoutItems.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.product?.name || item.name} ({item.size}, {item.color}) x{item.quantity}
                  </span>
                  <span className="font-medium">
                    ${((item.product?.price || item.price) * item.quantity).toFixed(2)}
                  </span>
                </div>
              ))}

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
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">${checkoutTotal.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                    <span className="font-bold">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}

              </div>

              {shippingCost > 0 ? (
                <div className="flex justify-between text-sm py-4 border-b border-gray-200">
                  <span className="text-gray-600">SHIPPING</span>
                  <span className="font-medium">₹{shippingCost.toFixed(2)}</span>
                </div>
              ) : (
                <div className="flex justify-between text-sm py-4 border-b border-gray-200">
                  <span className="text-gray-600">SHIPPING</span>
                  <span className="font-bold text-green-600 uppercase text-xs">Free Shipping</span>
                </div>
              )}

              {paymentMethod === 'cod' && codCharge > 0 && (
                <div className="flex justify-between text-sm py-4 border-b border-gray-200">
                  <span className="text-gray-600">COD CHARGE</span>
                  <span className="font-medium">₹{codCharge.toFixed(2)}</span>
                </div>
              )}

              <div className="flex justify-between text-base font-bold py-4">
                <span>TOTAL</span>
                <span>₹{totalAmount.toFixed(2)}</span>
              </div>

              {/* DEBUG PAYLOAD */}
              <div className="mt-8 p-4 bg-red-100 text-red-900 text-xs font-mono break-all whitespace-pre-wrap rounded">
                DEBUG CAN_USE_COD: {canUseCod ? 'TRUE' : 'FALSE'}<br />
                COD_ENABLED: {codEnabled ? 'TRUE' : 'FALSE'}<br />
                CHECKOUT_TOTAL: {checkoutTotal}<br />
                COD_MAX: {codMaxAmount}<br />
                IS_COD_AVAIL_FOR_CART: {isCodAvailableForCart ? 'TRUE' : 'FALSE'}<br />
                {JSON.stringify(checkoutItems, null, 2)}
              </div>

            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-6 bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400"
            data-testid="place-order-button"
          >
            {loading ? 'PROCESSING...' : 'PLACE ORDER'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Checkout;