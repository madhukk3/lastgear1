import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Package, ShoppingCart, Users, BarChart3, FileText, LogOut, Settings as SettingsIcon, Image as ImageIcon, Ticket, Menu, X, RefreshCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'sonner';

const AdminLayout = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  // Close mobile menu on route change
  React.useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
    navigate('/admin/login');
  };

  const menuItems = [
    { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/admin/products', icon: Package, label: 'Products' },
    { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
    { path: '/admin/exchanges', icon: RefreshCcw, label: 'Exchanges' },
    { path: '/admin/customers', icon: Users, label: 'Customers' },
    { path: '/admin/inventory', icon: BarChart3, label: 'Inventory' },
    { path: '/admin/hero-banners', icon: ImageIcon, label: 'Hero Banners' },
    { path: '/admin/impact-series', icon: Package, label: 'Impact Series' },
    { path: '/admin/coupons', icon: Ticket, label: 'Coupons' },
    { path: '/admin/logs', icon: FileText, label: 'Logs' },
    { path: '/admin/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row" data-testid="admin-layout">

      {/* Mobile Header with Hamburger */}
      <div className="md:hidden bg-gray-900 text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center gap-2">
          <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-6 w-auto object-contain" />
          <h1 className="text-xl font-puma tracking-wider">LAST GEAR</h1>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2">
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay (Mobile) */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed top-0 left-0 h-full w-64 bg-gray-900 text-white z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:flex md:flex-col`}>
        <div className="p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-6 w-auto object-contain" />
            <h1 className="text-2xl font-puma tracking-wider">LAST GEAR</h1>
          </div>
          <p className="text-sm text-gray-400 mt-1">Admin Panel</p>
        </div>

        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive
                  ? 'bg-white text-gray-900'
                  : 'text-gray-300 hover:bg-gray-800'
                  }`}
                data-testid={`nav-${item.label.toLowerCase()}`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-gray-800 transition-colors w-full"
            data-testid="admin-logout"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full md:ml-0 p-4 md:p-8 mt-16 md:mt-0 max-w-[100vw] overflow-x-hidden block">
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;