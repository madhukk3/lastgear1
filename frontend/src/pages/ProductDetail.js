import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { toast } from 'sonner';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState('');
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchProduct();
    if (user) {
      checkWishlist();
    }
  }, [id, user]);

  const fetchProduct = async () => {
    try {
      const response = await axios.get(`${API}/products/${id}`);
      setProduct(response.data);
      setSelectedSize(response.data.sizes[0]);
      setSelectedColor(response.data.colors[0]);
    } catch (error) {
      console.error('Failed to fetch product:', error);
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  };

  const checkWishlist = async () => {
    try {
      const response = await axios.get(`${API}/wishlist`);
      const wishlistProductIds = response.data.products?.map(p => p.id) || [];
      setIsInWishlist(wishlistProductIds.includes(id));
    } catch (error) {
      console.error('Failed to check wishlist:', error);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('Please login to add items to cart');
      navigate('/login');
      return;
    }

    try {
      setAddingToCart(true);
      await addToCart(product.id, 1, selectedSize, selectedColor);
      toast.success('Added to cart!');
    } catch (error) {
      console.error('Failed to add to cart:', error);
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const toggleWishlist = async () => {
    if (!user) {
      toast.error('Please login to add to wishlist');
      navigate('/login');
      return;
    }

    try {
      if (isInWishlist) {
        await axios.delete(`${API}/wishlist/${product.id}`);
        setIsInWishlist(false);
        toast.success('Removed from wishlist');
      } else {
        await axios.post(`${API}/wishlist/${product.id}`);
        setIsInWishlist(true);
        toast.success('Added to wishlist');
      }
    } catch (error) {
      console.error('Failed to update wishlist:', error);
      toast.error('Failed to update wishlist');
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-20 text-center">Loading...</div>;
  }

  if (!product) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="product-detail-page">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Image */}
        <div>
          <div className="aspect-[4/5] bg-gray-100" data-testid="product-image">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Product Info */}
        <div className="sticky top-32 self-start">
          <h1 className="text-4xl font-bold mb-4" data-testid="product-name">{product.name}</h1>
          <p className="text-3xl font-medium mb-6" data-testid="product-price">₹{product.price.toFixed(0)}</p>
          <p className="text-gray-600 mb-8" data-testid="product-description">{product.description}</p>

          {/* Color Selection */}
          <div className="mb-6">
            <h3 className="font-bold mb-3">COLOR: {selectedColor}</h3>
            <div className="flex gap-3">
              {product.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-6 py-3 border-2 font-medium transition-colors ${
                    selectedColor === color
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 hover:border-black'
                  }`}
                  data-testid={`color-${color}`}
                >
                  {color}
                </button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="mb-8">
            <h3 className="font-bold mb-3">SIZE: {selectedSize}</h3>
            <div className="flex gap-3">
              {product.sizes.map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSize(size)}
                  className={`w-16 h-12 border-2 font-medium transition-colors ${
                    selectedSize === size
                      ? 'border-black bg-black text-white'
                      : 'border-gray-300 hover:border-black'
                  }`}
                  data-testid={`size-${size}`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-4">
            <button
              onClick={handleAddToCart}
              disabled={addingToCart || product.stock === 0}
              className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="add-to-cart-button"
            >
              {addingToCart ? (
                'ADDING...'
              ) : product.stock === 0 ? (
                'OUT OF STOCK'
              ) : (
                <>
                  <ShoppingCart size={20} />
                  ADD TO CART
                </>
              )}
            </button>

            {user && (
              <button
                onClick={toggleWishlist}
                className={`w-full border-2 py-4 font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${
                  isInWishlist
                    ? 'border-black bg-black text-white'
                    : 'border-black text-black hover:bg-black hover:text-white'
                }`}
                data-testid="wishlist-button"
              >
                <Heart size={20} fill={isInWishlist ? 'currentColor' : 'none'} />
                {isInWishlist ? 'IN WISHLIST' : 'ADD TO WISHLIST'}
              </button>
            )}
          </div>

          {/* Stock Info */}
          <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
            <Check size={16} className="text-green-600" />
            <span>{product.stock} units in stock</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;