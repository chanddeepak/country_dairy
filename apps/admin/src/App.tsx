import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Sidebar from './components/layout/Sidebar';
import type { TabType } from './components/layout/Sidebar';
import Login from './pages/Login';
import Overview from './pages/Overview';
import Inventory from './pages/Inventory';
import ProductEditor from './pages/ProductEditor';
import AddProductWizard from './pages/AddProductWizard';
import HeroManager from './pages/HeroManager';
import type { Product } from './types';
import Orders from './pages/Orders';
import Logistics from './pages/Logistics';
import Routes from './pages/Routes';
import Customers from './pages/Customers';
import type { Customer } from './pages/Customers';
import Wallets from './pages/Wallets';
import Reviews from './pages/Reviews';
import UserManagement from './pages/UserManagement';
import AuditLogPage from './pages/AuditLog';
import CMSManager from './pages/CMSManager';
import DriverView from './pages/DriverView';
import type { CategoryItem } from './pages/CategoryCMS';

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'Country Dairy A2 Cow Milk',
    slug: 'a2-cow-milk',
    categoryName: 'Dairy',
    status: 'LIVE',
    storyDescription: 'Pure A2 Gir & Sahiwal Cow Milk. Freshly collected from grass-fed cows and delivered in chilled glass bottles.',
    badgeText: 'FARM FRESH',
    isFeatured: true,
    displayOrder: 1,
    isSubscriptionAllowed: false, // Default OFF
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'var-1a', productId: 'prod-1', sku: 'CD-MILK-1L', sizeLabel: '1 Litre Glass Bottle', sellingPrice: 95, mrpPrice: 110, stockQuantity: 500, lowStockThreshold: 20, packagingType: 'GLASS_JAR', isActive: true, displayOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'var-1b', productId: 'prod-1', sku: 'CD-MILK-2L', sizeLabel: '2 Litre Family Pack', sellingPrice: 185, mrpPrice: 210, stockQuantity: 250, lowStockThreshold: 10, packagingType: 'GLASS_JAR', isActive: true, displayOrder: 2, createdAt: '', updatedAt: '' },
    ],
    galleryImages: [
      { id: 'img-1', productId: 'prod-1', imageUrl: '/images/products/milk-bottle.png', displayOrder: 1, isPrimary: true },
    ],
    specifications: { 'Milk Type': 'A2 Beta-Casein Protein', 'Processing': 'Pasteurized (Non-Homogenized)', 'Fat Content': '3.8% - 4.2%' },
    nutritionFacts: { 'Energy': '68 kcal', 'Protein': '3.4g', 'Calcium': '120mg' },
    batchCode: 'BATCH-2026-MILK01',
    verified: true,
  },
  {
    id: 'prod-2',
    title: 'Country Dairy A2 Vedic Ghee',
    slug: 'a2-vedic-ghee',
    categoryName: 'Dairy',
    status: 'LIVE',
    storyDescription: 'Traditional Hand-Churned Bilona Ghee made from A2 curd of free-grazing Gir Cows. Rich golden granular texture.',
    badgeText: 'VEDIC BILONA',
    isFeatured: true,
    displayOrder: 2,
    isSubscriptionAllowed: false, // Default OFF
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'var-2a', productId: 'prod-2', sku: 'CD-GHEE-500ML', sizeLabel: '500ml Glass Jar', sellingPrice: 780, mrpPrice: 900, stockQuantity: 100, lowStockThreshold: 10, packagingType: 'GLASS_JAR', isActive: true, displayOrder: 1, createdAt: '', updatedAt: '' },
      { id: 'var-2b', productId: 'prod-2', sku: 'CD-GHEE-1L', sizeLabel: '1 Litre Glass Jar', sellingPrice: 1450, mrpPrice: 1650, stockQuantity: 150, lowStockThreshold: 15, packagingType: 'GLASS_JAR', isActive: true, displayOrder: 2, createdAt: '', updatedAt: '' },
      { id: 'var-2c', productId: 'prod-2', sku: 'CD-GHEE-2.5L-DOLCHI', sizeLabel: '2.5L Traditional Metal Dolchi', sellingPrice: 3500, mrpPrice: 3999, stockQuantity: 0, lowStockThreshold: 5, packagingType: 'METAL_DOLCHI', isActive: true, displayOrder: 3, createdAt: '', updatedAt: '' },
    ],
    galleryImages: [
      { id: 'img-2', productId: 'prod-2', imageUrl: '/images/products/ghee-jar.png', displayOrder: 1, isPrimary: true },
    ],
    specifications: { 'Method': 'Traditional 2-Way Churned Bilona', 'Aroma': 'Nutty Golden Granular', 'Shelf Life': '12 Months' },
    nutritionFacts: { 'Energy': '898 kcal', 'Total Fat': '99.8g', 'Vitamin A': '840mcg' },
    batchCode: 'BATCH-2026-GHEE03',
    verified: true,
  },
  {
    id: 'prod-3',
    title: 'Organic Wood-Pressed Mustard Oil',
    slug: 'wood-pressed-mustard-oil',
    categoryName: 'Oils',
    status: 'LIVE',
    storyDescription: 'Cold Kachi Ghani pressed from organic yellow mustard seeds. Retains natural pungent aroma and essential Omega-3 fatty acids.',
    badgeText: 'COLD PRESSED',
    isFeatured: false,
    displayOrder: 3,
    isSubscriptionAllowed: false, // Default OFF
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'var-3a', productId: 'prod-3', sku: 'CD-OIL-1L', sizeLabel: '1 Litre Pet Bottle', sellingPrice: 320, mrpPrice: 380, stockQuantity: 200, lowStockThreshold: 20, packagingType: 'PET_BOTTLE', isActive: true, displayOrder: 1, createdAt: '', updatedAt: '' },
    ],
    galleryImages: [
      { id: 'img-3', productId: 'prod-3', imageUrl: '/images/products/mustard-oil.png', displayOrder: 1, isPrimary: true },
    ],
    specifications: { 'Pressing': 'Wood Pressed Kachi Ghani (30°C)', 'Seed Origin': 'Organic Rajasthan Yellow Mustard' },
    nutritionFacts: { 'Energy': '884 kcal', 'MUFA': '65g', 'PUFA': '21g' },
    batchCode: 'BATCH-2026-OIL02',
    verified: false,
  },
  {
    id: 'prod-4',
    title: 'Raw Wild Forest Honey',
    slug: 'raw-wild-forest-honey',
    categoryName: 'Honey',
    status: 'LIVE',
    storyDescription: 'Unfiltered, unheated wild flora honey harvested ethically from deep forest beehives. Natural enzyme rich.',
    badgeText: 'UNFILTERED',
    isFeatured: false,
    displayOrder: 4,
    isSubscriptionAllowed: false, // Default OFF
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    variants: [
      { id: 'var-4a', productId: 'prod-4', sku: 'CD-HONEY-500G', sizeLabel: '500g Glass Jar', sellingPrice: 450, mrpPrice: 520, stockQuantity: 100, lowStockThreshold: 10, packagingType: 'GLASS_JAR', isActive: true, displayOrder: 1, createdAt: '', updatedAt: '' },
    ],
    galleryImages: [
      { id: 'img-4', productId: 'prod-4', imageUrl: '/images/products/forest-honey.png', displayOrder: 1, isPrimary: true },
    ],
    specifications: { 'Processing': 'Zero Heating / Raw Unprocessed', 'Purity': '100% Wild Multiflora' },
    nutritionFacts: { 'Energy': '304 kcal', 'Natural Carbohydrates': '82g' },
    batchCode: 'BATCH-2026-HONEY01',
    verified: false,
  },
];

