import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

const Checkout = () => {
  const navigate = useNavigate();
  const { cart, cartTotal } = useCart();
  const { user } = useAuth();
  const { globalDiscount, shippingCharge, freeShippingThreshold } = useSettings() || { globalDiscount: 0, shippingCharge: 99, freeShippingThreshold: 1500 };
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');

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
    if (!cart.items || cart.items.length === 0) {
      toast.error('Your cart is empty');
      navigate('/cart');
    }
  }, [user, cart]);


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
      const orderItems = cart.items.map(item => ({
        product_id: item.product_id,
        name: item.product?.name,
        price: item.product?.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
      }));


      // Calculate final pricing
      let subtotal = cartTotal;
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
      });

      const orderId = orderResponse.data.id;

      // Create checkout session
      const originUrl = window.location.origin;
      const checkoutResponse = await axios.post(`${API}/checkout/session`, {
        order_id: orderId,
        origin_url: originUrl,
      });

      // Redirect to Stripe
      window.location.href = checkoutResponse.data.url;
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error(error.response?.data?.detail || 'Checkout failed');
      setLoading(false);
    }
  };

  if (!user || !cart.items || cart.items.length === 0) {
    return null;
  }

  let totalDiscountPercent = globalDiscount;
  if (appliedCoupon) {
    totalDiscountPercent += appliedCoupon.discount;
  }

  const discountAmount = cartTotal * (totalDiscountPercent / 100);
  const subtotalAfterDiscount = cartTotal - discountAmount;
  const shippingCost = subtotalAfterDiscount >= 50 ? 0 : 5;
  const totalAmount = subtotalAfterDiscount + shippingCost;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="checkout-page">
      <h1 className="text-4xl font-bold mb-8">CHECKOUT</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        {/* Checkout Form */}
        <div className="lg:col-span-2">
          <form onSubmit={handleSubmit} className="space-y-6" data-testid="checkout-form">
            <div>
              <h2 className="text-2xl font-bold mb-6">SHIPPING INFORMATION</h2>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400"
              data-testid="place-order-button"
            >
              {loading ? 'PROCESSING...' : 'PROCEED TO PAYMENT'}
            </button>
          </form>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-8 sticky top-32" data-testid="order-summary">
            <h2 className="text-2xl font-bold mb-6">ORDER SUMMARY</h2>
            <div className="space-y-4 mb-6">
              {cart.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span>
                    {item.product?.name} ({item.size}, {item.color}) x{item.quantity}
                  </span>
                  <span className="font-medium">
                    ${(item.product?.price * item.quantity).toFixed(2)}
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
                  <span className="font-bold">${cartTotal.toFixed(2)}</span>
                </div>

                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                    <span className="font-bold">-${discountAmount.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="font-bold">{shippingCost === 0 ? 'FREE' : `$${shippingCost.toFixed(2)}`}</span>
                </div>
                <div className="flex justify-between text-xl pt-4 border-t border-gray-300">
                  <span className="font-bold">Total</span>
                  <span className="font-bold">${totalAmount.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;