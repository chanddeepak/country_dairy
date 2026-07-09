import { useState } from 'react';
import { MapPin, User, FileText, CheckCircle2, AlertCircle } from 'lucide-react';

interface RouteManifest {
  id: string;
  address: string;
  customer: string;
  product: string;
  status: 'PENDING' | 'DELIVERED' | 'UNDELIVERED';
}

const NoidaManifest: RouteManifest[] = [
  { id: '1', address: 'House 142, Block C, Sector 62', customer: 'Amit Sharma', product: 'A2 Cow Milk (2 Litres)', status: 'PENDING' },
  { id: '2', address: 'Apartment 402, Royal Residency', customer: 'Karan Bajaj', product: 'A2 Cow Milk (1 Litre)', status: 'PENDING' },
];

const DelhiManifest: RouteManifest[] = [
  { id: '3', address: 'Plot 15, GK-2 Main Rd', customer: 'Priya Sen', product: 'A2 Vedic Ghee (1 Litre)', status: 'PENDING' },
  { id: '4', address: 'House B-44, GK-1', customer: 'Rohan Malhotra', product: 'A2 Cow Milk (3 Litres)', status: 'PENDING' },
];

const GurgaonManifest: RouteManifest[] = [
  { id: '5', address: 'Villa 109, DLF Phase 3', customer: 'Vikram Grover', product: 'Raw Wild Forest Honey (500g)', status: 'PENDING' },
];

