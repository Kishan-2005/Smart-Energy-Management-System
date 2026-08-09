import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  Sun, 
  Battery, 
  CloudSun, 
  Leaf, 
  Zap, 
  Cloud, 
  CloudRain, 
  Wind, 
  Droplets, 
  MapPin, 
  RefreshCw 
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export const SolarForecast: React.FC = () => {
  const { token } = useAuth();
  const [solarData, setSolarData] = useState<any>(null);
  const [weatherData, setWeatherData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');

  const fetchSolarAndWeather = async (forceRefresh = false) => {
    if (forceRefresh) setSyncing(true);
    else setLoading(true);

    const key = localStorage.getItem('weather_api_key') || '';
    const lat = localStorage.getItem('weather_lat') || '12.9716';
    const lon = localStorage.getItem('weather_lon') || '77.5946';
    const loc = localStorage.getItem('weather_location_name') || 'Bengaluru';
    
    const solcastKey = localStorage.getItem('solcast_api_key') || '';
    const solcastId = localStorage.getItem('solcast_resource_id') || '';
    const solcastCap = localStorage.getItem('solcast_capacity') || '6.5';

    const baseParams = `?lat=${lat}&lon=${lon}&location=${encodeURIComponent(loc)}${key ? `&api_key=${key}` : ''}`;
    const solarParams = `${baseParams}${solcastKey ? `&solcast_api_key=${solcastKey}` : ''}${solcastId ? `&solcast_resource_id=${solcastId}` : ''}&capacity=${solcastCap}`;

    try {
      // 1. Fetch Solar analytics
      const solarRes = await fetch(`http://localhost:8000/api/v1/energy/solar${solarParams}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      // 2. Fetch Weather Data (use POST to refresh if forced)
      const weatherUrl = forceRefresh 
        ? `http://localhost:8000/api/v1/energy/weather/refresh${baseParams}` 
        : `http://localhost:8000/api/v1/energy/weather${baseParams}`;
      
      const weatherMethod = forceRefresh ? 'POST' : 'GET';
      const weatherRes = await fetch(weatherUrl, {
        method: weatherMethod,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (solarRes.ok && weatherRes.ok) {
        const sData = await solarRes.json();
        const wData = await weatherRes.json();
        setSolarData(sData);
        setWeatherData(wData);
        setError('');
      } else {
        setError('Failed to fetch weather and solar forecast statistics');
      }
    } catch (err) {
      setError('Failed to connect to backend endpoints');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchSolarAndWeather();
  }, [token]);

  const getWeatherIcon = (cond: string) => {
    const term = (cond || '').toLowerCase();
    if (term.includes('sunny') || term.includes('clear')) {
      return <Sun className="h-8 w-8 text-amber-500 my-3 animate-pulse" />;
    } else if (term.includes('partly')) {
      return <CloudSun className="h-8 w-8 text-amber-450 my-3" />;
    } else if (term.includes('overcast') || term.includes('cloud')) {
      return <Cloud className="h-8 w-8 text-slate-400 my-3" />;
    } else if (term.includes('rain') || term.includes('drizzle')) {
      return <CloudRain className="h-8 w-8 text-blue-400 my-3" />;
    }
    return <CloudSun className="h-8 w-8 text-amber-450 my-3" />;
  };

  if (loading && !solarData) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Sun className="h-10 w-10 animate-spin text-brand-500" />
          <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Loading Solar & Weather Models...</span>
        </div>
      </div>
    );
  }

  // Calculate dynamic yields from forecast curves
  const totalYield = solarData?.hourly_solar?.reduce((acc: number, cur: any) => acc + (cur.generation_kw || 0), 0) || 12.4;
  const carbonSaved = totalYield * 0.42;

  return (
    <div className="space-y-8">
      {/* Weather Header Panel */}
      <div className="glass-panel rounded-3xl p-6 relative overflow-hidden">
        {/* Glow gradients */}
        <div className="absolute right-0 top-0 -mr-16 -mt-16 w-48 h-48 rounded-full bg-brand-500/10 blur-3xl" />
        <div className="absolute left-1/3 bottom-0 w-36 h-36 rounded-full bg-teal-500/5 blur-3xl" />

        <div className="flex flex-col gap-6 md:flex-row md:items-center justify-between relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <MapPin className="h-5 w-5 text-brand-500" />
              <h2 className="text-xl font-extrabold text-slate-800 dark:text-white leading-none">
                {weatherData?.current?.location ?? 'Bengaluru'} Weather & Solar Outlook
              </h2>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                weatherData?.integration_type === 'live' 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
              }`}>
                OWM: {weatherData?.integration_type === 'live' ? 'Live API' : 'Simulation'}
              </span>
              <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                solarData?.solcast_integration_type === 'live' 
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/25 shadow-[0_0_15px_rgba(16,185,129,0.15)]' 
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/25'
              }`}>
                Solcast: {solarData?.solcast_integration_type === 'live' ? 'Live API' : 'Simulation'}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              OpenWeatherMap dynamic weather details paired with Solcast advanced solar irradiance forecasting.
            </p>
          </div>

          <button
            onClick={() => fetchSolarAndWeather(true)}
            disabled={syncing}
            className="flex items-center gap-2 self-start md:self-center rounded-2xl bg-brand-600 hover:bg-brand-500 text-white font-bold text-xs px-5 py-3 transition-all active:scale-95 disabled:opacity-50 shadow-md shadow-brand-500/10"
          >
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            <span>{syncing ? 'Syncing Weather...' : 'Sync Weather'}</span>
          </button>
        </div>

        {/* Current Weather Details Grid */}
        {weatherData?.current && (
          <div className="mt-6 grid gap-4 grid-cols-2 md:grid-cols-4 pt-6 border-t border-slate-100 dark:border-slate-800/80 relative z-10">
            {/* Temp */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/10 p-2.5 text-amber-500 border border-amber-500/10">
                <Sun className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Temperature</span>
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">{weatherData.current.temperature}°C</span>
              </div>
            </div>

            {/* Humidity */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500 border border-blue-500/10">
                <Droplets className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Humidity</span>
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">{weatherData.current.humidity}%</span>
              </div>
            </div>

            {/* Wind speed */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-teal-500/10 p-2.5 text-teal-500 border border-teal-500/10">
                <Wind className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Wind Speed</span>
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">{weatherData.current.wind_speed} m/s</span>
              </div>
            </div>

            {/* Cloud cover */}
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-slate-500/10 p-2.5 text-slate-500 border border-slate-500/10">
                <Cloud className="h-5 w-5" />
              </div>
              <div>
                <span className="block text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Cloud Cover</span>
                <span className="text-base font-bold text-slate-800 dark:text-slate-200">{weatherData.current.cloud_cover}%</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs font-semibold text-rose-500">
          ⚠️ {error}
        </div>
      )}

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
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">{totalYield.toFixed(1)} kWh</span>
            <div className="rounded-xl bg-blue-500/10 p-2 text-blue-500">
              <Zap className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Carbon savings */}
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Carbon Saved Today</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">{carbonSaved.toFixed(1)} kg CO₂</span>
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
              <Sun className="h-5 w-5 text-amber-500 animate-spin-slow" /> Solar Yield Forecast
            </h2>
            <p className="text-xs text-slate-400 mt-1">Predicted generation curve updated by cloud cover indices</p>
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
        <h3 className="font-bold text-slate-800 dark:text-white text-base">5-Day Weather & Solar Outlook</h3>
        <div className="mt-6 grid gap-4 sm:grid-cols-5">
          {weatherData?.forecast?.map((wf: any, index: number) => (
            <div 
              key={index} 
              className="flex flex-col items-center justify-between text-center rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 p-4 dark:bg-slate-900/20 hover:-translate-y-1 transition-all duration-200"
            >
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">{wf.day}</span>
              {getWeatherIcon(wf.condition)}
              
              <div className="space-y-1 w-full my-2">
                <span className="block font-bold text-slate-800 dark:text-slate-200 text-sm">{wf.temp}</span>
                <span className="block text-[10px] font-semibold text-slate-455 dark:text-slate-400 mt-0.5">{wf.condition}</span>
                
                {/* Weather cards parameters details */}
                <div className="pt-2 mt-2 border-t border-slate-100 dark:border-slate-800/40 text-[9px] text-slate-400 flex flex-col gap-1 text-left pl-1">
                  <span className="flex items-center gap-1 font-medium">☁️ Clouds: {Math.round(wf.cloud_cover)}%</span>
                  <span className="flex items-center gap-1 font-medium">💧 Humidity: {Math.round(wf.humidity)}%</span>
                  <span className="flex items-center gap-1 font-medium">💨 Wind: {wf.wind_speed} m/s</span>
                </div>
              </div>

              <div className="mt-3 w-full rounded-lg bg-amber-500/10 py-1 text-[10px] font-bold text-amber-500">
                Score: {wf.solar_score}/10
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

