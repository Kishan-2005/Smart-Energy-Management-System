import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Cpu, Power, Zap, RefreshCw, BarChart2 } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface Appliance {
  id: number;
  appliance_name: string;
  power_consumed: number;
  status: boolean;
  efficiency_grade: string;
}

export const ApplianceAnalytics: React.FC = () => {
  const { token } = useAuth();
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [togglingId, setTogglingId] = useState<number | null>(null);

  const fetchAppliances = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/appliances', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setAppliances(data);
      } else {
        setError('Failed to fetch appliances data');
      }
    } catch (err) {
      setError('Failed to connect to appliances backend');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppliances();
  }, [token]);

  const handleToggle = async (id: number, currentStatus: boolean) => {
    setTogglingId(id);
    try {
      const res = await fetch(`http://localhost:8000/api/v1/energy/appliances/${id}/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: !currentStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setAppliances((prev) => prev.map((app) => (app.id === id ? updated : app)));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingId(null);
    }
  };

  // Prepare chart data (filter only active appliances or display all with power)
  const chartData = appliances
    .filter((app) => app.status)
    .map((app) => ({
      name: app.appliance_name,
      value: app.power_consumed
    }));

  const COLORS = ['#0ea0ea', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#ef4444'];

  const getGradeColor = (grade: string) => {
    if (grade.startsWith('A')) return 'text-emerald-500 bg-emerald-500/10';
    if (grade.startsWith('B')) return 'text-blue-500 bg-blue-500/10';
    if (grade.startsWith('C')) return 'text-amber-500 bg-amber-500/10';
    return 'text-red-500 bg-red-500/10';
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
      {/* Overview Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Total Appliances Connected</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{appliances.length}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">({appliances.filter(a => a.status).length} running)</span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Appliance Load Draw</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">
              {appliances.reduce((acc, app) => acc + (app.status ? app.power_consumed : 0), 0).toFixed(2)} kW
            </span>
          </div>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Overall Efficiency Index</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">Grade A</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-bold text-emerald-500">Optimal</span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Appliances Control List */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white text-lg">Connected Devices</h2>
              <p className="text-xs text-slate-400 mt-1">Control smart switches and inspect appliance performance</p>
            </div>
            <button 
              onClick={fetchAppliances}
              className="rounded-xl border border-slate-200/80 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-darkbg-card dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {appliances.map((app) => (
              <div key={app.id} className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                <div className="flex items-center gap-4">
                  <div className={`rounded-xl p-3 ${
                    app.status ? 'bg-brand-500/10 text-brand-500' : 'bg-slate-100 text-slate-400 dark:bg-slate-900/50'
                  }`}>
                    <Cpu className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{app.appliance_name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {app.status ? `${app.power_consumed} kW` : 'Idle'}
                      </span>
                      <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${getGradeColor(app.efficiency_grade)}`}>
                        Grade {app.efficiency_grade}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Power switch toggle */}
                <button
                  onClick={() => handleToggle(app.id, app.status)}
                  disabled={togglingId === app.id}
                  className={`rounded-xl p-2.5 transition-all ${
                    app.status 
                      ? 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20' 
                      : 'bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-900/50 dark:text-slate-500 dark:hover:bg-slate-900'
                  }`}
                  aria-label={`Toggle ${app.appliance_name}`}
                >
                  <Power className={`h-5 w-5 ${togglingId === app.id ? 'animate-spin' : ''}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recharts Breakdown Pie */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">Load Breakdown</h2>
            <p className="text-xs text-slate-400 mt-1">Breakdown of active consumption load by active appliance</p>
          </div>

          <div className="h-64 w-full my-6">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <div className="flex flex-col items-center gap-2 text-center">
                  <BarChart2 className="h-8 w-8 text-slate-500" />
                  <span className="text-xs">No appliances currently drawing active power</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(22, 31, 48, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: '10px' }} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="rounded-xl bg-amber-500/5 border border-amber-500/15 p-4 text-xs text-amber-600 dark:text-amber-400 font-medium">
            ⚠️ EV Charger is currently inactive. Consider activating smart scheduled charging to initiate overnight during off-peak times.
          </div>
        </div>
      </div>
    </div>
  );
};
