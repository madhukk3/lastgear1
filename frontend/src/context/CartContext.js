import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [] });
  const [loading, setLoading] = useState(false);
  const [addedItem, setAddedItem] = useState(null);
  const { token } = useAuth();

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  const fetchCart = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/cart`);
      setCart(response.data);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setLoading(false);
    }
  }, [API]);

  useEffect(() => {
    if (token) {
      fetchCart();
    } else {
      setCart({ items: [] });
    }
  }, [fetchCart, token]);

  const addToCart = async (product_id, quantity, size, color, fullProductData = null) => {
    try {
      await axios.post(`${API}/cart`, { product_id, quantity, size, color });
      await fetchCart();
      if (fullProductData) {
        setAddedItem({
          ...fullProductData,
          selectedQuantity: quantity,
          selectedSize: size,
          selectedColor: color
        });
      }
    } catch (error) {
      console.error('Failed to add to cart:', error);
      throw error;
    }
  };

  const clearAddedItem = () => {
    setAddedItem(null);
  };

  const removeFromCart = async (product_id, size, color) => {
    try {
      await axios.delete(`${API}/cart/${product_id}?size=${size}&color=${color}`);
      await fetchCart();
    } catch (error) {
      console.error('Failed to remove from cart:', error);
      throw error;
    }
  };

  const clearCart = async () => {
    try {
      await axios.delete(`${API}/cart`);
      setCart({ items: [] });
    } catch (error) {
      console.error('Failed to clear cart:', error);
      throw error;
    }
  };

  const cartCount = cart.items?.reduce((total, item) => total + item.quantity, 0) || 0;
  const cartTotal = cart.items?.reduce((total, item) => {
    const price = item.product?.price || 0;
    return total + (price * item.quantity);
  }, 0) || 0;

  return (
    <CartContext.Provider value={{ cart, cartCount, cartTotal, addToCart, removeFromCart, clearCart, fetchCart, loading, addedItem, clearAddedItem }}>
      {children}
    </CartContext.Provider>
  );
}
