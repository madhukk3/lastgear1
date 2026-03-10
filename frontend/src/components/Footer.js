import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="bg-black text-white mt-20" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-[56px] md:h-[64px] w-auto object-contain opacity-90" />
              <h3 className="text-2xl font-puma">LAST GEAR</h3>
            </div>
            <p className="text-gray-400 text-sm">Premium streetwear for the modern lifestyle.</p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="font-bold mb-4">SHOP</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/products?category=t-shirts" className="hover:text-white">T-Shirts</Link></li>
              <li><Link to="/products?category=hoodies" className="hover:text-white">Hoodies</Link></li>
              <li><Link to="/products" className="hover:text-white">All Products</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-bold mb-4">SUPPORT</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/" className="hover:text-white">Contact Us</Link></li>
              <li><Link to="/" className="hover:text-white">Shipping Info</Link></li>
              <li><Link to="/" className="hover:text-white">Returns</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="font-bold mb-4">ACCOUNT</h4>
            <ul className="space-y-2 text-sm text-gray-400">
              <li><Link to="/account" className="hover:text-white">My Account</Link></li>
              <li><Link to="/account" className="hover:text-white">Order History</Link></li>
              <li><Link to="/wishlist" className="hover:text-white">Wishlist</Link></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
          <p>&copy; 2026 LAST GEAR. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;