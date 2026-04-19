import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { ShoppingBag, Users, Wallet } from 'lucide-react';
import { toast } from 'sonner';

const AdminCustomers = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
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

  const totalCustomers = customers.length;
  const totalOrders = customers.reduce((sum, customer) => sum + (customer.order_count || 0), 0);
  const totalRevenue = customers.reduce((sum, customer) => sum + (customer.total_spent || 0), 0);

  return (
    <div data-testid="admin-customers">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-nav text-[11px] text-[#8d6a46]">Customers</p>
              <p className="mt-2 text-3xl font-bold text-[#16120d]">{totalCustomers}</p>
            </div>
            <div className="rounded-2xl bg-[#f4f1eb] p-3 text-[#16120d]">
              <Users size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-nav text-[11px] text-[#8d6a46]">Orders</p>
              <p className="mt-2 text-3xl font-bold text-[#16120d]">{totalOrders}</p>
            </div>
            <div className="rounded-2xl bg-[#f4f1eb] p-3 text-[#16120d]">
              <ShoppingBag size={20} />
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-black/8 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-nav text-[11px] text-[#8d6a46]">Revenue</p>
              <p className="mt-2 text-3xl font-bold text-[#16120d]">₹{totalRevenue.toFixed(0)}</p>
            </div>
            <div className="rounded-2xl bg-[#f4f1eb] p-3 text-[#16120d]">
              <Wallet size={20} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-[28px] border border-black/8 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-black/8 px-5 py-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="font-nav text-2xl text-[#16120d]">Customer Records</h2>
            <p className="mt-1 font-nav text-sm text-black/52">Names, contact details, order counts and spending in one clean place.</p>
          </div>
          <div className="rounded-2xl bg-[#f4f1eb] px-4 py-2 font-nav text-sm text-black/58">
            {loading ? 'Loading records...' : `${customers.length} customer${customers.length === 1 ? '' : 's'} found`}
          </div>
        </div>

        {loading ? (
          <div className="px-5 py-10 font-nav text-sm text-black/56">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="px-5 py-10 font-nav text-sm text-black/56">No customer records yet.</div>
        ) : (
          <>
            <div className="block md:hidden space-y-3 p-4">
              {customers.map((customer) => (
                <div key={customer.id} className="rounded-2xl border border-black/8 bg-[#fbf8f3] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-nav text-[#16120d]">{customer.name}</p>
                      <p className="mt-1 break-all text-sm text-black/58">{customer.email}</p>
                    </div>
                    <div className="rounded-xl bg-white px-3 py-2 font-nav text-sm text-[#16120d]">
                      {customer.order_count} orders
                    </div>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="font-nav text-[11px] text-[#8d6a46]">Phone</p>
                      <p className="mt-1 font-nav text-[#16120d]">{customer.phone || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="font-nav text-[11px] text-[#8d6a46]">Spent</p>
                      <p className="mt-1 font-nav text-[#16120d]">₹{customer.total_spent?.toFixed(0) || 0}</p>
                    </div>
                    <div>
                      <p className="font-nav text-[11px] text-[#8d6a46]">Joined</p>
                      <p className="mt-1 font-nav text-[#16120d]">{new Date(customer.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[800px]">
                <thead className="bg-[#f8f5ef]">
                  <tr>
                    <th className="px-6 py-4 text-left font-nav text-[11px] text-[#8d6a46]">Name</th>
                    <th className="px-6 py-4 text-left font-nav text-[11px] text-[#8d6a46]">Email</th>
                    <th className="px-6 py-4 text-left font-nav text-[11px] text-[#8d6a46]">Phone</th>
                    <th className="px-6 py-4 text-left font-nav text-[11px] text-[#8d6a46]">Orders</th>
                    <th className="px-6 py-4 text-left font-nav text-[11px] text-[#8d6a46]">Total Spent</th>
                    <th className="px-6 py-4 text-left font-nav text-[11px] text-[#8d6a46]">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/6">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-[#fbf8f3]">
                      <td className="px-6 py-4 font-nav text-[#16120d]">{customer.name}</td>
                      <td className="px-6 py-4 text-[#16120d]">{customer.email}</td>
                      <td className="px-6 py-4 font-nav text-[#16120d]">{customer.phone || 'N/A'}</td>
                      <td className="px-6 py-4 font-nav text-[#16120d]">{customer.order_count}</td>
                      <td className="px-6 py-4 font-nav text-[#16120d]">₹{customer.total_spent?.toFixed(0) || 0}</td>
                      <td className="px-6 py-4 font-nav text-sm text-black/52">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AdminCustomers;
