import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  DollarSign, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Battery as BatteryIcon, 
  BatteryCharging, 
  Clock, 
  Zap, 
  Tv, 
  Thermometer, 
  Car, 
  Sliders,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CardSkeleton, ListSkeleton } from '../components/LoadingSkeleton';

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

// --------------------------------------------------------
// SUB-COMPONENT: LIQUID BATTERY WIDGET
// --------------------------------------------------------
interface LiquidBatteryProps {
  soc: number;
  charging: boolean;
  rate: number;
}

const LiquidBattery: React.FC<LiquidBatteryProps> = ({ soc, charging, rate }) => {
  return (
    <div className="relative w-32 h-52 mx-auto flex flex-col justify-end items-center border-4 border-slate-800 rounded-[28px] p-1.5 bg-slate-950/60 shadow-inner select-none">
      {/* Battery Tip */}
      <div className="absolute -top-3.5 w-10 h-3 bg-slate-800 rounded-t-lg" />
      
      {/* Waves Level box */}
      <div 
        className={`w-full rounded-[20px] wave-battery transition-all duration-1000 relative overflow-hidden flex items-center justify-center ${
          charging 
            ? 'bg-gradient-to-t from-emerald-600/90 to-teal-400/90 shadow-[0_0_20px_rgba(16,185,129,0.3)]' 
            : 'bg-gradient-to-t from-brand-600/90 to-cyan-400/90 shadow-[0_0_20px_rgba(14,160,234,0.3)]'
        }`}
        style={{ height: `${Math.max(12, soc)}%` }}
      >
        {/* Floating Percentage Indicator */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20">
          <span className="text-3xl font-black tracking-tight">{soc.toFixed(0)}%</span>
          <span className="text-[9px] font-extrabold uppercase tracking-widest opacity-80 mt-0.5">
            {charging ? `+${rate.toFixed(1)} kW` : 'Stored'}
          </span>
        </div>
      </div>
    </div>
  );
};

// --------------------------------------------------------
// SUB-COMPONENT: THERMOSTAT ECO CONTROL
// --------------------------------------------------------
interface ThermostatControlProps {
  r: Recommendation;
  acState: ApplianceState | undefined;
  token: string | null;
  handleApply: (id: number, currentStatus: string) => Promise<void>;
  fetchOptimizer: () => Promise<void>;
}

const ThermostatControl: React.FC<ThermostatControlProps> = ({
  r,
  acState,
  token,
  handleApply,
  fetchOptimizer
}) => {
  const isACOn = acState?.status ?? false;
  const acPower = acState?.power ?? 0;
  const [temp, setTemp] = useState(21.0);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex justify-between items-center text-slate-400">
        <span>Air Conditioner Status:</span>
        <span className={`font-bold flex items-center gap-1.5 ${isACOn ? 'text-blue-455' : 'text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${isACOn ? 'bg-blue-400 animate-pulse' : 'bg-slate-650'}`} />
          {isACOn ? `Active (${acPower.toFixed(2)} kW)` : 'Inactive / Off'}
        </span>
      </div>

      {isACOn && (
        <div className="space-y-3 p-3.5 bg-white/5 border border-white/5 rounded-2xl">
          <div className="flex justify-between items-center">
            <span className="text-[11px] text-slate-400">Current Temperature Setpoint:</span>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setTemp(t => Math.max(16.0, t - 0.5))}
                className="w-7 h-7 rounded-lg bg-white/5 font-extrabold flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all text-sm text-white"
              >
                -
              </button>
              <span className="font-black text-white text-sm w-12 text-center">{temp.toFixed(1)}°C</span>
              <button 
                onClick={() => setTemp(t => Math.min(30.0, t + 0.5))}
                className="w-7 h-7 rounded-lg bg-white/5 font-extrabold flex items-center justify-center hover:bg-white/10 active:scale-90 transition-all text-sm text-white"
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
              className={`rounded-lg px-3.5 py-1.5 font-bold transition-all text-xs active:scale-95 ${
                r.status === 'applied'
                  ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                  : 'bg-brand-650 text-white hover:bg-brand-550 border border-brand-550/20'
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

// --------------------------------------------------------
// MAIN OPTIMIZER COMPONENT
// --------------------------------------------------------
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
        <div className="flex items-center justify-between text-slate-450">
          <span>Washing Machine Status:</span>
          <span className={`font-bold flex items-center gap-1.5 ${isWMRunning ? 'text-amber-400' : 'text-slate-500'}`}>
            <span className={`h-2 w-2 rounded-full ${isWMRunning ? 'bg-amber-400 animate-ping' : 'bg-slate-650'}`} />
            {isWMRunning ? `Running (${wmPower.toFixed(2)} kW)` : 'Idle / Ready'}
          </span>
        </div>
        
        {isWMRunning ? (
          <div className="flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-[11px] text-slate-400 leading-normal">
              Shift this run to nighttime off-peak hours (9 PM - 6 AM) or midday solar surplus (11 AM - 2 PM) to save billing charges.
            </span>
            <button
              onClick={() => handleApplianceToggle(wmState.id, true, r)}
              className="whitespace-nowrap rounded-lg bg-amber-500 text-white font-bold px-3.5 py-2 hover:bg-amber-600 transition-all text-xs active:scale-95 shadow-sm shadow-amber-500/10"
            >
              Postpone & Shift Now
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
            <span className="text-[11px] text-slate-450">Automatic off-peak schedule configuration rules.</span>
            <button
              onClick={() => handleApply(r.id, r.status)}
              className={`rounded-lg px-3.5 py-2 font-bold text-xs transition-all active:scale-95 ${
                r.status === 'applied' 
                  ? 'bg-white/10 text-slate-300 hover:bg-white/20' 
                  : 'bg-brand-650 text-white hover:bg-brand-550 border border-brand-550/20'
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
        {/* Custom liquid battery widget */}
        <div className="grid gap-6 md:grid-cols-2 items-center">
          <LiquidBattery
            soc={batterySoc}
            charging={batteryChargingActive}
            rate={batteryChargeRate}
          />
          
          <div className="space-y-4">
            {/* Target SOC slider */}
            <div className="space-y-2">
              <div className="flex justify-between font-bold text-slate-400">
                <span>Charge Target limit</span>
                <span className="font-extrabold text-brand-400">{batteryTargetSoc}%</span>
              </div>
              <input 
                type="range"
                min="60"
                max="100"
                value={batteryTargetSoc}
                disabled={batteryChargingActive}
                onChange={(e) => setBatteryTargetSoc(parseInt(e.target.value))}
                className="w-full h-1.5 rounded-lg appearance-none cursor-pointer bg-white/10 accent-brand-500 disabled:opacity-50"
              />
            </div>

            {/* Charge actions */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider flex items-center gap-1.5">
                {batteryChargingActive ? (
                  <>
                    <span className="h-2 w-2 rounded-full bg-emerald-450 animate-ping" />
                    <span>⚡ Charge Active</span>
                  </>
                ) : (
                  <>
                    <span className="h-2 w-2 rounded-full bg-slate-600" />
                    <span>🔋 Peak Shaving Ready</span>
                  </>
                )}
              </span>
              <button
                onClick={() => handleBatteryChargeToggle(!batteryChargingActive)}
                className={`rounded-lg px-4 py-2 font-black transition-all text-xs active:scale-95 ${
                  batteryChargingActive 
                    ? 'bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/10' 
                    : 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/10'
                }`}
              >
                {batteryChargingActive ? 'Stop Charge' : 'Pre-Charge Now'}
              </button>
            </div>
          </div>
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
        <span className="text-[11px] text-slate-450 block mb-1">
          Idle appliances consuming power on standby:
        </span>
        <div className="space-y-2">
          {entState && (
            <div className="flex items-center justify-between rounded-2xl bg-white/5 p-3.5 border border-white/5">
              <div className="flex flex-col gap-0.5">
                <span className="font-bold text-white flex items-center gap-2">
                  <Tv className="h-4 w-4 text-brand-400" /> Home Entertainment Setup
                </span>
                <span className="text-[10px] text-slate-400">Standby Draw: {isEntOn ? `${entPower.toFixed(2)} kW` : '0.00 kW (Off)'}</span>
              </div>
              <button
                onClick={() => handleApplianceToggle(entState.id, isEntOn)}
                className={`rounded-lg px-3 py-1.5 font-bold transition-all text-[11px] active:scale-95 ${
                  isEntOn 
                    ? 'bg-rose-500/15 text-rose-455 hover:bg-rose-500/25 border border-rose-500/20' 
                    : 'bg-white/5 text-slate-350 hover:bg-white/10'
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
            className={`rounded-lg px-4 py-2 font-bold transition-all text-xs active:scale-95 ${
              r.status === 'applied'
                ? 'bg-white/10 text-slate-300 hover:bg-white/20'
                : 'bg-brand-650 text-white hover:bg-brand-550 border border-brand-550/20'
            }`}
          >
            {r.status === 'applied' ? 'Applied Standby Save' : 'Optimize All Standby'}
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="grid gap-6 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2"><ListSkeleton /></div>
          <div><ListSkeleton /></div>
        </div>
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
        <div className="glass-panel glow-emerald rounded-3xl p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Tariff Optimizations</span>
          <div className="mt-4 flex items-center justify-between">
            <span className="text-2xl font-black tracking-tight text-white md:text-3xl">${savings.toFixed(2)}</span>
            <div className="rounded-2xl bg-emerald-500/10 p-2.5 text-emerald-450 border border-emerald-500/20">
              <DollarSign className="h-5 w-5" />
            </div>
          </div>
          <span className="mt-2 block text-xs text-slate-400">Potential monthly savings</span>
        </div>

        <div className="glass-panel glow-brand rounded-3xl p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Actions Configured</span>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-black tracking-tight text-white md:text-3xl">
              {recs.filter(r => r.status === 'applied').length} / {recs.length}
            </span>
            <span className="text-xs text-slate-400 font-semibold uppercase">Applied</span>
          </div>
          <span className="mt-2 block text-xs text-slate-400">Auto-schedules active</span>
        </div>

        <div className="glass-panel rounded-3xl p-6">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Billing Cycle</span>
          <div className="mt-4">
            <span className="text-2xl font-black tracking-tight text-white md:text-3xl">{progress}%</span>
            <div className="mt-2.5 h-1.5 w-full rounded-full bg-white/10">
              <div className="h-full rounded-full bg-brand-500" style={{ width: `${progress}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Grid container */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recommendations list */}
        <div className="glass-panel rounded-3xl p-6 lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-extrabold text-white text-lg">Load-Shifting Analytics</h2>
              <p className="text-xs text-slate-400 mt-0.5">Interactive optimization recommendations</p>
            </div>
            <button 
              onClick={fetchOptimizer}
              className="rounded-xl border border-white/5 p-2.5 text-slate-400 hover:bg-white/5 transition-all duration-200 active:scale-95"
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
                        ? 'border-emerald-500/20 bg-emerald-500/5' 
                        : 'border-white/5 bg-white/5'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 rounded-xl p-2.5 ${
                          isApplied ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-500/10 text-brand-400'
                        }`}>
                          {isApplied ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : (
                            <AlertCircle className="h-5 w-5" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-white text-sm">{r.title}</h3>
                          <p className="mt-1.5 text-xs text-slate-450 leading-relaxed">{r.recommendation_text}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <span className="block text-sm font-bold text-white">+${r.potential_saving.toFixed(2)}</span>
                        <span className="block text-[9px] text-slate-450 font-bold uppercase mt-0.5">Save / mo</span>
                      </div>
                    </div>

                    {/* Interactive Controls */}
                    <div className="mt-4 border-t border-white/5 pt-4">
                      {r.actionable_type === 'shift_load' && renderShiftLoadControl(r)}
                      {r.actionable_type === 'battery' && renderBatteryControl(r)}
                      {r.actionable_type === 'standby' && renderStandbyControl(r)}
                      {r.actionable_type === 'thermostat' && (
                        <ThermostatControl
                          r={r}
                          acState={applianceStates["Air Conditioner"]}
                          token={token}
                          handleApply={handleApply}
                          fetchOptimizer={fetchOptimizer}
                        />
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

        {/* Time-of-use rates tariff card */}
        <div className="glass-panel rounded-3xl p-6 flex flex-col justify-between">
          <div>
            <h3 className="font-extrabold text-white text-base">Time-of-Use (TOU) Rates</h3>
            <p className="text-xs text-slate-400 mt-0.5">Electricity grid rate brackets</p>

            <div className="mt-6 space-y-4">
              {tariffs.map((t, index) => (
                <div key={index} className="flex items-center justify-between rounded-2xl bg-white/5 p-4 border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full animate-pulse" style={{ backgroundColor: t.color }} />
                    <div>
                      <span className="block text-xs font-bold text-white">{t.type}</span>
                      <span className="block text-[9px] text-slate-450 mt-0.5">{t.time}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-black text-white">${t.rate.toFixed(2)}</span>
                    <span className="block text-[9px] text-slate-400">/ kWh</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-brand-500/5 border border-brand-500/15 p-4 text-xs text-brand-400 leading-relaxed font-semibold">
            ⏰ Peak rate tiers run in the evening. Run heavy appliance washers or heat pumps post-9:00 PM to save bill charges.
          </div>
        </div>
      </div>

      {/* Recommended Schedule Timeline Section */}
      <div className="glass-panel rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-white text-base">Recommended Appliance Scheduling</h3>
            <p className="text-xs text-slate-400 mt-0.5">Optimized slot sequences created by ML forecasters</p>
          </div>
          <div className="rounded-2xl bg-white/5 p-2 text-slate-400 border border-white/5">
            <Clock className="h-4.5 w-4.5" />
          </div>
        </div>

        {/* Schedule grid items */}
        <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {schedule.map((item, index) => (
            <div key={index} className="group rounded-2xl border border-white/5 bg-slate-950/40 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-500/20 flex flex-col justify-between">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/5 border border-white/5 flex-shrink-0">
                  {(() => {
                    switch (item.icon) {
                      case 'BatteryCharging': return <BatteryCharging className="h-5 w-5 text-emerald-400" />;
                      case 'Car': return <Car className="h-5 w-5 text-brand-400" />;
                      case 'Thermometer': return <Thermometer className="h-5 w-5 text-blue-400" />;
                      default: return <Zap className="h-5 w-5 text-amber-400" />;
                    }
                  })()}
                </span>
                <div>
                  <p className="text-sm font-bold text-white">{item.appliance}</p>
                  <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">{item.reason}</p>
                </div>
              </div>
              
              <div className="mt-4 flex items-center justify-between pt-3 border-t border-white/5">
                <span className="text-[9px] text-slate-450 font-bold uppercase tracking-wider">Suggested Slot</span>
                <span className="rounded-full bg-brand-500/10 border border-brand-500/20 px-3 py-1 text-[10px] font-bold text-brand-400 tracking-wide">
                  {item.recommended_time}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Visual Timeline Panel */}
        <div className="mt-8 border-t border-white/5 pt-6">
          <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
            <Sliders className="h-4.5 w-4.5 text-brand-400" /> Optimized Daily Schedule Timeline
          </h3>
          <div className="space-y-4">
            {/* Tariff regions indicator */}
            <div className="relative h-6 rounded-lg bg-slate-900/60 border border-white/5 flex overflow-hidden text-[9px] font-bold text-white select-none">
              <div className="flex-grow bg-emerald-500/10 border-r border-white/5 text-emerald-450 flex items-center justify-center" style={{ flexBasis: '25%' }}>Off-Peak</div>
              <div className="flex-grow bg-amber-500/10 border-r border-white/5 text-amber-450 flex items-center justify-center" style={{ flexBasis: '41%' }}>Mid-Peak</div>
              <div className="flex-grow bg-rose-500/10 border-r border-white/5 text-rose-450 flex items-center justify-center" style={{ flexBasis: '21%' }}>On-Peak</div>
              <div className="flex-grow bg-emerald-500/10 text-emerald-455 flex items-center justify-center" style={{ flexBasis: '13%' }}>Off-Peak</div>
            </div>
            
            {/* Hourly ticks */}
            <div className="flex justify-between text-[9px] text-slate-500 px-1 font-mono">
              <span>12 AM</span>
              <span>4 AM</span>
              <span>8 AM</span>
              <span>12 PM</span>
              <span>4 PM</span>
              <span>8 PM</span>
              <span>12 AM</span>
            </div>

            {/* Items horizontal progress bars */}
            <div className="space-y-3 pt-2">
              {schedule.map((item, index) => {
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
                    <div className="w-28 text-[11px] font-bold text-slate-400 truncate">
                      {item.appliance}
                    </div>
                    <div className="flex-1 relative h-6 rounded-lg bg-white/5 border border-white/5">
                      <div 
                        className="absolute h-full top-0 rounded-lg bg-gradient-to-r from-brand-600 to-indigo-650 border border-brand-500/20 shadow flex items-center justify-center text-[8px] font-extrabold text-white text-center cursor-pointer select-none transition-all hover:scale-[1.01] hover:brightness-110"
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
