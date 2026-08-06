import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrainCircuit, AlertCircle, Info, Calendar } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts';

export const Forecasting: React.FC = () => {
  const { token } = useAuth();
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/energy/forecast', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setForecastData(data);
        } else {
          setError('Failed to load forecast datasets');
        }
      } catch (err) {
        setError('Connection to forecasting service failed');
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  // Pick some peak times
  const warnings = [
    { time: '18:00 - 21:00 Today', event: 'Peak Grid Demand Warning', reason: 'High expected region usage. Shift loads to off-peak slots.', action: 'Critical' },
    { time: '11:00 - 14:00 Tomorrow', event: 'Solar Production Surplus', reason: 'Abundant solar panel inputs expected. Ideal for EV charging.', action: 'Optimization' }
  ];

  return (
    <div className="space-y-8">
      {/* AI Alert Ribbon */}
      <div className="rounded-2xl border border-brand-500/20 bg-brand-500/5 p-5 dark:bg-brand-950/20">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="flex items-start gap-3.5">
            <div className="rounded-xl bg-brand-500/10 p-2.5 text-brand-500">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Forecast Model Status</h3>
              <p className="text-xs text-slate-400 mt-0.5">Model: LSTM Energy Regressor. Trained 4 hours ago. Accuracy index: 96.4%.</p>
            </div>
          </div>
          <button className="flex items-center gap-1.5 self-start sm:self-center rounded-xl bg-brand-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-brand-500/15 hover:bg-brand-500 active:scale-95 transition-all">
            <Calendar className="h-4 w-4" />
            <span>Schedule Re-Train</span>
          </button>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next 24 Hours Area with Confidence Limits */}
        <div className="glass-panel rounded-2xl p-6">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">Next 24 Hours Demand Prediction</h2>
            <p className="text-xs text-slate-400 mt-1">Shaded area represents model's 95% confidence boundaries</p>
          </div>

          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData?.forecast_24h ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                <XAxis dataKey="hour_label" stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(22, 31, 48, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                {/* Confidence boundary area */}
                <Area type="monotone" dataKey="confidence_upper" stroke="none" fill="#3b82f6" fillOpacity={0.08} />
                <Area type="monotone" dataKey="confidence_lower" stroke="none" fill="#3b82f6" fillOpacity={0.08} />
                {/* Mean Prediction line */}
                <Area type="monotone" dataKey="predicted_kwh" stroke="#3b82f6" strokeWidth={2.5} fill="none" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Day Comparison Bar Chart */}
        <div className="glass-panel rounded-2xl p-6">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">7-Day Net Consumption Outlook</h2>
            <p className="text-xs text-slate-400 mt-1">Comparison of predicted daily consumption vs. historical average</p>
          </div>

          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData?.forecast_7d ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                <XAxis dataKey="day" stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(22, 31, 48, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Bar dataKey="predicted_kwh" name="Predicted" fill="#0ea0ea" radius={[4, 4, 0, 0]} />
                <Bar dataKey="historical_avg_kwh" name="Historical Average" fill="#94a3b8" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid Warnings List */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-bold text-slate-800 dark:text-white text-base">Anomalies & Load-Shift Forecast</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {warnings.map((w, index) => (
            <div key={index} className="flex gap-4 rounded-xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 p-4 dark:bg-slate-900/20">
              <div className={`rounded-xl p-2.5 ${
                w.action === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{w.time}</span>
                  <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                    w.action === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
                  }`}>{w.action}</span>
                </div>
                <h4 className="mt-1 font-bold text-slate-800 dark:text-slate-200 text-sm">{w.event}</h4>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">{w.reason}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
