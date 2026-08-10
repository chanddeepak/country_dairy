import React from 'react';
import { 
  Package, ShoppingCart, Truck, Map, BarChart3, Users, Wallet, Star, ShieldCheck, LogOut, Sliders, Layout, FlaskConical
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { displayName, type UserRole } from '../../types';

export type TabType = 
  | 'overview' 
  | 'inventory' 
  | 'hero' 
  | 'orders' 
  | 'logistics' 
  | 'routes' 
  | 'customers' 
  | 'wallets' 
  | 'reviews' 
  | 'users' 
  | 'cms'
  | 'driver'
  | 'purity'
  | 'audit';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

interface NavItem {
  key: TabType;
  label: string;
  icon: React.ReactNode;
  allowedRoles?: UserRole[];
  /** Hidden entirely unless this feature flag is on. */
  requiresFlag?: string;
  /** Still demo data with no backend — shown, but marked so nobody trusts it. */
  comingSoon?: boolean;
}

interface SidebarPropsWithFlags extends SidebarProps {
  featureFlags?: Record<string, boolean>;
}

export default function Sidebar({ activeTab, setActiveTab, featureFlags = {} }: SidebarPropsWithFlags) {
  const { user, logout, hasPermission } = useAuth();

  const allLinks: NavItem[] = [
    { 
      key: 'overview', 
      label: 'Overview & Analytics', 
      icon: <BarChart3 className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER']
    },
    { 
      key: 'inventory', 
      label: 'Product Catalog & Stock', 
      icon: <Package className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'CATALOG_MANAGER', 'ORDER_MANAGER']
    },
    { 
      key: 'hero', 
      label: 'Hero Carousel CMS', 
      icon: <Layout className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'CATALOG_MANAGER']
    },
    { 
      key: 'orders', 
      label: 'Order Queue & Fulfillment', 
      icon: <ShoppingCart className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER']
    },
    { 
      key: 'logistics',
      comingSoon: true, 
      label: 'Delhivery Shipping', 
      icon: <Truck className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER']
    },
    { 
      key: 'driver',
      comingSoon: true, 
      label: 'Driver Delivery App', 
      icon: <Truck className="h-4 w-4 text-[#fbbf24]" />,
      allowedRoles: ['SUPER_ADMIN', 'DELIVERY_DRIVER']
    },
    { 
      key: 'routes',
      comingSoon: true, 
      label: 'Milk Route Sheets', 
      icon: <Map className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER']
    },
    { 
      key: 'customers', 
      label: 'Customer Directory', 
      icon: <Users className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER']
    },
    { 
      key: 'wallets', 
      label: 'Wallet Ledger', 
      icon: <Wallet className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'ORDER_MANAGER'],
      requiresFlag: 'ENABLE_WALLET',
    },
    { 
      key: 'cms', 
      label: 'Storefront CMS & Flags', 
      icon: <Sliders className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'CATALOG_MANAGER']
    },
    {
      key: 'purity',
      label: 'Batch Lab Reports',
      icon: <FlaskConical className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'CATALOG_MANAGER']
    },
    { 
      key: 'reviews', 
      label: 'Customer Reviews', 
      icon: <Star className="h-4 w-4" />,
      allowedRoles: ['SUPER_ADMIN', 'CATALOG_MANAGER']
    },
    { 
      key: 'users', 
      label: 'User Management & Roles', 
      icon: <ShieldCheck className="h-4 w-4 text-[#fbbf24]" />,
      allowedRoles: ['SUPER_ADMIN']
    },
    { 
      key: 'audit', 
      label: 'Audit Logs & Revert', 
      icon: <ShieldCheck className="h-4 w-4 text-[#a7f3d0]" />,
      allowedRoles: ['SUPER_ADMIN']
    },
  ];

  const visibleLinks = allLinks.filter(link => {
    // A page for a disabled feature is hidden, not merely disabled — showing
    // "Wallet Ledger" while the wallet is off advertises something that does
    // not exist.
    if (link.requiresFlag && featureFlags[link.requiresFlag] !== true) return false;
    if (!link.allowedRoles) return true;
    return hasPermission(link.allowedRoles);
  });

  return (
    <aside className="admin-sidebar bg-[#064e3b] text-[#FAF8F3] p-5 flex flex-col justify-between min-h-screen w-64 border-r border-[#065f46] shrink-0 shadow-xl">
      <div>
        {/* Brand Header */}
        <div className="brand-header flex items-center gap-3 mb-6 pb-4 border-b border-[#065f46]/80">
          <div className="brand-logo bg-[#C59B27] text-[#064e3b] w-10 h-10 rounded-xl flex items-center justify-center font-serif font-black text-lg shadow-lg border border-[#fef3c7]/30">
            CD
          </div>
          <div>
            <span className="brand-name font-serif font-extrabold text-base tracking-tight text-[#fef3c7] block leading-snug">
              Country Dairy
            </span>
            <span className="text-[10px] text-emerald-200/80 font-mono uppercase tracking-wider">Admin Console</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="nav-links flex flex-col gap-1">
          {visibleLinks.map((link) => {
            const isActive = activeTab === link.key;
            return (
              <button 
                key={link.key}
                onClick={() => setActiveTab(link.key)}
                className={`nav-btn flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all ${
                  isActive 
                    ? 'bg-[#FAF8F3] text-[#064e3b] shadow-md border border-[#fef3c7]' 
                    : 'text-emerald-100 hover:bg-[#065f46] hover:text-white'
                }`}
              >
                {link.icon}
                <span className="truncate">{link.label}</span>
                {link.comingSoon && (
                  <span
                    className={`ml-auto text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded shrink-0 ${
                      isActive ? 'bg-stone-200 text-stone-600' : 'bg-emerald-900/60 text-emerald-300/80'
                    }`}
                    title="Demo data — this page is not connected to the API yet"
                  >
                    Demo
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Logout Box */}
      <div className="pt-4 border-t border-[#065f46]/80">
        {user && (
          <div className="bg-[#043e2f] p-3 rounded-xl border border-emerald-600/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[9px] uppercase font-black tracking-wider text-[#C59B27] bg-[#C59B27]/15 px-2 py-0.5 rounded border border-[#C59B27]/30">
                {user.role.replace('_', ' ')}
              </span>
            </div>
            <div className="text-xs font-bold text-white truncate">{displayName(user)}</div>
            <div className="text-[10px] text-emerald-200/70 truncate">{user.email}</div>
            
            <button
              onClick={logout}
              className="w-full mt-2 flex items-center justify-center gap-2 py-1.5 px-3 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/30 rounded-lg text-xs font-semibold transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
