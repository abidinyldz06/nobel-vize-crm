"use client";

import { useMemo, useState, useEffect } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface ChartProps {
  monthlyData: { month: string, count: number }[];
  countryData: { name: string, value: number }[];
  statusData: { name: string, value: number }[];
  revenueData: { month: string, amount: number }[];
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#0ea5e9', '#ec4899'];
const STATUS_COLORS: Record<string, string> = {
  'Profil Analizi': '#64748b',
  'Evrak Bekleniyor': '#f59e0b',
  'Randevu Bekleniyor': '#fb923c',
  'Randevu Alındı': '#3b82f6',
  'Evrak Hazırlanıyor': '#818cf8',
  'Başvuru Yapıldı': '#c084fc',
  'Onaylandı': '#10b981',
  'Reddedildi': '#ef4444',
  'Kapandı': '#475569'
};

const CustomTooltip = ({ active, payload, label, prefix = "", suffix = "" }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 border border-slate-700 text-white p-3 rounded-xl shadow-xl text-xs font-medium">
        <p className="mb-1 opacity-70">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} style={{ color: p.color || p.fill }}>
            {p.name === 'value' ? '' : `${p.name}: `}
            {prefix}{Number(p.value).toLocaleString('tr-TR')}{suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function DashboardCharts({ monthlyData, countryData, statusData, revenueData }: ChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return <div className="h-48 w-full animate-pulse bg-slate-100 dark:bg-[#1a2232] rounded-2xl"></div>;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-6">
      
      {/* 1. Monthly Application Trend */}
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Aylık Başvuru Trendi</h3>
        <div className="h-[150px] md:h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip suffix=" başvuru" />} />
              <Line type="monotone" name="Başvuru" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 2. Country Distribution */}
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Ülke Dağılımı</h3>
        <div className="h-[150px] md:h-[220px] w-full flex items-center justify-center">
          {countryData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={countryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {countryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip suffix=" başvuru" />} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-500">Yeterli veri yok.</p>
          )}
        </div>
      </div>

      {/* 3. Status Distribution */}
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Başvuru Durumları</h3>
        <div className="h-[150px] md:h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={statusData} layout="vertical" margin={{ top: 0, right: 10, left: 30, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
              <XAxis type="number" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} width={100} />
              <Tooltip content={<CustomTooltip suffix=" başvuru" />} />
              <Bar dataKey="value" name="Adet" radius={[0, 4, 4, 0]} barSize={20}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name] || '#3b82f6'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 4. Monthly Revenue Trend */}
      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-5 rounded-2xl shadow-lg">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-4">Aylık Tahsilat (Son 6 Ay)</h3>
        <div className="h-[150px] md:h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={revenueData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
              <XAxis dataKey="month" stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} />
              <YAxis stroke="#6b7280" fontSize={10} tickLine={false} axisLine={false} tickFormatter={(value) => `₺${value/1000}k`} />
              <Tooltip content={<CustomTooltip prefix="₺" />} />
              <Area type="monotone" name="Gelir" dataKey="amount" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
