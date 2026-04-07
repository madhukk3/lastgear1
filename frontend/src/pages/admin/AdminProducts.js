import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Edit2, Trash2, Search, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import ImageUpload from '../../components/ImageUpload';
import TagInput from '../../components/TagInput';

const AdminProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    category: 't-shirts',
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    colors: ['Black', 'White'],
    colors: ['Black', 'White'],
    images: [''],
    size_stock: { 'S': 20, 'M': 20, 'L': 20, 'XL': 20, 'XXL': 20 },
    stock: 100,
    featured: false,
    badge: '',
    impact_series_id: '',
    is_free_shipping: false,
    discount_percentage: 0,
    cod_available: true,
    video: '',
  });
  const [impactSeriesList, setImpactSeriesList] = useState([]);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${API}/admin/products`);
      setProducts(response.data.products);
    } catch (error) {
      console.error('Failed to fetch products:', error);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const fetchImpactSeries = async () => {
    try {
      const response = await axios.get(`${API}/admin/impact-series`);
      setImpactSeriesList(response.data);
    } catch (error) {
      console.error('Failed to fetch impact series:', error);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchImpactSeries();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create a copy of the size_stock matching ONLY the currently selected sizes
      const filteredSizeStock = {};
      let totalStock = 0;
      formData.sizes.forEach(size => {
        const amt = formData.size_stock[size] || 0;
        filteredSizeStock[size] = amt;
        totalStock += amt;
      });

      const payload = { ...formData, size_stock: filteredSizeStock, stock: totalStock };
      if (!payload.impact_series_id) {
        payload.impact_series_id = null;
      }

      if (editingProduct) {
        await axios.put(`${API}/admin/products/${editingProduct.id}`, payload);
        toast.success('Product updated successfully');
      } else {
        await axios.post(`${API}/admin/products`, payload);
        toast.success('Product created successfully');
      }
      setShowAddModal(false);
      setEditingProduct(null);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Failed to save product:', error);
      toast.error(error.response?.data?.detail || 'Failed to save product');
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;

    try {
      await axios.delete(`${API}/admin/products/${productId}`);
      toast.success('Product deleted successfully');
      fetchProducts();
    } catch (error) {
      console.error('Failed to delete product:', error);
      toast.error('Failed to delete product');
    }
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      description: product.description,
      price: product.price,
      category: product.category,
      sizes: product.sizes || [],
      colors: product.colors || [],
      colors: product.colors || [],
      images: product.images,
      size_stock: product.size_stock || {},
      stock: product.stock,
      featured: product.featured,
      badge: product.badge || '',
      impact_series_id: product.impact_series_id || '',
      is_free_shipping: product.is_free_shipping || false,
      discount_percentage: product.discount_percentage || 0,
      cod_available: product.cod_available !== undefined ? product.cod_available : true,
      video: product.video || '',
    });
    setShowAddModal(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      price: '',
      category: 't-shirts',
      sizes: ['S', 'M', 'L', 'XL', 'XXL'],
      colors: ['Black', 'White'],
      colors: ['Black', 'White'],
      images: [''],
      size_stock: { 'S': 20, 'M': 20, 'L': 20, 'XL': 20, 'XXL': 20 },
      stock: 100,
      featured: false,
      badge: '',
      impact_series_id: '',
      is_free_shipping: false,
      discount_percentage: 0,
      cod_available: true,
      video: '',
    });
  };

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    product.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div data-testid="admin-products">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Products Management</h1>
        <button
          onClick={() => {
            resetForm();
            setEditingProduct(null);
            setShowAddModal(true);
          }}
          className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800"
          data-testid="add-product-button"
        >
          <Plus size={20} />
          Add Product
        </button>
      </div>

      {/* Search */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            data-testid="search-products"
          />
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="max-h-[72vh] overflow-auto">
          <table className="w-full min-w-[800px]">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stock</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Featured</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredProducts.map((product) => (
                <tr key={product.id} data-testid={`product-row-${product.id}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <img src={product.images[0]} alt={product.name} className="w-12 h-12 object-cover rounded" />
                      <div>
                        <div className="font-medium">{product.name}</div>
                        <div className="text-sm text-gray-500">{product.colors.length} colors</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 capitalize">{product.category}</td>
                  <td className="px-6 py-4 font-medium">₹{product.price.toFixed(0)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      <span className={`w-fit px-2 py-1 rounded text-sm ${product.stock < 10 ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        Total: {product.stock}
                      </span>
                      {product.size_stock && Object.keys(product.size_stock).length > 0 && (
                        <span className="text-xs text-gray-500">
                          {Object.entries(product.size_stock).map(([size, amt]) => `${size}:${amt}`).join(', ')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {product.featured ? (
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">Yes</span>
                    ) : (
                      <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-sm">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleEdit(product)}
                        className="p-2 hover:bg-gray-100 rounded"
                        data-testid={`edit-${product.id}`}
                      >
                        <Edit2 size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 hover:bg-red-100 text-red-600 rounded"
                        data-testid={`delete-${product.id}`}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="product-modal">
          <div className="bg-white rounded-lg p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6">{editingProduct ? 'Edit Product' : 'Add New Product'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!formData.impact_series_id}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, impact_series_id: impactSeriesList[0]?.id || '' });
                      } else {
                        setFormData({ ...formData, impact_series_id: '' });
                      }
                    }}
                    className="w-5 h-5 accent-black rounded border-gray-300 focus:ring-black"
                  />
                  <span className="font-bold text-lg">Add directly to an Impact Series</span>
                </label>
                {!!formData.impact_series_id && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <label className="block text-sm font-medium mb-2">Select Impact Series</label>
                    <select
                      value={formData.impact_series_id}
                      onChange={(e) => setFormData({ ...formData, impact_series_id: e.target.value })}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                      required
                    >
                      <option value="" disabled>Select a series...</option>
                      {impactSeriesList.map((series) => (
                        <option key={series.id} value={series.id}>
                          {series.title}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Product Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="product-name-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  data-testid="product-description-input"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Price (₹)</label>
                  <input
                    type="number"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                    required
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="product-price-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                    data-testid="product-category-input"
                  >
                    <option value="t-shirts">T-Shirts</option>
                    <option value="hoodies">Hoodies</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 bg-gray-50 border border-gray-200 p-4 rounded-lg">
                  <label className="block text-sm font-bold mb-4">Stock quantities per size:</label>
                  {formData.sizes.length === 0 ? (
                    <p className="text-sm text-gray-500 italic">Please add sizes above first.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
                      {formData.sizes.map(size => (
                        <div key={size} className="flex flex-col">
                          <label className="text-xs font-medium text-gray-700 mb-1">{size}</label>
                          <input
                            type="number"
                            min="0"
                            value={formData.size_stock[size] || 0}
                            onChange={(e) => setFormData({
                              ...formData,
                              size_stock: { ...formData.size_stock, [size]: Math.max(0, parseInt(e.target.value) || 0) }
                            })}
                            className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-black"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Product Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Sizes</label>
                <TagInput
                  tags={formData.sizes}
                  setTags={(t) => setFormData({ ...formData, sizes: t })}
                  placeholder="Custom Size..."
                  suggestions={['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', 'UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11', 'UK 12']}
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Colors</label>
                <TagInput
                  tags={formData.colors}
                  setTags={(t) => setFormData({ ...formData, colors: t })}
                  placeholder="Custom Color..."
                  suggestions={['Black', 'White', 'Navy', 'Red', 'Grey', 'Olive', 'Blue', 'Beige', 'Pink', 'Green', 'Yellow', 'Brown']}
                />
              </div>

              <div>
                <label className="block text-sm font-bold mb-4">Product Images (Up to 5)</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                  {[0, 1, 2, 3, 4].map((index) => (
                    <ImageUpload
                      key={index}
                      label={index === 0 ? "Main Image" : `Image ${index + 1}`}
                      value={formData.images[index] || ''}
                      onChange={(url) => {
                        const newImages = [...formData.images];
                        newImages[index] = url;
                        // Clean up empty strings if removed
                        setFormData({ ...formData, images: newImages.filter(Boolean) });
                      }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Product Video URL (Optional)</label>
                <input
                  type="url"
                  value={formData.video}
                  onChange={(e) => setFormData({ ...formData, video: e.target.value })}
                  placeholder="e.g. https://youtube.com/watch?v=... or .mp4 link"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                />
                <p className="text-xs text-gray-500 mt-1">Paste a direct link to the product video to add a video thumbnail in the gallery.</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Product Badge</label>
                <input
                  type="text"
                  value={formData.badge}
                  onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                  placeholder="e.g. NEW, SALE"
                  className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black uppercase"
                  data-testid="product-badge-input"
                />
              </div>

              <div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.featured}
                    onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
                    className="rounded"
                    data-testid="product-featured-input"
                  />
                  <span className="text-sm font-medium">Featured Product</span>
                </label>
              </div>

              <div className="mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.is_free_shipping}
                    onChange={(e) => setFormData({ ...formData, is_free_shipping: e.target.checked })}
                    className="rounded"
                    data-testid="product-free-shipping-input"
                  />
                  <span className="text-sm font-medium">Offer Free Shipping (Ignore ₹1500 limit)</span>
                </label>
              </div>

              <div className="mt-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.cod_available}
                    onChange={(e) => setFormData({ ...formData, cod_available: e.target.checked })}
                    className="rounded"
                    data-testid="product-cod-available-input"
                  />
                  <span className="text-sm font-medium">Enable Cash on Delivery (COD)</span>
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  className="flex-1 bg-black text-white py-3 rounded-lg hover:bg-gray-800"
                  data-testid="save-product-button"
                >
                  {editingProduct ? 'Update Product' : 'Create Product'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingProduct(null);
                    resetForm();
                  }}
                  className="flex-1 border border-gray-300 py-3 rounded-lg hover:bg-gray-50"
                  data-testid="cancel-button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminProducts;
