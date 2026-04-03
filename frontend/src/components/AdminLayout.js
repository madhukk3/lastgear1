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

  const menuSections = [
    {
      label: 'Overview',
      items: [
        { path: '/admin/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      ]
    },
    {
      label: 'Store',
      items: [
        { path: '/admin/products', icon: Package, label: 'Products' },
        { path: '/admin/inventory', icon: BarChart3, label: 'Inventory' },
        { path: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
        { path: '/admin/exchanges', icon: RefreshCcw, label: 'Exchanges' },
      ]
    },
    {
      label: 'People',
      items: [
        { path: '/admin/customers', icon: Users, label: 'Customers' },
      ]
    },
    {
      label: 'Marketing',
      items: [
        { path: '/admin/hero-banners', icon: ImageIcon, label: 'Hero Banners' },
        { path: '/admin/impact-series', icon: Package, label: 'Impact Series' },
        { path: '/admin/coupons', icon: Ticket, label: 'Coupons' },
      ]
    },
    {
      label: 'System',
      items: [
        { path: '/admin/logs', icon: FileText, label: 'Logs' },
        { path: '/admin/settings', icon: SettingsIcon, label: 'Settings' },
      ]
    }
  ];

  const allMenuItems = menuSections.flatMap((section) => section.items);
  const activeItem = allMenuItems.find((item) => item.path === location.pathname);

  return (
    <div className="min-h-screen bg-[#f4f1eb] flex flex-col md:flex-row" data-testid="admin-layout">

      {/* Mobile Header with Hamburger */}
      <div className="md:hidden bg-[#111827] text-white p-4 flex justify-between items-center fixed top-0 left-0 right-0 z-50 shadow-sm">
          <div className="flex items-center gap-2">
            <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-6 w-auto object-contain" />
            <div>
            <h1 className="font-nav text-xl">LAST GEAR</h1>
            <p className="font-nav text-[10px] text-white/55">Admin Console</p>
            </div>
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
      <aside className={`fixed top-0 left-0 h-full w-72 bg-[#111827] text-white z-50 transform transition-transform duration-300 ease-in-out md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'} md:static md:flex md:flex-col`}>
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center gap-2">
            <img src="/logo-white.png" alt="LAST GEAR Logo" className="h-6 w-auto object-contain" />
            <h1 className="font-nav text-2xl">LAST GEAR</h1>
          </div>
          <p className="mt-1 font-nav text-sm text-white/55">Simple admin control panel</p>
        </div>

        <nav className="p-4 space-y-6 flex-1 overflow-y-auto">
          {menuSections.map((section) => (
            <div key={section.label}>
              <p className="px-3 font-nav text-[11px] text-white/35">{section.label}</p>
              <div className="mt-3 space-y-1.5">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-colors ${isActive
                        ? 'bg-white text-[#111827] shadow-sm'
                        : 'text-white/72 hover:bg-white/6 hover:text-white'
                        }`}
                      data-testid={`nav-${item.label.toLowerCase()}`}
                    >
                      <div className="flex h-5 w-5 items-center justify-center shrink-0">
                        <Icon size={18} />
                      </div>
                      <div className="flex min-h-[20px] items-center">
                        <p className="font-nav leading-none">{item.label}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10 shrink-0">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl text-white/72 hover:bg-white/6 transition-colors w-full"
            data-testid="admin-logout"
          >
            <LogOut size={20} />
            <span className="font-nav">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 w-full md:ml-0 p-4 md:p-8 mt-16 md:mt-0 max-w-[100vw] overflow-x-hidden block">
        <div className="mb-6 rounded-[28px] border border-black/8 bg-white px-5 py-5 shadow-sm md:px-7">
          <p className="font-nav text-[11px] text-[#8d6a46]">Admin Section</p>
          <div className="mt-2 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="font-nav text-3xl text-[#16120d] md:text-4xl">{activeItem?.label || 'Admin'}</h1>
              <p className="mt-1 font-nav text-sm text-black/52">{activeItem?.description || 'Manage your store clearly and quickly.'}</p>
            </div>
            <div className="rounded-2xl bg-[#f4f1eb] px-4 py-3 font-nav text-sm text-black/58">
              Keep records tidy. Work section by section.
            </div>
          </div>
        </div>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
