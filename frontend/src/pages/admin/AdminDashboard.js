import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, ShoppingCart, Users, Package, AlertTriangle, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';

const AdminDashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API}/admin/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#000000', '#4B5563', '#9CA3AF', '#D1D5DB'];

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-96">
          <div className="text-xl">Loading dashboard...</div>
        </div>
      </>
    );
  }

  return (
    <div data-testid="admin-dashboard">
      <h1 className="mb-8 font-nav text-4xl text-[#16120d]">Dashboard Overview</h1>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow" data-testid="stat-revenue">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <IndianRupee className="text-green-600" size={24} />
            </div>
            <span className="font-nav text-sm text-gray-500">Total Revenue</span>
          </div>
          <div className="text-3xl font-bold">₹{stats?.total_revenue?.toLocaleString('en-IN') || 0}</div>
          <p className="mt-2 font-nav text-sm text-gray-600">{stats?.paid_orders || 0} paid orders</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow" data-testid="stat-orders">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <ShoppingCart className="text-blue-600" size={24} />
            </div>
            <span className="font-nav text-sm text-gray-500">Total Orders</span>
          </div>
          <div className="text-3xl font-bold">{stats?.total_orders || 0}</div>
          <p className="mt-2 font-nav text-sm text-gray-600">{stats?.recent_orders_24h || 0} in last 24h</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow" data-testid="stat-customers">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Users className="text-purple-600" size={24} />
            </div>
            <span className="font-nav text-sm text-gray-500">Customers</span>
          </div>
          <div className="text-3xl font-bold">{stats?.total_customers || 0}</div>
          <p className="mt-2 font-nav text-sm text-gray-600">Registered users</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow" data-testid="stat-products">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Package className="text-orange-600" size={24} />
            </div>
            <span className="font-nav text-sm text-gray-500">Products</span>
          </div>
          <div className="text-3xl font-bold">{stats?.total_products || 0}</div>
          <p className="mt-2 font-nav text-sm text-red-600">
            <AlertTriangle size={14} className="inline mr-1" />
            {stats?.low_stock_products || 0} low stock
          </p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Revenue Bar Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="mb-4 font-nav text-2xl text-[#16120d]">Revenue by Category</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={stats?.category_stats || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" tick={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12 }} />
              <YAxis tick={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: 12 }} />
              <Tooltip formatter={(value) => `₹${value.toFixed(0)}`} contentStyle={{ fontFamily: 'Space Grotesk, sans-serif' }} />
              <Legend wrapperStyle={{ fontFamily: 'Space Grotesk, sans-serif', fontSize: '12px' }} />
              <Bar dataKey="revenue" fill="#000000" name="Revenue (₹)" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category Orders Pie Chart */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="mb-4 font-nav text-2xl text-[#16120d]">Orders by Category</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={stats?.category_stats || []}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ _id, percent }) => `${_id}: ${(percent * 100).toFixed(0)}%`}
                outerRadius={100}
                fill="#8884d8"
                dataKey="orders"
              >
                {(stats?.category_stats || []).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ fontFamily: 'Space Grotesk, sans-serif' }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="mb-4 font-nav text-2xl text-[#16120d]">Order Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="font-nav text-gray-600">Paid</span>
              <span className="font-bold text-green-600">{stats?.paid_orders || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-nav text-gray-600">Pending</span>
              <span className="font-bold text-yellow-600">{stats?.pending_orders || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="mb-4 font-nav text-2xl text-[#16120d]">Inventory Status</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="font-nav text-gray-600">Total Products</span>
              <span className="font-bold">{stats?.total_products || 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-nav text-gray-600">Low Stock</span>
              <span className="font-bold text-red-600">{stats?.low_stock_products || 0}</span>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="mb-4 font-nav text-2xl text-[#16120d]">Performance</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="font-nav text-gray-600">Avg Order Value</span>
              <span className="font-bold">
                ₹{stats?.paid_orders > 0 ? (stats?.total_revenue / stats?.paid_orders).toFixed(0) : 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="font-nav text-gray-600">Conversion Rate</span>
              <span className="font-bold">
                {stats?.total_orders > 0 ? ((stats?.paid_orders / stats?.total_orders) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;
