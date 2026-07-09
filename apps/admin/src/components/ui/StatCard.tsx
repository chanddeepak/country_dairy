import React from 'react';

interface StatCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  trend?: {
    value: string;
    type: 'positive' | 'negative' | 'neutral';
  };
}

export default function StatCard({ title, value, subtext, icon, trend }: StatCardProps) {
  return (
    <div className="metric-card bg-white p-6 rounded-2xl border border-stone-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-4">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">{title}</span>
        <div className="p-2 bg-stone-50 rounded-lg text-[#064e3b]">{icon}</div>
      </div>
      <div className="flex items-baseline gap-2 mb-2">
        <span className="text-3xl font-black text-stone-900 tracking-tight">{value}</span>
        {trend && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            trend.type === 'positive' 
              ? 'bg-emerald-50 text-emerald-700' 
              : trend.type === 'negative' 
                ? 'bg-red-50 text-red-700' 
                : 'bg-stone-50 text-stone-600'
          }`}>
            {trend.value}
          </span>
        )}
      </div>
      <span className="text-xs text-stone-500">{subtext}</span>
    </div>
  );
}
