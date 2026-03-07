import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import AdminLayout from '../../components/AdminLayout';
import { toast } from 'sonner';

const AdminInventory = () => {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStock, setUpdatingStock] = useState({});

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchLowStock();
  }, []);

  const fetchLowStock = async () => {
    try {
      const response = await axios.get(`${API}/admin/inventory/low-stock`);
      setLowStockProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      toast.error('Failed to load inventory');
    } finally {
      setLoading(false);
    }
  };

  const updateStock = async (productId, newStock) => {
    try {
      await axios.put(`${API}/admin/inventory/${productId}/stock`, null, {
        params: { stock: newStock }
      });
      toast.success('Stock updated');
      fetchLowStock();
    } catch (error) {
      console.error('Failed to update stock:', error);
      toast.error('Failed to update stock');
    }
  };

  return (
    <AdminLayout>
      <div data-testid="admin-inventory">
        <div className="flex items-center gap-3 mb-8">
          <AlertTriangle className="text-red-600" size={32} />
          <h1 className="text-3xl font-bold">Low Stock Inventory</h1>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Update Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {lowStockProducts.map((product) => (
                <tr key={product.id}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover rounded" />
                      <div className="font-medium">{product.name}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4 capitalize">{product.category}</td>
                  <td className="px-6 py-4">
                    <span className="px-3 py-1 bg-red-100 text-red-800 rounded font-bold">
                      {product.stock} units
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        defaultValue={product.stock}
                        onChange={(e) => setUpdatingStock({...updatingStock, [product.id]: parseInt(e.target.value)})}
                        className="w-24 px-3 py-1 border rounded"
                      />
                      <button
                        onClick={() => updateStock(product.id, updatingStock[product.id] || product.stock)}
                        className="px-4 py-1 bg-black text-white rounded hover:bg-gray-800"
                      >
                        Update
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminInventory;