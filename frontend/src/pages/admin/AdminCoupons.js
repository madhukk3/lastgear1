import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const AdminCoupons = () => {
  const [coupons, setCoupons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);
  const [formData, setFormData] = useState({
    code: '',
    discount_percentage: 10,
    is_active: true
  });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const response = await axios.get(`${API}/admin/coupons`);
      setCoupons(response.data);
    } catch (error) {
      console.error('Failed to fetch coupons:', error);
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingCoupon) {
        await axios.put(`${API}/admin/coupons/${editingCoupon.id}`, formData);
        toast.success('Coupon updated successfully');
      } else {
        await axios.post(`${API}/admin/coupons`, formData);
        toast.success('Coupon created successfully');
      }
      setShowAddModal(false);
      setEditingCoupon(null);
      resetForm();
      fetchCoupons();
    } catch (error) {
      console.error('Failed to save coupon:', error);
      toast.error(error.response?.data?.detail || 'Failed to save coupon');
    }
  };

  const handleDelete = async (couponId) => {
    if (!window.confirm('Are you sure you want to delete this coupon?')) return;
    try {
      await axios.delete(`${API}/admin/coupons/${couponId}`);
      toast.success('Coupon deleted successfully');
      fetchCoupons();
    } catch (error) {
      console.error('Failed to delete coupon:', error);
      toast.error('Failed to delete coupon');
    }
  };

  const handleEdit = (coupon) => {
    setEditingCoupon(coupon);
    setFormData({
      code: coupon.code,
      discount_percentage: coupon.discount_percentage,
      is_active: coupon.is_active
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      code: '',
      discount_percentage: 10,
      is_active: true
    });
  };

  return (
    <>
      <div data-testid="admin-coupons">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Coupon Management</h1>
          <button
            onClick={() => {
              resetForm();
              setEditingCoupon(null);
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          >
            <Plus size={20} />
            Add Coupon
          </button>
        </div>

        {/* Coupons Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Discount</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr><td colSpan="4" className="px-6 py-4 text-center">Loading...</td></tr>
              ) : coupons.length === 0 ? (
                <tr><td colSpan="4" className="px-6 py-4 text-center text-gray-500">No coupons found. Create your first promotion!</td></tr>
              ) : (
                coupons.map((coupon) => (
                  <tr key={coupon.id}>
                    <td className="px-6 py-4 font-bold text-lg">{coupon.code}</td>
                    <td className="px-6 py-4 font-medium">{coupon.discount_percentage}% OFF</td>
                    <td className="px-6 py-4">
                      {coupon.is_active ? (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-sm font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(coupon)}
                          className="p-2 hover:bg-gray-100 rounded text-gray-600 transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(coupon.id)}
                          className="p-2 hover:bg-red-50 text-red-600 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Add/Edit Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-8 max-w-md w-full shadow-2xl">
              <h2 className="text-2xl font-bold mb-6">{editingCoupon ? 'Edit Promo Code' : 'Create Promo Code'}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Promo Code (e.g. SALE50)</label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase().replace(/\s/g, '') })}
                    required
                    placeholder="WINTER20"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black uppercase font-bold text-lg tracking-wider"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">Discount Percentage (%)</label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseInt(e.target.value) || 0 })}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black text-lg"
                  />
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-5 h-5 accent-black rounded border-gray-300 focus:ring-black"
                    />
                    <span className="font-semibold text-gray-800">Code is Active</span>
                  </label>
                  <p className="text-sm text-gray-500 mt-1 ml-8">Uncheck to temporarily disable this promo code without deleting it.</p>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    type="submit"
                    className="flex-1 bg-black text-white py-3 rounded-lg font-bold hover:bg-gray-800 transition-colors"
                  >
                    {editingCoupon ? 'Update Code' : 'Create Code'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddModal(false);
                      setEditingCoupon(null);
                      resetForm();
                    }}
                    className="flex-1 border-2 border-gray-200 py-3 rounded-lg font-bold hover:bg-gray-50 transition-colors text-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AdminCoupons;