export default function Routes() {
  const [route, setRoute] = useState<'Noida' | 'Delhi' | 'Gurgaon'>('Noida');
  const [runner, setRunner] = useState('Ramesh Kumar (Runner-ID: 4092)');
  const [manifests, setManifests] = useState<Record<'Noida' | 'Delhi' | 'Gurgaon', RouteManifest[]>>({
    Noida: NoidaManifest,
    Delhi: DelhiManifest,
    Gurgaon: GurgaonManifest,
  });

  const activeManifest = manifests[route];

  const handleStatusUpdate = (id: string, newStatus: 'DELIVERED' | 'UNDELIVERED') => {
    setManifests(prev => {
      const updatedList = prev[route].map(m => {
        if (m.id === id) {
          return { ...m, status: newStatus };
        }
        return m;
      });
      return { ...prev, [route]: updatedList };
    });
  };

  const triggerPrintManifest = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Runner Route Sheet - ${route}</title>
          <style>
            body { font-family: monospace; padding: 35px; color: #000; }
            h2 { border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; font-size: 18px; }
            .info-bar { display: grid; grid-template-columns: 1fr 1fr; margin-bottom: 30px; font-size: 12px; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; }
            th { border-bottom: 2px solid #000; text-align: left; padding: 10px; font-size: 11px; }
            td { border-bottom: 1px solid #ddd; padding: 12px 10px; font-size: 11px; }
          </style>
        </head>
        <body>
          <h2>LOCAL RUNNER DELIVERY MANIFEST SHEET</h2>
          <div class="info-bar">
            <div>
              <strong>ROUTE AREA:</strong> ${route} Sector Block<br/>
              <strong>DISPATCH DATE:</strong> ${new Date().toLocaleDateString()}<br/>
            </div>
            <div>
              <strong>ASSIGNED RUNNER:</strong> ${runner}<br/>
              <strong>TOTAL DROPS:</strong> ${activeManifest.length} sequence drops
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Drop #</th>
                <th>House Delivery Address</th>
                <th>Recipient Customer</th>
                <th>Products Count</th>
                <th>Recipient Sign Slot</th>
              </tr>
            </thead>
            <tbody>
              ${activeManifest.map((m, idx) => `
                <tr>
                  <td>${idx + 1}</td>
                  <td>${m.address}</td>
                  <td><strong>${m.customer}</strong></td>
                  <td>${m.product}</td>
                  <td style="border: 1px solid #aaa; height: 35px; width: 120px;"></td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-6">
      <div className="screen-panel bg-white p-6 rounded-2xl border border-stone-200 shadow-sm">
        <div className="screen-header mb-6">
          <h2 className="text-lg font-bold text-stone-800">Daily Milk Runner Routing Sheets</h2>
          <p className="text-xs text-stone-500">Assign local runners to deliver daily fresh dairy subscriptions to residential blocks.</p>
        </div>

        <div className="form-grid grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <div className="form-group flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600 uppercase flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-stone-400" /> Select Delivery Route Area:</label>
            <select 
              value={route}
              onChange={e => setRoute(e.target.value as any)}
              className="form-control bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-[#064e3b]"
            >
              <option value="Noida">Sector 62, Noida Area</option>
              <option value="Delhi">GK-1 & GK-2, South Delhi Area</option>
              <option value="Gurgaon">Sector 45, Gurgaon Area</option>
            </select>
          </div>

          <div className="form-group flex flex-col gap-1.5">
            <label className="text-xs font-bold text-stone-600 uppercase flex items-center gap-1"><User className="h-3.5 w-3.5 text-stone-400" /> Assigned Delivery Runner:</label>
            <select 
              value={runner}
              onChange={e => setRunner(e.target.value)}
              className="form-control bg-stone-50 border border-stone-200 px-3 py-2.5 rounded-lg text-sm text-stone-800 focus:outline-none focus:border-[#064e3b]"
            >
              <option value="Ramesh Kumar (Runner-ID: 4092)">Ramesh Kumar (Runner-ID: 4092)</option>
              <option value="Sunil Yadav (Runner-ID: 1842)">Sunil Yadav (Runner-ID: 1842)</option>
              <option value="Aman Singh (Runner-ID: 2948)">Aman Singh (Runner-ID: 2948)</option>
            </select>
          </div>
        </div>

        <div className="route-manifest-box bg-stone-50/50 p-6 rounded-2xl border border-stone-200/60">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6 border-b border-stone-200/60 pb-4">
            <div>
              <h4 className="font-serif font-black text-base text-[#064e3b]">Route Manifest - {route} Sequence drops</h4>
              <p className="text-xs text-stone-500 font-mono mt-0.5">Assigned to: {runner}</p>
            </div>
            <button 
              onClick={triggerPrintManifest}
              className="btn-accent bg-emerald-50 hover:bg-emerald-100 border border-emerald-250 text-emerald-800 font-bold text-xs px-4 py-2.5 rounded-lg flex items-center gap-2 transition"
            >
              <FileText className="h-4 w-4" />
              Print Runner Run-Sheet
            </button>
          </div>

          <table className="data-table w-full text-left border-collapse bg-white rounded-xl overflow-hidden border border-stone-200/60">
            <thead>
              <tr className="border-b border-stone-200 text-stone-500 font-bold text-xs uppercase bg-stone-50">
                <th className="p-4">Drop Position</th>
                <th className="p-4">House Address</th>
                <th className="p-4">Customer Name</th>
                <th className="p-4">Subscribed Products</th>
                <th className="p-4">Fulfillment Feedback</th>
                <th className="p-4 text-right">Dispatch Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeManifest.map((m, idx) => (
                <tr key={m.id} className="border-b border-stone-100 last:border-0 hover:bg-stone-50/20 transition-colors text-sm">
                  <td className="p-4 font-bold text-stone-500">{idx + 1}</td>
                  <td className="p-4 font-semibold text-stone-800">{m.address}</td>
                  <td className="p-4 text-stone-700">{m.customer}</td>
                  <td className="p-4 text-stone-600 font-medium">{m.product}</td>
                  <td className="p-4 font-mono text-xs">
                    {m.status === 'PENDING' ? (
                      <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-1.5 w-fit">
                        Pending Drop
                      </span>
                    ) : m.status === 'DELIVERED' ? (
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-1.5 w-fit">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Delivered
                      </span>
                    ) : (
                      <span className="text-red-700 font-bold bg-red-50 px-2 py-0.5 rounded border border-red-100 flex items-center gap-1.5 w-fit">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Undelivered
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-right">
                    {m.status === 'PENDING' ? (
                      <div className="flex gap-1.5 justify-end">
                        <button 
                          onClick={() => handleStatusUpdate(m.id, 'DELIVERED')}
                          className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-[11px] px-2.5 py-1.5 rounded transition"
                        >
                          Delivered
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(m.id, 'UNDELIVERED')}
                          className="bg-red-50 hover:bg-red-150 text-red-800 font-bold text-[11px] px-2.5 py-1.5 rounded transition"
                        >
                          Failed
                        </button>
                      </div>
                    ) : (
                      <button 
                        onClick={() => {
                          setManifests(prev => {
                            const updated = prev[route].map(item => item.id === m.id ? { ...item, status: 'PENDING' } : item);
                            return { ...prev, [route]: updated };
                          });
                        }}
                        className="text-stone-400 hover:text-stone-600 text-xs font-semibold hover:underline"
                      >
                        Reset Status
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
