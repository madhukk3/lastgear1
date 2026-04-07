import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';
import { AdminProvider } from './context/AdminContext';
import { SettingsProvider } from './context/SettingsContext';
import AdminRoute from './components/AdminRoute';
import AdminLayout from './components/AdminLayout';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Products from './pages/Products';
import ProductDetail from './pages/ProductDetail';
import Login from './pages/Login';
import Register from './pages/Register';
import Cart from './pages/Cart';
import Checkout from './pages/CheckoutNew';
import OrderSuccess from './pages/OrderSuccess';
import OrderStatusPage from './pages/OrderStatus';
import Wishlist from './pages/Wishlist';
import Account from './pages/Account';
import HelpCenter from './pages/HelpCenter';
import About from './pages/About';
import AddedToCartPopup from './components/AddedToCartPopup';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProducts from './pages/admin/AdminProducts';
import AdminOrders from './pages/admin/AdminOrders';
import AdminCustomers from './pages/admin/AdminCustomers';
import AdminInventory from './pages/admin/AdminInventory';
import AdminLogs from './pages/admin/AdminLogs';
import AdminSettings from './pages/admin/AdminSettings';
import AdminImpactSeries from './pages/admin/AdminImpactSeries';
import AdminHeroBanners from './pages/admin/AdminHeroBanners';
import AdminCoupons from './pages/admin/AdminCoupons';
import AdminExchanges from './pages/admin/AdminExchanges';
import BrandLoader from './components/BrandLoader';
import { useAuth } from './context/AuthContext';
import { useSettings } from './context/SettingsContext';
import './App.css';
import './index.css';

function AppShell() {
  const { loading: authLoading } = useAuth();
  const { loading: settingsLoading } = useSettings();

  if (authLoading || settingsLoading) {
    return <BrandLoader fullScreen eyebrow="Booting" />;
  }

  return (
    <BrowserRouter>
      <AddedToCartPopup />
      <Toaster position="bottom-center" richColors closeButton />
      <Routes>
        {/* Admin Routes */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminRoute><AdminLayout><AdminDashboard /></AdminLayout></AdminRoute>} />
        <Route path="/admin/products" element={<AdminRoute><AdminLayout><AdminProducts /></AdminLayout></AdminRoute>} />
        <Route path="/admin/orders" element={<AdminRoute><AdminLayout><AdminOrders /></AdminLayout></AdminRoute>} />
        <Route path="/admin/customers" element={<AdminRoute><AdminLayout><AdminCustomers /></AdminLayout></AdminRoute>} />
        <Route path="/admin/inventory" element={<AdminRoute><AdminLayout><AdminInventory /></AdminLayout></AdminRoute>} />
        <Route path="/admin/logs" element={<AdminRoute><AdminLayout><AdminLogs /></AdminLayout></AdminRoute>} />
        <Route path="/admin/settings" element={<AdminRoute><AdminLayout><AdminSettings /></AdminLayout></AdminRoute>} />
        <Route path="/admin/impact-series" element={<AdminRoute><AdminLayout><AdminImpactSeries /></AdminLayout></AdminRoute>} />
        <Route path="/admin/hero-banners" element={<AdminRoute><AdminLayout><AdminHeroBanners /></AdminLayout></AdminRoute>} />
        <Route path="/admin/coupons" element={<AdminRoute><AdminLayout><AdminCoupons /></AdminLayout></AdminRoute>} />
        <Route path="/admin/exchanges" element={<AdminRoute><AdminLayout><AdminExchanges /></AdminLayout></AdminRoute>} />

        {/* Public Routes */}
        <Route path="*" element={
          <div className="App min-h-screen flex flex-col">
            <Header />
            <main className="flex-1">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/products" element={<Products />} />
                <Route path="/products/:id" element={<ProductDetail />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/cart" element={<Cart />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/order-success" element={<OrderSuccess />} />
                <Route path="/account/orders/:order_id" element={<OrderStatusPage />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/account" element={<Account />} />
                <Route path="/about" element={<About />} />
                <Route path="/help" element={<HelpCenter />} />
              </Routes>
            </main>
            <Footer />
          </div>
        } />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  return (
    <AuthProvider>
      <SettingsProvider>
        <CartProvider>
          <AdminProvider>
            <AppShell />
          </AdminProvider>
        </CartProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

export default App;
