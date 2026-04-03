import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer className="mt-20 overflow-hidden border-t border-white/10 bg-[#120e0b] text-white" data-testid="footer">
      <div className="max-w-7xl mx-auto px-4 py-14">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr]">
          {/* Brand */}
          <div>
            <div className="mb-5 flex items-center gap-3">
              <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-[56px] md:h-[64px] w-auto object-contain opacity-90" />
              <div>
                <h3 className="font-nav text-3xl">LAST GEAR</h3>
                <p className="font-nav text-[10px] text-white/45">Fashion Division</p>
              </div>
            </div>
            <p className="max-w-md text-sm leading-7 text-white/62">
              LAST GEAR Fashion is the first startup under our LAST GEAR company vision, built to make fashion feel immersive, creative, and unforgettable from the first click.
            </p>
          </div>

          {/* Shop */}
          <div>
            <h4 className="mb-4 font-nav text-2xl text-[#f1e6d8]">Shop</h4>
            <ul className="space-y-3 text-sm text-white/58">
              <li><Link to="/products?category=t-shirts" className="hover:text-[#f1e6d8]">T-Shirts</Link></li>
              <li><Link to="/products?category=hoodies" className="hover:text-[#f1e6d8]">Hoodies</Link></li>
              <li><Link to="/products" className="hover:text-[#f1e6d8]">All Products</Link></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="mb-4 font-nav text-2xl text-[#f1e6d8]">Support</h4>
            <ul className="space-y-3 text-sm text-white/58">
              <li><Link to="/about" className="hover:text-[#f1e6d8]">About Us</Link></li>
              <li><Link to="/help" className="hover:text-[#f1e6d8]">Help Center</Link></li>
              <li><Link to="/help" className="hover:text-[#f1e6d8]">Shipping Info</Link></li>
              <li><Link to="/help" className="hover:text-[#f1e6d8]">Returns</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="mb-4 font-nav text-2xl text-[#f1e6d8]">Account</h4>
            <ul className="space-y-3 text-sm text-white/58">
              <li><Link to="/account" className="hover:text-[#f1e6d8]">My Account</Link></li>
              <li><Link to="/account" className="hover:text-[#f1e6d8]">Order History</Link></li>
              <li><Link to="/wishlist" className="hover:text-[#f1e6d8]">Wishlist</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-white/10 pt-8 text-center text-sm text-white/42">
          <p>&copy; 2026 LAST GEAR. Fashion for every shift.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
