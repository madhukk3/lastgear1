import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { toast } from 'sonner';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [statusUpdate, setStatusUpdate] = useState({ order_status: '', tracking_number: '', force_update: false });
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const ALLOWED_TRANSITIONS = {
    order_locked: ["processing", "cancelled"],
    processing: ["packed", "cancelled"],
    packed: ["shipped", "cancelled"],
    shipped: ["out_for_delivery"],
    out_for_delivery: ["delivered"],
    delivered: ["exchange_requested"],
    exchange_requested: ["exchange_approved", "exchange_rejected"],
    exchange_approved: ["return_received"],
    return_received: ["replacement_processing"],
    replacement_processing: ["replacement_shipped"],
    replacement_shipped: ["exchange_completed"]
  };

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

  const approveCancellation = async (orderId) => {
    if (!window.confirm("Are you sure you want to APPROVE this cancellation? Stock will be automatically restored, and status changed to Cancelled.")) return;
    try {
      await axios.patch(`${API}/admin/orders/${orderId}/approve-cancel`);
      toast.success('Cancellation approved');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to approve cancellation');
    }
  };

  const rejectCancellation = async (orderId) => {
    if (!window.confirm("Reject this cancellation request? The order will revert to processing context.")) return;
    try {
      await axios.patch(`${API}/admin/orders/${orderId}/reject-cancel`);
      toast.success('Cancellation rejected');
      fetchOrders();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reject cancellation');
    }
  };

  const filteredByTab = activeTab === 'all'
    ? orders
    : orders.filter(o => o.cancel_requested);

  const displayOrders = filteredByTab.filter(order => {
    if (!searchQuery) return true;
    const searchLower = searchQuery.toLowerCase();
    const idMatch = order.id.toLowerCase().includes(searchLower);
    const nameMatch = order.shipping_address?.full_name?.toLowerCase().includes(searchLower);
    return idMatch || nameMatch;
  });

  return (
    <div data-testid="admin-orders">
      <h1 className="text-3xl font-bold mb-8">Orders Management</h1>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 font-bold rounded-lg ${activeTab === 'all' ? 'bg-black text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            All Orders
          </button>
          <button
            onClick={() => setActiveTab('cancellations')}
            className={`px-4 py-2 font-bold rounded-lg flex gap-2 items-center ${activeTab === 'cancellations' ? 'bg-red-600 text-white' : 'bg-red-100 text-red-600'}`}
          >
            Cancellation Requests
            {orders.filter(o => o.cancel_requested).length > 0 && (
              <span className="bg-white text-red-600 px-2 py-0.5 rounded-full text-xs">
                {orders.filter(o => o.cancel_requested).length}
              </span>
            )}
          </button>
        </div>
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Search by Order ID or Name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2 outline-none focus:border-black transition-colors"
          />
        </div>
      </div>

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
            {displayOrders.map((order) => (
              <tr key={order.id} className={order.cancel_requested ? 'bg-red-50' : ''}>
                <td className="px-6 py-4 text-sm font-mono">
                  {order.id}
                  {order.cancel_requested && (
                    <div className="mt-1">
                      <span className="block text-[10px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded uppercase w-max mb-1">Cancel Req</span>
                      {order.cancel_reason && <span className="block text-[10px] text-red-500 italic max-w-[150px] truncate" title={order.cancel_reason}>"{order.cancel_reason}"</span>}
                    </div>
                  )}
                </td>
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
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedOrder(order);
                        setStatusUpdate({ order_status: order.order_status, tracking_number: order.tracking_number || '', force_update: false });
                      }}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Edit
                    </button>
                    {order.cancel_requested && (
                      <>
                        <span className="text-gray-300">|</span>
                        <button onClick={() => approveCancellation(order.id)} className="text-sm text-green-600 hover:text-green-800 font-bold uppercase tracking-wide">
                          Approve
                        </button>
                        <button onClick={() => rejectCancellation(order.id)} className="text-sm text-red-600 hover:text-red-800 font-bold uppercase tracking-wide">
                          Reject
                        </button>
                      </>
                    )}
                  </div>
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
                  className="w-full px-4 py-2 border rounded-lg capitalize appearance-none bg-white bg-no-repeat"
                  style={{ backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23000%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.4-12.8z%22%2F%3E%3C%2Fsvg%3E")', backgroundPosition: 'right 1rem top 50%', backgroundSize: '0.65rem auto' }}
                >
                  <option value={selectedOrder.order_status} className="text-gray-500 italic">CURRENT: {selectedOrder.order_status.replace(/_/g, ' ')}</option>
                  {(statusUpdate.force_update ? Object.keys(ALLOWED_TRANSITIONS) : (ALLOWED_TRANSITIONS[selectedOrder.order_status] || [])).map(opt => (
                    <option key={opt} value={opt} className="font-bold text-black">{opt.replace(/_/g, ' ')}</option>
                  ))}
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

              {/* Force Override Toggle */}
              <div className="flex items-center gap-2 mt-4 p-3 bg-red-50 border border-red-100 rounded-lg">
                <input
                  type="checkbox"
                  id="forceUpdateToggle"
                  checked={statusUpdate.force_update}
                  onChange={(e) => setStatusUpdate({ ...statusUpdate, force_update: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500 border-gray-300 cursor-pointer"
                />
                <label htmlFor="forceUpdateToggle" className="text-sm text-red-800 font-medium cursor-pointer">
                  Bypass System Flow Constraints (Force Admin Override)
                </label>
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