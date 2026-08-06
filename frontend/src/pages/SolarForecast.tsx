import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Sun, Battery, CloudSun, Leaf, Zap } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const SolarForecast: React.FC = () => {
  const { token } = useAuth();
  const [solarData, setSolarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchSolar = async () => {
      try {
        const res = await fetch('http://localhost:8000/api/v1/energy/solar', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        if (res.ok) {
          const data = await res.json();
          setSolarData(data);
        } else {
          setError('Failed to fetch solar forecast statistics');
        }
      } catch (err) {
        setError('Failed to connect to solar backend endpoints');
      } finally {
        setLoading(false);
      }
    };

    fetchSolar();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Overview stats */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {/* PV Capacity */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">PV Array Size</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">{solarData?.system_capacity_kw ?? '6.5'} kWp</span>
            <div className="rounded-xl bg-amber-500/10 p-2 text-amber-500">
              <Sun className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Battery capacity */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Storage Capacity</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">{solarData?.battery_capacity_kwh ?? '13.5'} kWh</span>
            <div className="rounded-xl bg-teal-500/10 p-2 text-teal-500">
              <Battery className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* PV generation peak prediction */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Solar Yield Today</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">12.4 kWh</span>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Carbon savings */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Carbon Saved Today</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">5.2 kg CO₂</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500">
              <Leaf className="h-5 w-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts grids */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Solar production curve */}
        <div className="glass-panel rounded-2xl p-6">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
              <Sun className="h-5 w-5 text-amber-500" /> Solar Insolation & Yield Forecast
            </h2>
            <p className="text-xs text-slate-400 mt-1">Predicted generation curve based on meteorological estimates</p>
          </div>

          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={solarData?.hourly_solar ?? []}>
                <defs>
                  <linearGradient id="colorSolarForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                <XAxis dataKey="time" stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} unit=" kW" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(22, 31, 48, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Area type="monotone" dataKey="generation_kw" name="Solar Generation" stroke="#f59e0b" strokeWidth={2.5} fillOpacity={1} fill="url(#colorSolarForecast)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Battery SOC Profile */}
        <div className="glass-panel rounded-2xl p-6">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg flex items-center gap-2">
              <Battery className="h-5 w-5 text-teal-500" /> Battery Storage Charge Cycle
            </h2>
            <p className="text-xs text-slate-400 mt-1">Simulated 24-hour battery State of Charge (SOC%) trend</p>
          </div>

          <div className="mt-8 h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={solarData?.battery_soc_curve ?? []}>
                <defs>
                  <linearGradient id="colorBatterySOC" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(156, 163, 175, 0.1)" />
                <XAxis dataKey="hour" stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} />
                <YAxis stroke="rgba(156, 163, 175, 0.6)" fontSize={10} tickLine={false} unit="%" />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(22, 31, 48, 0.95)',
                    border: '1px solid rgba(255, 255, 255, 0.05)',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '11px'
                  }}
                />
                <Area type="monotone" dataKey="soc_percent" name="SOC %" stroke="#10b981" strokeWidth={2.5} fillOpacity={1} fill="url(#colorBatterySOC)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Solar Weather Outlook */}
      <div className="glass-panel rounded-2xl p-6">
        <h3 className="font-bold text-slate-800 dark:text-white text-base">Weekly Solar Yield Outlook</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-5">
          {solarData?.weather_forecast?.map((wf: any, index: number) => (
            <div key={index} className="flex flex-col items-center justify-between text-center rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 p-4 dark:bg-slate-900/20">
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{wf.day}</span>
              <CloudSun className="h-8 w-8 text-amber-500 my-3" />
              <div>
                <span className="block font-bold text-slate-800 dark:text-slate-200 text-sm">{wf.temp}</span>
                <span className="block text-[10px] font-semibold text-slate-400 mt-0.5">{wf.condition}</span>
              </div>
              <div className="mt-4 rounded-lg bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold text-amber-500">
                Score: {wf.solar_score}/10
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
