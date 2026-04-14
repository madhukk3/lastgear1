import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import {
  User as UserIcon,
  Package,
  LogOut,
  Heart,
  MapPin,
  ArrowRight,
  ShoppingBag,
  Truck,
  SlidersHorizontal,
  ChevronDown,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const ORDER_RANGE_OPTIONS = [
  { value: 'last_6_months', label: 'Last six months' },
  { value: 'last_12_months', label: 'Last twelve months' },
  { value: 'all', label: 'All time' },
];

const Account = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [orders, setOrders] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [wishlist, setWishlist] = useState({ products: [] });
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addressLoading, setAddressLoading] = useState(true);
  const [addressSubmitting, setAddressSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingAddressId, setEditingAddressId] = useState(null);
  const [orderRange, setOrderRange] = useState('last_6_months');
  const [addressForm, setAddressForm] = useState({
    label: 'Home',
    full_name: user?.name || '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'India',
    phone: user?.phone || '',
    is_default: false,
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
    [orders]
  );

  const filteredOrders = useMemo(() => {
    if (orderRange === 'all') {
      return sortedOrders;
    }

    const now = new Date();
    const months = orderRange === 'last_12_months' ? 12 : 6;
    const cutoff = new Date(now.getFullYear(), now.getMonth() - months, now.getDate());
    return sortedOrders.filter((order) => new Date(order.created_at) >= cutoff);
  }, [orderRange, sortedOrders]);

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
    fetchSavedAddresses();
    fetchWishlistPreview();
    loadRecentlyViewed();
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
      setRecommendations(response.data || []);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    }
  };

  const fetchWishlistPreview = async () => {
    try {
      const response = await axios.get(`${API}/wishlist`);
      setWishlist(response.data || { products: [] });
    } catch (error) {
      console.error('Failed to fetch wishlist preview:', error);
    }
  };

  const loadRecentlyViewed = () => {
    try {
      const savedProducts = JSON.parse(localStorage.getItem('lastgear_recently_viewed') || '[]');
      setRecentlyViewed(Array.isArray(savedProducts) ? savedProducts : []);
    } catch (error) {
      console.error('Failed to read recently viewed products:', error);
      setRecentlyViewed([]);
    }
  };

  const fetchSavedAddresses = async () => {
    try {
      const response = await axios.get(`${API}/account/addresses`);
      setSavedAddresses(response.data || []);
    } catch (error) {
      console.error('Failed to fetch saved addresses:', error);
      toast.error('Failed to load saved addresses');
    } finally {
      setAddressLoading(false);
    }
  };

  const resetAddressForm = () => {
    setEditingAddressId(null);
    setAddressForm({
      label: 'Home',
      full_name: user?.name || '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      country: 'India',
      phone: user?.phone || '',
      is_default: savedAddresses.length === 0,
    });
  };

  const handleAddressChange = (e) => {
    const { name, value, type, checked } = e.target;
    setAddressForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSaveAddress = async (e) => {
    e.preventDefault();
    setAddressSubmitting(true);
    try {
      if (editingAddressId) {
        await axios.put(`${API}/account/addresses/${editingAddressId}`, addressForm);
        toast.success('Address updated');
      } else {
        await axios.post(`${API}/account/addresses`, addressForm);
        toast.success('Address saved');
      }
      await fetchSavedAddresses();
      resetAddressForm();
    } catch (error) {
      console.error('Failed to save address:', error);
      toast.error(error.response?.data?.detail || 'Failed to save address');
    } finally {
      setAddressSubmitting(false);
    }
  };

  const handleEditAddress = (address) => {
    setActiveTab('addresses');
    setEditingAddressId(address.id);
    setAddressForm({
      label: address.label || 'Home',
      full_name: address.full_name || '',
      address_line1: address.address_line1 || '',
      address_line2: address.address_line2 || '',
      city: address.city || '',
      state: address.state || '',
      postal_code: address.postal_code || '',
      country: address.country || 'India',
      phone: address.phone || '',
      is_default: !!address.is_default,
    });
  };

  const handleDeleteAddress = async (addressId) => {
    if (!window.confirm('Remove this saved address?')) return;
    try {
      await axios.delete(`${API}/account/addresses/${addressId}`);
      toast.success('Address removed');
      await fetchSavedAddresses();
      if (editingAddressId === addressId) {
        resetAddressForm();
      }
    } catch (error) {
      console.error('Failed to delete address:', error);
      toast.error(error.response?.data?.detail || 'Failed to remove address');
    }
  };

  const handleSetDefaultAddress = async (addressId) => {
    try {
      const response = await axios.patch(`${API}/account/addresses/${addressId}/default`);
      setSavedAddresses(response.data || []);
      toast.success('Default address updated');
    } catch (error) {
      console.error('Failed to set default address:', error);
      toast.error(error.response?.data?.detail || 'Failed to update default address');
    }
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/');
  };

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const sidebarItems = [
    { id: 'overview', label: 'Account Overview', icon: UserIcon },
    { id: 'orders', label: 'My Orders', icon: Package },
    { id: 'wishlist', label: 'Wishlist', icon: Heart },
    { id: 'addresses', label: 'Addresses', icon: MapPin },
    { id: 'settings', label: 'Account Settings', icon: SlidersHorizontal },
  ];

  if (!user) {
    return null;
  }

  const showMobileSectionView = activeTab !== 'overview';

  const renderProductGrid = (products, testIdPrefix) => (
    <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
      {products.map((product) => (
        <button
          key={product.id}
          onClick={() => navigate(`/products/${product.id}`)}
          className="text-left group"
          data-testid={`${testIdPrefix}-${product.id}`}
        >
          <div className="aspect-[4/5] overflow-hidden bg-[#f4efe7]">
            <img
              src={product.images?.[0]}
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
            />
          </div>
          <div className="pt-3">
            <p className="font-nav text-[11px] text-black/40">
              {product.colors?.length || 0} color{(product.colors?.length || 0) !== 1 ? 's' : ''}
            </p>
            <h3 className="mt-1 font-nav text-lg leading-none text-[#16120d]">{product.name}</h3>
            <p className="mt-2 text-sm font-semibold text-[#16120d]">₹{Number(product.price || 0).toFixed(0)}</p>
          </div>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-white" data-testid="account-page">
      <div className="mx-auto max-w-[1600px]">
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr]">
          <aside className={`${showMobileSectionView ? 'hidden lg:block' : 'block'} bg-[#f5f5f5] px-5 py-8 lg:min-h-[calc(100vh-220px)]`}>
            <div className="space-y-2">
              {sidebarItems.slice(0, 1).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`flex w-full items-center gap-4 border-l-2 px-4 py-4 text-left transition-colors ${
                      isActive
                        ? 'border-black bg-white font-semibold text-[#16120d]'
                        : 'border-transparent text-[#16120d] hover:bg-white/70'
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.9} />
                    <span className="font-nav text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 space-y-2">
              {sidebarItems.slice(1).map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleTabChange(item.id)}
                    className={`flex w-full items-center gap-4 border-l-2 px-4 py-4 text-left transition-colors ${
                      isActive
                        ? 'border-black bg-white font-semibold text-[#16120d]'
                        : 'border-transparent text-[#16120d] hover:bg-white/70'
                    }`}
                  >
                    <Icon size={20} strokeWidth={1.9} />
                    <span className="font-nav text-sm">{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="mt-10 px-2">
              <p className="font-nav text-xl text-[#16120d]">Need Help?</p>
              <Link to="/help" className="mt-3 inline-flex text-sm text-black/60 underline underline-offset-4">
                Contact Support
              </Link>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="mt-10 px-2 font-nav text-sm text-[#16120d] underline underline-offset-4"
            >
              Logout
            </button>
          </aside>

          <main className="px-6 py-8 md:px-10 lg:px-12">
            {showMobileSectionView && (
              <button
                type="button"
                onClick={() => handleTabChange('overview')}
                className="mb-5 inline-flex items-center gap-2 text-sm text-[#16120d] lg:hidden"
              >
                <span>&lt;</span>
                <span>My Account</span>
              </button>
            )}

            {activeTab === 'overview' && (
              <section data-testid="account-overview-section">
                <div className="mb-10">
                  <h1 className="text-[2.2rem] font-semibold leading-none text-[#16120d] md:text-[3.6rem]">Hello, {user.name}</h1>
                </div>

                {latestOrder && (
                  <div className="mb-12 grid gap-6 border border-black/10 p-6 md:grid-cols-[1.1fr_auto]">
                    <div>
                      <p className="font-nav text-xs text-black/45">Latest order</p>
                      <h2 className="mt-3 text-[1.65rem] font-semibold leading-tight text-[#16120d] md:text-[2.3rem]">
                        {latestOrder.items?.length === 1 ? latestOrder.items[0].name : latestOrder.id}
                      </h2>
                      <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-black/58">
                        <span>{formatDate(latestOrder.created_at)}</span>
                        <span>•</span>
                        <span>{formatStatus(latestOrder.order_status)}</span>
                        <span>•</span>
                        <span>₹{Number(latestOrder.total_amount || 0).toFixed(0)}</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-3 md:items-end">
                      <Link
                        to={`/account/orders/${latestOrder.id}`}
                        className="inline-flex items-center gap-2 border border-black px-5 py-3 text-sm font-medium text-[#16120d] transition-colors hover:bg-black hover:text-white"
                      >
                        Track latest order
                        <ArrowRight size={16} />
                      </Link>
                      <button
                        type="button"
                        onClick={() => setActiveTab('addresses')}
                        className="inline-flex items-center gap-2 border border-black/15 px-5 py-3 text-sm font-medium text-[#16120d] transition-colors hover:border-black"
                      >
                        Manage addresses
                        <MapPin size={16} />
                      </button>
                    </div>
                  </div>
                )}

                <div className="mb-14">
                  <h2 className="text-[1.6rem] font-semibold leading-none text-[#16120d]">Trending Now</h2>
                  <div className="mt-8">
                    {recommendations.length > 0 ? (
                      renderProductGrid(recommendations.slice(0, 4), 'recommendation')
                    ) : (
                      <p className="text-black/55">Fresh picks will appear here soon.</p>
                    )}
                  </div>
                </div>

                <div>
                  <h2 className="text-[1.6rem] font-semibold leading-none text-[#16120d]">Recently Viewed By You</h2>
                  <div className="mt-8">
                    {recentlyViewed.length > 0 ? (
                      renderProductGrid(recentlyViewed.slice(0, 4), 'recently-viewed')
                    ) : (
                      <p className="text-black/55">Browse a few products and they will show up here.</p>
                    )}
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'orders' && (
              <section data-testid="orders-section">
                <div className="mb-8">
                  <p className="text-base font-semibold text-[#16120d] md:text-lg">Order history</p>
                  <h1 className="mt-2 text-[2.2rem] font-semibold leading-none text-[#16120d] md:text-[3rem]">My Orders</h1>
                </div>

                <div className="mb-8">
                  <label className="mb-2 block font-nav text-xs text-[#16120d]">SELECT DATE</label>
                  <div className="relative">
                    <select
                      value={orderRange}
                      onChange={(e) => setOrderRange(e.target.value)}
                      className="w-full appearance-none border border-black/20 bg-white px-4 py-4 pr-12 text-lg text-[#16120d] outline-none transition-colors focus:border-black md:px-5 md:py-5 md:text-xl"
                    >
                      {ORDER_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-black/70 md:right-5" size={22} />
                  </div>
                </div>

                {loading ? (
                  <div className="py-10 text-black/55">Loading orders...</div>
                ) : filteredOrders.length === 0 ? (
                  <div className="space-y-12 py-4">
                    <p className="text-2xl font-semibold text-[#16120d]">No orders found for that time period</p>
                    <button
                      type="button"
                      onClick={() => setActiveTab('overview')}
                      className="font-nav text-xl text-[#16120d] underline underline-offset-4"
                    >
                      Return to My Account
                    </button>
                  </div>
                ) : (
                  <div className="space-y-5">
                    {filteredOrders.map((order) => (
                      <Link
                        to={`/account/orders/${order.id}`}
                        key={order.id}
                        className="block border border-black/10 p-5 transition-colors hover:border-black md:p-6"
                        data-testid={`order-${order.id}`}
                      >
                      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                              <p className="text-xl font-bold leading-none text-[#16120d] md:text-2xl">
                                {order.items?.length === 1 ? order.items[0].name : `${order.items?.[0]?.name || order.id} + ${Math.max((order.items?.length || 1) - 1, 0)} more`}
                              </p>
                              <span className="rounded-full bg-[#f2f2f2] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-black/60">
                                {formatStatus(order.order_status)}
                              </span>
                          </div>
                            <p className="mt-2 text-xs text-black/50 md:text-sm">
                              {formatDate(order.created_at)} • {order.items?.length || 0} item{(order.items?.length || 0) !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-5">
                            <span className="text-xl font-semibold text-[#16120d] md:text-2xl">₹{Number(order.total_amount || 0).toFixed(0)}</span>
                            <span className="font-nav text-xs text-[#16120d] md:text-sm">View Details &gt;</span>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            {activeTab === 'wishlist' && (
              <section data-testid="wishlist-section">
                <div className="mb-10">
                  <h1 className="text-[2.2rem] font-semibold leading-none text-[#16120d] md:text-[3rem]">Wishlist</h1>
                  <p className="mt-3 text-lg text-black/58">Saved pieces you may want to pick up later.</p>
                </div>

                {wishlist.products?.length > 0 ? (
                  <>
                    {renderProductGrid(wishlist.products.slice(0, 8), 'wishlist-item')}
                    <button
                      type="button"
                      onClick={() => navigate('/wishlist')}
                      className="mt-8 font-nav text-lg text-[#16120d] underline underline-offset-4"
                    >
                      Open Full Wishlist
                    </button>
                  </>
                ) : (
                    <div className="space-y-4">
                      <p className="text-2xl font-semibold text-[#16120d]">Your wishlist is empty</p>
                      <button
                        type="button"
                        onClick={() => navigate('/products')}
                        className="font-nav text-lg text-[#16120d] underline underline-offset-4"
                      >
                        Start Browsing
                      </button>
                    </div>
                  )}
              </section>
            )}

            {activeTab === 'addresses' && (
              <section data-testid="addresses-section">
                <div className="mb-10">
                  <h1 className="text-[2.2rem] font-semibold leading-none text-[#16120d] md:text-[3rem]">Addresses</h1>
                </div>

                <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.05fr_0.95fr]">
                  <div>
                    {addressLoading ? (
                      <div className="border border-black/10 bg-white p-6 text-sm text-gray-500">Loading saved addresses...</div>
                    ) : savedAddresses.length === 0 ? (
                      <div>
                        <p className="mb-6 text-2xl font-semibold text-[#16120d]">You have no addresses yet</p>
                        <button
                          type="button"
                          onClick={resetAddressForm}
                          className="flex h-28 w-full flex-col items-center justify-center bg-[#f5f5f5] text-[#16120d] transition-colors hover:bg-[#efefef]"
                        >
                          <span className="text-3xl leading-none">+</span>
                          <span className="mt-2 font-nav text-sm underline underline-offset-4">Add New Address</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-5">
                        {savedAddresses.map((address) => (
                          <div key={address.id} className="border border-black/10 bg-white p-6">
                            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                              <div className="space-y-2 text-sm leading-6 text-black/70">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="font-nav text-lg text-[#16120d]">{address.label || 'Address'}</span>
                                  {address.is_default && (
                                    <span className="rounded-full bg-black px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-white">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <p className="font-nav text-[#16120d]">{address.full_name}</p>
                                <p>{address.address_line1}</p>
                                {address.address_line2 && <p>{address.address_line2}</p>}
                                <p>{address.city}, {address.state} {address.postal_code}</p>
                                <p>{address.country}</p>
                                <p className="text-xs uppercase tracking-[0.16em] text-black/45">{address.phone}</p>
                              </div>

                              <div className="flex flex-wrap gap-2">
                                {!address.is_default && (
                                  <button
                                    type="button"
                                    onClick={() => handleSetDefaultAddress(address.id)}
                                    className="border border-black/15 px-3 py-2 font-nav text-xs text-[#16120d] transition-colors hover:border-black"
                                  >
                                    Set Default
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleEditAddress(address)}
                                  className="border border-black/15 px-3 py-2 font-nav text-xs text-[#16120d] transition-colors hover:border-black"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAddress(address.id)}
                                  className="border border-black/15 px-3 py-2 font-nav text-xs text-[#16120d] transition-colors hover:border-red-600 hover:text-red-600"
                                >
                                  Delete
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border border-black/10 p-6">
                    <div className="mb-6">
                      <h2 className="text-[2rem] font-semibold leading-none text-[#16120d]">
                        {editingAddressId ? 'Edit Address' : 'Add New Address'}
                      </h2>
                    </div>

                    <form onSubmit={handleSaveAddress} className="space-y-4">
                      <div>
                        <label className="mb-2 block font-nav text-xs text-black/55">ADDRESS LABEL *</label>
                        <input
                          type="text"
                          name="label"
                          value={addressForm.label}
                          onChange={handleAddressChange}
                          required
                          className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-nav text-xs text-black/55">FULL NAME *</label>
                        <input
                          type="text"
                          name="full_name"
                          value={addressForm.full_name}
                          onChange={handleAddressChange}
                          required
                          className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-nav text-xs text-black/55">PHONE *</label>
                        <input
                          type="tel"
                          name="phone"
                          value={addressForm.phone}
                          onChange={handleAddressChange}
                          required
                          className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-nav text-xs text-black/55">ADDRESS LINE 1 *</label>
                        <input
                          type="text"
                          name="address_line1"
                          value={addressForm.address_line1}
                          onChange={handleAddressChange}
                          required
                          className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block font-nav text-xs text-black/55">ADDRESS LINE 2</label>
                        <input
                          type="text"
                          name="address_line2"
                          value={addressForm.address_line2}
                          onChange={handleAddressChange}
                          className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block font-nav text-xs text-black/55">CITY *</label>
                          <input
                            type="text"
                            name="city"
                            value={addressForm.city}
                            onChange={handleAddressChange}
                            required
                            className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block font-nav text-xs text-black/55">STATE *</label>
                          <input
                            type="text"
                            name="state"
                            value={addressForm.state}
                            onChange={handleAddressChange}
                            required
                            className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="mb-2 block font-nav text-xs text-black/55">PIN CODE *</label>
                          <input
                            type="text"
                            name="postal_code"
                            value={addressForm.postal_code}
                            onChange={handleAddressChange}
                            maxLength="6"
                            required
                            className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block font-nav text-xs text-black/55">COUNTRY *</label>
                          <input
                            type="text"
                            name="country"
                            value={addressForm.country}
                            onChange={handleAddressChange}
                            required
                            className="w-full border border-black/15 px-4 py-3 outline-none transition-colors focus:border-black"
                          />
                        </div>
                      </div>

                      <label className="flex items-center gap-3 pt-2 text-sm text-black/65">
                        <input
                          type="checkbox"
                          name="is_default"
                          checked={addressForm.is_default}
                          onChange={handleAddressChange}
                          className="h-4 w-4"
                        />
                        Set this as my default address
                      </label>

                      <div className="flex flex-col gap-3 pt-3 sm:flex-row">
                        <button
                          type="submit"
                          disabled={addressSubmitting}
                          className="bg-black px-6 py-3 font-nav text-sm text-white transition-colors hover:bg-[#2a2018] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {addressSubmitting ? 'Saving...' : editingAddressId ? 'Update Address' : 'Save Address'}
                        </button>
                        {editingAddressId && (
                          <button
                            type="button"
                            onClick={resetAddressForm}
                            className="border border-black/15 px-6 py-3 font-nav text-sm text-[#16120d] transition-colors hover:border-black"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  </div>
                </div>
              </section>
            )}

            {activeTab === 'settings' && (
              <section data-testid="settings-section">
                <div className="mb-10">
                  <h1 className="text-[2.2rem] font-semibold leading-none text-[#16120d] md:text-[3rem]">Account Settings</h1>
                </div>

                <div className="space-y-6">
                  <div className="border border-black/10 p-6">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-[2rem] font-semibold leading-none text-[#16120d]">Personal Details</h2>
                      </div>
                    </div>
                    <div className="space-y-3 text-lg text-black/70">
                      <p><span className="font-semibold text-[#16120d]">Name:</span> {user.name || 'Not added yet'}</p>
                      <p><span className="font-semibold text-[#16120d]">Phone:</span> {user.phone || 'Not added yet'}</p>
                    </div>
                  </div>

                  <div className="border border-black/10 p-6">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-[2rem] font-semibold leading-none text-[#16120d]">Email & Password</h2>
                      </div>
                    </div>
                    <div className="space-y-3 text-lg text-black/70">
                      <p><span className="font-semibold text-[#16120d]">Email:</span> {user.email}</p>
                      <p><span className="font-semibold text-[#16120d]">Password:</span> ••••••••••••</p>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default Account;
