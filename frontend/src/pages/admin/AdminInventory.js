import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const AdminInventory = () => {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStock, setUpdatingStock] = useState({});

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
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

  const updateStock = async (productId, size, newStock) => {
    try {
      await axios.put(`${API}/admin/inventory/${productId}/stock`, null, {
        params: { stock: newStock, size: size }
      });
      toast.success('Stock updated');
      fetchLowStock();
    } catch (error) {
      console.error('Failed to update stock:', error);
      toast.error('Failed to update stock');
    }
  };

  return (
    <div data-testid="admin-inventory">
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="text-red-600" size={32} />
        <h1 className="text-3xl font-bold">Low Stock Inventory</h1>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Current Stock</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Update Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {lowStockProducts.map((product) => {
              // Determine sizes to display
              const sizesToDisplay = product.size_stock && Object.keys(product.size_stock).length > 0
                ? Object.entries(product.size_stock)
                : [['Global', product.stock]]; // Fallback if no sizes are set

              return sizesToDisplay.map(([size, stockAmount]) => {
                const uniqueKey = `${product.id}-${size}`;

                return (
                  <tr key={uniqueKey}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover rounded" />
                        <div className="font-medium">{product.name}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 capitalize">{product.category}</td>
                    <td className="px-6 py-4 font-medium">{size}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded font-bold ${stockAmount < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {stockAmount} units
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min="0"
                          defaultValue={stockAmount}
                          onChange={(e) => setUpdatingStock({ ...updatingStock, [uniqueKey]: parseInt(e.target.value) })}
                          className="w-24 px-3 py-1 border rounded"
                        />
                        <button
                          onClick={() => updateStock(product.id, size === 'Global' ? null : size, updatingStock[uniqueKey] ?? stockAmount)}
                          className="px-4 py-1 bg-black text-white rounded hover:bg-gray-800"
                        >
                          Update
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              });
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminInventory;
