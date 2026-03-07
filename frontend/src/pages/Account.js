import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User as UserIcon, Package, LogOut, Heart } from 'lucide-react';
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
      <h1 className="text-4xl font-bold mb-8">MY ACCOUNT</h1>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="bg-gray-50 p-6 space-y-4" data-testid="account-sidebar">
            <div className="pb-4 border-b border-gray-300">
              <div className="flex items-center gap-3 mb-2">
                <UserIcon size={20} />
                <span className="font-bold">{user.name}</span>
              </div>
              <p className="text-sm text-gray-600">{user.email}</p>
            </div>
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full text-left px-4 py-3 flex items-center gap-3 transition-colors ${
                activeTab === 'orders' ? 'bg-black text-white' : 'hover:bg-gray-200'
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
              onClick={handleLogout}
              className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-red-600 hover:text-white transition-colors"
              data-testid="logout-button"
            >
              <LogOut size={20} />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          {activeTab === 'orders' && (
            <div data-testid="orders-section">
              <h2 className="text-2xl font-bold mb-6">ORDER HISTORY</h2>
              {loading ? (
                <div className="text-center py-12">Loading orders...</div>
              ) : orders.length === 0 ? (
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
                <div className="space-y-6">
                  {orders.map((order) => (
                    <div
                      key={order.id}
                      className="border border-gray-200 p-6"
                      data-testid={`order-${order.id}`}
                    >
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Order ID</p>
                          <p className="font-bold">{order.id}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Order Date</p>
                          <p className="font-medium">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Payment Status</p>
                          <span
                            className={`inline-block px-3 py-1 text-xs font-bold uppercase ${
                              order.payment_status === 'paid'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {order.payment_status}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-600">Order Status</p>
                          <span className="inline-block px-3 py-1 text-xs font-bold uppercase bg-blue-100 text-blue-800">
                            {order.order_status}
                          </span>
                        </div>
                      </div>
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm text-gray-600 mb-2">Items</p>
                        {order.items.map((item, idx) => (
                          <p key={idx} className="text-sm">
                            {item.name} - Size: {item.size}, Color: {item.color} (x{item.quantity})
                          </p>
                        ))}
                      </div>
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <div className="flex justify-between text-xl font-bold">
                          <span>Total</span>
                          <span>₹{order.total_amount.toFixed(0)}</span>
                        </div>
                      </div>
                    </div>
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