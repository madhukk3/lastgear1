import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      const response = await axios.get(`${API}/admin/customers`);
      setCustomers(response.data.customers);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="admin-customers">
      <h1 className="text-3xl font-bold mb-8">Customers</h1>

      <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Phone</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Orders</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Spent</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {customers.map((customer) => (
              <tr key={customer.id}>
                <td className="px-6 py-4">{customer.name}</td>
                <td className="px-6 py-4">{customer.email}</td>
                <td className="px-6 py-4">{customer.phone || 'N/A'}</td>
                <td className="px-6 py-4 font-medium">{customer.order_count}</td>
                <td className="px-6 py-4 font-medium">₹{customer.total_spent?.toFixed(0) || 0}</td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {new Date(customer.created_at).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminCustomers;