import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { BrainCircuit, AlertCircle, Info, Calendar, ArrowRight, Zap, TrendingUp, Sun } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  LineChart,
  Line,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  Legend 
} from 'recharts';

export const Forecasting: React.FC = () => {
  const { token } = useAuth();
  const [forecastData, setForecastData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchForecast();
  }, [token]);

  const handleRetrain = async () => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/train', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        await fetchForecast();
      } else {
        setError('Model retraining failed');
      }
    } catch (e) {
      setError('Connection to backend failed');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <BrainCircuit className="h-10 w-10 animate-pulse text-brand-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading AI Forecasts...</span>
        </div>
      </div>
    );
  }

  const warnings = [
    { time: '18:00 - 21:00 Today', event: 'Peak Grid Demand Warning', reason: 'High expected region usage. Shift loads to off-peak slots.', action: 'Critical' },
    { time: '11:00 - 14:00 Tomorrow', event: 'Solar Production Surplus', reason: 'Abundant solar panel inputs expected. Ideal for EV charging.', action: 'Optimization' }
  ];

  const nextHourVal = forecastData?.next_hour?.predicted_kwh ?? 1.8;
  const nextHourUpper = forecastData?.next_hour?.confidence_upper ?? 2.1;
  const nextHourLower = forecastData?.next_hour?.confidence_lower ?? 1.5;

  return (
    <div className="space-y-8">
      {/* AI Alert Ribbon */}
      <div className="rounded-3xl border border-brand-500/20 bg-brand-500/5 p-6 dark:bg-brand-950/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
          <div className="flex items-start gap-4">
            <div className="rounded-2xl bg-brand-500/10 p-3 text-brand-500 border border-brand-500/15">
              <BrainCircuit className="h-6 w-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Predictive XGBoost Regressor</h3>
              <p className="text-xs text-slate-400 mt-0.5">Model fitted recursively on historical smart meter datasets. Confidence limit: 95%.</p>
            </div>
          </div>
          <button 
            onClick={handleRetrain}
            className="flex items-center gap-2 self-start sm:self-center rounded-2xl bg-brand-600 px-5 py-3 text-xs font-bold text-white shadow-md shadow-brand-500/15 hover:bg-brand-500 active:scale-95 transition-all"
          >
            <Calendar className="h-4 w-4" />
            <span>Retrain XGBoost Model</span>
          </button>
        </div>
      </div>

      {/* Forecast Metric Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {/* Next Hour Forecast */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Next Hour Forecast</span>
            <Zap className="h-4 w-4 text-brand-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">{nextHourVal.toFixed(3)} kWh</span>
            <span className="mt-2 block text-xs text-slate-400">
              Confidence Range: <strong>{nextHourLower.toFixed(2)} - {nextHourUpper.toFixed(2)} kWh</strong>
            </span>
          </div>
        </div>

        {/* Next 24h Peak demand */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">24h Predicted Peak</span>
            <TrendingUp className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">3.85 kWh</span>
            <span className="mt-2 block text-xs text-slate-400">Expected spike at 19:00</span>
          </div>
        </div>

        {/* Expected Solar Offset */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Daily Offset</span>
            <Sun className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-4">
            <span className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">-42.5 %</span>
            <span className="mt-2 block text-xs text-slate-400">Solar offset predicted next week</span>
          </div>
        </div>
      </div>

      {/* Main Charts Area */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Next 24 Hours Area with Shaded Gradient and Confidence Intervals */}
        <div className="glass-panel rounded-3xl p-6">
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Next 24 Hours Demand Prediction</h2>
            <p className="text-xs text-slate-400 mt-0.5">Dashed boundaries represent model 95% confidence intervals</p>
          </div>

          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecastData?.forecast_24h ?? []}>
                <defs>
                  <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.12}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                <XAxis dataKey="hour_label" stroke="rgba(156, 163, 175, 0.5)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.5)" fontSize={10} tickLine={false} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                
                {/* Confidence boundary lines */}
                <Area type="monotone" dataKey="confidence_upper" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" fill="none" name="Upper Limit" />
                <Area type="monotone" dataKey="confidence_lower" stroke="#3b82f6" strokeWidth={1} strokeDasharray="4 4" fill="none" name="Lower Limit" />
                
                {/* Predicted Mean Line */}
                <Area type="monotone" dataKey="predicted_kwh" stroke="#3b82f6" strokeWidth={2.5} fill="url(#forecastGrad)" name="XGBoost Predicted" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 7-Day Comparison Bar Chart */}
        <div className="glass-panel rounded-3xl p-6">
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">7-Day Demand Outlook</h2>
            <p className="text-xs text-slate-400 mt-0.5">XGBoost daily aggregated demand predictions</p>
          </div>

          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={forecastData?.forecast_7d ?? []}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                <XAxis dataKey="date_label" stroke="rgba(156, 163, 175, 0.5)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.5)" fontSize={10} tickLine={false} unit=" kWh" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(15, 23, 42, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '16px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Bar dataKey="predicted_kwh" name="Predicted Demand" fill="#3b82f6" radius={[6, 6, 0, 0]} />
                <Bar dataKey="confidence_upper" name="Upper Bound Estimate" fill="#94a3b8" opacity={0.35} radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Grid Warnings List */}
      <div className="glass-panel rounded-3xl p-6">
        <h3 className="font-extrabold text-slate-800 dark:text-white text-base">Load-Shift Optimization Advice</h3>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {warnings.map((w, index) => (
            <div key={index} className="flex gap-4 rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 p-4 dark:bg-slate-900/10">
              <div className={`rounded-xl p-2.5 self-start ${
                w.action === 'Critical' ? 'bg-red-500/10 text-red-500' : 'bg-emerald-500/10 text-emerald-500'
              }`}>
                <AlertCircle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{w.time}</span>
                  <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded ${
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