const TAB_STORAGE_KEY = 'country_dairy_admin_active_tab';

function AdminMainContent() {
  const { user, isAuthenticated } = useAuth();
  
  const [activeTab, setActiveTabState] = useState<TabType>(() => {
    const saved = localStorage.getItem(TAB_STORAGE_KEY);
    return (saved as TabType) || 'overview';
  });

  const setActiveTab = (tab: TabType) => {
    setActiveTabState(tab);
    localStorage.setItem(TAB_STORAGE_KEY, tab);
  };
  
  // Product Editor Sub-State
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingNewProduct, setIsAddingNewProduct] = useState(false);

  // Post-Login Automatic Redirection Matrix (only if no tab saved yet)
  useEffect(() => {
    if (!user) return;
    const savedTab = localStorage.getItem(TAB_STORAGE_KEY);
    if (!savedTab) {
      if (user.role === 'DELIVERY_DRIVER') {
        setActiveTab('driver');
      } else if (user.role === 'CATALOG_MANAGER') {
        setActiveTab('inventory');
      } else if (user.role === 'ORDER_MANAGER') {
        setActiveTab('orders');
      } else {
        setActiveTab('overview');
      }
    }
  }, [user?.role]);

  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);

  // Seeded categories state
  const [categories, setCategories] = useState<CategoryItem[]>([
    { id: 'cat-1', name: 'Dairy', slug: 'dairy', description: 'Fresh A2 Cow Milk, Vedic Bilona Ghee, Cottage Cheese & Paneer', iconName: 'Milk', displayOrder: 1, isActive: true },
    { id: 'cat-2', name: 'Oils', slug: 'oils', description: 'Cold-pressed organic mustard oil & sesame cooking oils', iconName: 'Droplet', displayOrder: 2, isActive: true },
    { id: 'cat-3', name: 'Honey', slug: 'honey', description: 'Unprocessed wild forest raw honey', iconName: 'Sun', displayOrder: 3, isActive: true },
    { id: 'cat-4', name: 'Spices & Staples', slug: 'spices-staples', description: 'Organic rock salt, turmeric powder & traditional grains', iconName: 'Sparkles', displayOrder: 4, isActive: false },
  ]);

  // Seeded mock order database records
  const [orders, setOrders] = useState([
    { id: 'ORD-10492', customer: 'Amit Sharma', items: 'A2 Cow Milk (6L)', total: 570, deliveryType: 'LOCAL', status: 'CONFIRMED', paymentStatus: 'PAID', date: 'July 5, 2026', waybill: '' },
    { id: 'ORD-10493', customer: 'Priyanjali Roy', items: 'A2 Vedic Ghee (1L)', total: 1450, deliveryType: 'COURIER', status: 'CONFIRMED', paymentStatus: 'PAID', date: 'July 5, 2026', waybill: '' },
    { id: 'ORD-10494', customer: 'Rahul Verma', items: 'Mustard Oil (2L), Forest Honey (500g)', total: 1090, deliveryType: 'COURIER', status: 'CONFIRMED', paymentStatus: 'PAID', date: 'July 5, 2026', waybill: 'DELHIVERY-9831948123' },
    { id: 'ORD-10495', customer: 'Deepak Chand', items: 'A2 Cow Milk (2L)', total: 190, deliveryType: 'LOCAL', status: 'PENDING', paymentStatus: 'PENDING', date: 'July 5, 2026', waybill: '' },
  ]);

  // Seeded mock customers list
  const [customers, setCustomers] = useState<Customer[]>([
    { id: 'CUST-001', name: 'Amit Sharma', phone: '+91 98765 43210', email: 'amit.sharma@example.com', walletBalance: 1500, ordersCount: 12, activeSubscriptions: 2 },
    { id: 'CUST-002', name: 'Priya Sen', phone: '+91 98123 45678', email: 'priya.sen@example.com', walletBalance: 2400, ordersCount: 8, activeSubscriptions: 1 },
    { id: 'CUST-003', name: 'Rohan Malhotra', phone: '+91 99999 88888', email: 'rohan.m@example.com', walletBalance: 450, ordersCount: 22, activeSubscriptions: 3 },
    { id: 'CUST-004', name: 'Deepak Chand', phone: '+91 97777 66666', email: 'deepak.c@example.com', walletBalance: 0, ordersCount: 1, activeSubscriptions: 0 },
  ]);

  // Form states
  const [batchCodeInput, setBatchCodeInput] = useState('');
  const [purityScoreInput, setPurityScoreInput] = useState('99.8%');
  const [phInput, setPhInput] = useState('6.65');
  const [fatInput] = useState('4.25%');
  const [selectedProductId, setSelectedProductId] = useState('prod-1');

  // Unauthenticated → Render Login Console
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // Trigger Delhivery booking dispatch
  const handleDelhiveryBooking = (orderId: string, waybillNum: string) => {
    setOrders(prev => prev.map(order => {
      if (order.id === orderId) {
        return { ...order, waybill: waybillNum, status: 'SHIPPED' };
      }
      return order;
    }));
  };

  const handleRegisterBatchTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchCodeInput) {
      alert('Please specify a batch code');
      return;
    }
    setProducts(prev => prev.map(p => {
      if (p.id === selectedProductId) {
        return { ...p, batchCode: batchCodeInput, verified: true };
      }
      return p;
    }));
    alert(`Purity Certificate Issued!\nBatch: ${batchCodeInput}\nPurity Score: ${purityScoreInput}\npH Level: ${phInput}\nFat content: ${fatInput}`);
    setBatchCodeInput('');
  };

  return (
    <div className="admin-container min-h-screen bg-[#FAF8F3] text-[#2A2A2A] flex">
      <Sidebar activeTab={activeTab} setActiveTab={(tab) => { setActiveTab(tab); setEditingProduct(null); setIsAddingNewProduct(false); }} />

      <main className="admin-main flex-1 p-6 sm:p-8 overflow-y-auto">
        <header className="dashboard-header mb-6 flex items-center justify-between border-b border-stone-200/80 pb-4">
          <div className="dashboard-title">
            <h1 className="text-2xl sm:text-3xl font-serif font-black text-[#2A2A2A] tracking-tight">Admin Console</h1>
            <p className="text-xs text-[#6b6661] mt-1 font-medium">Country Dairy D2C Management Console & Farm Logistics Controller</p>
          </div>
        </header>

        {activeTab === 'overview' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Overview />
          </ProtectedRoute>
        )}

        {activeTab === 'inventory' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'CATALOG_MANAGER', 'ORDER_MANAGER']}>
            {isAddingNewProduct ? (
              <AddProductWizard
                categories={categories}
                onCancel={() => setIsAddingNewProduct(false)}
                onComplete={(newProd) => {
                  setProducts(prev => [newProd, ...prev]);
                  setIsAddingNewProduct(false);
                }}
              />
            ) : editingProduct ? (
              <ProductEditor
                categories={categories}
                initialProduct={editingProduct}
                onBack={() => setEditingProduct(null)}
                onSave={(updated) => {
                  setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
                  setEditingProduct(null);
                }}
              />
            ) : (
              <Inventory
                products={products}
                selectedProductId={selectedProductId}
                setSelectedProductId={setSelectedProductId}
                batchCodeInput={batchCodeInput}
                setBatchCodeInput={setBatchCodeInput}
                purityScoreInput={purityScoreInput}
                setPurityScoreInput={setPurityScoreInput}
                phInput={phInput}
                setPhInput={setPhInput}
                fatInput={fatInput}
                handleRegisterBatchTest={handleRegisterBatchTest}
                onUpdateProducts={setProducts}
                onOpenAddWizard={() => setIsAddingNewProduct(true)}
                onEditProduct={(product) => setEditingProduct(product)}
              />
            )}
          </ProtectedRoute>
        )}

        {activeTab === 'hero' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'CATALOG_MANAGER']}>
            <HeroManager />
          </ProtectedRoute>
        )}

        {activeTab === 'orders' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Orders 
              orders={orders} 
              onUpdateOrders={setOrders}
            />
          </ProtectedRoute>
        )}

        {activeTab === 'logistics' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Logistics
              orders={orders}
              handleDelhiveryBooking={handleDelhiveryBooking}
            />
          </ProtectedRoute>
        )}

        {activeTab === 'driver' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'DELIVERY_DRIVER']}>
            <DriverView />
          </ProtectedRoute>
        )}

        {activeTab === 'routes' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Routes />
          </ProtectedRoute>
        )}

        {activeTab === 'customers' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Customers customers={customers} />
          </ProtectedRoute>
        )}

        {activeTab === 'wallets' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Wallets customers={customers} onUpdateCustomers={setCustomers} />
          </ProtectedRoute>
        )}

        {activeTab === 'cms' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'CATALOG_MANAGER']}>
            <CMSManager categories={categories} onUpdateCategories={setCategories} />
          </ProtectedRoute>
        )}

        {activeTab === 'reviews' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'CATALOG_MANAGER']}>
            <Reviews />
          </ProtectedRoute>
        )}

        {activeTab === 'users' && (
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <UserManagement />
          </ProtectedRoute>
        )}

        {activeTab === 'audit' && (
          <ProtectedRoute requiredRole="SUPER_ADMIN">
            <AuditLogPage />
          </ProtectedRoute>
        )}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AdminMainContent />
    </AuthProvider>
  );
}
