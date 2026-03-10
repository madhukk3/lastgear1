import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

const Cart = () => {
  const { cart, cartTotal, removeFromCart, loading: cartLoading } = useCart();
  const { user } = useAuth();
  const { globalDiscount, shippingCharge, freeShippingThreshold } = useSettings() || { globalDiscount: 0, shippingCharge: 99, freeShippingThreshold: 1500 };
  const navigate = useNavigate();

  const handleRemoveItem = async (item) => {
    try {
      await removeFromCart(item.product_id, item.size, item.color);
      toast.success('Item removed from cart');
    } catch (error) {
      toast.error('Failed to remove item');
    }
  };

  const handleCheckout = () => {
    if (!user) {
      toast.error('Please login to checkout');
      navigate('/login?redirect=/checkout');
      return;
    }
    navigate('/checkout');
  };

  if (cartLoading) {
    return <div className="max-w-7xl mx-auto px-4 py-20 text-center">Loading...</div>;
  }

  const isFirstPurchaseEligible = user?.has_used_first_purchase_discount === false;
  let baseDiscountPercent = globalDiscount || 0;
  if (isFirstPurchaseEligible) {
    baseDiscountPercent += 5;
  }

  let discountAmount = 0;
  if (cart.items) {
    cart.items.forEach(item => {
      let itemDiscountPercent = baseDiscountPercent + (item.product?.discount_percentage || 0);
      if (itemDiscountPercent > 100) itemDiscountPercent = 100;
      const itemSubtotal = item.product.price * item.quantity;
      discountAmount += itemSubtotal * (itemDiscountPercent / 100);
    });
  }
  const subtotalAfterDiscount = cartTotal - discountAmount;
  const hasFreeShippingItem = cart.items && cart.items.some(item => item.product?.is_free_shipping);
  const shippingCost = hasFreeShippingItem || subtotalAfterDiscount >= freeShippingThreshold ? 0 : shippingCharge;
  const totalAmount = subtotalAfterDiscount + shippingCost;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="cart-page">
      <h1 className="text-4xl font-bold mb-8">SHOPPING CART</h1>

      {!cart.items || cart.items.length === 0 ? (
        <div className="text-center py-20" data-testid="empty-cart">
          <ShoppingBag size={64} className="mx-auto mb-4 text-gray-400" />
          <p className="text-xl text-gray-600 mb-6">Your cart is empty</p>
          <Link
            to="/products"
            className="inline-block bg-black text-white px-12 py-4 font-bold uppercase tracking-wider hover:bg-gray-800"
            data-testid="continue-shopping"
          >
            Continue Shopping
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-6" data-testid="cart-items">
            {cart.items.map((item, index) => (
              <div
                key={`${item.product_id}-${item.size}-${item.color}`}
                className="flex gap-6 border-b border-gray-200 pb-6"
                data-testid={`cart-item-${index}`}
              >
                <div className="w-32 h-40 bg-gray-100 flex-shrink-0">
                  <img
                    src={item.product?.images[0]}
                    alt={item.product?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-2">{item.product?.name}</h3>
                  <p className="text-sm text-gray-600 mb-1">Size: {item.size}</p>
                  <p className="text-sm text-gray-600 mb-2">Color: {item.color}</p>
                  <p className="text-sm text-gray-600 mb-4">Quantity: {item.quantity}</p>
                  <p className="text-lg font-bold">₹{(item.product?.price * item.quantity).toFixed(0)}</p>
                </div>
                <button
                  onClick={() => handleRemoveItem(item)}
                  className="text-gray-400 hover:text-red-600 transition-colors"
                  data-testid={`remove-item-${index}`}
                >
                  <Trash2 size={20} />
                </button>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 p-8 sticky top-32" data-testid="order-summary">
              <h2 className="text-2xl font-bold mb-6">ORDER SUMMARY</h2>
              <div className="space-y-4 mb-6">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span className="font-bold">₹{cartTotal.toFixed(0)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Discount Included {(isFirstPurchaseEligible || discountAmount > (cartTotal * ((globalDiscount || 0) / 100))) ? '(incl. Promos)' : ''}</span>
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
                {shippingCost === 0 && !hasFreeShippingItem && subtotalAfterDiscount >= freeShippingThreshold && (
                  <p className="text-xs text-green-600">Free shipping applied (over ₹{freeShippingThreshold})</p>
                )}
                {shippingCost === 0 && hasFreeShippingItem && (
                  <p className="text-xs text-green-600">Free shipping item in cart!</p>
                )}
                <div className="border-t border-gray-300 pt-4">
                  <div className="flex justify-between text-xl">
                    <span className="font-bold">Total</span>
                    <span className="font-bold">
                      ₹{totalAmount.toFixed(0)}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleCheckout}
                className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors mb-4"
                data-testid="checkout-button"
              >
                Proceed to Checkout
              </button>
              <Link
                to="/products"
                className="block text-center text-sm underline hover:no-underline"
                data-testid="continue-shopping-link"
              >
                Continue Shopping
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;