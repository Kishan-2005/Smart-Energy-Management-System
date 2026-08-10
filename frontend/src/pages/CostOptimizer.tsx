import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Battery, 
  BatteryCharging, 
  Clock, 
  Zap, 
  Tv, 
  Thermometer, 
  Car, 
  Lightbulb, 
  Sliders 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Recommendation {
  id: number;
  timestamp: string;
  title: string;
  recommendation_text: string;
  potential_saving: number;
  status: string;
  actionable_type: string;
}

interface Tariff {
  time: string;
  rate: number;
  type: string;
  color: string;
}

interface ScheduleItem {
  appliance: string;
  recommended_time: string;
  reason: string;
  icon: string;
}

interface ApplianceState {
  status: boolean;
  power: number;
  id: number;
}

export const CostOptimizer: React.FC = () => {
  const { token } = useAuth();
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [savings, setSavings] = useState(0.0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // Live states for interactive controls
  const [batterySoc, setBatterySoc] = useState(68.0);
  const [batteryTargetSoc, setBatteryTargetSoc] = useState(90.0);
  const [batteryChargingActive, setBatteryChargingActive] = useState(false);
  const [batteryChargeRate, setBatteryChargeRate] = useState(0.0);
  const [applianceStates, setApplianceStates] = useState<Record<string, ApplianceState>>({});

  const [notification, setNotification] = useState<{message: string; type: 'success' | 'info'} | null>(null);

  const showNotification = (message: string, type: 'success' | 'info' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  const fetchOptimizer = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/cost/optimizer', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setRecs(data.recommendations);
        setTariffs(data.tariffs);
        setSchedule(data.optimal_schedule ?? []);
        setSavings(data.monthly_potential_savings);
        setProgress(data.billing_cycle_progress);
        
        // Load live override states
        setBatterySoc(data.battery_soc ?? 68.0);
        setBatteryTargetSoc(data.battery_target_soc ?? 90.0);
        setBatteryChargingActive(data.battery_charging_active ?? false);
        setBatteryChargeRate(data.battery_charge_rate_kw ?? 0.0);
        setApplianceStates(data.appliance_states ?? {});
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptimizer();
    // Poll the cost optimizer data every 3 seconds to keep values/telemetry fresh
    const interval = setInterval(fetchOptimizer, 3000);
    return () => clearInterval(interval);
  }, [token]);

  const handleApply = async (id: number, currentStatus: string) => {
    setUpdatingId(id);
    const nextStatus = currentStatus === 'applied' ? 'pending' : 'applied';
    try {
      const res = await fetch(`http://localhost:8000/api/v1/energy/cost/optimizer/recommendations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: nextStatus })
      });
      if (res.ok) {
        const updated = await res.json();
        setRecs((prev) => prev.map((r) => (r.id === id ? updated : r)));
        showNotification(
          nextStatus === 'applied' 
            ? `Recommendation Applied: "${updated.title}" successfully configured.`
            : `Recommendation Reverted to pending.`,
          'success'
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBatteryChargeToggle = async (active: boolean) => {
    try {
      const res = await fetch('http://localhost:8000/api/v1/energy/battery/charge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ target_soc: batteryTargetSoc, charge_active: active })
      });
      if (res.ok) {
        const data = await res.json();
        setBatteryChargingActive(data.charge_active);
        setBatteryTargetSoc(data.target_soc);
        
        // Also auto-apply the recommendation if active is true
        if (active) {
          const rec = recs.find(r => r.actionable_type === 'battery');
          if (rec && rec.status !== 'applied') {
            await handleApply(rec.id, 'pending');
          }
          showNotification(`Battery pre-charging triggered. Charging rate: 3.0 kW.`, 'info');
        } else {
          showNotification(`Battery pre-charging suspended.`, 'info');
        }
        fetchOptimizer();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApplianceToggle = async (id: number, currentStatus: boolean, recToApply?: Recommendation) => {
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
        if (recToApply && recToApply.status !== 'applied') {
          await handleApply(recToApply.id, 'pending');
        }
        showNotification(`Appliance status updated successfully.`);
        fetchOptimizer();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renderShiftLoadControl = (r: Recommendation) => {
    const wmState = applianceStates["Washing Machine"];
    const isWMRunning = wmState?.status ?? false;
    const wmPower = wmState?.power ?? 0;
    
    return (
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between text-slate-500">
          <span>Washing Machine Status:</span>
          <span className={`font-bold flex items-center gap-1.5 ${isWMRunning ? 'text-amber-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${isWMRunning ? 'bg-amber-500 animate-ping' : 'bg-slate-400'}`} />
            {isWMRunning ? `Running (${wmPower.toFixed(2)} kW)` : 'Idle / Ready'}
          </span>
        </div>
        
        {isWMRunning ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <span className="text-[11px] text-slate-400 leading-normal">
              Shift this run to nighttime off-peak hours (9 PM - 6 AM) or midday solar surplus (11 AM - 2 PM) to save billing charges.
            </span>
            <button
              onClick={() => handleApplianceToggle(wmState.id, true, r)}
              className="whitespace-nowrap rounded-lg bg-amber-500 text-white font-bold px-3 py-1.5 hover:bg-amber-600 transition-all text-xs active:scale-95 shadow-sm shadow-amber-500/10"
            >
              Postpone & Shift Now
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-900/40 p-3 rounded-xl border border-slate-100 dark:border-slate-800/40">
            <span className="text-[11px] text-slate-400">Automatic off-peak schedule configuration rules.</span>
            <button
              onClick={() => handleApply(r.id, r.status)}
              className={`rounded-lg px-3 py-1.5 font-semibold text-xs transition-all active:scale-95 ${
                r.status === 'applied' 
                  ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-350 hover:bg-slate-300 dark:hover:bg-slate-700' 
                  : 'bg-brand-600 text-white hover:bg-brand-500'
              }`}
            >
              {r.status === 'applied' ? 'Applied Schedule' : 'Schedule Next Load'}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderBatteryControl = (r: Recommendation) => {
    return (
      <div className="space-y-4 text-xs">
        {/* Battery SOC */}
        <div className="space-y-1.5">
          <div className="flex justify-between font-medium text-slate-400">
            <span>Battery Charge Level</span>
            <span className="font-bold text-slate-700 dark:text-slate-200">{batterySoc.toFixed(1)}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${batteryChargingActive ? 'bg-emerald-500 animate-pulse' : 'bg-brand-500'}`} 
              style={{ width: `${batterySoc}%` }} 
            />
          </div>
        </div>

        {/* Target SOC slider */}
        <div className="space-y-1">
          <div className="flex justify-between font-medium text-slate-400">
            <span>Target SOC limit</span>
            <span className="font-bold text-brand-500">{batteryTargetSoc}%</span>
          </div>
          <input 
            type="range"
            min="60"
            max="100"
            value={batteryTargetSoc}
            disabled={batteryChargingActive}
            onChange={(e) => setBatteryTargetSoc(parseInt(e.target.value))}
            className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-slate-200 dark:bg-slate-800 accent-brand-500 disabled:opacity-50"
          />
        </div>

        {/* Charge actions */}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider flex items-center gap-1.5">
            {batteryChargingActive ? (
              <>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                <span>⚡ Charging at +{batteryChargeRate.toFixed(1)} kW</span>
              </>
            ) : (
              <>
                <span className="h-2 w-2 rounded-full bg-slate-400" />
                <span>🔋 Standing by to shave evening peaks</span>
              </>
            )}
          </span>
          <button
            onClick={() => handleBatteryChargeToggle(!batteryChargingActive)}
            className={`rounded-lg px-3.5 py-1.5 font-bold transition-all text-xs active:scale-95 ${
              batteryChargingActive 
                ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/10' 
                : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/10'
            }`}
          >
            {batteryChargingActive ? 'Stop Charging' : 'Pre-Charge Now'}
          </button>
        </div>
      </div>
    );
  };

  const renderStandbyControl = (r: Recommendation) => {
    const entState = applianceStates["Home Entertainment"];
    const isEntOn = entState?.status ?? false;
    const entPower = entState?.power ?? 0;
    
    return (
      <div className="space-y-4 text-xs">
        <span className="text-[11px] text-slate-400 block mb-1">
          Idle appliances consuming power on standby:
        </span>
        <div className="space-y-2">
          {entState && (
            <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-slate-900/40 p-3 border border-slate-100 dark:border-slate-800/40">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                  <Tv className="h-3.5 w-3.5 text-brand-500" /> Home Entertainment Setup
                </span>
                <span className="text-[10px] text-slate-400">Standby Draw: {isEntOn ? `${entPower.toFixed(2)} kW` : '0.00 kW (Off)'}</span>
              </div>
              <button
                onClick={() => handleApplianceToggle(entState.id, isEntOn)}
                className={`rounded-lg px-2.5 py-1.5 font-bold transition-all text-[11px] active:scale-95 ${
                  isEntOn 
                    ? 'bg-rose-500/10 text-rose-500 hover:bg-rose-500/20' 
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
                }`}
              >
                {isEntOn ? 'Kill Standby' : 'Turn On'}
              </button>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <button
            onClick={async () => {
              if (entState && isEntOn) {
                await fetch(`http://localhost:8000/api/v1/energy/appliances/${entState.id}/toggle`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                  },
                  body: JSON.stringify({ status: false })
                });
              }
              await handleApply(r.id, r.status);
              fetchOptimizer();
            }}
            className={`rounded-lg px-3.5 py-1.5 font-bold transition-all text-xs active:scale-95 ${
              r.status === 'applied'
                ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-350 hover:bg-slate-300 dark:hover:bg-slate-700'
                : 'bg-brand-600 text-white hover:bg-brand-500'
            }`}
          >
            {r.status === 'applied' ? 'Applied Standby Save' : 'Optimize All Standby'}
          </button>
        </div>
      </div>
    );
  };

  const renderThermostatControl = (r: Recommendation) => {
    const acState = applianceStates["Air Conditioner"];
    const isACOn = acState?.status ?? false;
    const acPower = acState?.power ?? 0;
    const [temp, setTemp] = useState(21.0);

    return (
      <div className="space-y-4 text-xs">
        <div className="flex justify-between items-center">
          <span>Air Conditioner Status:</span>
          <span className={`font-bold flex items-center gap-1.5 ${isACOn ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${isACOn ? 'bg-blue-500 animate-pulse' : 'bg-slate-450'}`} />
            {isACOn ? `Active (${acPower.toFixed(2)} kW)` : 'Inactive / Off'}
          </span>
        </div>

        {isACOn && (
          <div className="space-y-3 p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800/40 rounded-xl">
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-slate-400">Current Temperature Setpoint:</span>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setTemp(t => Math.max(16.0, t - 0.5))}
                  className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-sm"
                >
                  -
                </button>
                <span className="font-extrabold text-slate-800 dark:text-white text-sm">{temp.toFixed(1)}°C</span>
                <button 
                  onClick={() => setTemp(t => Math.min(30.0, t + 0.5))}
                  className="w-6 h-6 rounded bg-slate-200 dark:bg-slate-800 font-bold flex items-center justify-center hover:scale-105 active:scale-95 transition-all text-sm"
                >
                  +
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={async () => {
                  setTemp(23.5);
                  await handleApply(r.id, r.status);
                  fetchOptimizer();
                }}
                className={`rounded-lg px-3 py-1.5 font-bold transition-all text-xs active:scale-95 ${
                  r.status === 'applied'
                    ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-350 hover:bg-slate-300 dark:hover:bg-slate-700'
                    : 'bg-brand-600 text-white hover:bg-brand-500 shadow-sm'
                }`}
              >
                {r.status === 'applied' ? 'Eco Setpoint Active' : 'Optimize Setpoint (23.5°C)'}
              </button>
            </div>
          </div>
        )}
      </div>
    );
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
      {/* Toast Notification Banner */}
      <AnimatePresence>
        {notification && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 rounded-2xl p-4 shadow-xl text-xs font-bold text-white border flex items-center gap-3 backdrop-blur-md ${
              notification.type === 'success' 
                ? 'bg-emerald-500/90 border-emerald-500/25 shadow-emerald-500/10' 
                : 'bg-blue-500/90 border-blue-500/25 shadow-blue-500/10'
            }`}
          >
            <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
            <span>{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Overview Summaries */}
      <div className="grid gap-6 sm:grid-cols-3">
        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Tariff Optimization Savings</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">${savings.toFixed(2)}</span>
            <div className="rounded-xl bg-emerald-500/10 p-2 text-emerald-500 border border-emerald-500/20">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <span className="mt-2 block text-xs text-slate-400">Potential monthly billing savings</span>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Optimization Actions</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">
              {recs.filter(r => r.status === 'applied').length} / {recs.length}
            </span>
            <span className="text-xs text-slate-500 font-semibold uppercase">Applied</span>
          </div>
          <span className="mt-2 block text-xs text-slate-400">Auto-scheduling and load shifts</span>
        </div>

        <div className="glass-panel rounded-2xl p-6">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Billing Cycle Progress</span>
          <div className="mt-4">
            <span className="text-2xl font-bold tracking-tight text-slate-800 dark:text-white md:text-3xl">{progress}%</span>
            <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommendations list */}
        <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Load-Shifting Recommendations</h2>
              <p className="text-xs text-slate-400 mt-1">Interactive cards to optimize household loads dynamically</p>
            </div>
            <button 
              onClick={fetchOptimizer}
              className="rounded-xl border border-slate-200/80 p-2.5 text-slate-600 hover:bg-slate-50 dark:border-slate-800/80 dark:bg-darkbg-card dark:text-slate-400 dark:hover:bg-slate-800 transition-all duration-200 active:scale-95"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-6">
            <AnimatePresence mode="popLayout">
              {recs.map((r) => {
                const isApplied = r.status === 'applied';
                return (
                  <motion.div 
                    layout
                    key={r.id} 
                    className={`rounded-2xl border p-5 transition-all duration-300 shadow-sm ${
                      isApplied 
                        ? 'border-emerald-500/25 bg-emerald-500/5 dark:bg-emerald-950/10' 
                        : 'border-slate-200/70 bg-white dark:border-slate-800/60 dark:bg-slate-900/10'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-xl p-2.5 ${
                          isApplied ? 'bg-emerald-500/15 text-emerald-500' : 'bg-brand-500/10 text-brand-500'
                        }`}>
                          {isApplied ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{r.title}</h3>
                          <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">{r.recommendation_text}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="block text-sm font-bold text-slate-800 dark:text-white">+${r.potential_saving.toFixed(2)}</span>
                        <span className="block text-[10px] text-slate-400 font-semibold uppercase mt-0.5">Est. saving</span>
                      </div>
                    </div>

                    {/* Interactive Body Controls */}
                    <div className="mt-4 border-t border-slate-100 dark:border-slate-800/40 pt-4">
                      {r.actionable_type === 'shift_load' && renderShiftLoadControl(r)}
                      {r.actionable_type === 'battery' && renderBatteryControl(r)}
                      {r.actionable_type === 'standby' && renderStandbyControl(r)}
                      {r.actionable_type === 'thermostat' && renderThermostatControl(r)}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Time-of-use rates tariff card */}
        <div className="glass-panel rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-bold text-slate-800 dark:text-white text-lg">Time-of-Use (TOU) Rates</h2>
            <p className="text-xs text-slate-400 mt-1">Current active grid electricity rate brackets</p>

            <div className="mt-6 space-y-4">
              {tariffs.map((t, index) => (
                <div key={index} className="flex items-center justify-between rounded-xl bg-slate-100 dark:bg-slate-900/40 p-4 border border-slate-200/50 dark:border-slate-850/50">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                    <div>
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{t.type}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">{t.time}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-bold text-slate-800 dark:text-white">${t.rate.toFixed(2)}</span>
                    <span className="block text-[9px] text-slate-400">/ kWh</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-xl bg-brand-500/5 border border-brand-500/15 p-4 text-xs text-brand-500 leading-relaxed font-medium">
            ⏰ Grid Peak rates run during the evening dinner slot. We recommend scheduling heavy washers and dryers to start post-9:00 PM.
          </div>
        </div>
      </div>

      {/* Recommended Schedule Timeline Section */}
      <div className="glass-panel rounded-2xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Recommended Appliance Schedule</h2>
            <p className="text-xs text-slate-400 mt-1">Timing cards optimized dynamically via weather and load forecasters</p>
          </div>
          <div className="rounded-2xl bg-slate-100 p-2 dark:bg-slate-800 border border-slate-250/20">
            <Clock className="h-4 w-4 text-slate-600 dark:text-slate-350" />
          </div>
        </div>

        {/* Schedule grid items */}
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {schedule.map((item, index) => (
            <div key={index} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md dark:border-slate-800 dark:bg-slate-950 flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-355 flex-shrink-0 border border-slate-200/50 dark:border-slate-800/50">
                  {(() => {
                    switch (item.icon) {
                      case 'BatteryCharging': return <BatteryCharging className="h-5 w-5 text-emerald-500" />;
                      case 'Car': return <Car className="h-5 w-5 text-brand-500" />;
                      case 'Thermometer': return <Thermometer className="h-5 w-5 text-blue-500" />;
                      case 'WashingMachine': return <Zap className="h-5 w-5 text-amber-500" />;
                      default: return <Sliders className="h-5 w-5 text-indigo-500" />;
                    }
                  })()}
                </span>
                <div>
                  <p className="text-sm font-bold text-slate-900 dark:text-white">{item.appliance}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{item.reason}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-900/60">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Suggested Slot</span>
                <span className="rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-[10px] font-bold text-brand-500 tracking-wide">
                  {item.recommended_time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Timeline Panel */}
        <div className="mt-8 border-t border-slate-250/20 dark:border-slate-800/60 pt-6">
          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Sliders className="h-4 w-4 text-brand-500" /> Optimized Daily Schedule Timeline
          </h3>
          <div className="space-y-4">
            {/* Tariff regions indicator */}
            <div className="relative h-6 rounded-lg bg-slate-100 dark:bg-slate-900/60 border border-slate-200/40 dark:border-slate-800/40 flex overflow-hidden text-[9px] font-bold text-white select-none">
              <div className="flex-1 bg-emerald-500/20 text-emerald-500 flex items-center justify-center" style={{ flexGrow: 6 }}>Off-Peak</div>
              <div className="flex-1 bg-amber-500/20 text-amber-500 flex items-center justify-center" style={{ flexGrow: 10 }}>Mid-Peak</div>
              <div className="flex-1 bg-rose-500/20 text-rose-500 flex items-center justify-center" style={{ flexGrow: 5 }}>On-Peak</div>
              <div className="flex-1 bg-emerald-500/20 text-emerald-500 flex items-center justify-center" style={{ flexGrow: 3 }}>Off-Peak</div>
            </div>
            
            {/* Hourly ticks */}
            <div className="flex justify-between text-[9px] text-slate-450 dark:text-slate-500 px-1 font-mono">
              <span>12 AM</span>
              <span>4 AM</span>
              <span>8 AM</span>
              <span>12 PM</span>
              <span>4 PM</span>
              <span>8 PM</span>
              <span>12 AM</span>
            </div>

            {/* Items horizontal progress bars */}
            <div className="space-y-3.5 pt-2">
              {schedule.map((item, index) => {
                // Determine width and offset positions based on recommended_time string parsing
                let startHour = 0;
                let endHour = 24;
                const timeStr = item.recommended_time.toLowerCase();
                
                if (timeStr.includes("02:00 am") && timeStr.includes("06:00 am")) {
                  startHour = 2; endHour = 6;
                } else if (timeStr.includes("11:00 am") && timeStr.includes("02:00 pm")) {
                  startHour = 11; endHour = 14;
                } else if (timeStr.includes("09:00 pm") && timeStr.includes("12:00 am")) {
                  startHour = 21; endHour = 24;
                } else if (timeStr.includes("10:00 am") && timeStr.includes("03:00 pm")) {
                  startHour = 10; endHour = 15;
                } else if (timeStr.includes("02:00 pm") && timeStr.includes("04:00 pm")) {
                  startHour = 14; endHour = 16;
                }

                const startPct = (startHour / 24) * 100;
                const durationPct = ((endHour - startHour) / 24) * 100;

                return (
                  <div key={index} className="flex items-center gap-4">
                    {/* Name of appliance */}
                    <div className="w-28 text-[11px] font-bold text-slate-600 dark:text-slate-400 truncate">
                      {item.appliance}
                    </div>
                    {/* Bar row */}
                    <div className="flex-1 relative h-6 rounded-lg bg-slate-100/50 dark:bg-slate-900/20 border border-slate-200/50 dark:border-slate-800/40">
                      <div 
                        className="absolute h-full top-0 rounded-lg bg-gradient-to-r from-brand-500 to-indigo-500 border border-brand-500/20 shadow flex items-center justify-center text-[8px] font-extrabold text-white text-center cursor-pointer select-none transition-all hover:scale-[1.01] hover:brightness-110"
                        style={{ left: `${startPct}%`, width: `${durationPct}%` }}
                        title={`${item.appliance}: ${item.recommended_time}`}
                      >
                        Run Slot
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
