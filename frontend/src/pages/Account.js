import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { User as UserIcon, Package, LogOut, Heart, MapPin, ArrowRight, ShoppingBag, Truck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const Account = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('orders');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [orders]
  );

  const latestOrder = sortedOrders[0] || null;
  const latestShippingAddress = latestOrder?.shipping_address || null;

  const formatStatus = (status) => (status || '').replace(/_/g, ' ').toUpperCase();
  const formatDate = (value) =>
    value
      ? new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
      : '---';

  useEffect(() => {
    if (!user) {
      toast.error('Please login to view account');
      navigate('/login?redirect=/account');
      return;
    }
    fetchOrders();
    fetchRecommendations();
  }, [user]);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/orders`);
      setOrders(response.data);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendations = async () => {
    try {
      const response = await axios.get(`${API}/recommendations`);
      setRecommendations(response.data);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="account-page">
      <h1 className="font-puma text-4xl mb-8">MY ACCOUNT</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-black/10 p-6 space-y-5 shadow-[0_18px_50px_-35px_rgba(18,14,11,0.35)]" data-testid="account-sidebar">
            <div className="pb-4 border-b border-gray-300">
              <div className="flex items-center gap-3 mb-2">
                <UserIcon size={20} />
                <span className="font-nav text-base">{user.name}</span>
              </div>
              <p className="text-sm text-gray-600">{user.email}</p>
              {user.phone && <p className="mt-1 text-xs text-gray-500">{user.phone}</p>}
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${activeTab === 'orders' ? 'bg-black text-white' : 'hover:bg-gray-200'
                }`}
              data-testid="orders-tab"
            >
              <Package size={20} />
              <span className="font-medium">My Orders</span>
            </button>
            <button
              onClick={() => navigate('/wishlist')}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-200 transition-colors"
              data-testid="wishlist-tab"
            >
              <Heart size={20} />
              <span className="font-medium">Wishlist</span>
            </button>
            <button
              onClick={() => navigate('/products')}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-200 transition-colors"
              data-testid="continue-shopping-button"
            >
              <ShoppingBag size={20} />
              <span className="font-medium">Continue Shopping</span>
            </button>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-red-600 hover:text-white transition-colors"
              data-testid="logout-button"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>

            {latestShippingAddress && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center gap-2 text-[11px] text-gray-500 uppercase tracking-[0.22em] mb-3">
                  <MapPin size={14} />
                  <span>Recent Delivery</span>
                </div>
                <div className="bg-[#f7f3ed] border border-black/5 p-4 text-sm leading-6">
                  <p className="font-nav text-sm text-black">{latestShippingAddress.full_name}</p>
                  <p className="text-gray-700">{latestShippingAddress.address_line1}</p>
                  {latestShippingAddress.address_line2 && <p className="text-gray-700">{latestShippingAddress.address_line2}</p>}
                  <p className="text-gray-700">
                    {latestShippingAddress.city}, {latestShippingAddress.state} {latestShippingAddress.postal_code}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'orders' && (
            <div data-testid="orders-section">
              {latestOrder && (
                <div className="mb-8 border border-black/10 bg-white p-6 shadow-[0_18px_50px_-35px_rgba(18,14,11,0.25)]">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-[11px] text-gray-500 uppercase tracking-[0.22em]">
                        <Truck size={14} />
                        <span>Latest Order</span>
                      </div>
                      <div>
                        <h2 className="font-puma text-3xl leading-none">
                          {latestOrder.items && latestOrder.items.length > 0 ? latestOrder.items[0].name : latestOrder.id}
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                          {formatDate(latestOrder.created_at)} • {latestOrder.items?.length || 0} Item{latestOrder.items?.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="inline-flex items-center rounded-full bg-black px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
                          {formatStatus(latestOrder.order_status)}
                        </span>
                        <span className="text-lg font-black">₹{Number(latestOrder.total_amount || 0).toFixed(0)}</span>
                      </div>
                    </div>

                    <Link
                      to={`/account/orders/${latestOrder.id}`}
                      className="inline-flex items-center justify-center gap-2 border border-black bg-black px-6 py-3 font-nav text-sm text-white transition-colors hover:bg-white hover:text-black"
                    >
                      Track Latest Order
                      <ArrowRight size={16} />
                    </Link>
                  </div>
                </div>
              )}

              <h2 className="font-puma text-2xl mb-6">ORDER HISTORY</h2>
              {loading ? (
                <div className="text-center py-12">Loading orders...</div>
              ) : sortedOrders.length === 0 ? (
                <div className="text-center py-12" data-testid="no-orders">
                  <Package size={48} className="mx-auto mb-4 text-gray-400" />
                  <p className="text-xl text-gray-600 mb-4">No orders yet</p>
                  <button
                    onClick={() => navigate('/products')}
                    className="bg-black text-white px-8 py-3 font-bold uppercase tracking-wider hover:bg-gray-800"
                  >
                    Start Shopping
                  </button>
                </div>
              ) : (
                <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  {sortedOrders.map((order) => (
                    <Link
                      to={`/account/orders/${order.id}`}
                      key={order.id}
                      className="block border border-gray-200 p-5 rounded bg-white hover:border-black hover:shadow-md transition-all cursor-pointer group mb-4"
                      data-testid={`order-${order.id}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex flex-col gap-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                            <span className="font-bold text-sm md:text-base uppercase group-hover:text-[#ff003c] transition-colors">
                              {order.items && order.items.length > 0
                                ? (order.items.length === 1 ? order.items[0].name : `${order.items[0].name} + ${order.items.length - 1} MORE`)
                                : order.id}
                            </span>
                            <span className="inline-block flex-shrink-0 px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-gray-100 text-gray-800 tracking-wider">
                              {formatStatus(order.order_status)}
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 font-mono">
                            {formatDate(order.created_at)} • {order.items.length} Item{order.items.length !== 1 ? 's' : ''}
                          </span>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-6 border-t border-gray-100 sm:border-0 pt-3 sm:pt-0">
                          <span className="text-lg font-black font-mono">
                            ₹{order.total_amount?.toFixed(0) || 0}
                          </span>
                          <span className="text-xs font-bold uppercase tracking-widest text-[#ff003c] group-hover:translate-x-1 transition-transform">
                            VIEW DETAILS &gt;
                          </span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-16" data-testid="recommendations-section">
          <h2 className="text-3xl font-bold mb-8">RECOMMENDED FOR YOU</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12">
            {recommendations.map((product) => (
              <button
                key={product.id}
                onClick={() => navigate(`/products/${product.id}`)}
                className="product-card text-left"
                data-testid={`recommendation-${product.id}`}
              >
                <div className="aspect-[4/5] bg-white mb-4 overflow-hidden">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-gray-500 mb-1">{product.colors.length} COLOR{product.colors.length > 1 ? 'S' : ''}</p>
                <h3 className="font-bold text-sm mb-1">{product.name}</h3>
                <p className="font-medium">₹{product.price.toFixed(0)}</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Account;
