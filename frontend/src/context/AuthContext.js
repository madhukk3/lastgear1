import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API}/auth/me`);
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return response.data;
  };

  const register = async (email, password, name, phone) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name, phone });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return response.data;
  };

  const sendOTP = async (phone) => {
    const response = await axios.post(`${API}/auth/send-otp`, { phone });
    return response.data;
  };

  const registerWithOTP = async (email, password, name, phone, otp) => {
    const response = await axios.post(`${API}/auth/register-otp`, { email, password, name, phone, otp });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return response.data;
  };

  const loginWithOTP = async (phone, otp) => {
    const response = await axios.post(`${API}/auth/login-otp`, { phone, otp });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return response.data;
  };

  const loginWithGoogle = async (credential) => {
    const response = await axios.post(`${API}/auth/google`, { credential });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    setToken(token);
    setUser(user);
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, sendOTP, registerWithOTP, loginWithOTP, loginWithGoogle, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};