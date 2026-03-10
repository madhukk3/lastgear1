import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState({ order_status: '', tracking_number: '' });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const response = await axios.get(`${API}/admin/orders`);
      setOrders(response.data.orders);
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async () => {
    try {
      await axios.put(`${API}/admin/orders/${selectedOrder.id}/status`, statusUpdate);
      toast.success('Order status updated');
      setSelectedOrder(null);
      fetchOrders();
    } catch (error) {
      console.error('Failed to update order:', error);
      toast.error('Failed to update order status');
    }
  };

  return (
    <div data-testid="admin-orders">
      <h1 className="text-3xl font-bold mb-8">Orders Management</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payment</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {orders.map((order) => (
              <tr key={order.id}>
                <td className="px-6 py-4 text-sm font-mono">{order.id.slice(0, 8)}</td>
                <td className="px-6 py-4 text-sm">{format(new Date(order.created_at), 'MMM dd, yyyy')}</td>
                <td className="px-6 py-4 text-sm">{order.shipping_address.full_name}</td>
                <td className="px-6 py-4 text-sm">{order.items.length}</td>
                <td className="px-6 py-4 font-medium">₹{order.total_amount.toFixed(0)}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs ${order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                    {order.payment_status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs capitalize">
                    {order.order_status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => {
                      setSelectedOrder(order);
                      setStatusUpdate({ order_status: order.order_status, tracking_number: order.tracking_number || '' });
                    }}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Update
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Update Status Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-6">Update Order Status</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Order Status</label>
                <select
                  value={statusUpdate.order_status}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, order_status: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                >
                  <option value="processing">Processing</option>
                  <option value="shipped">Shipped</option>
                  <option value="delivered">Delivered</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Tracking Number (Optional)</label>
                <input
                  type="text"
                  value={statusUpdate.tracking_number}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, tracking_number: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <div className="flex gap-4 pt-4">
                <button
                  onClick={updateOrderStatus}
                  className="flex-1 bg-black text-white py-3 rounded-lg"
                >
                  Update
                </button>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="flex-1 border py-3 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminOrders;