import { useState } from 'react';
import Sidebar from './components/layout/Sidebar';
import Overview from './pages/Overview';
import Inventory from './pages/Inventory';
import type { Product } from './pages/Inventory';
import Orders from './pages/Orders';
import Logistics from './pages/Logistics';
import Routes from './pages/Routes';
import Customers from './pages/Customers';
import type { Customer } from './pages/Customers';
import Wallets from './pages/Wallets';
import Reviews from './pages/Reviews';

type TabType = 'overview' | 'inventory' | 'orders' | 'logistics' | 'routes' | 'customers' | 'wallets' | 'reviews';


export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Seeded mock product items
  const [products, setProducts] = useState<Product[]>([
    { id: '1', name: 'Country Dairy A2 Cow Milk', price: 95, stock: 500, category: 'Dairy', batchCode: 'BATCH-2026-MILK01', verified: true, isSubscriptionAllowed: true },
    { id: '2', name: 'Country Dairy A2 Vedic Ghee', price: 1450, stock: 150, category: 'Dairy', batchCode: 'BATCH-2026-GHEE03', verified: true, isSubscriptionAllowed: true },
    { id: '4', name: 'Raw Wild Forest Honey', price: 450, stock: 100, category: 'Honey', batchCode: 'BATCH-2026-HONEY01', verified: false, isSubscriptionAllowed: false },
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
  const [selectedProductId, setSelectedProductId] = useState('1');

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
    <div className="admin-container">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="admin-main">
        <header className="dashboard-header mb-6">
          <div className="dashboard-title">
            <h1 className="text-2xl font-black text-stone-900">Admin Console</h1>
            <p className="text-xs text-stone-500 mt-1">Managing dairy logistics, laboratory verifications, and courier dispatches.</p>
          </div>
        </header>

        {activeTab === 'overview' && <Overview />}

        {activeTab === 'inventory' && (
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
          />
        )}

        {activeTab === 'orders' && (
          <Orders 
            orders={orders} 
            onUpdateOrders={setOrders}
          />
        )}

        {activeTab === 'logistics' && (
          <Logistics
            orders={orders}
            handleDelhiveryBooking={handleDelhiveryBooking}
          />
        )}

        {activeTab === 'routes' && <Routes />}

        {activeTab === 'customers' && (
          <Customers customers={customers} />
        )}

        {activeTab === 'wallets' && (
          <Wallets customers={customers} onUpdateCustomers={setCustomers} />
        )}

        {activeTab === 'reviews' && <Reviews />}
      </main>
    </div>
  );
}
