import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { globalDiscount } = useSettings() || { globalDiscount: 0 };
  const [product, setProduct] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
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

      // Fetch related products from same category
      try {
        const relatedRes = await axios.get(`${API}/products?category=${response.data.category}`);
        // Filter out current product and keep at most 5
        const filtered = relatedRes.data.filter(p => p.id !== id).slice(0, 5);
        setRelatedProducts(filtered);
      } catch (relatedErr) {
        console.error('Failed to fetch related products', relatedErr);
      }

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

  const currentStock = product?.size_stock?.[selectedSize] ?? product?.stock ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="product-detail-page">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
        {/* Image */}
        <div className="md:col-span-5">
          <div className="aspect-[4/5] bg-gray-100" data-testid="product-image">
            <img
              src={product.images[0]}
              alt={product.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Product Info */}
        <div className="md:col-span-7 sticky top-32 self-start">
          <h1 className="text-4xl font-bold mb-4" data-testid="product-name">{product.name}</h1>

          {globalDiscount > 0 ? (
            <div className="flex gap-4 items-center mb-6">
              <p className="text-3xl font-medium text-gray-400 line-through">₹{product.price.toFixed(0)}</p>
              <p className="text-3xl font-medium text-red-600">₹{(product.price * (1 - globalDiscount / 100)).toFixed(0)}</p>
              <span className="bg-red-100 text-red-800 text-sm font-bold px-2 py-1 rounded border border-red-200">-{globalDiscount}% OFF</span>
            </div>
          ) : (
            <p className="text-3xl font-medium mb-6" data-testid="product-price">₹{product.price.toFixed(0)}</p>
          )}

          <p className="text-gray-600 mb-8" data-testid="product-description">{product.description}</p>

          {/* Color Selection */}
          <div className="mb-6">
            <h3 className="font-bold mb-3">COLOR: {selectedColor}</h3>
            <div className="flex gap-3">
              {product.colors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={`px-6 py-3 border-2 font-medium transition-colors ${selectedColor === color
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
                  className={`w-16 h-12 border-2 font-medium transition-colors ${selectedSize === size
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
              disabled={addingToCart || currentStock === 0}
              className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="add-to-cart-button"
            >
              {addingToCart ? (
                'ADDING...'
              ) : currentStock === 0 ? (
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
                className={`w-full border-2 py-4 font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${isInWishlist
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
            {currentStock > 0 ? (
              <>
                <Check size={16} className="text-green-600" />
                <span className={currentStock < 10 ? 'text-red-600 font-bold' : ''}>
                  {currentStock} units in stock
                </span>
              </>
            ) : (
              <span className="text-red-600 font-bold">Currently unavailable in this size</span>
            )}
          </div>
        </div>
      </div>

      {/* Recommended Products */}
      {relatedProducts.length > 0 && (
        <div className="mt-32">
          <h2 className="text-2xl font-bold mb-8 text-center uppercase tracking-wider">You May Also Like</h2>
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-4 gap-y-12">
            {relatedProducts.map((relatedProd) => (
              <Link
                key={relatedProd.id}
                to={`/products/${relatedProd.id}`}
                className="product-card group"
              >
                <div className="relative aspect-[4/5] bg-gray-100 mb-4 overflow-hidden">
                  {relatedProd.badge && (
                    <div className="absolute top-3 left-3 bg-red-600 text-white text-[10px] font-bold px-2 py-1 uppercase z-10 tracking-wider">
                      {relatedProd.badge}
                    </div>
                  )}
                  <img
                    src={relatedProd.images[0]}
                    alt={relatedProd.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  {/* Quick Add Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 bg-white/95 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                    <p className="text-xs font-bold text-center mb-2 uppercase">Quick Add to Cart</p>
                    <div className="flex justify-center gap-2 flex-wrap">
                      {relatedProd.sizes.map(size => (
                        <button
                          key={size}
                          onClick={async (e) => {
                            e.preventDefault();
                            if (!user) {
                              toast.error('Please login to add items');
                              navigate('/login');
                              return;
                            }
                            await addToCart(relatedProd.id, 1, size, relatedProd.colors[0]);
                            toast.success('Added to cart!');
                          }}
                          className="border border-black min-w-[32px] h-8 px-1 text-xs font-bold hover:bg-black hover:text-white transition-colors"
                        >
                          {size}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">{relatedProd.colors.length} COLOR{relatedProd.colors.length > 1 ? 'S' : ''}</p>
                <h3 className="font-bold text-sm mb-1">{relatedProd.name}</h3>
                {((globalDiscount || 0) + (relatedProd.discount_percentage || 0)) > 0 ? (
                  <div className="flex gap-2 items-center">
                    <p className="font-medium text-gray-500 line-through text-xs">₹{relatedProd.price.toFixed(0)}</p>
                    <p className="font-medium text-red-600">₹{(relatedProd.price * (1 - ((globalDiscount || 0) + (relatedProd.discount_percentage || 0)) / 100)).toFixed(0)}</p>
                  </div>
                ) : (
                  <p className="font-medium">₹{relatedProd.price.toFixed(0)}</p>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductDetail;