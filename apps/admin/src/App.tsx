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
import type { AdminOrder, Product } from './types';
import Orders from './pages/Orders';
import Logistics from './pages/Logistics';
import Routes from './pages/Routes';
import Customers from './pages/Customers';
import Wallets from './pages/Wallets';
import Reviews from './pages/Reviews';
import UserManagement from './pages/UserManagement';
import AuditLogPage from './pages/AuditLog';
import CMSManager from './pages/CMSManager';
import DriverView from './pages/DriverView';
import type { CategoryItem } from './pages/CategoryCMS';
import { adminApi } from './services/apiClient';

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

  // Product items initialized as empty array until DB fetch completes
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);

  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [featureFlags, setFeatureFlags] = useState<Record<string, boolean>>({});
  const [catalogError, setCatalogError] = useState('');

  // Fetch live catalog from the API. There is deliberately no fallback to seed
  // data: showing invented products when the API is down hides the outage and
  // invites edits against rows that do not exist.
  useEffect(() => {
    setIsLoadingProducts(true);
    setCatalogError('');

    adminApi.getProducts()
      .then(liveProducts => {
        setProducts(liveProducts || []);
      })
      .catch(err => {
        setCatalogError(err instanceof Error ? err.message : 'Could not reach the API server');
        setProducts([]);
      })
      .finally(() => {
        setIsLoadingProducts(false);
      });

    adminApi.getCategories()
      .then(setCategories)
      .catch(() => setCategories([]));

    adminApi.getFeatureFlagMap()
      .then(setFeatureFlags)
      .catch(() => setFeatureFlags({}));

  }, []);

  // Orders and customers are fetched by their own pages, which need the full
  // API shape rather than the flattened summary this component used to build.
  const [orders, setOrders] = useState<AdminOrder[]>([]);

  useEffect(() => {
    adminApi.getOrdersAdmin()
      .then(setOrders)
      .catch(() => setOrders([]));
  }, []);

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

        {/* Surfaced rather than swallowed: a silent fallback to seed data used
            to make an unreachable API look like an empty-but-working catalog. */}
        {catalogError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
            <strong>Could not reach the API server.</strong> {catalogError}
            <div className="mt-1 text-red-600/80">
              Catalog data is unavailable — changes cannot be saved until the connection is restored.
            </div>
          </div>
        )}

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
                onComplete={async (newProd) => {
                  try {
                    const created = await adminApi.createProduct(newProd);
                    const normalized = {
                      ...(created || newProd),
                      categoryName: created?.categoryName || (created as any)?.category?.name || newProd.categoryName || 'Dairy',
                    };
                    setProducts(prev => [normalized, ...prev.filter(p => p.id !== newProd.id && p.id !== normalized.id)]);
                  } catch (err) {
                    console.warn('API save warning:', err);
                    setProducts(prev => [newProd, ...prev]);
                  } finally {
                    setIsAddingNewProduct(false);
                  }
                }}
              />
            ) : editingProduct ? (
              <ProductEditor
                categories={categories}
                initialProduct={editingProduct}
                onBack={() => setEditingProduct(null)}
                onSave={async (updated) => {
                  try {
                    const saved = await adminApi.updateProduct(updated.id, updated);
                    const normalized = {
                      ...(saved || updated),
                      categoryName: saved?.categoryName || (saved as any)?.category?.name || updated.categoryName || 'Dairy',
                    };
                    setProducts(prev => prev.map(p => (p.id === updated.id || p.id === normalized.id) ? normalized : p));
                  } catch (err) {
                    console.warn('API update warning:', err);
                    setProducts(prev => prev.map(p => p.id === updated.id ? updated : p));
                  } finally {
                    setEditingProduct(null);
                  }
                }}
              />
            ) : (
              <Inventory
                products={products}
                isLoading={isLoadingProducts}
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
            <Orders />
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
            <Customers walletEnabled={featureFlags.ENABLE_WALLET === true} />
          </ProtectedRoute>
        )}

        {activeTab === 'wallets' && (
          <ProtectedRoute requiredRole={['SUPER_ADMIN', 'ORDER_MANAGER']}>
            <Wallets customers={[]} onUpdateCustomers={() => {}} />
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
