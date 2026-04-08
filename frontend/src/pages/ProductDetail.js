import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { Heart, ShoppingCart, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import BackButton from '../components/BackButton';
import BrandLoader from '../components/BrandLoader';
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
  const [buyingNow, setBuyingNow] = useState(false);
  const [activeMedia, setActiveMedia] = useState(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const getYouTubeEmbedUrl = (url) => {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|\/shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : url;
  };

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
      if (typeof window !== 'undefined') {
        try {
          const savedProducts = JSON.parse(localStorage.getItem('lastgear_recently_viewed') || '[]');
          const nextProducts = [response.data, ...(Array.isArray(savedProducts) ? savedProducts : []).filter((item) => item.id !== response.data.id)].slice(0, 4);
          localStorage.setItem('lastgear_recently_viewed', JSON.stringify(nextProducts));
        } catch (storageError) {
          console.error('Failed to update recently viewed products:', storageError);
        }
      }
      setActiveMedia({ type: 'image', url: response.data.images[0] });
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
      await addToCart(product.id, 1, selectedSize, selectedColor, product);
    } catch (error) {
      console.error('Failed to add to cart:', error);
      toast.error('Failed to add to cart');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleBuyNow = async () => {
    const directBuyData = {
      product_id: product.id,
      name: product.name,
      price: product.price,
      quantity: 1,
      size: selectedSize,
      color: selectedColor,
      product: product
    };

    if (!user) {
      sessionStorage.setItem('directBuyItem', JSON.stringify(directBuyData));
      toast.error('Please login to checkout');
      navigate('/login?redirect=/checkout');
      return;
    }

    try {
      setBuyingNow(true);
      // Directly check out without adding to global cart
      navigate('/checkout', {
        state: {
          directBuyItem: directBuyData
        }
      });
    } catch (error) {
      console.error('Failed to buy now:', error);
      toast.error('Failed to process buy now');
    } finally {
      setBuyingNow(false);
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

  const handleMouseMove = (e) => {
    const { left, top, width, height } = e.target.getBoundingClientRect();
    const x = ((e.clientX - left) / width) * 100;
    const y = ((e.clientY - top) / height) * 100;
    setZoomPos({ x, y });
  };

  if (loading) {
    return <BrandLoader minHeight="72vh" eyebrow="Product" />;
  }

  if (!product) {
    return null;
  }

  const currentStock = product?.size_stock?.[selectedSize] ?? product?.stock ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12" data-testid="product-detail-page">
      <BackButton label="Back" className="mb-8 text-[#120e0b]" />
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
        {/* Media Gallery */}
        <div className="md:col-span-4 flex flex-col gap-4">

          {/* Main Viewer */}
          <div className="w-full bg-gray-100 aspect-[4/5] overflow-hidden relative" data-testid="product-main-media">
            {activeMedia?.type === 'video' ? (
              activeMedia.url.includes('youtube.com') || activeMedia.url.includes('youtu.be') ? (
                <iframe
                  src={getYouTubeEmbedUrl(activeMedia.url)}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video src={activeMedia.url} controls autoPlay loop className="w-full h-full object-cover" />
              )
            ) : (
              <div
                className="absolute inset-0 cursor-zoom-in"
                onMouseEnter={() => setIsZoomed(true)}
                onMouseLeave={() => setIsZoomed(false)}
                onMouseMove={handleMouseMove}
                style={{
                  backgroundImage: isZoomed ? `url(${activeMedia?.url})` : 'none',
                  backgroundPosition: `${zoomPos.x}% ${zoomPos.y}%`,
                  backgroundSize: '200%', // 2x Zoom level
                  backgroundRepeat: 'no-repeat'
                }}
              >
                <img
                  src={activeMedia?.url}
                  alt={product.name}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${isZoomed ? 'opacity-0' : 'opacity-100'}`}
                />
              </div>
            )}
          </div>

          {/* Thumbnails Row Below Image */}
          <div className="flex flex-row gap-3 overflow-x-auto pb-2 no-scrollbar w-full">
            {product.images.map((img, idx) => (
              <button
                key={idx}
                onClick={() => setActiveMedia({ type: 'image', url: img })}
                className={`w-20 md:w-24 aspect-[4/5] shrink-0 bg-gray-100 border-2 transition-all overflow-hidden ${activeMedia?.url === img ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <img src={img} alt={`${product.name} ${idx + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}

            {/* Video Thumbnail (if present) */}
            {product.video && (
              <button
                onClick={() => setActiveMedia({ type: 'video', url: product.video })}
                className={`w-20 md:w-24 aspect-[4/5] shrink-0 bg-gray-900 flex items-center justify-center border-2 transition-all ${activeMedia?.type === 'video' ? 'border-black opacity-100' : 'border-transparent opacity-60 hover:opacity-100'}`}
              >
                <span className="text-white text-xs font-bold tracking-widest uppercase">Video</span>
              </button>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="md:col-span-8 sticky top-32 self-start px-2 lg:px-8">
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
            <div className="flex gap-4">
              <button
                onClick={handleAddToCart}
                disabled={addingToCart || buyingNow || currentStock === 0}
                className="flex-1 border-2 border-black text-black py-4 font-bold uppercase tracking-wider hover:bg-black hover:text-white transition-colors disabled:border-gray-400 disabled:text-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                  className={`flex-1 border-2 py-4 font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-2 ${isInWishlist
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

            <button
              onClick={handleBuyNow}
              disabled={addingToCart || buyingNow || currentStock === 0}
              className="w-full bg-black text-white py-4 font-bold uppercase tracking-wider hover:bg-gray-800 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="buy-now-button"
            >
              {buyingNow ? (
                'PROCESSING...'
              ) : currentStock === 0 ? (
                'OUT OF STOCK'
              ) : (
                'BUY NOW'
              )}
            </button>
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
      {
        relatedProducts.length > 0 && (
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
                                // navigate('/login');
                                return;
                              }
                              try {
                                await addToCart(relatedProd.id, 1, size, relatedProd.colors[0], relatedProd);
                                toast.success('Added to cart!');
                              } catch (error) {
                                console.error('Failed to add related product to cart:', error);
                                toast.error('Failed to add to cart');
                              }
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
        )
      }
    </div >
  );
};

export default ProductDetail;
