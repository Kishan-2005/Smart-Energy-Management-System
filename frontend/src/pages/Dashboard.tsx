import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Zap, 
  Sun, 
  Battery, 
  Activity, 
  Wifi, 
  WifiOff, 
  TrendingUp, 
  Cpu, 
  Lightbulb, 
  Tv, 
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

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

interface Appliance {
  id: number;
  name: string;
  category: string;
  status: boolean;
  power_consumed: number;
  location: string;
}

export const Dashboard: React.FC = () => {
  const { token } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Real-time WebSocket parameters
  const [liveData, setLiveData] = useState<any>(null);
  const [wsStatus, setWsStatus] = useState<'CONNECTING' | 'LIVE' | 'DISCONNECTED'>('CONNECTING');
  
  // Rolling telemetry history for charts (limit to last 30 points)
  const [rollingHistory, setRollingHistory] = useState<any[]>([]);

  // 1. WebSocket connection setup
  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connectWS = () => {
      setWsStatus('CONNECTING');
      ws = new WebSocket('ws://127.0.0.1:8000/api/v1/energy/ws');

      ws.onopen = () => {
        setWsStatus('LIVE');
        setError('');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setLiveData(data);
          
          // Append to rolling history
          const timeLabel = new Date(data.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });

          setRollingHistory((prev) => {
            const next = [...prev, {
              time: timeLabel,
              power: data.active_power,
              voltage: data.voltage,
              current: data.current
            }];
            if (next.length > 25) {
              return next.slice(1);
            }
            return next;
          });
        } catch (e) {
          console.error("Failed to parse websocket frame:", e);
        }
      };

      ws.onclose = () => {
        setWsStatus('DISCONNECTED');
        reconnectTimeout = window.setTimeout(connectWS, 3000); // retry connect
      };

      ws.onerror = (err) => {
        console.error("Websocket error:", err);
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  // 2. Fetch REST stats & appliances
  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/stats', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error("REST stats fetch error:", err);
    }
  };

  const fetchAppliances = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/appliances', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAppliances(data);
      }
    } catch (err) {
      console.error("REST appliances fetch error:", err);
    }
  };

  useEffect(() => {
    const loadREST = async () => {
      setLoading(true);
      await Promise.all([fetchStats(), fetchAppliances()]);
      setLoading(false);
    };
    loadREST();
    
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [token]);

  // 3. Toggle appliance handler
  const handleToggleAppliance = async (id: number) => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/appliances/toggle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ appliance_id: id })
      });
      if (res.ok) {
        // Toggle status locally in state
        setAppliances(prev => 
          prev.map(app => app.id === id ? { ...app, status: !app.status } : app)
        );
        // Refresh slower stats right after toggle
        setTimeout(fetchStats, 200);
      }
    } catch (err) {
      console.error("Failed to toggle appliance status:", err);
    }
  };

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

  // Fallbacks
  const currentLoad = liveData?.active_power ?? stats?.current_load_kw ?? 1.45;
  const currentVoltage = liveData?.voltage ?? 230.1;
  const currentAmps = liveData?.current ?? 6.3;
  const cumulativeEnergy = liveData?.energy_consumed_kwh ?? 125.40;
  const todayConsumption = stats?.today_consumption_kwh ?? 14.5;
  const todaySolar = stats?.today_solar_generation_kwh ?? 11.2;

  // Power Heatmap Grid mock dataset: 7 days of the week, 24 hours per day
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  // Power factor function representing normal grid load levels (peaks in evening 18-22 and morning 8-10)
  const getHeatmapColor = (dayIndex: number, hour: number) => {
    let baseLoad = 0.3; // Standby
    if (hour >= 8 && hour <= 10) baseLoad += 0.5; // morning spike
    if (hour >= 18 && hour <= 22) baseLoad += 0.9; // evening spike
    
    // Add minor day specific variance
    if (dayIndex >= 5) baseLoad += 0.2; // weekend boost
    
    if (baseLoad > 1.2) return 'bg-rose-500/80 dark:bg-rose-500/90 hover:scale-125'; // high
    if (baseLoad > 0.6) return 'bg-amber-400/70 dark:bg-amber-400/80 hover:scale-125'; // medium
    return 'bg-emerald-500/30 dark:bg-emerald-500/20 hover:scale-125'; // low
  };

  const getApplianceIcon = (category?: string | null) => {
    switch ((category || '').toLowerCase()) {
      case 'lighting': return <Lightbulb className="h-4 w-4" />;
      case 'entertainment': return <Tv className="h-4 w-4" />;
      case 'cooling':
      case 'heating': return <Cpu className="h-4 w-4" />;
      default: return <Zap className="h-4 w-4" />;
    }
  };

  const getDisaggregatedPrediction = (app: Appliance) => {
    if (!liveData || !liveData.ai_predictions) return 0;
    const name = (app.name || '').toLowerCase();
    const cat = (app.category || '').toLowerCase();
    
    if (name.includes('fridge') || name.includes('refrigerator') || cat.includes('refrigerator') || cat.includes('fridge')) {
      return liveData.ai_predictions.refrigerator ?? 0;
    }
    if (name.includes('tv') || name.includes('television') || cat.includes('entertainment')) {
      return liveData.ai_predictions.tv ?? 0;
    }
    if (name.includes('ac') || name.includes('conditioner') || cat.includes('cooling') || cat.includes('heating')) {
      return liveData.ai_predictions.ac ?? 0;
    }
    if (name.includes('washing') || name.includes('dryer') || cat.includes('laundry')) {
      return liveData.ai_predictions.washing_machine ?? 0;
    }
    if (name.includes('fan') || cat.includes('ventilation') || cat.includes('lighting')) {
      return liveData.ai_predictions.fan ?? 0;
    }
    return 0;
  };

  return (
    <div className="space-y-8">
      {/* Real-time WebSockets Banner status */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-slate-200/60 bg-white/40 p-4 backdrop-blur-md dark:border-slate-800/60 dark:bg-darkbg-card/40">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-bold tracking-wide transition-all ${
            wsStatus === 'LIVE' 
              ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
              : wsStatus === 'CONNECTING'
                ? 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
                : 'bg-red-500/10 text-red-500 border border-red-500/25 animate-pulse'
          }`}>
            {wsStatus === 'LIVE' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <Wifi className="h-4 w-4" />
                <span>LIVE TELEMETRY ACTIVE</span>
              </>
            ) : wsStatus === 'CONNECTING' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span>ESTABLISHING SOCKET...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4" />
                <span>OFFLINE - SOCKET RETRY</span>
              </>
            )}
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-brand-500" />
            <span>High-precision smart telemetry updating instantly</span>
          </div>
        </div>
        
        {liveData && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
            UPDATED: {new Date(liveData.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Energy KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Power Load */}
        <div className="glass-panel glow-blue rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Grid Active Power</span>
            <div className="rounded-2xl bg-blue-500/10 p-2.5 text-blue-500 border border-blue-500/20">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white md:text-4xl">
              {currentLoad.toFixed(3)} kW
            </span>
            <span className="mt-2 block text-xs font-medium text-slate-400 flex items-center gap-1">
              <Activity className="h-3 w-3 text-emerald-500 animate-pulse" /> Real-time simulated load
            </span>
          </div>
        </div>

        {/* Card 2: Voltage Trend + Sparkline */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Voltage Line</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald-500 border border-emerald-500/20">
              STABLE
            </span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <div>
              <span className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white md:text-4xl">
                {currentVoltage.toFixed(1)} V
              </span>
              <span className="mt-2 block text-xs text-slate-400">Target Line: 230V</span>
            </div>
            
            {/* Sparkline */}
            <div className="h-10 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rollingHistory}>
                  <Line type="monotone" dataKey="voltage" stroke="#10b981" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Card 3: Current Flow + Sparkline */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Line Current</span>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">RMS Telemetry</span>
          </div>
          <div className="mt-4 flex items-baseline justify-between gap-4">
            <div>
              <span className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white md:text-4xl">
                {currentAmps.toFixed(2)} A
              </span>
              <span className="mt-2 block text-xs text-slate-400">Max limit: 32.0A</span>
            </div>

            {/* Sparkline */}
            <div className="h-10 w-24">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={rollingHistory}>
                  <Line type="monotone" dataKey="current" stroke="#ef4444" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Card 4: Cumulative Energy */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between transition-all duration-200 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Accumulated Counter</span>
            <div className="rounded-2xl bg-orange-500/10 p-2.5 text-orange-500 border border-orange-500/20">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white md:text-4xl">
              {cumulativeEnergy.toFixed(3)} kWh
            </span>
            <span className="mt-2 block text-xs text-slate-400">Wh counter logging enabled</span>
          </div>
        </div>
      </div>

      {/* Live Chart & Appliance Toggles Row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Live Line Chart */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Real-Time Power Curve</h2>
              <p className="text-xs text-slate-400 mt-0.5">High frequency consumption logging graph</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-blue-500 bg-blue-500/10 border border-blue-500/20 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Real-time Active Load</span>
            </div>
          </div>

          <div className="h-80 w-full">
            {rollingHistory.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-8 w-8 animate-spin text-brand-500" />
                  <span className="text-xs font-bold uppercase tracking-wider">Listening for WS frames...</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={rollingHistory}>
                  <defs>
                    <linearGradient id="livePowerGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                  <XAxis dataKey="time" stroke="rgba(156, 163, 175, 0.5)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(156, 163, 175, 0.5)" fontSize={10} tickLine={false} unit=" kW" domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(15, 23, 42, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '11px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="power" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5} 
                    fillOpacity={1} 
                    fill="url(#livePowerGrad)" 
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Appliance Controller list */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Appliance Control Board</h2>
            <p className="text-xs text-slate-400 mt-0.5">Toggle smart home devices directly</p>
          </div>

          <div className="my-6 space-y-4 max-h-[300px] overflow-y-auto pr-2 scrollbar-thin">
            {appliances.length === 0 ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-400">
                No appliances seeded.
              </div>
            ) : (
              appliances.map((app) => (
                <div 
                  key={app.id} 
                  className={`flex items-center justify-between rounded-2xl border p-4 transition-all duration-300 ${
                    app.status 
                      ? 'border-brand-500/20 bg-brand-500/5 dark:bg-brand-500/10' 
                      : 'border-slate-200/80 dark:border-slate-800/80 bg-white/5 dark:bg-darkbg-card/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${
                      app.status ? 'bg-brand-500/20 text-brand-500' : 'bg-slate-500/10 text-slate-400'
                    }`}>
                      {getApplianceIcon(app.category)}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-slate-800 dark:text-white">{app.name}</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          Location: {app.location}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold text-brand-500 bg-brand-500/10 px-1.5 py-0.5 rounded">
                            AI XGBoost: {getDisaggregatedPrediction(app).toFixed(2)} kW
                          </span>
                          {app.status && (
                            <span className="text-[9px] font-medium text-slate-400">
                              (Actual: {app.power_consumed.toFixed(2)} kW)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleToggleAppliance(app.id)}
                    className="focus:outline-none transition-all duration-200 active:scale-95"
                  >
                    {app.status ? (
                      <ToggleRight className="h-9 w-9 text-brand-500" />
                    ) : (
                      <ToggleLeft className="h-9 w-9 text-slate-300 dark:text-slate-700" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/20 p-4 text-[11px] text-amber-600 dark:text-amber-400 font-semibold leading-relaxed">
            💡 <strong>Smart Link Mode</strong> is active. Turning appliances ON/OFF instantly modifies the simulated current load across all WebSocket clients!
          </div>
        </div>
      </div>

      {/* Hourly / Daily Heatmap grid */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Power Distribution Heatmap</h2>
            <p className="text-xs text-slate-400 mt-0.5">7-Day calendar visualization of system load levels by hour</p>
          </div>
          <div className="flex items-center gap-4 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-emerald-500/30" /> Low standby ({"<"} 0.5 kW)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-amber-400/70" /> Moderate load (0.5 - 1.2 kW)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded bg-rose-500/80" /> Peak spike ({">"} 1.2 kW)
            </span>
          </div>
        </div>

        {/* Heatmap Grid Wrapper */}
        <div className="overflow-x-auto pb-2 scrollbar-thin">
          <div className="min-w-[800px] space-y-2">
            {/* Hour Headers */}
            <div className="flex items-center pl-10 text-[9px] font-extrabold text-slate-400/80 tracking-wider">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="w-full text-center">
                  {i === 0 ? '12A' : i === 12 ? '12P' : i > 12 ? `${i - 12}P` : `${i}A`}
                </div>
              ))}
            </div>

            {/* Heatmap Rows */}
            {daysOfWeek.map((day, dayIndex) => (
              <div key={day} className="flex items-center">
                {/* Day label */}
                <div className="w-10 text-xs font-bold text-slate-400 dark:text-slate-500 pr-2">
                  {day}
                </div>
                
                {/* Hour boxes */}
                <div className="flex-1 flex gap-1">
                  {Array.from({ length: 24 }).map((_, hour) => (
                    <div 
                      key={hour} 
                      className={`h-7 w-full rounded-md transition-all duration-200 cursor-pointer ${getHeatmapColor(dayIndex, hour)}`} 
                      title={`${day} at ${hour}:00 - Simulated average load levels`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
