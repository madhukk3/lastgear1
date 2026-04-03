import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { ArrowRight, ChevronLeft, ChevronRight, Package, TrendingUp, Truck } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { useSettings } from '../context/SettingsContext';
import { toast } from 'sonner';

const Home = () => {
  const [heroBanners, setHeroBanners] = useState([]);
  const [featuredProducts, setFeaturedProducts] = useState([]);
  const [impactSeriesData, setImpactSeriesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSlide, setCurrentSlide] = useState(0);
  const { addToCart } = useCart();
  const { globalDiscount, freeShippingThreshold } = useSettings() || { globalDiscount: 0, freeShippingThreshold: 1500 };

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;
  const activeHero = heroBanners[currentSlide] || null;

  useEffect(() => {
    if (heroBanners.length === 0) return undefined;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [heroBanners.length]);

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

  const nextSlide = () => setCurrentSlide((prev) => (prev + 1) % heroBanners.length);
  const prevSlide = () => setCurrentSlide((prev) => (prev === 0 ? heroBanners.length - 1 : prev - 1));

  return (
    <div className="bg-[#f3efe7] text-[#16120d]" data-testid="home-page">
      <section className="relative overflow-hidden border-b border-black/10 bg-[#120e0b]" data-testid="hero-section">
        <div className="absolute inset-0">
          {heroBanners.length > 0 ? (
            heroBanners.map((slide, index) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'}`}
              >
                <img src={slide.image} alt={slide.title} className="hero-pan h-full w-full object-cover scale-[1.04]" />
              </div>
            ))
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#53341b_0%,#120e0b_42%,#080705_100%)]" />
          )}
          <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(8,6,5,0.9)_10%,rgba(8,6,5,0.35)_42%,rgba(8,6,5,0.82)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(217,145,70,0.32),transparent_26%),linear-gradient(to_bottom,transparent,rgba(0,0,0,0.5))]" />
          <div className="lastgear-grid absolute inset-0 opacity-20" />
        </div>

        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl grid-cols-1 gap-12 px-4 py-16 md:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:py-24">
          <div className="max-w-3xl text-white">
            <div className="fade-up mb-6 inline-flex items-center gap-3 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.38em] text-white/80 backdrop-blur" style={{ '--delay': '0.1s' }}>
              <span>LAST GEAR</span>
              <span className="h-1 w-1 rounded-full bg-[#d99146]" />
              <span>Premium Streetwear</span>
            </div>

            <h1 className="fade-up max-w-4xl font-display text-[4rem] uppercase leading-[0.88] tracking-[0.04em] text-[#f8f2ea] md:text-[6rem] lg:text-[8rem]" style={{ '--delay': '0.18s' }}>
              Shift Into
              <span className="block text-transparent stroke-text">LAST GEAR</span>
            </h1>

            <p className="fade-up mt-6 max-w-2xl text-base leading-7 text-white/72 md:text-lg" style={{ '--delay': '0.26s' }}>
              Sharp fits. Bold mood. Pure drop energy.
            </p>

            <div className="fade-up mt-10 flex flex-col gap-4 sm:flex-row" style={{ '--delay': '0.34s' }}>
              <Link
                to={activeHero?.link || '/products'}
                className="shimmer-link pulse-glow inline-flex items-center justify-center gap-3 rounded-full bg-[#f1e6d8] px-8 py-4 text-sm font-bold uppercase tracking-[0.28em] text-[#120e0b] transition hover:bg-white"
              >
                {activeHero?.button_text || 'Shop The Drop'}
                <ArrowRight size={18} />
              </Link>
              <Link
                to="/about"
                className="shimmer-link inline-flex items-center justify-center gap-3 rounded-full border border-white/30 px-8 py-4 text-sm font-semibold uppercase tracking-[0.28em] text-white transition hover:bg-white/10"
              >
                Discover LAST GEAR
              </Link>
            </div>
          </div>

          <div className="fade-in grid gap-4 self-end lg:justify-self-end" style={{ '--delay': '0.28s' }}>
            <div className="rounded-[32px] border border-white/15 bg-white/10 p-6 text-white shadow-[0_20px_80px_rgba(0,0,0,0.35)] backdrop-blur-md">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-[0.3em] text-white/60">Now Showing</span>
                <span className="text-sm text-[#f0d9c0]">{String(currentSlide + 1).padStart(2, '0')}/{String(Math.max(heroBanners.length, 1)).padStart(2, '0')}</span>
              </div>
              <h2 className="font-display text-4xl uppercase leading-none text-[#f7f1e8]">
                {activeHero?.title || 'Wear The Final Shift'}
              </h2>
              <p className="mt-4 text-sm leading-6 text-white/70">
                {activeHero?.subtitle || 'Built to stand out.'}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-[24px] border border-white/12 bg-black/25 p-4 text-white backdrop-blur-sm">
                <div className="font-display text-2xl uppercase text-[#d99146]">01</div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/62">Fashion Division</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-black/25 p-4 text-white backdrop-blur-sm">
                <div className="font-display text-2xl uppercase text-[#d99146]">New</div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/62">Premium Drops</p>
              </div>
              <div className="rounded-[24px] border border-white/12 bg-black/25 p-4 text-white backdrop-blur-sm">
                <div className="font-display text-2xl uppercase text-[#d99146]">Bold</div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-white/62">Street Energy</p>
              </div>
            </div>
          </div>
        </div>

        {heroBanners.length > 1 && (
          <>
            <button
              onClick={prevSlide}
              className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/25 p-3 text-white backdrop-blur transition hover:bg-white/15 lg:flex"
              aria-label="Previous Slide"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={nextSlide}
              className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full border border-white/20 bg-black/25 p-3 text-white backdrop-blur transition hover:bg-white/15 lg:flex"
              aria-label="Next Slide"
            >
              <ChevronRight size={24} />
            </button>

            <div className="absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-3">
              {heroBanners.map((slide, index) => (
                <button
                  key={slide.id}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all ${index === currentSlide ? 'w-16 bg-[#f1e6d8]' : 'w-6 bg-white/35 hover:bg-white/60'}`}
                  aria-label={`Go to slide ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6" data-testid="categories-section">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#8d5f32]">Shop By Drop</p>
            <h2 className="mt-2 font-display text-5xl uppercase leading-none text-[#120e0b] md:text-6xl">Choose Your Gear</h2>
          </div>
        </div>

        <div className="reveal-row grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <Link to="/products?category=t-shirts" className="group relative min-h-[540px] overflow-hidden rounded-[36px] bg-[#140f0b] text-white" data-testid="category-tshirts" style={{ '--stagger': 0 }}>
            <img src="https://images.unsplash.com/photo-1581655353564-df123a1eb820?w=1200" alt="T-Shirts Collection" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(0,0,0,0.18),rgba(0,0,0,0.74))]" />
            <div className="relative flex h-full flex-col justify-between p-8 md:p-10">
              <span className="w-fit rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/75">T-Shirts</span>
              <div>
                <p className="mb-3 text-sm uppercase tracking-[0.38em] text-[#f0d9c0]">Clean Impact</p>
                <h3 className="font-display text-6xl uppercase leading-[0.9] md:text-7xl">Everyday Heat</h3>
                <p className="mt-4 max-w-md text-sm leading-7 text-white/72">
                  Clean lines. Strong presence.
                </p>
                <span className="mt-8 inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-white">
                  Shop T-Shirts
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </Link>

          <Link to="/products?category=hoodies" className="group relative min-h-[540px] overflow-hidden rounded-[36px] bg-[#d6cdc0] text-[#120e0b]" data-testid="category-hoodies" style={{ '--stagger': 1 }}>
            <img src="https://images.unsplash.com/photo-1590759483822-b2fee5aa6bd3?w=1200" alt="Hoodies Collection" className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-105" />
            <div className="absolute inset-0 bg-[linear-gradient(140deg,rgba(240,232,223,0.22),rgba(18,14,11,0.56))]" />
            <div className="relative flex h-full flex-col justify-between p-8 md:p-10 text-white">
              <span className="w-fit rounded-full border border-white/25 bg-black/20 px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-white/80">Hoodies</span>
              <div>
                <p className="mb-3 text-sm uppercase tracking-[0.38em] text-[#f0d9c0]">Heavy Presence</p>
                <h3 className="font-display text-6xl uppercase leading-[0.9] md:text-7xl">Layered Power</h3>
                <p className="mt-4 max-w-md text-sm leading-7 text-white/72">
                  Heavy feel. Clear attitude.
                </p>
                <span className="mt-8 inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.28em] text-white">
                  Shop Hoodies
                  <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </div>
          </Link>
        </div>
      </section>

      {impactSeriesData && (
        <section className="relative overflow-hidden border-y border-black/10 bg-[#120e0b] py-24 text-white" data-testid="impact-series-section">
          <img src={impactSeriesData.image} alt={impactSeriesData.title || 'Impact Series'} className="absolute inset-0 h-full w-full object-cover opacity-30" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(18,14,11,0.92),rgba(18,14,11,0.56),rgba(18,14,11,0.92))]" />

          <div className="relative mx-auto grid max-w-7xl gap-10 px-4 md:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div className="rounded-[34px] border border-white/12 bg-white/8 p-8 backdrop-blur-md">
              <p className="text-sm uppercase tracking-[0.34em] text-[#d99146]">Impact Series</p>
              <h2 className="mt-4 font-display text-5xl uppercase leading-[0.92] text-[#f8f2ea] md:text-6xl">
                {impactSeriesData.title || 'Impact Series'}
              </h2>
              <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.25em] text-white/60">
                <span>{impactSeriesData.edition || 'Edition 01'}</span>
                <span>/</span>
                <span>{impactSeriesData.subtitle || 'Signature Drop'}</span>
              </div>
            </div>

            <div>
              <p className="max-w-2xl text-lg leading-8 text-white/74">
                {impactSeriesData.description || 'A drop with meaning.'}
              </p>
              <Link
                to={`/products?impact_series_id=${impactSeriesData.id}&impact_series_title=${encodeURIComponent(impactSeriesData.title)}`}
                className="mt-8 inline-flex items-center gap-3 rounded-full bg-[#f1e6d8] px-8 py-4 text-sm font-bold uppercase tracking-[0.26em] text-[#120e0b] transition hover:bg-white"
              >
                Shop The Series
                <ArrowRight size={18} />
              </Link>
            </div>
          </div>
        </section>
      )}

      <section className="mx-auto max-w-7xl px-4 py-20 md:px-6" data-testid="featured-products-section">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.34em] text-[#8d5f32]">Featured Drop</p>
            <h2 className="mt-2 font-display text-5xl uppercase leading-none text-[#120e0b] md:text-6xl">New Arrivals</h2>
          </div>
          <Link to="/products" className="inline-flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.26em] text-[#120e0b] transition hover:text-[#8d5f32]">
            See Full Collection
            <ArrowRight size={18} />
          </Link>
        </div>

        {loading ? (
          <div className="rounded-[28px] border border-black/10 bg-white/70 px-6 py-16 text-center text-black/60">
            Loading the newest pieces...
          </div>
        ) : (
          <div className="reveal-row grid grid-cols-2 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4">
            {featuredProducts.slice(0, 8).map((product) => {
              const totalDiscount = (globalDiscount || 0) + (product.discount_percentage || 0);
              const discountedPrice = product.price * (1 - totalDiscount / 100);

              return (
                <Link
                  key={product.id}
                  to={`/products/${product.id}`}
                  className="group overflow-hidden rounded-[30px] border border-black/10 bg-white/80 shadow-[0_16px_44px_rgba(15,10,6,0.08)] transition duration-300 hover:shadow-[0_24px_64px_rgba(15,10,6,0.14)]"
                  data-testid={`product-card-${product.id}`}
                  style={{ '--stagger': featuredProducts.indexOf(product) }}
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-[#e7dfd3]">
                    {product.badge && (
                      <div className="absolute left-4 top-4 z-10 rounded-full bg-[#120e0b] px-3 py-2 text-[10px] font-bold uppercase tracking-[0.25em] text-[#f1e6d8]">
                        {product.badge}
                      </div>
                    )}
                    <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover transition duration-700 group-hover:scale-110" />
                    <div className="absolute inset-x-0 bottom-0 translate-y-full bg-[linear-gradient(to_top,rgba(18,14,11,0.96),rgba(18,14,11,0.78),transparent)] p-4 transition duration-300 group-hover:translate-y-0">
                      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.22em] text-[#f0d9c0]">Quick Add</p>
                      <div className="flex flex-wrap gap-2">
                        {product.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={(e) => handleQuickAdd(e, product, size)}
                            title="Add to Cart"
                            className="rounded-full border border-white/20 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white hover:text-[#120e0b]"
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3 p-5">
                    <p className="text-[11px] uppercase tracking-[0.26em] text-black/42">
                      {product.colors.length} color{product.colors.length > 1 ? 's' : ''}
                    </p>
                    <h3 className="font-display text-2xl uppercase leading-none text-[#120e0b]">
                      {product.name}
                    </h3>
                    {totalDiscount > 0 ? (
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-black/35 line-through">₹{product.price.toFixed(0)}</p>
                        <p className="text-lg font-semibold text-[#8d2d17]">₹{discountedPrice.toFixed(0)}</p>
                      </div>
                    ) : (
                      <p className="text-lg font-semibold text-[#120e0b]">₹{product.price.toFixed(0)}</p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="border-y border-black/10 bg-[#e6ddcf] py-10">
        <div className="reveal-row mx-auto grid max-w-7xl gap-6 px-4 md:px-6 md:grid-cols-3">
          <div className="rounded-[26px] border border-black/10 bg-white/75 p-6" style={{ '--stagger': 0 }}>
            <div className="inline-flex rounded-full bg-[#120e0b] p-3 text-[#f1e6d8]">
              <TrendingUp size={24} strokeWidth={1.7} />
            </div>
            <h3 className="mt-4 font-display text-[2rem] uppercase leading-none text-[#120e0b]">Premium Quality</h3>
            <p className="mt-2 text-sm leading-6 text-black/64">Better fabric. Better feel.</p>
          </div>

          <div className="rounded-[26px] border border-black/10 bg-white/75 p-6" style={{ '--stagger': 1 }}>
            <div className="inline-flex rounded-full bg-[#120e0b] p-3 text-[#f1e6d8]">
              <Truck size={24} strokeWidth={1.7} />
            </div>
            <h3 className="mt-4 font-display text-[2rem] uppercase leading-none text-[#120e0b]">Free Shipping</h3>
            <p className="mt-2 text-sm leading-6 text-black/64">Free over ₹{freeShippingThreshold}. No extra noise.</p>
          </div>

          <div className="rounded-[26px] border border-black/10 bg-white/75 p-6" style={{ '--stagger': 2 }}>
            <div className="inline-flex rounded-full bg-[#120e0b] p-3 text-[#f1e6d8]">
              <Package size={24} strokeWidth={1.7} />
            </div>
            <h3 className="mt-4 font-display text-[2rem] uppercase leading-none text-[#120e0b]">Easy Exchanges</h3>
            <p className="mt-2 text-sm leading-6 text-black/64">Simple steps. Quick support.</p>
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#120e0b] py-24 text-white" data-testid="newsletter-section">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(217,145,70,0.22),transparent_30%),linear-gradient(to_bottom,transparent,rgba(0,0,0,0.35))]" />
        <div className="relative mx-auto max-w-4xl px-4 text-center md:px-6">
          <p className="text-sm font-semibold uppercase tracking-[0.36em] text-[#d99146]">Stay In The Shift</p>
          <h2 className="mt-4 font-display text-5xl uppercase leading-[0.92] text-[#f8f2ea] md:text-6xl">
            Be First For
            <span className="block">The Next Drop</span>
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-white/68">
            New drops. First access.
          </p>
          <form className="mx-auto mt-10 flex max-w-2xl flex-col gap-4 sm:flex-row" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Enter your email"
              className="flex-1 rounded-full border border-white/15 bg-white/10 px-6 py-4 text-white placeholder:text-white/45 focus:outline-none focus:ring-2 focus:ring-[#d99146]"
              data-testid="newsletter-input"
            />
            <button
              type="submit"
              className="rounded-full bg-[#f1e6d8] px-10 py-4 text-sm font-bold uppercase tracking-[0.28em] text-[#120e0b] transition hover:bg-white"
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
