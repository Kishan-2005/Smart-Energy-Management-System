import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  Sun, 
  Battery, 
  DollarSign, 
  AlertTriangle, 
  ArrowRight,
  TrendingDown,
  Activity,
  Shield,
  Wifi,
  WifiOff
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface Stats {
  current_load_kw: number;
  today_consumption_kwh: number;
  today_solar_generation_kwh: number;
  current_solar_production_kw: number;
  battery_soc_percent: number;
  battery_charging_rate_kw: number;
  today_cost_estimate: number;
  grid_dependence_percent: number;
  savings_this_month: number;
  co2_saved_kg: number;
}

export const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Real-time WebSocket parameters
  const [liveData, setLiveData] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'LIVE' | 'DISCONNECTED'>('CONNECTING');

  // Chart state for Recharts
  const [chartData, setChartData] = useState<any[]>([]);

  // 1. WebSocket Client connection setup
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connectWS = () => {
      setWsStatus('CONNECTING');
      ws = new WebSocket('ws://localhost:8000/api/v1/energy/ws');

      ws.onopen = () => {
        setWsStatus('LIVE');
        setError('');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
        } catch (e) {
          console.error("Failed to parse websocket frame:", e);
        }
      };

      ws.onclose = () => {
        setWsStatus('DISCONNECTED');
        reconnectTimeout = window.setTimeout(connectWS, 3000); // retry reconnect every 3s
      };

      ws.onerror = (err) => {
        console.error("Websocket socket error:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // 2. Fetch REST statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/energy/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setStats(data);
        }
      } catch (err) {
        console.error("REST stats fetch error:", err);
      }
    };

    const fetchForecast = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/energy/forecast', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          const rawHist = data.historical_12h.map((h: any) => ({
            time: h.hour_label,
            usage: h.actual_kwh,
            solar: Math.max(0, h.actual_kwh * 0.35 + (Math.sin(parseInt(h.hour_label)/2.5) * 0.45))
          }));
          setChartData(rawHist);
        }
      } catch (e) {
        console.error("REST forecast fetch error:", e);
      }
    };

    const loadREST = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchForecast()]);
      setLoading(false);
    };

    loadREST();
    
    const interval = setInterval(fetchStats, 5000); // refresh slower REST metrics every 5s
    return () => clearInterval(interval);
  }, [token]);

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className="h-96 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />
      </div>
    );
  }

  // Value resolutions (prefer live websocket variables, fallback to REST mock values)
  const currentLoad = liveData?.active_power ?? stats?.current_load_kw ?? 1.45;
  const currentVoltage = liveData?.voltage ?? 230.1;
  const currentAmps = liveData?.current ?? 6.3;
  const currentFreq = liveData?.frequency ?? 50.0;
  const currentPF = liveData?.power_factor ?? 0.96;
  const cumulativeEnergy = liveData?.energy_consumed_kwh ?? 125.40;
  
  // Calculate Gauge details (SVG stroke circum = 2 * PI * r = 2 * 3.14159 * 40 = 251.2)
  const MAX_GAUGE_POWER = 10.0; // kW reference
  const gaugePercent = Math.min(100, (currentLoad / MAX_GAUGE_POWER) * 100);
  const strokeDashoffset = 251.2 - (251.2 * gaugePercent) / 100;

  return (
    <div className="space-y-8">
      {/* Header Utilities Alert & WebSocket Status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200/80 bg-white/50 p-4 dark:border-slate-800/80 dark:bg-darkbg-card/50">
        <div className="flex items-center gap-3">
          {/* Status Indicator */}
          <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold ${
            wsStatus === 'LIVE' 
              ? 'bg-emerald-500/10 text-emerald-500' 
              : wsStatus === 'CONNECTING'
                ? 'bg-amber-500/10 text-amber-500'
                : 'bg-red-500/10 text-red-500 animate-pulse'
          }`}>
            {wsStatus === 'LIVE' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <Wifi className="h-4 w-4" />
                <span>LIVE - WebSockets connected</span>
              </>
            ) : wsStatus === 'CONNECTING' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>CONNECTING...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>DISCONNECTED - Reconnecting</span>
              </>
            )}
          </div>
          <span className="text-xs text-slate-400 font-medium">Smart Meter Simulator: ACTIVE</span>
        </div>
        
        {liveData && (
          <span className="text-xs text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-1">
            <Activity className="h-3.5 w-3.5 text-brand-500" />
            Last telemetry: {new Date(liveData.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Main Grid: Live Gauge + Grid telemetries */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Power Gauge */}
        <div className="glass-panel glow-blue rounded-3xl p-6 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-4 left-6">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live Power Gauge</span>
          </div>

          <div className="mt-8 relative flex items-center justify-center">
            {/* SVG Speedometer circle */}
            <svg className="w-40 h-40 transform -rotate-90">
              <circle 
                cx="80" 
                cy="80" 
                r="40" 
                stroke="rgba(148, 163, 184, 0.08)" 
                strokeWidth="10" 
                fill="transparent" 
              />
              <circle 
                cx="80" 
                cy="80" 
                r="40" 
                stroke="url(#gaugeGrad)" 
                strokeWidth="10" 
                fill="transparent" 
                strokeDasharray="251.2" 
                strokeDashoffset={strokeDashoffset} 
                strokeLinecap="round" 
                className="transition-all duration-300 ease-out" 
              />
              <defs>
                <linearGradient id="gaugeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#0ea0ea" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-slate-800 dark:text-white tracking-tight">{currentLoad.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-400 uppercase mt-0.5">kW</span>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4 text-xs font-medium text-slate-500">
            <span>PF: <strong>{currentPF}</strong></span>
            <span>•</span>
            <span>Freq: <strong>{currentFreq}Hz</strong></span>
          </div>
        </div>

        {/* Indicator Cards Grid */}
        <div className="lg:col-span-2 grid gap-6 sm:grid-cols-2">
          {/* Card 1: Voltage */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Voltage</span>
              <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-500">NOMINAL</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white md:text-4xl">{currentVoltage} V</span>
              <span className="mt-2 block text-xs text-slate-400">Target Line Level: 230V</span>
            </div>
          </div>

          {/* Card 2: Current */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Current</span>
              <span className="text-xs text-slate-400">Load Amperage</span>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white md:text-4xl">{currentAmps} A</span>
              <span className="mt-2 block text-xs text-slate-400">Safety Limit: 32.0 A</span>
            </div>
          </div>

          {/* Card 3: Energy Counter */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Cumulative Energy</span>
              <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500">
                <Zap className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white md:text-4xl">{cumulativeEnergy.toFixed(3)} kWh</span>
              <span className="mt-2 block text-xs text-slate-400">Active counter (Wh resolution)</span>
            </div>
          </div>

          {/* Card 4: Today Consumption */}
          <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Consumption Today</span>
              <div className="rounded-xl bg-orange-500/10 p-2 text-orange-500">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-4">
              <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white md:text-4xl">
                {stats?.today_consumption_kwh ?? '0.0'} kWh
              </span>
              <span className="mt-2 block text-xs text-slate-400">
                Est. Cost Today: <span className="font-semibold text-slate-700 dark:text-slate-200">${stats?.today_cost_estimate ?? '0.00'}</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics chart and details */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recharts Area Chart */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white text-lg">Net Demand Balance</h2>
              <p className="text-xs text-slate-400 mt-1">Simulated load variations compared with solar yield</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-500">
                <span className="h-2 w-2 rounded-full bg-blue-500" /> Consumption
              </span>
              <span className="flex items-center gap-1.5 text-amber-500">
                <span className="h-2 w-2 rounded-full bg-amber-500" /> Solar
              </span>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData.length > 0 ? chartData : [
                { time: '08:00', usage: 1.2, solar: 0.5 },
                { time: '10:00', usage: 1.5, solar: 2.1 },
                { time: '12:00', usage: 1.9, solar: 4.8 },
                { time: '14:00', usage: 1.7, solar: 4.2 },
                { time: '16:00', usage: 2.2, solar: 2.0 },
                { time: '18:00', usage: 3.4, solar: 0.2 },
              ]}>
                <defs>
                  <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.15)" />
                <XAxis dataKey="time" stroke="rgba(156, 163, 175, 0.6)" fontSize={11} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.6)" fontSize={11} tickLine={false} unit=" kW" />
                <Tooltip 
                  contentStyle={{ 
                    background: 'rgba(22, 31, 48, 0.9)', 
                    border: '1px solid rgba(255, 255, 255, 0.05)', 
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px'
                  }} 
                />
                <Area type="monotone" dataKey="usage" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorUsage)" />
                <Area type="monotone" dataKey="solar" stroke="#f59e0b" strokeWidth={2} fillOpacity={1} fill="url(#colorSolar)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Environmental Offset Card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">System Metrics</h2>
            <p className="text-xs text-slate-400 mt-1">Sustainability and system status indicators</p>
          </div>

          <div className="my-6 space-y-5">
            {/* Grid Independence */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-slate-500 dark:text-slate-400">Grid Independence Ratio</span>
                <span className="text-slate-700 dark:text-slate-200">{stats?.grid_dependence_percent ?? 55}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                <div 
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500" 
                  style={{ width: `${stats?.grid_dependence_percent ?? 55}%` }} 
                />
              </div>
            </div>

            {/* Savings this month */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-500">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Saved This Month</span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-white">${stats?.savings_this_month ?? '48.35'}</span>
                </div>
              </div>
            </div>

            {/* Solar Utilization */}
            <div className="flex items-center justify-between border-t border-slate-100 dark:border-slate-800/80 pt-4">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-amber-500/10 p-2 text-amber-500">
                  <Sun className="h-4 w-4" />
                </div>
                <div>
                  <span className="block text-xs font-semibold text-slate-500 dark:text-slate-400">Carbon Offset</span>
                  <span className="block text-sm font-bold text-slate-800 dark:text-white">+{stats?.co2_saved_kg ?? '5.2'} kg CO₂</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl bg-brand-500/5 border border-brand-500/15 p-4 text-xs text-brand-500 font-medium">
            🌱 Your energy profile is <strong>Eco-Friendly</strong>. Solar solar inputs covered 40% of peak afternoon usage!
          </div>
        </div>
      </div>
    </div>
  );
};
