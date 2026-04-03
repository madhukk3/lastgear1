import React, { useEffect, useState } from 'react';
import { useSearchParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronDown } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

const Products = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const { globalDiscount } = useSettings() || { globalDiscount: 0 };
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    category: searchParams.get('category') || '',
    search: searchParams.get('search') || '',
    color: searchParams.get('color') || '',
    size: searchParams.get('size') || '',
    min_price: searchParams.get('min_price') || '',
    max_price: searchParams.get('max_price') || '',
    impact_series_id: searchParams.get('impact_series_id') || '',
  });
  const impactSeriesTitle = searchParams.get('impact_series_title') || '';

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const categories = ['All', 'T-Shirts', 'Hoodies'];
  const sizes = ['S', 'M', 'L', 'XL', 'XXL'];
  const colors = ['Black', 'White', 'Gray', 'Navy', 'Charcoal', 'Olive', 'Burgundy', 'Cream', 'Sand'];
  const priceRanges = [
    { label: 'All', min: '', max: '' },
    { label: 'Under ₹300', min: '', max: '300' },
    { label: '₹300 - ₹500', min: '300', max: '500' },
    { label: '₹500 - ₹1000', min: '500', max: '1000' },
    { label: '₹1000 - ₹1500', min: '1000', max: '1500' },
    { label: 'Over ₹1500', min: '1500', max: '' },
  ];

  useEffect(() => {
    fetchProducts();
  }, [searchParams]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.category) params.append('category', filters.category);
      if (filters.search) params.append('search', filters.search);
      if (filters.color) params.append('color', filters.color);
      if (filters.size) params.append('size', filters.size);
      if (filters.min_price) params.append('min_price', filters.min_price);
      if (filters.max_price) params.append('max_price', filters.max_price);
      if (filters.impact_series_id) params.append('impact_series_id', filters.impact_series_id);

      const response = await axios.get(`${API}/products?${params}`);
      setProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch products:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateFilter = (key, value) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);

    const params = new URLSearchParams();
    Object.entries(newFilters).forEach(([k, v]) => {
      if (v) params.append(k, v);
    });
    setSearchParams(params);
  };

  const handleQuickAdd = async (e, product, size) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      // setAddingToCart({ id: product.id, size }); // This line was in the provided snippet but not defined in the original code.
      await addToCart(product.id, 1, size, product.colors[0] || 'Default', product);
      toast.success('Added to cart!');
    } catch (error) {
      if (error.response && error.response.status === 401) {
        toast.error('Please login to add to cart');
      } else {
        toast.error('Failed to add to cart');
      }
    }
  };

  const clearFilters = () => {
    setFilters({
      category: '',
      search: '',
      color: '',
      size: '',
      min_price: '',
      max_price: '',
      impact_series_id: '',
    });
    setSearchParams({});
  };

  return (
    <div data-testid="products-page">
      {/* Title Bar */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <h1 className="text-4xl font-bold uppercase" data-testid="products-title">
            {impactSeriesTitle ? impactSeriesTitle : filters.category ? filters.category : 'ALL PRODUCTS'}
          </h1>
          <p className="text-gray-600 mt-2">{products.length} PRODUCTS</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="sticky top-20 bg-white border-b border-gray-200 z-40" data-testid="filter-bar">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-wrap gap-4">
            {/* Category Filter */}
            <div className="relative">
              <select
                value={filters.category}
                onChange={(e) => updateFilter('category', e.target.value)}
                className="appearance-none border border-gray-300 px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                data-testid="filter-category"
              >
                <option value="">CATEGORY</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat === 'All' ? '' : cat.toLowerCase()}>
                    {cat}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" size={16} />
            </div>

            {/* Size Filter */}
            <div className="relative">
              <select
                value={filters.size}
                onChange={(e) => updateFilter('size', e.target.value)}
                className="appearance-none border border-gray-300 px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                data-testid="filter-size"
              >
                <option value="">SIZE</option>
                {sizes.map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" size={16} />
            </div>

            {/* Color Filter */}
            <div className="relative">
              <select
                value={filters.color}
                onChange={(e) => updateFilter('color', e.target.value)}
                className="appearance-none border border-gray-300 px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                data-testid="filter-color"
              >
                <option value="">COLOR</option>
                {colors.map((color) => (
                  <option key={color} value={color}>
                    {color}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" size={16} />
            </div>

            {/* Price Filter */}
            <div className="relative">
              <select
                value={`${filters.min_price}-${filters.max_price}`}
                onChange={(e) => {
                  const [min, max] = e.target.value.split('-');
                  updateFilter('min_price', min);
                  updateFilter('max_price', max);
                }}
                className="appearance-none border border-gray-300 px-4 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-black cursor-pointer"
                data-testid="filter-price"
              >
                {priceRanges.map((range) => (
                  <option key={range.label} value={`${range.min}-${range.max}`}>
                    {range.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" size={16} />
            </div>

            {/* Clear Filters */}
            {(filters.category || filters.size || filters.color || filters.min_price || filters.max_price) && (
              <button
                onClick={clearFilters}
                className="border border-black px-4 py-2 font-medium hover:bg-black hover:text-white transition-colors"
                data-testid="clear-filters"
              >
                CLEAR FILTERS
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Products Grid */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        {loading ? (
          <div className="text-center py-20">Loading products...</div>
        ) : products.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-xl text-gray-600">No products found</p>
            <button
              onClick={clearFilters}
              className="mt-4 bg-black text-white px-8 py-3 font-bold hover:bg-gray-800"
            >
              CLEAR FILTERS
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12" data-testid="products-grid">
            {products.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.id}`}
                className="product-card group"
                data-testid={`product-card-${product.id}`}
              >
                <div className="relative aspect-[4/5] bg-gray-100 mb-4 overflow-hidden">
                  {product.badge && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 uppercase z-10 tracking-wider">
                      {product.badge}
                    </div>
                  )}
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Quick Add Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-xs font-bold text-center mb-2 uppercase">Quick Add to Cart</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {product.sizes.map(size => (
                        <button
                          key={size}
                          onClick={(e) => handleQuickAdd(e, product, size)}
                          title="Add to Cart"
                          className="border border-black min-w-[32px] h-8 px-1 text-xs font-bold hover:bg-black hover:text-white transition-colors"
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">{product.colors.length} COLOR{product.colors.length > 1 ? 'S' : ''}</p>
                <h3 className="font-bold text-sm mb-1">{product.name}</h3>
                {((globalDiscount || 0) + (product.discount_percentage || 0)) > 0 ? (
                  <div className="flex gap-2 items-center">
                    <p className="font-medium text-gray-500 line-through text-xs">₹{product.price.toFixed(0)}</p>
                    <p className="font-medium text-red-600">₹{(product.price * (1 - ((globalDiscount || 0) + (product.discount_percentage || 0)) / 100)).toFixed(0)}</p>
                  </div>
                ) : (
                  <p className="font-medium">₹{product.price.toFixed(0)}</p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Products;
