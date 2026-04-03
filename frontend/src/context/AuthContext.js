import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
  const API = `${BACKEND_URL}/api`;

  useEffect(() => {
    axios.defaults.withCredentials = true;
    axios.defaults.headers.common['X-Requested-With'] = 'XMLHttpRequest';
  }, []);

  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config || {};
        const statusCode = error.response?.status;
        const requestUrl = originalRequest.url || '';

        if (
          statusCode === 401 &&
          !originalRequest._retry &&
          !requestUrl.includes('/auth/login') &&
          !requestUrl.includes('/auth/register') &&
          !requestUrl.includes('/auth/refresh') &&
          !requestUrl.includes('/auth/logout')
        ) {
          originalRequest._retry = true;

          try {
            await axios.post(`${API}/auth/refresh`, {}, { withCredentials: true });
            return axios({
              ...originalRequest,
              withCredentials: true,
            });
          } catch (refreshError) {
            setUser(null);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => axios.interceptors.response.eject(interceptor);
  }, [API]);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const response = await axios.get(`${API}/auth/me`, { withCredentials: true });
        setUser(response.data);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, [API]);

  const login = async (email, password) => {
    const response = await axios.post(`${API}/auth/login`, { email, password }, { withCredentials: true });
    setUser(response.data.user);
    return response.data;
  };

  const register = async (email, password, name, phone) => {
    const response = await axios.post(`${API}/auth/register`, { email, password, name, phone }, { withCredentials: true });
    setUser(response.data.user);
    return response.data;
  };

  const sendOTP = async (phone) => {
    const response = await axios.post(`${API}/auth/send-otp`, { phone }, { withCredentials: true });
    return response.data;
  };

  const registerWithOTP = async (email, password, name, phone, otp) => {
    const response = await axios.post(`${API}/auth/register-otp`, { email, password, name, phone, otp }, { withCredentials: true });
    setUser(response.data.user);
    return response.data;
  };

  const loginWithOTP = async (phone, otp) => {
    const response = await axios.post(`${API}/auth/login-otp`, { phone, otp }, { withCredentials: true });
    setUser(response.data.user);
    return response.data;
  };

  const loginWithGoogle = async (credential) => {
    const response = await axios.post(`${API}/auth/google`, { credential }, { withCredentials: true });
    setUser(response.data.user);
    return response.data;
  };

  const logout = async () => {
    try {
      await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
    }
  };

  const value = {
    user,
    token: user ? 'session' : null,
    login,
    register,
    sendOTP,
    registerWithOTP,
    loginWithOTP,
    loginWithGoogle,
    logout,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
