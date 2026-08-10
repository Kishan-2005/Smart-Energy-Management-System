import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  BarChart3, 
  Download, 
  Calendar, 
  RefreshCw, 
  Clock, 
  Cpu, 
  TrendingUp, 
  Percent, 
  TrendingDown
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

interface ReportRow {
  date_label: string;
  avg_active_power: number;
  avg_voltage: number;
  avg_current: number;
  avg_frequency: number;
  max_energy_kwh: number;
  net_consumption_kwh: number;
}

interface Appliance {
  id: number;
  appliance_name: string;
  power_consumed: number;
  status: boolean;
  efficiency_grade: string;
}

export const Reports: React.FC = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly' | 'breakdown'>('daily');
  
  const [dailyLogs, setDailyLogs] = useState<ReportRow[]>([]);
  const [weeklyLogs, setWeeklyLogs] = useState<ReportRow[]>([]);
  const [monthlyLogs, setMonthlyLogs] = useState<ReportRow[]>([]);
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [forecastData, setForecastData] = useState<any>(null);
  
  const [totals, setTotals] = useState<any>(null);
  const [forecastAccuracy, setForecastAccuracy] = useState(94.8);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<string | null>(null);

  const fetchAllReports = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resDaily, resWeekly, resMonthly, resApps, resForecast, resReports] = await Promise.all([
        fetch('http://localhost:8000/api/v1/energy/daily', { headers }),
        fetch('http://localhost:8000/api/v1/energy/weekly', { headers }),
        fetch('http://localhost:8000/api/v1/energy/monthly', { headers }),
        fetch('http://localhost:8000/api/v1/energy/appliances', { headers }),
        fetch('http://localhost:8000/api/v1/energy/forecast', { headers }),
        fetch('http://localhost:8000/api/v1/energy/reports', { headers })
      ]);

      if (resDaily.ok) setDailyLogs(await resDaily.json());
      if (resWeekly.ok) setWeeklyLogs(await resWeekly.json());
      if (resMonthly.ok) setMonthlyLogs(await resMonthly.json());
      if (resApps.ok) setAppliances(await resApps.json());
      if (resReports.ok) {
        const rData = await resReports.json();
        setTotals(rData.monthly_totals);
      }
      if (resForecast.ok) {
        const fData = await resForecast.json();
        setForecastData(fData);
        // Calculate dynamic forecast accuracy MAPE
        if (fData.historical_12h && fData.historical_12h.length > 0) {
          let errorSum = 0;
          let count = 0;
          for (const item of fData.historical_12h) {
            if (item.actual_kwh > 0) {
              errorSum += Math.abs(item.actual_kwh - item.predicted_kwh) / item.actual_kwh;
              count++;
            }
          }
          if (count > 0) {
            const mape = errorSum / count;
            const accuracy = Math.max(50.0, Math.min(100.0, (1 - mape) * 100));
            setForecastAccuracy(accuracy);
          }
        }
      }
    } catch (err) {
      console.error("Reports loading error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, [token]);

  // CSV Exporter
  const handleExportCSV = () => {
    setDownloading('CSV');
    setTimeout(() => {
      let dataToExport: any[] = [];
      let headers: string[] = [];
      let filename = `energy_report_${activeTab}.csv`;

      if (activeTab === 'daily') {
        dataToExport = dailyLogs;
        headers = ['date_label', 'avg_active_power', 'avg_voltage', 'avg_current', 'avg_frequency', 'net_consumption_kwh'];
      } else if (activeTab === 'weekly') {
        dataToExport = weeklyLogs;
        headers = ['date_label', 'avg_active_power', 'avg_voltage', 'avg_current', 'avg_frequency', 'net_consumption_kwh'];
      } else if (activeTab === 'monthly') {
        dataToExport = monthlyLogs;
        headers = ['date_label', 'avg_active_power', 'avg_voltage', 'avg_current', 'avg_frequency', 'net_consumption_kwh'];
      } else if (activeTab === 'breakdown') {
        dataToExport = appliances;
        headers = ['appliance_name', 'power_consumed', 'status', 'efficiency_grade'];
        filename = 'appliance_load_breakdown.csv';
      }

      if (dataToExport.length === 0) {
        alert("No data available to export");
        setDownloading(null);
        return;
      }

      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(field => {
            let val = (row as any)[field];
            if (val === undefined || val === null) val = '';
            return `"${('' + val).replace(/"/g, '""')}"`;
          }).join(',')
        )
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloading(null);
    }, 1000);
  };

  // PDF Exporter
  const handleExportPDF = () => {
    setDownloading('PDF');
    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        alert('Pop-up blocked! Please allow pop-ups to export reports as PDF.');
        setDownloading(null);
        return;
      }

      let tableHeaders = '';
      let tableRows = '';
      let reportTitle = '';

      if (activeTab === 'daily') {
        reportTitle = 'Daily Smart Telemetry Report';
        tableHeaders = '<th>Period / Date</th><th>Avg Active Power (kW)</th><th>Avg Voltage (V)</th><th>Avg Current (A)</th><th>Avg Frequency (Hz)</th><th>Net Consumed (kWh)</th>';
        tableRows = dailyLogs.map(row => `
          <tr>
            <td>${row.date_label}</td>
            <td>${row.avg_active_power.toFixed(3)} kW</td>
            <td>${row.avg_voltage.toFixed(1)} V</td>
            <td>${row.avg_current.toFixed(2)} A</td>
            <td>${row.avg_frequency.toFixed(2)} Hz</td>
            <td class="bold">${row.net_consumption_kwh.toFixed(2)} kWh</td>
          </tr>
        `).join('');
      } else if (activeTab === 'weekly') {
        reportTitle = 'Weekly Aggregated Energy Report';
        tableHeaders = '<th>Period / Week</th><th>Avg Active Power (kW)</th><th>Avg Voltage (V)</th><th>Avg Current (A)</th><th>Avg Frequency (Hz)</th><th>Net Consumed (kWh)</th>';
        tableRows = weeklyLogs.map(row => `
          <tr>
            <td>${row.date_label}</td>
            <td>${row.avg_active_power.toFixed(3)} kW</td>
            <td>${row.avg_voltage.toFixed(1)} V</td>
            <td>${row.avg_current.toFixed(2)} A</td>
            <td>${row.avg_frequency.toFixed(2)} Hz</td>
            <td class="bold">${row.net_consumption_kwh.toFixed(2)} kWh</td>
          </tr>
        `).join('');
      } else if (activeTab === 'monthly') {
        reportTitle = 'Monthly Aggregated Energy Report';
        tableHeaders = '<th>Period / Month</th><th>Avg Active Power (kW)</th><th>Avg Voltage (V)</th><th>Avg Current (A)</th><th>Avg Frequency (Hz)</th><th>Net Consumed (kWh)</th>';
        tableRows = monthlyLogs.map(row => `
          <tr>
            <td>${row.date_label}</td>
            <td>${row.avg_active_power.toFixed(3)} kW</td>
            <td>${row.avg_voltage.toFixed(1)} V</td>
            <td>${row.avg_current.toFixed(2)} A</td>
            <td>${row.avg_frequency.toFixed(2)} Hz</td>
            <td class="bold">${row.net_consumption_kwh.toFixed(2)} kWh</td>
          </tr>
        `).join('');
      } else if (activeTab === 'breakdown') {
        reportTitle = 'Appliance Disaggregation & Load Breakdown Report';
        tableHeaders = '<th>Appliance Name</th><th>Allocated Real load (kW)</th><th>Smart Switch status</th><th>Efficiency Grade</th>';
        tableRows = appliances.map(app => `
          <tr>
            <td class="bold">${app.appliance_name}</td>
            <td>${app.power_consumed.toFixed(2)} kW</td>
            <td><span class="badge ${app.status ? 'active' : 'inactive'}">${app.status ? 'ON' : 'OFF'}</span></td>
            <td class="bold">Grade ${app.efficiency_grade}</td>
          </tr>
        `).join('');
      }

      const printContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Executive Energy Report - AuraEnergy</title>
          <style>
            body { font-family: 'Segoe UI', system-ui, sans-serif; color: #1e293b; margin: 0; padding: 40px; background: #ffffff; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 30px; }
            .logo { font-size: 20px; font-weight: 800; color: #0f172a; text-decoration: none; }
            .logo span { color: #2563eb; }
            .report-meta { text-align: right; font-size: 11px; color: #64748b; }
            h1 { font-size: 24px; font-weight: 800; color: #0f172a; margin-top: 0; margin-bottom: 5px; }
            .subtitle { font-size: 12px; color: #64748b; margin-bottom: 35px; }
            .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 35px; }
            .stat-card { border: 1px solid #e2e8f0; border-radius: 12px; padding: 15px 20px; background: #f8fafc; }
            .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; color: #64748b; }
            .stat-value { font-size: 18px; font-weight: 700; margin-top: 5px; color: #0f172a; }
            .stat-value.savings { color: #10b981; }
            .accuracy-panel { border: 1px solid #cbd5e1; border-radius: 12px; background: #f1f5f9; padding: 15px 20px; margin-bottom: 35px; display: flex; justify-content: space-between; align-items: center; }
            .accuracy-title { font-size: 13px; font-weight: 700; color: #1e293b; }
            .accuracy-desc { font-size: 11px; color: #64748b; margin-top: 3px; }
            .accuracy-value { font-size: 24px; font-weight: 800; color: #2563eb; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 30px; }
            th { background: #f1f5f9; border-bottom: 1.5px solid #cbd5e1; padding: 10px 12px; font-weight: 600; text-align: left; color: #475569; }
            td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; color: #334155; }
            tr:nth-child(even) { background: #f8fafc; }
            .bold { font-weight: 700; }
            .badge { display: inline-block; font-size: 9px; font-weight: 700; padding: 2px 6px; border-radius: 6px; }
            .badge.active { background: #d1fae5; color: #065f46; }
            .badge.inactive { background: #f3f4f6; color: #374151; }
            .footer { border-top: 1px solid #e2e8f0; padding-top: 15px; font-size: 10px; color: #94a3b8; text-align: center; margin-top: 50px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">AURA<span>ENERGY</span></div>
            <div class="report-meta">
              <div>EXECUTIVE REPORT</div>
              <div>Generated: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}</div>
            </div>
          </div>
          <h1>${reportTitle}</h1>
          <div class="subtitle">Intelligent Smart Energy Management System Aggregation Logs</div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Monthly Consumption</div>
              <div class="stat-value">${totals?.consumption_kwh ?? '0'} kWh</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Monthly Solar Generation</div>
              <div class="stat-value">${totals?.solar_generation_kwh ?? '0'} kWh</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net Cost</div>
              <div class="stat-value">$${totals?.net_cost?.toFixed(2) ?? '0.00'}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Net Savings</div>
              <div class="stat-value savings">$${totals?.savings?.toFixed(2) ?? '0.00'}</div>
            </div>
          </div>

          <div class="accuracy-panel">
            <div>
              <div class="accuracy-title">AI Load Forecaster Accuracy</div>
              <div class="accuracy-desc">MAPE disaggregation metrics benchmarked against historical baseline</div>
            </div>
            <div class="accuracy-value">${forecastAccuracy.toFixed(1)}%</div>
          </div>

          <table>
            <thead>
              <tr>${tableHeaders}</tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          <div class="footer">
            AuraEnergy Smart Grid disaggregation report. Confidential. Generated automatically.
          </div>
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.close();
              }, 500);
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(printContent);
      printWindow.document.close();
      setDownloading(null);
    }, 1200);
  };

  const getActiveData = () => {
    switch (activeTab) {
      case 'daily': return dailyLogs;
      case 'weekly': return weeklyLogs;
      case 'monthly': return monthlyLogs;
      default: return [];
    }
  };

  // Chart preparation
  const chartData = appliances
    .filter(app => app.status)
    .map(app => ({
      name: app.appliance_name,
      value: app.power_consumed
    }));

  const COLORS = ['#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#3b82f6', '#ef4444'];

  if (loading && dailyLogs.length === 0) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Exporter Controls Row */}
      <div className="glass-panel rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-slate-200/40 dark:border-slate-800/40 pb-4 lg:pb-0 lg:border-none">
          <button
            onClick={() => setActiveTab('daily')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'daily'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Daily Usage
          </button>
          <button
            onClick={() => setActiveTab('weekly')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'weekly'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Weekly Usage
          </button>
          <button
            onClick={() => setActiveTab('monthly')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'monthly'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Monthly Usage
          </button>
          <button
            onClick={() => setActiveTab('breakdown')}
            className={`rounded-xl px-4 py-2 text-xs font-bold transition-all ${
              activeTab === 'breakdown'
                ? 'bg-brand-500/10 text-brand-500'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Appliance & Accuracy Breakdown
          </button>
        </div>

        {/* Download Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchAllReports}
            className="rounded-xl border border-slate-200/80 dark:border-slate-800/80 p-2.5 text-slate-450 hover:bg-slate-850 dark:bg-slate-900/50 dark:hover:bg-slate-800 transition-all active:scale-95"
            title="Refresh logs"
          >
            <RefreshCw className="h-4 w-4" />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={!!downloading}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 dark:border-slate-800 dark:bg-darkbg-card dark:hover:bg-slate-800 px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-400 disabled:opacity-50 transition-all active:scale-95"
          >
            <Download className="h-4 w-4" />
            <span>{downloading === 'CSV' ? 'Exporting CSV...' : 'Export CSV'}</span>
          </button>

          <button
            onClick={handleExportPDF}
            disabled={!!downloading}
            className="flex items-center gap-1.5 rounded-xl bg-brand-600 hover:bg-brand-500 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-brand-500/15 disabled:opacity-50 transition-all active:scale-95"
          >
            <BarChart3 className="h-4 w-4" />
            <span>{downloading === 'PDF' ? 'Generating PDF...' : 'Export PDF'}</span>
          </button>
        </div>
      </div>

      {/* Aggregate Summaries (Cost Savings & Totals) */}
      <div className="grid gap-6 sm:grid-cols-4">
        <div className="glass-panel rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/50">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 text-brand-500" /> Billing Consumption
          </span>
          <span className="mt-2 block text-xl font-extrabold text-slate-800 dark:text-white">{totals?.consumption_kwh ?? '0'} kWh</span>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/50">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> Solar Generation
          </span>
          <span className="mt-2 block text-xl font-extrabold text-slate-800 dark:text-white">{totals?.solar_generation_kwh ?? '0'} kWh</span>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/50">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <TrendingDown className="h-3.5 w-3.5 text-rose-500" /> Net Cost
          </span>
          <span className="mt-2 block text-xl font-extrabold text-slate-800 dark:text-white">${totals?.net_cost?.toFixed(2) ?? '0.00'}</span>
        </div>

        <div className="glass-panel rounded-2xl p-5 border border-slate-200/50 dark:border-slate-800/50 bg-emerald-500/5 dark:bg-emerald-950/5">
          <span className="block text-[10px] font-bold uppercase tracking-wider text-emerald-500 flex items-center gap-1.5">
            <Percent className="h-3.5 w-3.5" /> Total Cost Savings
          </span>
          <span className="mt-2 block text-xl font-extrabold text-emerald-500">${totals?.savings?.toFixed(2) ?? '0.00'}</span>
        </div>
      </div>

      {/* Main Aggregation Logs Tabular Panel */}
      {activeTab !== 'breakdown' ? (
        <div className="glass-panel rounded-2xl overflow-hidden border border-slate-200/70 dark:border-slate-800/80">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs md:text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 dark:border-slate-850 dark:bg-slate-900/30 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="p-4 pl-6">Period Date</th>
                  <th className="p-4">Avg Active Power (kW)</th>
                  <th className="p-4">Avg Voltage (V)</th>
                  <th className="p-4">Avg Current (A)</th>
                  <th className="p-4">Avg Frequency (Hz)</th>
                  <th className="p-4 pr-6 text-right">Net Consumption (kWh)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850 text-slate-600 dark:text-slate-350">
                {getActiveData().map((row, index) => (
                  <tr key={index} className="hover:bg-slate-100/30 dark:hover:bg-slate-900/20 transition-all font-medium">
                    <td className="p-4 pl-6 font-bold text-slate-800 dark:text-slate-200">{row.date_label}</td>
                    <td className="p-4">{row.avg_active_power.toFixed(3)} kW</td>
                    <td className="p-4">{row.avg_voltage.toFixed(1)} V</td>
                    <td className="p-4">{row.avg_current.toFixed(2)} A</td>
                    <td className="p-4">{row.avg_frequency.toFixed(2)} Hz</td>
                    <td className="p-4 pr-6 text-right font-bold text-brand-500">{row.net_consumption_kwh.toFixed(2)} kWh</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Appliance breakdown & forecast accuracy tab */
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Appliance controls */}
          <div className="glass-panel rounded-2xl p-6 lg:col-span-2 space-y-6">
            <div>
              <h2 className="font-extrabold text-slate-800 dark:text-white text-lg">Appliance Disaggregation Shares</h2>
              <p className="text-xs text-slate-400 mt-1">NILM ML model predictions on connected smart devices</p>
            </div>
            
            <div className="divide-y divide-slate-100 dark:divide-slate-850">
              {appliances.map((app) => (
                <div key={app.id} className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0 font-medium">
                  <div className="flex items-center gap-3">
                    <div className={`rounded-xl p-2.5 ${
                      app.status ? 'bg-brand-500/10 text-brand-500' : 'bg-slate-100 text-slate-400 dark:bg-slate-900/50'
                    }`}>
                      <Cpu className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="block text-xs font-bold text-slate-800 dark:text-slate-200">{app.appliance_name}</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5 font-bold uppercase">Efficiency Grade: {app.efficiency_grade}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-xs font-bold text-slate-800 dark:text-white">
                      {app.status ? `${app.power_consumed.toFixed(2)} kW` : 'Standby / Idle'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            {/* Pie Chart disaggregation */}
            <div className="glass-panel rounded-2xl p-6">
              <h2 className="font-bold text-slate-800 dark:text-white text-base">Active Load Breakdown</h2>
              <div className="h-48 w-full my-4">
                {chartData.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-slate-400 text-xs font-semibold">
                    No active power consumption
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(22, 31, 48, 0.95)',
                          border: '1px solid rgba(255, 255, 255, 0.05)',
                          borderRadius: '12px',
                          color: '#fff',
                          fontSize: '10px'
                        }}
                      />
                      <Legend iconType="circle" wrapperStyle={{ fontSize: '9px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* AI Model Forecast Accuracy */}
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-blue-500/10 p-2.5 text-blue-500 border border-blue-500/20">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-850 dark:text-white text-sm">AI Forecasting Accuracy</h3>
                  <span className="block text-[10px] text-slate-400 font-semibold uppercase mt-0.5">XGBoost & Random Forest MAPE</span>
                </div>
              </div>

              <div className="pt-2">
                <span className="text-3xl font-extrabold text-blue-500 tracking-tight">{forecastAccuracy.toFixed(1)}%</span>
                <p className="text-[10px] text-slate-400 mt-2 leading-relaxed">
                  Forecaster models are fitted recursively on aggregate smart telemetry histories. The current score represents a Mean Absolute Percentage Error (MAPE) deviation benchmarked over the past 12 hourly periods.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
