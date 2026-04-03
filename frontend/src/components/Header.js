import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingCart, User, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import axios from 'axios';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  const [recommendations, setRecommendations] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef(null);

  const [announcements, setAnnouncements] = useState([]);
  const [currentAnnouncementIndex, setCurrentAnnouncementIndex] = useState(0);
  const [announcementActive, setAnnouncementActive] = useState(false);
  const [fadeStatus, setFadeStatus] = useState('opacity-100');

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (searchQuery.trim().length > 1) {
        try {
          const response = await axios.get(`${API}/products?search=${searchQuery}`);
          setRecommendations(response.data.slice(0, 5));
          setShowDropdown(true);
        } catch (error) {
          console.error('Failed to fetch recommendations:', error);
        }
      } else {
        setRecommendations([]);
        setShowDropdown(false);
      }
    };

    const delayDebounceFn = setTimeout(() => {
      fetchRecommendations();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, API]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await axios.get(`${API}/settings/announcement`);
        // Use announcements array if available, otherwise fallback to single text if exists
        const fetchedAnnouncements = response.data.announcements && response.data.announcements.length > 0
          ? response.data.announcements
          : response.data.announcement_text ? [response.data.announcement_text] : [];

        setAnnouncements(fetchedAnnouncements);
        setAnnouncementActive(response.data.announcement_active || false);
      } catch (error) {
        console.error('Failed to fetch announcement settings:', error);
      }
    };
    fetchSettings();
  }, [API]);

  useEffect(() => {
    if (announcements.length > 1 && announcementActive) {
      const intervalId = setInterval(() => {
        setFadeStatus('opacity-0');

        // Wait for the fade-out to complete before changing text
        setTimeout(() => {
          setCurrentAnnouncementIndex((prevIndex) => (prevIndex + 1) % announcements.length);
          setFadeStatus('opacity-100');
        }, 500); // 500ms should match the tailwind transition duration

      }, 4000); // Rotate every 4 seconds
      return () => clearInterval(intervalId);
    }
  }, [announcements, announcementActive]);

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${searchQuery}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const renderAnnouncement = (text) => {
    if (!text) return null;

    // Regex to match [Link Text](URL)
    const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;

    let match;
    while ((match = linkRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      parts.push(
        <a
          key={match.index}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-gray-500 transition-colors mx-1"
        >
          {match[1]}
        </a>
      );
      lastIndex = linkRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  return (
    <header className="header-sticky w-full z-50" data-testid="main-header">
      {/* Top Announcement Bar */}
      {announcementActive && announcements.length > 0 && (
        <div className="bg-[#f4f4f4] border-b border-gray-300 text-black w-full relative z-50 overflow-hidden">
          <div className="hidden lg:flex max-w-7xl mx-auto px-4 py-1.5 items-center justify-between gap-6">
            <div className={`min-w-0 flex-1 text-[10px] font-bold tracking-[0.32em] uppercase transition-opacity duration-500 ease-in-out ${fadeStatus}`} key={currentAnnouncementIndex}>
              <div className="truncate">
                {renderAnnouncement(announcements[currentAnnouncementIndex])}
              </div>
            </div>

            <div className="flex items-center space-x-4 whitespace-nowrap text-[13px] font-medium tracking-normal normal-case text-black">
              <Link to="/help" className="hover:text-gray-600 transition-colors">Help</Link>
              <span className="text-gray-400 font-normal">|</span>
              {user ? (
                <Link to="/account" className="hover:text-gray-600 transition-colors">Hi, {user.name.split(' ')[0]}</Link>
              ) : (
                <>
                  <Link to="/login" className="hover:text-gray-600 transition-colors">Sign Up</Link>
                  <span className="text-gray-400 font-normal">|</span>
                  <Link to="/login" className="hover:text-gray-600 transition-colors">Log In</Link>
                </>
              )}
            </div>
          </div>

          {/* Mobile Announcement Bar */}
          <div className={`lg:hidden px-4 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider truncate transition-opacity duration-500 ease-in-out ${fadeStatus}`} key={`mobile-${currentAnnouncementIndex}`}>
            {renderAnnouncement(announcements[currentAnnouncementIndex])}
          </div>
        </div>
      )}

      <div className="w-full border-b border-white/10 bg-[#120e0b]/95 text-white backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14 md:h-[60px]">
            {/* Logo with Image */}
            <Link to="/" className="flex items-center gap-3" data-testid="logo-link">
              <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-[34px] md:h-[40px] w-auto object-contain" />
              <div className="leading-none">
                <span className="block text-[28px] md:text-[32px] font-puma tracking-[0.18em]">LAST GEAR</span>
                <span className="hidden md:block text-[10px] uppercase tracking-[0.42em] text-white/50">Fashion Division</span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            <nav className="hidden lg:flex items-center space-x-8 font-nav text-[12px]">
              <Link to="/" className="hover:text-[#f0d9c0] transition-colors" data-testid="nav-home">
                Home
              </Link>
              <Link to="/products?category=t-shirts" className="hover:text-[#f0d9c0] transition-colors" data-testid="nav-tshirts">
                T-Shirts
              </Link>
              <Link to="/products?category=hoodies" className="hover:text-[#f0d9c0] transition-colors" data-testid="nav-hoodies">
                Hoodies
              </Link>
              <Link to="/about" className="hover:text-[#f0d9c0] transition-colors" data-testid="nav-about">
                About
              </Link>
              <Link to="/products" className="hover:text-[#f0d9c0] transition-colors" data-testid="nav-all">
                All Products
              </Link>
            </nav>

            {/* Icons */}
            <div className="flex items-center space-x-5">
              {/* Desktop Search Button */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="hidden lg:flex items-center space-x-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 transition-colors font-bold text-[11px] tracking-[0.24em] hover:border-[#d99146] hover:text-[#f0d9c0]"
                data-testid="search-btn-desktop"
              >
                <Search size={16} strokeWidth={2} />
                <span>SEARCH</span>
              </button>

              {/* Mobile Search Icon */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="lg:hidden hover:text-[#f0d9c0] transition-colors"
                data-testid="search-icon-mobile"
              >
                <Search size={20} strokeWidth={1.5} />
              </button>

              {user && (
                <Link to="/wishlist" className="hover:text-[#f0d9c0] transition-colors" data-testid="wishlist-icon">
                  <Heart size={20} strokeWidth={1.5} />
                </Link>
              )}

              <Link to="/cart" className="relative hover:text-[#f0d9c0] transition-colors" data-testid="cart-icon">
                <ShoppingCart size={20} strokeWidth={1.5} />
                {cartCount > 0 && (
                  <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#d99146] text-xs text-[#120e0b]" data-testid="cart-count">
                    {cartCount}
                  </span>
                )}
              </Link>

              {user ? (
                <Link to="/account" className="hover:text-[#f0d9c0] transition-colors" data-testid="account-icon">
                  <User size={20} strokeWidth={1.5} />
                </Link>
              ) : (
                <Link to="/login" className="hover:text-[#f0d9c0] transition-colors" data-testid="login-icon">
                  <User size={20} strokeWidth={1.5} />
                </Link>
              )}

              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden hover:text-[#f0d9c0] transition-colors"
                data-testid="mobile-menu-icon"
              >
                {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>

          {/* Search Bar */}
          {searchOpen && (
            <div className="relative border-t border-white/10 py-4" data-testid="search-bar" ref={searchRef}>
              <form onSubmit={handleSearch} className="flex">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={() => {
                    if (recommendations.length > 0) setShowDropdown(true);
                  }}
                  placeholder="Search products..."
                  className="flex-1 rounded-l-full border border-white/15 bg-white/8 px-5 py-3 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[#d99146]"
                  data-testid="search-input"
                />
                <button type="submit" className="rounded-r-full bg-[#f1e6d8] px-6 py-3 text-sm font-bold uppercase tracking-[0.2em] text-[#120e0b] transition-colors hover:bg-white" data-testid="search-submit">
                  SEARCH
                </button>
              </form>

              {/* Recommendations Dropdown */}
              {showDropdown && recommendations.length > 0 && (
                <div className="absolute top-full left-0 z-50 mt-2 max-h-96 w-full overflow-y-auto rounded-[24px] border border-black/10 bg-white text-black shadow-lg">
                  <div className="border-b border-gray-100 px-4 py-2 text-xs font-bold uppercase tracking-[0.2em] text-gray-500">
                    Recommended Products
                  </div>
                  <ul>
                    {recommendations.map((product) => (
                      <li key={product.id}>
                        <Link
                          to={`/products/${product.id}`}
                          className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100"
                          onClick={() => {
                            setSearchOpen(false);
                            setSearchQuery('');
                            setShowDropdown(false);
                          }}
                        >
                          <img src={product.images[0]} alt={product.name} className="w-12 h-16 object-cover" />
                          <div>
                            <p className="font-bold text-sm uppercase">{product.name}</p>
                            <p className="text-gray-600 font-medium mt-1">₹{product.price.toFixed(0)}</p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <nav className="lg:hidden space-y-4 border-t border-white/10 py-4 font-nav text-[13px]" data-testid="mobile-menu">
              <Link to="/" className="block hover:text-[#f0d9c0]" onClick={() => setMobileMenuOpen(false)}>
                Home
              </Link>
              <Link to="/products?category=t-shirts" className="block hover:text-[#f0d9c0]" onClick={() => setMobileMenuOpen(false)}>
                T-Shirts
              </Link>
              <Link to="/products?category=hoodies" className="block hover:text-[#f0d9c0]" onClick={() => setMobileMenuOpen(false)}>
                Hoodies
              </Link>
              <Link to="/about" className="block hover:text-[#f0d9c0]" onClick={() => setMobileMenuOpen(false)}>
                About
              </Link>
              <Link to="/products" className="block hover:text-[#f0d9c0]" onClick={() => setMobileMenuOpen(false)}>
                All Products
              </Link>
              {user && (
                <Link to="/account" className="block hover:text-[#f0d9c0]" onClick={() => setMobileMenuOpen(false)}>
                  MY ACCOUNT
                </Link>
              )}
            </nav>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
