import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { DollarSign, CheckCircle2, AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';

interface Recommendation {
  id: number;
  timestamp: string;
  title: string;
  recommendation_text: string;
  potential_saving: number;
  status: string;
  actionable_type: string;
}

interface Tariff {
  time: string;
  rate: number;
  type: string;
  color: string;
}

export const CostOptimizer: React.FC = () => {
  const { token } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [savings, setSavings] = useState(0.0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const fetchOptimizer = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/cost/optimizer', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecs(data.recommendations);
        setTariffs(data.tariffs);
        setSavings(data.monthly_potential_savings);
        setProgress(data.billing_cycle_progress);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptimizer();
  }, [token]);

  const handleApply = async (id: number, currentStatus: string) => {
    setUpdatingId(id);
    const nextStatus = currentStatus === 'applied' ? 'pending' : 'applied';
    try {
      const res = await fetch(`http://localhost:8000/api/v1/energy/cost/optimizer/recommendations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setRecs((prev) => prev.map((r) => (r.id === id ? updated : r)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
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
      {/* Overview summaries */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tariff Optimization Savings</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">${savings.toFixed(2)}</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <span className="mt-2 block text-xs text-slate-400">Potential monthly billing savings</span>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Optimization Actions</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">
              {recs.filter(r => r.status === 'applied').length} / {recs.length}
            </span>
            <span className="text-xs text-slate-500">Applied</span>
          </div>
          <span className="mt-2 block text-xs text-slate-400">Auto-scheduling and load shifts</span>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Billing Cycle Progress</span>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">{progress}%</span>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommendations list */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white text-lg">Load-Shifting Recommendations</h2>
              <p className="text-xs text-slate-400 mt-1">Smart suggestions to shift consumption to lower-priced hours</p>
            </div>
            <button 
              onClick={fetchOptimizer}
              className="rounded-xl border border-slate-200/80 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-darkbg-card dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4">
            {recs.map((r) => (
              <div 
                key={r.id} 
                className={`rounded-2xl border p-5 transition-all duration-200 ${
                  r.status === 'applied' 
                    ? 'border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-950/10' 
                    : 'border-slate-100 bg-slate-50/50 dark:border-slate-800/60 dark:bg-slate-900/20'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 rounded-xl p-2 ${
                      r.status === 'applied' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-brand-500/10 text-brand-500'
                    }`}>
                      {r.status === 'applied' ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <AlertCircle className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{r.title}</h3>
                      <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{r.recommendation_text}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-bold text-slate-800 dark:text-white">+${r.potential_saving.toFixed(2)}</span>
                    <span className="block text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Est. saving</span>
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => handleApply(r.id, r.status)}
                    disabled={updatingId === r.id}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold shadow-sm transition-all active:scale-95 ${
                      r.status === 'applied' 
                        ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700' 
                        : 'bg-brand-600 text-white hover:bg-brand-500 shadow-brand-500/15'
                    }`}
                  >
                    {updatingId === r.id ? 'Applying...' : r.status === 'applied' ? 'Applied' : 'Apply Action'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Time-of-use rates tariff card */}
        <div className="glass-panel rounded-2xl p-6">
          <h2 className="font-bold text-slate-800 dark:text-white text-lg">Time-of-Use (TOU) Rates</h2>
          <p className="text-xs text-slate-400 mt-1">Current active grid electricity rate brackets</p>

          <div className="mt-6 space-y-4">
            {tariffs.map((t, index) => (
              <div key={index} className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-900/40 p-4">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                  <div>
                    <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{t.type}</span>
                    <span className="block text-[10px] text-slate-400 mt-0.5">{t.time}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-sm font-bold text-slate-800 dark:text-white">${t.rate.toFixed(2)}</span>
                  <span className="block text-[9px] text-slate-400">/ kWh</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-brand-500/5 border border-brand-500/15 p-4 text-xs text-brand-500 leading-relaxed">
            ⏰ Grid Peak rates run during the evening dinner slot. We recommend scheduling heavy washers and dryers to start post-9:00 PM.
          </div>
        </div>
      </div>
    </div>
  );
};
