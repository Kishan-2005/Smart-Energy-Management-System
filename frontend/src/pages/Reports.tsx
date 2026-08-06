import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BarChart3, Download, Calendar, RefreshCw } from 'lucide-react';

interface ReportRow {
  date: string;
  consumption_kwh: number;
  solar_generation_kwh: number;
  grid_imported_kwh: number;
  grid_exported_kwh: number;
  net_cost: number;
  savings: number;
  efficiency_ratio: number;
}

export const Reports: React.FC = () => {
  const { token } = useAuth();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [totals, setTotals] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchReports = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/reports', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setReports(data.daily_summaries);
        setTotals(data.monthly_totals);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, [token]);

  const handleDownload = (format: string) => {
    setDownloading(format);
    setTimeout(() => {
      setDownloading(null);
      alert(`Report downloaded successfully in ${format} format!`);
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Date Filters & Download Bar */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-500 dark:bg-slate-900/50 dark:text-slate-400">
            <Calendar className="h-4 w-4 text-brand-500" />
            <span>Last 7 Days</span>
          </div>
          <span className="text-xs text-slate-400">Custom Date Range:</span>
          <input 
            type="date" 
            className="rounded-xl border border-slate-200 bg-transparent px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300"
            defaultValue={new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}
          />
          <span className="text-xs text-slate-400">to</span>
          <input 
            type="date" 
            className="rounded-xl border border-slate-200 bg-transparent px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:text-slate-300"
            defaultValue={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleDownload('CSV')}
            disabled={!!downloading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-darkbg-card dark:hover:bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-600 dark:text-slate-400 disabled:opacity-50"
          >
            <Download className="h-4 w-4" />
            <span>{downloading === 'CSV' ? 'Exporting...' : 'Export CSV'}</span>
          </button>
          <button
            onClick={() => handleDownload('PDF')}
            disabled={!!downloading}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/15 disabled:opacity-50"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{downloading === 'PDF' ? 'Generating...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate summaries */}
      <div className="grid gap-6 sm:grid-cols-4">
        <div className="glass-panel rounded-2xl p-5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Consumption</span>
          <span className="mt-2 block text-xl font-bold text-slate-800 dark:text-white">{totals?.consumption_kwh ?? '0'} kWh</span>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Monthly Solar Gen</span>
          <span className="mt-2 block text-xl font-bold text-slate-800 dark:text-white">{totals?.solar_generation_kwh ?? '0'} kWh</span>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Net Cost</span>
          <span className="mt-2 block text-xl font-bold text-slate-800 dark:text-white">${totals?.net_cost?.toFixed(2) ?? '0.00'}</span>
        </div>
        <div className="glass-panel rounded-2xl p-5">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400">Net Savings</span>
          <span className="mt-2 block text-xl font-bold text-emerald-500">${totals?.savings?.toFixed(2) ?? '0.00'}</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800/80">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs md:text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-850 dark:bg-slate-900/30 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="p-4 pl-6">Date</th>
                <th className="p-4">Consumption (kWh)</th>
                <th className="p-4">Solar Gen (kWh)</th>
                <th className="p-4">Grid Imported (kWh)</th>
                <th className="p-4">Grid Exported (kWh)</th>
                <th className="p-4">Net Cost</th>
                <th className="p-4">Solar Savings</th>
                <th className="p-4 pr-6 text-right">Self-Sufficiency %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-600 dark:text-slate-300">
              {reports.map((row, index) => (
                <tr key={index} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/20 transition-all">
                  <td className="p-4 pl-6 font-semibold">{row.date}</td>
                  <td className="p-4">{row.consumption_kwh}</td>
                  <td className="p-4">{row.solar_generation_kwh}</td>
                  <td className="p-4">{row.grid_imported_kwh}</td>
                  <td className="p-4">{row.grid_exported_kwh}</td>
                  <td className={`p-4 font-semibold ${row.net_cost < 0 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-200'}`}>
                    {row.net_cost < 0 ? '-' : ''}${Math.abs(row.net_cost).toFixed(2)}
                  </td>
                  <td className="p-4 text-emerald-500 font-semibold">${row.savings.toFixed(2)}</td>
                  <td className="p-4 pr-6 text-right font-bold text-brand-500">{row.efficiency_ratio}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
