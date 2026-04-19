import React from 'react';
import { Navigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const AdminRoute = ({ children }) => {
  const { user, loading, logout } = useAuth();
  const [verified, setVerified] = React.useState(false);
  const [verifying, setVerifying] = React.useState(true);
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
  const API = `${BACKEND_URL}/api`;

  React.useEffect(() => {
    const verifyAdminSession = async () => {
      if (!user?.is_admin) {
        setVerified(false);
        setVerifying(false);
        return;
      }

      try {
        await axios.get(`${API}/admin/session`, { withCredentials: true });
        setVerified(true);
      } catch (error) {
        setVerified(false);
        if (error.response?.status === 401 || error.response?.status === 403) {
          await logout();
        }
      } finally {
        setVerifying(false);
      }
    };

    verifyAdminSession();
  }, [API, logout, user]);

  if (loading || verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  // Check if user is admin
  const isAdmin = user?.is_admin === true;

  if (!user) {
    return <Navigate to="/admin/login" replace />;
  }

  if (!isAdmin || !verified) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default AdminRoute;
