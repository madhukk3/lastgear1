import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

// Load Razorpay script
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

const Checkout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { cart, cartTotal } = useCart();
  const { user } = useAuth();
  const { globalDiscount, shippingCharge, freeShippingThreshold, codEnabled, codMaxAmount, codCharge } = useSettings() || { globalDiscount: 0, shippingCharge: 99, freeShippingThreshold: 1500, codEnabled: true, codMaxAmount: 3000, codCharge: 50 };
  const [loading, setLoading] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponError, setCouponError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('razorpay');

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

  // Verify if COD is available for this specific cart
  const isCodAvailableForCart = checkoutItems ? checkoutItems.every(item => item.product?.cod_available !== false) : false;

  // Master COD eligibility check
  const canUseCod = codEnabled && (checkoutTotal <= codMaxAmount) && isCodAvailableForCart;

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
    country: 'India',
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

  const buildCheckoutPricing = () => {
    let combinedBaseDiscount = globalDiscount || 0;
    if (appliedCoupon) {
      combinedBaseDiscount += appliedCoupon.discount;
    }

    const isFirstPurchaseEligible = user?.has_used_first_purchase_discount === false;
    if (isFirstPurchaseEligible) {
      combinedBaseDiscount += 5;
    }

    let rawDiscountAmount = 0;
    if (checkoutItems) {
      checkoutItems.forEach((item) => {
        const productObj = item.product || item;
        let itemDiscountPercent = combinedBaseDiscount + (productObj.discount_percentage || 0);
        if (itemDiscountPercent > 100) itemDiscountPercent = 100;
        const itemSubtotal = (productObj.price || item.price) * item.quantity;
        rawDiscountAmount += itemSubtotal * (itemDiscountPercent / 100);
      });
    }

    const computedDiscountAmount = Math.round(rawDiscountAmount);
    const subtotalAfterDiscountValue = checkoutTotal - computedDiscountAmount;
    const hasFreeShippingItem = checkoutItems && checkoutItems.some((item) => (item.product || item)?.is_free_shipping);
    const computedShippingCost = hasFreeShippingItem || subtotalAfterDiscountValue >= freeShippingThreshold ? 0 : shippingCharge;
    const computedCodCharge = paymentMethod === 'cod' ? codCharge : 0;
    const computedTotal = subtotalAfterDiscountValue + computedShippingCost + computedCodCharge;

    return {
      discountAmount: computedDiscountAmount,
      subtotalAfterDiscount: subtotalAfterDiscountValue,
      shippingCost: computedShippingCost,
      currentCodCharge: computedCodCharge,
      totalAmount: computedTotal,
    };
  };

  const handleRazorpayPayment = async (orderId, razorpayOrderId, amount, keyId) => {
    const res = await loadRazorpayScript();

    if (!res) {
      toast.error('Razorpay SDK failed to load. Please check your internet connection.');
      return;
    }

    const options = {
      key: keyId,
      amount: amount,
      currency: 'INR',
      name: 'LAST GEAR',
      description: 'Premium Streetwear',
      order_id: razorpayOrderId,
      handler: async function (response) {
        try {
          // Verify payment
          const verifyResponse = await axios.post(`${API}/razorpay/verify-payment`, {
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });

          if (isDirectBuy) sessionStorage.removeItem('directBuyItem');
          toast.success('Payment successful!');
          navigate(`/order-success?order_id=${verifyResponse.data.order_id}`);
        } catch (error) {
          console.error('Payment verification failed:', error);
          toast.error('Payment verification failed');
        }
      },
      prefill: {
        name: formData.full_name,
        email: user.email,
        contact: formData.phone,
      },
      notes: {
        address: `${formData.address_line1}, ${formData.city}, ${formData.state} - ${formData.postal_code}`,
      },
      theme: {
        color: '#000000',
      },
      modal: {
        ondismiss: function () {
          toast.error('Payment cancelled');
          setLoading(false);
        },
      },
    };

    const razorpayInstance = new window.Razorpay(options);
    razorpayInstance.open();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);

      // Create order items
      const orderItems = checkoutItems.map(item => ({
        product_id: item.product_id || item.product?.id,
        name: item.product?.name || item.name,
        price: item.product?.price || item.price,
        quantity: item.quantity,
        size: item.size,
        color: item.color,
        image: item.product?.images?.[0] || item.product?.image || item.image || null,
      }));


      const { discountAmount, totalAmount } = buildCheckoutPricing();

      // Create order
      const orderResponse = await axios.post(`${API}/orders`, {
        discount_applied: discountAmount,
        coupon_code: appliedCoupon ? appliedCoupon.code : null,
        items: orderItems,
        total_amount: totalAmount,
        shipping_address: formData,
        payment_method: paymentMethod,
      });

      const orderId = orderResponse.data.id;

      if (paymentMethod === 'cod') {
        if (isDirectBuy) sessionStorage.removeItem('directBuyItem');
        navigate(`/order-success?order_id=${orderId}`);
        toast.success(`Order placed successfully using Cash on Delivery!`);
        return;
      }

      // Create Razorpay order
      const razorpayResponse = await axios.post(`${API}/razorpay/create-order`, {
        order_id: orderId,
      });

      // Open Razorpay checkout
      await handleRazorpayPayment(
        orderId,
        razorpayResponse.data.razorpay_order_id,
        razorpayResponse.data.amount,
        razorpayResponse.data.key_id
      );
    } catch (error) {
      console.error('Checkout failed:', error);
      toast.error(error.response?.data?.detail || 'Checkout failed');
      setLoading(false);
    }
  };

  if (!user || (!isDirectBuy && (!cart.items || cart.items.length === 0))) {
    return null;
  }

  const isFirstPurchaseEligible = user?.has_used_first_purchase_discount === false;
  const { discountAmount, subtotalAfterDiscount, shippingCost, totalAmount } = buildCheckoutPricing();

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="checkout-page">
      <h1 className="text-4xl font-bold mb-8">CHECKOUT</h1>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-12" data-testid="checkout-form">
        {/* Checkout Steps */}
        <div className="lg:col-span-2 space-y-8">
          <div>
            <div className="flex items-center gap-3 mb-6 basis-full">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</span>
              <h2 className="text-2xl font-bold uppercase tracking-wide">SHIPPING INFORMATION</h2>
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
                  placeholder="+91-XXXXXXXXXX"
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
                    PIN CODE *
                  </label>
                  <input
                    type="text"
                    id="postal_code"
                    name="postal_code"
                    value={formData.postal_code}
                    onChange={handleChange}
                    required
                    maxLength="6"
                    pattern="[0-9]{6}"
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
                    readOnly
                    className="w-full px-4 py-3 border border-gray-300 bg-gray-50 focus:outline-none"
                    data-testid="country-input"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-12 mt-12">
            <div className="flex items-center gap-3 mb-6 pb-2 border-b border-gray-200">
              <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">2</span>
              <h2 className="text-xl font-bold uppercase tracking-wide">PAYMENT METHOD</h2>
            </div>
            <div className="space-y-4">
              <label className={`block border ${paymentMethod === 'razorpay' ? 'border-black' : 'border-gray-200'} p-5 cursor-pointer transition-colors`}>
                <div className="flex items-center">
                  <input
                    type="radio"
                    name="payment_method"
                    value="razorpay"
                    checked={paymentMethod === 'razorpay'}
                    onChange={() => setPaymentMethod('razorpay')}
                    className="h-4 w-4 text-black focus:ring-black border-gray-300 pointer-events-none"
                  />
                  <span className="ml-4 font-bold">UPI & Cards - Secure Online Payment</span>
                </div>
              </label>

              <label className={`block border ${!canUseCod ? 'border-gray-100 opacity-50 cursor-not-allowed bg-gray-50' : paymentMethod === 'cod' ? 'border-black' : 'border-gray-200'} p-5 ${canUseCod ? 'cursor-pointer hover:border-gray-300' : ''} transition-colors relative`}>
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
                  <span className={`ml-4 font-bold ${!canUseCod ? 'text-gray-400' : ''}`}>Cash on Delivery (COD)</span>
                  {canUseCod && codCharge > 0 && (
                    <span className="ml-auto text-sm font-bold text-gray-600">+₹{codCharge} Fee</span>
                  )}
                </div>

                {!canUseCod && (
                  <div className="ml-8 mt-2 text-xs text-red-500 font-medium">
                    {!codEnabled ? 'COD is currently disabled' :
                      (cartTotal > codMaxAmount) ? `COD not available for orders above ₹${codMaxAmount}` :
                        'COD is not available for one or more items in your cart'}
                  </div>
                )}
              </label>
            </div>
          </div>
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 lg:top-32 h-fit max-h-[calc(100vh-6rem)] overflow-y-auto pr-2 custom-scrollbar">
            <div className="bg-gray-50 p-8" data-testid="order-summary">
              <div className="flex items-center gap-3 mb-6">
                <span className="bg-black text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">3</span>
                <h2 className="text-xl font-bold uppercase tracking-wide">ORDER SUMMARY</h2>
              </div>
              <div className="space-y-4 mb-6">
                {checkoutItems.map((item, index) => {
                  const productObj = item.product || item;
                  return (
                    <div key={index} className="flex justify-between text-sm">
                      <span>
                        {productObj.name || item.name} ({item.size}, {item.color}) x{item.quantity}
                      </span>
                      <span className="font-medium">
                        ₹{((productObj.price || item.price) * item.quantity).toFixed(0)}
                      </span>
                    </div>
                  )
                })}

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
                  {isFirstPurchaseEligible && (
                    <div className="mt-2 text-xs text-purple-700 bg-purple-50 p-2 rounded border border-purple-100 flex items-center justify-between">
                      <span>✨ First Purchase Bonus</span>
                      <span className="font-bold border border-purple-600 px-1 rounded bg-white">-5%</span>
                    </div>
                  )}
                  {globalDiscount > 0 && !appliedCoupon && !isFirstPurchaseEligible && (
                    <div className="mt-2 text-xs text-green-700 bg-green-50 p-2 rounded border border-green-100 flex items-center justify-between">
                      <span>✨ Storewide Discount Active</span>
                      <span className="font-bold border border-green-600 px-1 rounded bg-white">-{globalDiscount}%</span>
                    </div>
                  )}
                </div>

                <div className="border-t border-gray-300 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="font-bold">₹{checkoutTotal.toFixed(0)}</span>
                  </div>

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount {appliedCoupon ? `(${appliedCoupon.code})` : ''}</span>
                      <span className="font-bold">-₹{discountAmount.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>Shipping</span>
                    <span className="font-bold">{shippingCost === 0 ? 'FREE' : `₹${shippingCost}`}</span>
                  </div>
                  {shippingCost > 0 && subtotalAfterDiscount < freeShippingThreshold && (
                    <p className="text-xs text-green-600">Add ₹{(freeShippingThreshold - subtotalAfterDiscount).toFixed(0)} more for FREE shipping!</p>
                  )}

                  {paymentMethod === 'cod' && codCharge > 0 && (
                    <div className="flex justify-between">
                      <span>COD Fee</span>
                      <span className="font-bold">₹{codCharge.toFixed(0)}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-xl pt-4 border-t border-gray-300">
                    <span className="font-bold">Total</span>
                    <span className="font-bold">₹{totalAmount.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-6 pb-6 w-full">
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#181818] text-white py-4 font-bold tracking-wider hover:bg-black transition-colors disabled:bg-gray-400 shadow-md hover:shadow-lg"
                data-testid="place-order-button"
              >
                {loading ? 'PROCESSING...' : 'PLACE ORDER'}
              </button>
              <p className="text-xs text-gray-500 mt-4 leading-relaxed text-center">
                By continuing, I confirm that I have read and accept the <span className="underline cursor-pointer hover:text-black">Terms and Conditions</span> and the <span className="underline cursor-pointer hover:text-black">Privacy Policy</span>.
              </p>
            </div>
          </div>
        </div>
      </form >
    </div >
  );
};

export default Checkout;
