import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight, ChevronLeft, TrendingUp, Package, Truck, ArrowRight } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';


const Home = () => {
  const navigate = useNavigate();
  const [heroBanners, setHeroBanners] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [impactSeriesData, setImpactSeriesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { addToCart } = useCart();
  const { globalDiscount, freeShippingThreshold } = useSettings() || { globalDiscount: 0, freeShippingThreshold: 1500 };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (heroBanners.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? heroBanners.length - 1 : prev - 1));

  const fetchHeroBanners = async () => {
    try {
      const response = await axios.get(`${API}/hero-banners`);
      setHeroBanners(response.data);
    } catch (error) {
      console.error('Failed to fetch hero banners:', error);
    }
  };

  const fetchFeaturedProducts = async () => {
    try {
      const response = await axios.get(`${API}/products?featured=true`);
      setFeaturedProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    }
  };

  const fetchActiveImpactSeries = async () => {
    try {
      const response = await axios.get(`${API}/impact-series/active`);
      setImpactSeriesData(response.data);
    } catch (error) {
      if (error.response && error.response.status !== 404) {
        console.error('Failed to fetch impact series:', error);
      }
    }
  };

  useEffect(() => {
    const fetchHomeData = async () => {
      setLoading(true);
      await Promise.all([fetchHeroBanners(), fetchFeaturedProducts(), fetchActiveImpactSeries()]);
      setLoading(false);
    };
    fetchHomeData();
  }, []);

  const handleQuickAdd = async (e, product, size) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      setAddingToCart({ id: product.id, size });
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

  return (
    <div data-testid="home-page">
      {/* Hero Carousel Section */}
      {heroBanners.length > 0 && (
        <section className="relative h-[600px] md:h-[700px] bg-black overflow-hidden group" data-testid="hero-section">
          {heroBanners.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
                }`}
            >
              <img
                src={slide.image}
                alt={slide.title}
                className="w-full h-full object-cover opacity-70"
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className={`text-center text-white transform transition-all duration-1000 ${index === currentSlide ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0'
                    }`}
                >
                  <h1
                    className="text-5xl md:text-8xl font-bold mb-4 font-puma tracking-wider uppercase text-white"
                    style={{ WebkitTextStroke: '2px black' }}
                  >
                    {slide.title}
                  </h1>
                  <p className="text-xl md:text-2xl mb-8 font-medium tracking-widest">
                    {slide.subtitle}
                  </p>
                  <Link
                    to={slide.link}
                    className="inline-flex items-center bg-white text-black px-10 py-4 font-bold uppercase tracking-widest hover:bg-gray-200 transition-colors"
                  >
                    {slide.button_text || 'SHOP NOW'} <ArrowRight className="ml-2" size={20} />
                  </Link>
                </div>
              </div>
            </div>
          ))}

          {/* Carousel Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-sm"
            aria-label="Previous Slide"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/20 hover:bg-white/40 text-white p-3 rounded-full opacity-0 group-hover:opacity-100 transition-all z-20 backdrop-blur-sm"
            aria-label="Next Slide"
          >
            <ChevronRight size={32} />
          </button>

          {/* Carousel Indicators */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-3 z-20">
            {heroBanners.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentSlide(index)}
                className={`w-3 h-3 rounded-full transition-all ${index === currentSlide ? 'bg-white w-10' : 'bg-white/50 hover:bg-white/80'
                  }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </section>
      )}

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-4 py-20" data-testid="categories-section">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <Link to="/products?category=t-shirts" className="relative group overflow-hidden" data-testid="category-tshirts">
            <div className="aspect-[4/5] bg-gray-100">
              <img
                src="https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=800"
                alt="T-Shirts Collection"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white p-6">
              <h2 className="text-3xl font-bold mb-2">T-SHIRTS</h2>
              <div className="flex items-center text-sm">
                <span>EXPLORE COLLECTION</span>
                <ChevronRight size={16} className="ml-2" />
              </div>
            </div>
          </Link>

          <Link to="/products?category=hoodies" className="relative group overflow-hidden" data-testid="category-hoodies">
            <div className="aspect-[4/5] bg-gray-100">
              <img
                src="https://images.unsplash.com/photo-1590759483822-b2fee5aa6bd3?w=800"
                alt="Hoodies Collection"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
            </div>
            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-80 text-white p-6">
              <h2 className="text-3xl font-bold mb-2">HOODIES</h2>
              <div className="flex items-center text-sm">
                <span>EXPLORE COLLECTION</span>
                <ChevronRight size={16} className="ml-2" />
              </div>
            </div>
          </Link>
        </div>
      </section>

      {/* Impact Series Section - Only renders if there is active data */}
      {impactSeriesData && (
        <section className="relative py-24 bg-black text-white overflow-hidden" data-testid="impact-series-section">
          {/* Background Image with Overlay */}
          <div className="absolute inset-0 z-0">
            <img
              src={impactSeriesData.image}
              alt="Impact Series Background"
              className="w-full h-full object-cover opacity-40 grayscale"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent"></div>
          </div>

          <div className="relative z-10 max-w-7xl mx-auto px-4 flex flex-col items-center text-center">
            <div className="mb-6 flex items-center gap-4">
              <span className="h-px w-12 bg-white/50"></span>
              <span className="text-sm font-bold tracking-[0.3em] text-white/80">{impactSeriesData.subtitle} // {impactSeriesData.edition}</span>
              <span className="h-px w-12 bg-white/50"></span>
            </div>

            <h2 className="text-5xl md:text-7xl font-bold mb-6 font-puma tracking-tight uppercase">
              {impactSeriesData.title}
            </h2>

            <p className="max-w-2xl text-lg md:text-xl text-gray-300 mb-10 leading-relaxed">
              {impactSeriesData.description}
            </p>

            <Link
              to={`/products?impact_series_id=${impactSeriesData.id}&impact_series_title=${encodeURIComponent(impactSeriesData.title)}`}
              className="group relative inline-flex items-center justify-center px-8 py-4 bg-white text-black font-bold uppercase tracking-widest overflow-hidden transition-all hover:scale-105"
            >
              <span className="relative z-10 flex items-center">
                EXPLORE THE SERIES <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </span>
              <div className="absolute inset-0 bg-gray-200 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform ease-out duration-300"></div>
            </Link>
          </div>
        </section>
      )}

      {/* Featured Products */}
      <section className="bg-gray-50 py-20" data-testid="featured-products-section">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">NEW ARRIVALS</h2>

          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12">
              {featuredProducts.slice(0, 8).map((product) => (
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
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-20" data-testid="features-section">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
          <div>
            <div className="inline-block p-4 bg-black text-white rounded-full mb-4">
              <TrendingUp size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">PREMIUM QUALITY</h3>
            <p className="text-gray-600">High-quality materials and craftsmanship</p>
          </div>
          <div>
            <div className="inline-block p-4 bg-black text-white rounded-full mb-4">
              <Truck size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">FREE SHIPPING</h3>
            <p className="text-gray-600">On orders over ₹{freeShippingThreshold} or selected items</p>
          </div>
          <div>
            <div className="inline-block p-4 bg-black text-white rounded-full mb-4">
              <Package size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">EASY RETURNS</h3>
            <p className="text-gray-600">7-day return policy</p>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="bg-black text-white py-20" data-testid="newsletter-section">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-4">STAY UPDATED</h2>
          <p className="text-gray-400 mb-8">Subscribe to get special offers and updates</p>
          <form className="flex flex-col md:flex-row gap-4" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 px-6 py-4 bg-white text-black focus:outline-none focus:ring-2 focus:ring-white"
              data-testid="newsletter-input"
            />
            <button
              type="submit"
              className="px-12 py-4 bg-white text-black font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
              data-testid="newsletter-submit"
            >
              Subscribe
            </button>
          </form>
        </div>
      </section>
    </div>
  );
};

export default Home;