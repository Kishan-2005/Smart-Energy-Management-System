import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Zap, Activity, ShieldAlert, Cpu } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

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
  const [error, setError] = useState('');

  useEffect(() => {
    let ws: WebSocket;
    let reconnectTimeout: number;

    const connectWS = () => {
      ws = new WebSocket('ws://127.0.0.1:8000/api/v1/energy/ws');

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
              current: data.current 
            }];
            if (next.length > 15) {
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

  return (
    <div className="space-y-8">
      {/* Real-time Indicator Gauge Cards */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Power */}
        <div className="glass-panel glow-blue rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Load</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{currentMetric?.active_power ?? '0.000'} kW</span>
            <div className="h-2 w-2 rounded-full bg-red-500 animate-ping" />
          </div>
          <span className="mt-2 block text-[10px] text-slate-500 dark:text-slate-400">Updates live every 2 seconds</span>
        </div>

        {/* Card 2: Voltage */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Line Voltage</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{currentMetric?.voltage ?? '230.0'} V</span>
            <span className="rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-500">Nominal</span>
          </div>
          <span className="mt-2 block text-[10px] text-slate-500 dark:text-slate-400">Target Range: 220V - 240V</span>
        </div>

        {/* Card 3: Current */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Current Flow</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{currentMetric?.current ?? '0.00'} A</span>
            <span className="text-xs text-slate-400 dark:text-slate-500">RMS Reading</span>
          </div>
          <span className="mt-2 block text-[10px] text-slate-500 dark:text-slate-400">Amperage rating maximum: 32A</span>
        </div>

        {/* Card 4: Frequency */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">AC Frequency</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-3xl font-bold tracking-tight text-slate-800 dark:text-white">{currentMetric?.frequency ?? '50.00'} Hz</span>
            <span className="text-xs text-brand-500 font-semibold">Phase Locked</span>
          </div>
          <span className="mt-2 block text-[10px] text-slate-500 dark:text-slate-400">Stability Threshold: ±0.5 Hz</span>
        </div>
      </div>

      {/* Live Graph Section */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Line Plot */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-red-500 animate-pulse-slow" /> Real-time Oscilloscope Curve
              </h2>
              <p className="text-xs text-slate-400 mt-1">Telemetry stream demonstrating high frequency usage oscillations</p>
            </div>
          </div>

          <div className="h-80 w-full">
            {history.length === 0 ? (
              <div className="flex h-full items-center justify-center text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <Activity className="h-8 w-8 animate-spin" />
                  <span>Waiting for data stream...</span>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                  <XAxis dataKey="time" stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} />
                  <YAxis stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      background: 'rgba(22, 31, 48, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px'
                    }}
                  />
                  <Line type="monotone" dataKey="power" stroke="#ef4444" strokeWidth={2.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Real-time Logger & Warnings */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">System Status Log</h2>
            <p className="text-xs text-slate-400 mt-1">Automated safety threshold checks</p>
          </div>

          <div className="my-6 space-y-3 overflow-y-auto max-h-56 pr-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-900/40 p-3 text-xs">
                <span className="text-slate-500 font-semibold">{h.time}</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{h.power} kW</span>
                <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                  h.power > 4.0 
                    ? 'bg-amber-500/10 text-amber-500' 
                    : 'bg-emerald-500/10 text-emerald-500'
                }`}>
                  {h.power > 4.0 ? 'High load' : 'Normal'}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-blue-500/10 border border-blue-500/15 p-4 text-xs text-blue-500">
            <Cpu className="h-5 w-5 flex-shrink-0" />
            <span>Harmonics distortion filter is currently active. Line phase offset is balanced.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
