import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';

const AdminContext = createContext(null);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider');
  }
  return context;
};

export const AdminProvider = ({ children }) => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const { token, user } = useAuth();

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const API = `${BACKEND_URL}/api`;

  const isAdmin = user?.is_admin === true;

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API}/admin/dashboard/stats`);
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminContext.Provider value={{ stats, fetchDashboardStats, loading, isAdmin }}>
      {children}
    </AdminContext.Provider>
  );
};
