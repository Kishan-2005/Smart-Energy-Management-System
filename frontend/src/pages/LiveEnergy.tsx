import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, Activity, ShieldAlert, Cpu, Sparkles, Sliders, PlayCircle, StopCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { CardSkeleton, ChartSkeleton } from '../components/LoadingSkeleton';

interface LiveMetric {
  timestamp: string;
  active_power: number;
  voltage: number;
  current: number;
  frequency: number;
  energy_consumed_kwh: number;
  grid_status: string;
}

export const LiveEnergy: React.FC = () => {
  const { token } = useAuth();
  const [currentMetric, setCurrentMetric] = useState<LiveMetric | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connectWS = () => {
      ws = new WebSocket('ws://127.0.0.1:8000/api/v1/energy/ws');

      ws.onopen = () => {
        setLoading(false);
      };

      ws.onmessage = (event) => {
        try {
          const data: LiveMetric = JSON.parse(event.data);
          setCurrentMetric(data);
          
          const timeLabel = new Date(data.timestamp).toLocaleTimeString([], { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
          });

          setHistory((prev) => {
            const next = [...prev, { 
              time: timeLabel, 
              power: data.active_power, 
              voltage: data.voltage, 
              current: data.current,
              freq: data.frequency
            }];
            if (next.length > 25) {
              return next.slice(1);
            }
            return next;
          });
        } catch (err) {
          console.error("Failed to parse Live WS telemetry:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = window.setTimeout(connectWS, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      clearTimeout(reconnectTimeout);
    };
  }, [token]);

  if (loading && history.length === 0) {
    return (
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><ChartSkeleton /></div>
          <div><ChartSkeleton /></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Indicator cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Active Power */}
        <div className="glass-panel glow-rose rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Active Draw</span>
            <div className="h-6 w-6 rounded-full bg-rose-500/10 border border-rose-500/25 flex items-center justify-center">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-500 animate-ping" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {currentMetric?.active_power.toFixed(3) ?? '0.000'} kW
            </span>
            <span className="mt-2 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Updates live every 1.0s
            </span>
          </div>
        </div>

        {/* Card 2: Voltage */}
        <div className="glass-panel glow-emerald rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Line Voltage</span>
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold text-emerald-450 border border-emerald-500/20">
              NOMINAL
            </span>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {currentMetric?.voltage.toFixed(1) ?? '230.0'} V
            </span>
            <span className="mt-2 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Deviation: {Math.abs((currentMetric?.voltage ?? 230) - 230).toFixed(2)}V
            </span>
          </div>
        </div>

        {/* Card 3: Current */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Amperage</span>
            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wide">RMS Current</span>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {currentMetric?.current.toFixed(2) ?? '0.00'} A
            </span>
            <span className="mt-2 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Max load capacity: 32A
            </span>
          </div>
        </div>

        {/* Card 4: Frequency */}
        <div className="glass-panel glow-brand rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] cursor-pointer">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">AC Frequency</span>
            <div className="rounded-xl bg-brand-500/10 p-1.5 text-brand-450 border border-brand-500/20">
              <Cpu className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-6">
            <span className="text-3xl font-black tracking-tight text-white md:text-4xl">
              {currentMetric?.frequency.toFixed(2) ?? '50.00'} Hz
            </span>
            <span className="mt-2 block text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
              Synchronized Phase-Lock
            </span>
          </div>
        </div>
      </div>

      {/* Graphs and Logs */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Real-time Oscilloscope */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 flex flex-col justify-between h-[360px]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Sliders className="h-4.5 w-4.5 text-brand-400" /> Active Load Oscilloscope
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">High frequency line power draw chart</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-rose-450 bg-rose-500/10 border border-rose-500/20 px-3 py-1 rounded-full">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ping" />
              <span>LIVE CORE STREAM</span>
            </div>
          </div>

          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="livePowerGradDraw" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
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
                  stroke="#f43f5e" 
                  strokeWidth={2.5} 
                  fillOpacity={1} 
                  fill="url(#livePowerGradDraw)" 
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Real-time Status Logger */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between h-[360px]">
          <div>
            <h3 className="font-extrabold text-white text-base">Grid System Status Log</h3>
            <p className="text-xs text-slate-400 mt-0.5">Automated safety threshold checks</p>
          </div>

          <div className="my-5 flex-1 space-y-2.5 overflow-y-auto pr-1 scrollbar-thin max-h-[170px]">
            {history.length === 0 ? (
              <div className="text-center text-xs text-slate-500 py-8">
                No active records.
              </div>
            ) : (
              history.map((h, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 border border-white/5 p-3 text-xs transition-all hover:bg-white/10">
                  <span className="text-slate-400 font-bold">{h.time}</span>
                  <span className="font-extrabold text-white">{h.power.toFixed(3)} kW</span>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    h.power > 3.0 
                      ? 'bg-rose-500/10 text-rose-450 border border-rose-500/25' 
                      : 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/25'
                  }`}>
                    {h.power > 3.0 ? 'High load' : 'Normal'}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 rounded-2xl bg-white/5 border border-white/5 p-4 text-xs text-slate-350">
            <Sparkles className="h-5 w-5 text-brand-400 flex-shrink-0" />
            <span>Telemetry data filter: ON. Phase lock frequency is balanced across load lines.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
