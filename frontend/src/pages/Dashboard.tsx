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
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Home,
  ShieldCheck,
  DollarSign,
  ArrowRight
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
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, ChartSkeleton, ListSkeleton } from '../components/LoadingSkeleton';

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

// --------------------------------------------------------
// SUB-COMPONENT: INTERACTIVE ENERGY FLOW (Tesla Energy Style)
// --------------------------------------------------------
interface EnergyFlowProps {
  solar: number;
  home: number;
  batterySoc: number;
  batteryRate: number; // positive = charging, negative = discharging
  batteryCharging: boolean;
  gridImport: number; // positive = import, negative = export
}

const EnergyFlow: React.FC<EnergyFlowProps> = ({
  solar,
  home,
  batterySoc,
  batteryRate,
  batteryCharging,
  gridImport
}) => {
  const isSolarGenerating = solar > 0.05;
  const isBatteryCharging = batteryCharging && batteryRate > 0.05;
  const isBatteryDischarging = !batteryCharging && batterySoc > 15 && Math.abs(batteryRate) > 0.01;
  const isGridImporting = gridImport > 0.05;
  const isGridExporting = gridImport < -0.05;

  return (
    <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between h-[360px] relative overflow-hidden">
      <div>
        <h3 className="font-extrabold text-white text-base flex items-center gap-2">
          <Activity className="h-4.5 w-4.5 text-emerald-400 animate-pulse" /> Live Energy Flow
        </h3>
        <p className="text-xs text-slate-400 mt-0.5">Real-time power routing across system components</p>
      </div>

      <div className="flex-1 flex items-center justify-center relative mt-2 select-none">
        {/* SVG Flow lines background */}
        <svg viewBox="0 0 400 240" className="w-full h-full max-w-[450px]">
          <defs>
            <linearGradient id="solarGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="homeGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#059669" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="batteryGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#2563eb" stopOpacity={0.2} />
            </linearGradient>
            <linearGradient id="gridGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#0891b2" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          {/* PATHS */}
          {/* Solar -> Home */}
          <path d="M 200 65 L 200 135" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
          {isSolarGenerating && (
            <path
              d="M 200 65 L 200 135"
              stroke="#fbbf24"
              strokeWidth="2"
              fill="none"
              className="flow-path-active"
            />
          )}

          {/* Solar -> Battery */}
          <path d="M 200 65 L 305 135" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
          {isSolarGenerating && isBatteryCharging && (
            <path
              d="M 200 65 L 305 135"
              stroke="#fbbf24"
              strokeWidth="2"
              fill="none"
              className="flow-path-active"
            />
          )}

          {/* Grid -> Home / Home -> Grid */}
          <path d="M 95 135 L 200 135" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
          {isGridImporting && (
            <path
              d="M 95 135 L 200 135"
              stroke="#06b6d4"
              strokeWidth="2"
              fill="none"
              className="flow-path-active"
            />
          )}
          {isGridExporting && (
            <path
              d="M 95 135 L 200 135"
              stroke="#10b981"
              strokeWidth="2"
              fill="none"
              className="flow-path-reverse"
            />
          )}

          {/* Battery -> Home / Home -> Battery */}
          <path d="M 305 135 L 200 135" stroke="rgba(255, 255, 255, 0.06)" strokeWidth="3" fill="none" />
          {isBatteryDischarging && (
            <path
              d="M 305 135 L 200 135"
              stroke="#3b82f6"
              strokeWidth="2"
              fill="none"
              className="flow-path-active"
            />
          )}
          {isBatteryCharging && !isSolarGenerating && (
            <path
              d="M 305 135 L 200 135"
              stroke="#3b82f6"
              strokeWidth="2"
              fill="none"
              className="flow-path-reverse"
            />
          )}

          {/* NODES */}
          {/* Node 1: SOLAR (Top) */}
          <g transform="translate(200, 45)">
            <circle r="22" fill="url(#solarGlow)" stroke={isSolarGenerating ? '#fbbf24' : 'rgba(255, 255, 255, 0.1)'} strokeWidth="2" className={isSolarGenerating ? 'node-pulse-emerald' : ''} />
            <Sun className={`h-5 w-5 -translate-x-2.5 -translate-y-2.5 ${isSolarGenerating ? 'text-amber-300 animate-spin-slow' : 'text-slate-500'}`} />
          </g>

          {/* Node 2: GRID (Left) */}
          <g transform="translate(70, 135)">
            <circle r="22" fill="url(#gridGlow)" stroke={isGridImporting || isGridExporting ? '#06b6d4' : 'rgba(255, 255, 255, 0.1)'} strokeWidth="2" />
            <Zap className={`h-5 w-5 -translate-x-2.5 -translate-y-2.5 ${isGridImporting ? 'text-cyan-400' : isGridExporting ? 'text-emerald-400' : 'text-slate-500'}`} />
          </g>

          {/* Node 3: HOME / LOAD (Center) */}
          <g transform="translate(200, 135)">
            <circle r="26" fill="url(#homeGlow)" stroke="#10b981" strokeWidth="2.5" />
            <Home className="h-6 w-6 -translate-x-3 -translate-y-3 text-emerald-300" />
          </g>

          {/* Node 4: BATTERY (Right) */}
          <g transform="translate(330, 135)">
            <circle r="22" fill="url(#batteryGlow)" stroke={isBatteryCharging || isBatteryDischarging ? '#3b82f6' : 'rgba(255, 255, 255, 0.1)'} strokeWidth="2" className={isBatteryCharging ? 'node-pulse-brand' : ''} />
            <Battery className={`h-5 w-5 -translate-x-2.5 -translate-y-2.5 ${isBatteryCharging ? 'text-blue-400' : isBatteryDischarging ? 'text-indigo-400' : 'text-slate-500'}`} />
          </g>
        </svg>

        {/* Float Labels with Values */}
        <div className="absolute top-[5px] text-center">
          <span className="block text-[10px] font-bold text-amber-400 uppercase tracking-wide">Solar Generation</span>
          <span className="text-xs font-black text-white">{solar.toFixed(2)} kW</span>
        </div>

        <div className="absolute left-[15px] top-[148px] text-center">
          <span className="block text-[10px] font-bold text-cyan-400 uppercase tracking-wide">Utility Grid</span>
          <span className="text-xs font-black text-white">
            {gridImport > 0 ? `Import ${gridImport.toFixed(2)} kW` : gridImport < 0 ? `Export ${Math.abs(gridImport).toFixed(2)} kW` : 'Balanced'}
          </span>
        </div>

        <div className="absolute top-[170px] text-center">
          <span className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wide">Home Load</span>
          <span className="text-sm font-black text-white">{home.toFixed(2)} kW</span>
        </div>

        <div className="absolute right-[15px] top-[148px] text-center">
          <span className="block text-[10px] font-bold text-blue-400 uppercase tracking-wide">Battery</span>
          <span className="text-xs font-black text-white">{batterySoc.toFixed(1)}%</span>
          <span className="block text-[9px] font-semibold text-slate-400">
            {batteryRate > 0.05 ? `+${batteryRate.toFixed(1)} kW` : batteryRate < -0.05 ? `${batteryRate.toFixed(1)} kW` : 'Idle'}
          </span>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------
// MAIN DASHBOARD COMPONENT
// --------------------------------------------------------
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
  const handleToggleAppliance = async (id: number, currentStatus: boolean) => {
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
        // Toggle status locally in state
        setAppliances(prev => 
          prev.map(app => app.id === id ? { ...app, status: !currentStatus } : app)
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
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><ChartSkeleton /></div>
          <div><ListSkeleton /></div>
        </div>
      </div>
    );
  }

  // Live and Fallback Metrics calculation
  const currentLoad = liveData?.active_power ?? stats?.current_load_kw ?? 1.45;
  const currentVoltage = liveData?.voltage ?? 230.1;
  const currentAmps = liveData?.current ?? 6.3;
  const cumulativeEnergy = liveData?.energy_consumed_kwh ?? 125.40;
  const todayConsumption = stats?.today_consumption_kwh ?? 14.5;
  const todaySolar = stats?.today_solar_generation_kwh ?? 11.2;

  // Compute live solar generation matching the backend simulator profile
  const nowHour = new Date().getHours();
  let computedSolar = 0.0;
  if (nowHour >= 6 && nowHour <= 18) {
    const bell = Math.exp(-0.5 * ((nowHour - 12) / 2.5) ** 2);
    computedSolar = bell * 4.2;
  }
  const currentSolar = stats?.current_solar_production_kw ?? computedSolar;

  // Retrieve battery parameters
  const batterySoc = liveData?.battery_soc ?? stats?.battery_soc_percent ?? 68.0;
  const batteryRate = liveData?.battery_charge_rate_kw ?? stats?.battery_charging_rate_kw ?? 0.0;
  const batteryCharging = liveData?.battery_charging_active ?? (batteryRate > 0.05);

  // Compute grid interaction
  // Home consumes power, Solar produces power, Battery charging adds load, Discharging subtracts load
  // Net Grid = HomeLoad - Solar - BatteryDischarge
  const computedGrid = currentLoad - currentSolar;

  // Power Heatmap Grid mock dataset
  const daysOfWeek = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  
  const getHeatmapColor = (dayIndex: number, hour: number) => {
    let baseLoad = 0.3; // Standby
    if (hour >= 8 && hour <= 10) baseLoad += 0.5; // morning spike
    if (hour >= 18 && hour <= 22) baseLoad += 0.9; // evening spike
    if (dayIndex >= 5) baseLoad += 0.2; // weekend boost
    
    if (baseLoad > 1.2) return 'bg-rose-500/80 hover:scale-125 shadow-sm shadow-rose-500/20'; // high
    if (baseLoad > 0.6) return 'bg-amber-500/70 hover:scale-125 shadow-sm shadow-amber-500/10'; // medium
    return 'bg-emerald-500/20 hover:scale-125'; // low
  };

  const getApplianceIcon = (category?: string | null) => {
    switch ((category || '').toLowerCase()) {
      case 'lighting': return <Lightbulb className="h-4.5 w-4.5" />;
      case 'entertainment': return <Tv className="h-4.5 w-4.5" />;
      case 'cooling':
      case 'heating': return <Cpu className="h-4.5 w-4.5" />;
      default: return <Zap className="h-4.5 w-4.5" />;
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-3xl border border-white/5 bg-slate-950/40 p-4 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className={`flex items-center gap-2 rounded-2xl px-3.5 py-2 text-xs font-extrabold tracking-wider transition-all ${
            wsStatus === 'LIVE' 
              ? 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
              : wsStatus === 'CONNECTING'
                ? 'bg-amber-500/10 text-amber-450 border border-amber-500/25'
                : 'bg-rose-500/10 text-rose-450 border border-rose-500/25 animate-pulse'
          }`}>
            {wsStatus === 'LIVE' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                <Wifi className="h-4 w-4 text-emerald-400" />
                <span>LIVE TELEMETRY ACTIVE</span>
              </>
            ) : wsStatus === 'CONNECTING' ? (
              <>
                <span className="h-2 w-2 rounded-full bg-amber-450 animate-pulse" />
                <span>ESTABLISHING SOCKET...</span>
              </>
            ) : (
              <>
                <WifiOff className="h-4 w-4 text-rose-450" />
                <span>OFFLINE - SOCKET RETRY</span>
              </>
            )}
          </div>
          <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 font-semibold">
            <Sparkles className="h-3.5 w-3.5 text-brand-400" />
            <span>High-precision smart telemetry updating instantly</span>
          </div>
        </div>
        
        {liveData && (
          <span className="text-[11px] text-slate-450 font-mono tracking-wider">
            UPDATED: {new Date(liveData.timestamp).toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Energy KPI Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Power Load */}
        <div className="glass-panel glow-brand rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">House Load</span>
            <div className="rounded-2xl bg-brand-500/15 p-2.5 text-brand-400 border border-brand-500/20">
              <Zap className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {currentLoad.toFixed(3)} kW
            </span>
            <span className="mt-2 block text-xs font-semibold text-slate-400 flex items-center gap-1.5">
              <Activity className="h-3.5 w-3.5 text-brand-400 animate-pulse" /> Real-time active usage
            </span>
          </div>
        </div>

        {/* Card 2: Solar Yield */}
        <div className="glass-panel glow-emerald rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Solar Generation</span>
            <div className="rounded-2xl bg-emerald-500/15 p-2.5 text-emerald-400 border border-emerald-500/20">
              <Sun className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {currentSolar.toFixed(2)} kW
            </span>
            <span className="mt-2 block text-xs font-semibold text-slate-400">
              Today: {todaySolar.toFixed(1)} kWh yielded
            </span>
          </div>
        </div>

        {/* Card 3: Battery Level */}
        <div className="glass-panel glow-amber rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Powerwall Battery</span>
            <div className="rounded-2xl bg-amber-500/15 p-2.5 text-amber-400 border border-amber-500/20">
              <Battery className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {batterySoc.toFixed(1)}%
            </span>
            <span className="mt-2 block text-xs font-semibold text-slate-400 flex items-center gap-1">
              {batteryRate > 0.05 ? (
                <span className="text-emerald-400 animate-pulse">⚡ Charging (+{batteryRate.toFixed(1)} kW)</span>
              ) : batteryRate < -0.05 ? (
                <span className="text-blue-400">🔋 Discharging ({batteryRate.toFixed(1)} kW)</span>
              ) : (
                <span>Idle / Connected</span>
              )}
            </span>
          </div>
        </div>

        {/* Card 4: Grid Import */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Grid Import/Export</span>
            <div className="rounded-2xl bg-cyan-500/15 p-2.5 text-cyan-400 border border-cyan-500/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {Math.abs(computedGrid).toFixed(2)} kW
            </span>
            <span className="mt-2 block text-xs font-semibold text-slate-400">
              {computedGrid > 0 ? 'Drawing from grid utility' : computedGrid < 0 ? 'Exporting excess solar' : 'Balanced off-grid'}
            </span>
          </div>
        </div>
      </div>

      {/* Energy Flow & Real-time Graph row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Interactive Energy Flow SVG */}
        <EnergyFlow
          solar={currentSolar}
          home={currentLoad}
          batterySoc={batterySoc}
          batteryRate={batteryRate}
          batteryCharging={batteryCharging}
          gridImport={computedGrid}
        />

        {/* Real-time Oscilloscope Curve */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between h-[360px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-white text-base">Real-Time Oscilloscope Curve</h3>
              <p className="text-xs text-slate-400 mt-0.5">High-frequency home consumption logging</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-brand-400 bg-brand-500/10 border border-brand-500/25 px-2.5 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-400 animate-pulse" />
              <span>Telemetry Active</span>
            </div>
          </div>

          <div className="h-[240px] w-full">
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
                      <stop offset="5%" stopColor="#0ea0ea" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#0ea0ea" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255, 255, 255, 0.03)" />
                  <XAxis dataKey="time" stroke="rgba(255, 255, 255, 0.3)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(255, 255, 255, 0.3)" fontSize={10} tickLine={false} unit=" kW" domain={['auto', 'auto']} />
                  <Tooltip 
                    contentStyle={{ 
                      background: 'rgba(13, 18, 30, 0.95)', 
                      border: '1px solid rgba(255, 255, 255, 0.08)', 
                      borderRadius: '16px',
                      color: '#fff',
                      fontSize: '11px'
                    }} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="power" 
                    stroke="#0ea0ea" 
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
      </div>

      {/* Appliance Controller & Distribution heatmaps */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Appliance Control Board */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-white text-base">Smart Appliance Controls</h3>
            <p className="text-xs text-slate-400 mt-0.5">Toggle and monitor home loads instantly</p>
          </div>

          <div className="my-5 space-y-3.5 max-h-[280px] overflow-y-auto pr-1 scrollbar-thin">
            {appliances.length === 0 ? (
              <div className="text-center py-8 text-xs font-semibold text-slate-400">
                No appliances seeded.
              </div>
            ) : (
              appliances.map((app) => (
                <div 
                  key={app.id} 
                  className={`flex items-center justify-between rounded-2xl border p-3.5 transition-all duration-300 ${
                    app.status 
                      ? 'border-brand-500/20 bg-brand-500/5' 
                      : 'border-white/5 bg-white/5'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${
                      app.status ? 'bg-brand-500/20 text-brand-400' : 'bg-white/5 text-slate-500'
                    }`}>
                      {getApplianceIcon(app.category)}
                    </div>
                    <div>
                      <span className="block text-sm font-bold text-white">{app.name}</span>
                      <div className="flex flex-col gap-0.5">
                        <span className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                          Location: {app.location}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[9px] font-bold text-brand-400 bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/10">
                            XGBoost: {getDisaggregatedPrediction(app).toFixed(2)} kW
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <button 
                    onClick={() => handleToggleAppliance(app.id, app.status)}
                    className="focus:outline-none transition-all duration-200 active:scale-95"
                  >
                    {app.status ? (
                      <ToggleRight className="h-9 w-9 text-brand-400" />
                    ) : (
                      <ToggleLeft className="h-9 w-9 text-slate-650" />
                    )}
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="rounded-2xl bg-amber-500/5 border border-amber-500/15 p-4 text-[10px] text-amber-400 font-semibold leading-relaxed">
            ⚡ Clicking buttons updates appliance states. These changes modify active smart simulation metrics instantly across client sessions!
          </div>
        </div>

        {/* Heatmap Grid */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-extrabold text-white text-base">Power Load Heatmap</h3>
              <p className="text-xs text-slate-400 mt-0.5">7-Day calendar visualization of historical load levels</p>
            </div>
            <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-emerald-500/20" /> Low ({"<"} 0.5 kW)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-amber-500/50" /> Mid (0.5 - 1.2 kW)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded bg-rose-500/80" /> Peak ({">"} 1.2 kW)
              </span>
            </div>
          </div>

          <div className="overflow-x-auto pb-1 scrollbar-thin">
            <div className="min-w-[650px] space-y-2">
              <div className="flex items-center pl-10 text-[9px] font-bold text-slate-500 tracking-wider">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="w-full text-center">
                    {i === 0 ? '12A' : i === 12 ? '12P' : i > 12 ? `${i - 12}P` : `${i}A`}
                  </div>
                ))}
              </div>

              {daysOfWeek.map((day, dayIndex) => (
                <div key={day} className="flex items-center">
                  <div className="w-10 text-xs font-bold text-slate-450 pr-2">
                    {day}
                  </div>
                  <div className="flex-1 flex gap-1">
                    {Array.from({ length: 24 }).map((_, hour) => (
                      <div 
                        key={hour} 
                        className={`h-7 w-full rounded-md transition-all duration-200 cursor-pointer ${getHeatmapColor(dayIndex, hour)}`} 
                        title={`${day} at ${hour}:00 - Average load metrics`}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
