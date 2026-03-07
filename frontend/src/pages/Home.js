import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ChevronRight, TrendingUp, Package, Truck } from 'lucide-react';

const Home = () => {
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    fetchFeaturedProducts();
  }, []);

  const fetchFeaturedProducts = async () => {
    try {
      const response = await axios.get(`${API}/products?featured=true`);
      setFeaturedProducts(response.data);
    } catch (error) {
      console.error('Failed to fetch featured products:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div data-testid="home-page">
      {/* Hero Section */}
      <section className="relative h-[600px] bg-black overflow-hidden" data-testid="hero-section">
        <img
          src="https://images.unsplash.com/photo-1762052508120-2607918d663f?w=1600"
          alt="LAST GEAR Hero"
          className="w-full h-full object-cover opacity-70"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h1 className="text-5xl md:text-7xl font-bold mb-6" data-testid="hero-title">
              LAST GEAR
            </h1>
            <p className="text-xl md:text-2xl mb-8 font-light">PREMIUM STREETWEAR COLLECTION</p>
            <Link
              to="/products"
              className="inline-block bg-white text-black px-12 py-4 font-bold uppercase tracking-wider hover:bg-gray-200 transition-colors"
              data-testid="shop-now-button"
            >
              Shop Now
            </Link>
          </div>
        </div>
      </section>

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

      {/* Featured Products */}
      <section className="bg-gray-50 py-20" data-testid="featured-products-section">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-4xl font-bold mb-12 text-center">NEW ARRIVALS</h2>
          
          {loading ? (
            <div className="text-center py-12">Loading...</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-12">
              {featuredProducts.map((product) => (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="product-card group"
                  data-testid={`product-card-${product.id}`}
                >
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
            <p className="text-gray-600">On orders over $50</p>
          </div>
          <div>
            <div className="inline-block p-4 bg-black text-white rounded-full mb-4">
              <Package size={32} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-bold mb-2">EASY RETURNS</h3>
            <p className="text-gray-600">30-day return policy</p>
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