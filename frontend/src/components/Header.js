import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, Heart, ShoppingCart, User, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';

const Header = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { user, logout } = useAuth();
  const { cartCount } = useCart();
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${searchQuery}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  return (
    <header className="header-sticky bg-black text-white" data-testid="main-header">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <Link to="/" className="text-2xl font-bold tracking-wider" data-testid="logo-link">
            LAST GEAR
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link to="/products?category=t-shirts" className="hover:text-gray-300 transition-colors" data-testid="nav-tshirts">
              T-SHIRTS
            </Link>
            <Link to="/products?category=hoodies" className="hover:text-gray-300 transition-colors" data-testid="nav-hoodies">
              HOODIES
            </Link>
            <Link to="/products" className="hover:text-gray-300 transition-colors" data-testid="nav-all">
              ALL PRODUCTS
            </Link>
          </nav>

          {/* Icons */}
          <div className="flex items-center space-x-6">
            <button 
              onClick={() => setSearchOpen(!searchOpen)} 
              className="hover:text-gray-300 transition-colors"
              data-testid="search-icon"
            >
              <Search size={20} strokeWidth={1.5} />
            </button>
            
            {user && (
              <Link to="/wishlist" className="hover:text-gray-300 transition-colors" data-testid="wishlist-icon">
                <Heart size={20} strokeWidth={1.5} />
              </Link>
            )}
            
            <Link to="/cart" className="relative hover:text-gray-300 transition-colors" data-testid="cart-icon">
              <ShoppingCart size={20} strokeWidth={1.5} />
              {cartCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center" data-testid="cart-count">
                  {cartCount}
                </span>
              )}
            </Link>
            
            {user ? (
              <Link to="/account" className="hover:text-gray-300 transition-colors" data-testid="account-icon">
                <User size={20} strokeWidth={1.5} />
              </Link>
            ) : (
              <Link to="/login" className="hover:text-gray-300 transition-colors" data-testid="login-icon">
                <User size={20} strokeWidth={1.5} />
              </Link>
            )}
            
            <button 
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)} 
              className="md:hidden hover:text-gray-300 transition-colors"
              data-testid="mobile-menu-icon"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Search Bar */}
        {searchOpen && (
          <div className="py-4 border-t border-gray-800" data-testid="search-bar">
            <form onSubmit={handleSearch} className="flex">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="flex-1 bg-gray-900 text-white px-4 py-2 focus:outline-none focus:ring-2 focus:ring-white"
                data-testid="search-input"
              />
              <button type="submit" className="bg-white text-black px-6 py-2 font-bold hover:bg-gray-200" data-testid="search-submit">
                SEARCH
              </button>
            </form>
          </div>
        )}

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <nav className="md:hidden py-4 border-t border-gray-800 space-y-4" data-testid="mobile-menu">
            <Link to="/products?category=t-shirts" className="block hover:text-gray-300" onClick={() => setMobileMenuOpen(false)}>
              T-SHIRTS
            </Link>
            <Link to="/products?category=hoodies" className="block hover:text-gray-300" onClick={() => setMobileMenuOpen(false)}>
              HOODIES
            </Link>
            <Link to="/products" className="block hover:text-gray-300" onClick={() => setMobileMenuOpen(false)}>
              ALL PRODUCTS
            </Link>
            {user && (
              <Link to="/account" className="block hover:text-gray-300" onClick={() => setMobileMenuOpen(false)}>
                MY ACCOUNT
              </Link>
            )}
          </nav>
        )}
      </div>
    </header>
  );
};

export default Header;