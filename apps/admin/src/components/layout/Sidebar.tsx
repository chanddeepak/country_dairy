import { 
  Package, ShoppingCart, Truck, Map, BarChart3, Users, Wallet, Star 
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: 'overview' | 'inventory' | 'orders' | 'logistics' | 'routes' | 'customers' | 'wallets' | 'reviews') => void;
}

export default function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const links = [
    { key: 'overview', label: 'Overview', icon: <BarChart3 className="h-5 w-5" /> },
    { key: 'inventory', label: 'Batch & Inventory', icon: <Package className="h-5 w-5" /> },
    { key: 'orders', label: 'Order Manager', icon: <ShoppingCart className="h-5 w-5" /> },
    { key: 'logistics', label: 'Delhivery Logistics', icon: <Truck className="h-5 w-5" /> },
    { key: 'routes', label: 'Milk Routing Sheets', icon: <Map className="h-5 w-5" /> },
    { key: 'customers', label: 'Customer Profiles', icon: <Users className="h-5 w-5" /> },
    { key: 'wallets', label: 'Wallet Ledger', icon: <Wallet className="h-5 w-5" /> },
    { key: 'reviews', label: 'Reviews Moderation', icon: <Star className="h-5 w-5" /> },
  ] as const;

  return (
    <aside className="admin-sidebar bg-[#064e3b] text-[#f5f5f4] p-8 flex flex-col justify-between min-h-screen">
      <div>
        <div className="brand-header flex items-center gap-3 mb-10">
          <div className="brand-logo bg-[#f59e0b] text-[#064e3b] w-10 h-10 rounded-full flex items-center justify-center font-black text-lg">
            CD
          </div>
          <span className="brand-name font-extrabold text-xl tracking-tight text-[#fbbf24]">
            Country Dairy
          </span>
        </div>

        <nav className="nav-links flex flex-col gap-2">
          {links.map((link) => (
            <button 
              key={link.key}
              onClick={() => setActiveTab(link.key)}
              className={`nav-btn flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
                activeTab === link.key 
                  ? 'bg-[#065f46] text-white shadow' 
                  : 'text-[#a7f3d0] hover:bg-[#065f46]/50 hover:text-white'
              }`}
            >
              {link.icon}
              {link.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="text-[10px] text-[#a7f3d0]/80 mt-8">
        Country Dairy Console v1.0.0
      </div>
    </aside>
  );
}
