import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Trash2, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import BrandLoader from '../components/BrandLoader';
import { toast } from 'sonner';

const Wishlist = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [wishlist, setWishlist] = useState({ products: [] });
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (!user) {
      toast.error('Please login to view wishlist');
      navigate('/login?redirect=/wishlist');
      return;
    }
    fetchWishlist();
  }, [user]);

  const fetchWishlist = async () => {
    try {
      const response = await axios.get(`${API}/wishlist`);
      setWishlist(response.data);
    } catch (error) {
      console.error('Failed to fetch wishlist:', error);
      toast.error('Failed to load wishlist');
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId) => {
    try {
      await axios.delete(`${API}/wishlist/${productId}`);
      toast.success('Removed from wishlist');
      fetchWishlist();
    } catch (error) {
      console.error('Failed to remove from wishlist:', error);
      toast.error('Failed to remove item');
    }
  };

  if (!user) {
    return null;
  }

  if (loading) {
    return <BrandLoader minHeight="72vh" eyebrow="Wishlist" />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="wishlist-page">
      <h1 className="text-4xl font-bold mb-8">MY WISHLIST</h1>

      {wishlist.products.length === 0 ? (
        <div className="text-center py-20" data-testid="empty-wishlist">
          <ShoppingBag size={64} className="mx-auto mb-4 text-gray-400" />
          <p className="text-xl text-gray-600 mb-6">Your wishlist is empty</p>
          <Link
            to="/products"
            className="inline-block bg-black text-white px-12 py-4 font-bold uppercase tracking-wider hover:bg-gray-800"
            data-testid="browse-products"
          >
            Browse Products
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12" data-testid="wishlist-grid">
          {wishlist.products.map((product) => (
            <div key={product.id} className="relative group" data-testid={`wishlist-item-${product.id}`}>
              <Link to={`/products/${product.id}`} className="product-card">
                <div className="aspect-[4/5] bg-white mb-4 overflow-hidden">
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-xs text-gray-500 mb-1">{product.colors.length} COLOR{product.colors.length > 1 ? 'S' : ''}</p>
                <h3 className="font-bold text-sm mb-1">{product.name}</h3>
                <p className="font-medium">₹{product.price.toFixed(0)}</p>
              </Link>
              <button
                onClick={() => removeFromWishlist(product.id)}
                className="absolute top-2 right-2 bg-white p-2 rounded-full shadow-lg hover:bg-red-600 hover:text-white transition-colors"
                data-testid={`remove-wishlist-${product.id}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Wishlist;
