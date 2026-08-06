import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { Login } from './pages/Login';
import { Register } from './pages/Register';

// Import feature pages
import { Dashboard } from './pages/Dashboard';
import { LiveEnergy } from './pages/LiveEnergy';
import { Forecasting } from './pages/Forecasting';
import { ApplianceAnalytics } from './pages/ApplianceAnalytics';
import { SolarForecast } from './pages/SolarForecast';
import { CostOptimizer } from './pages/CostOptimizer';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

// Private Route Guard Wrapper
const ProtectedLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-500 border-t-transparent" />
          <span className="text-sm font-semibold tracking-wider text-slate-400">Loading your energy portal...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 radial-bg dark:bg-darkbg dark:text-slate-100 lg:pl-72">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex flex-col">
        <Navbar onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          {children}
        </main>
      </div>
    </div>
  );
};

export const AppContent: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      
      {/* Protected Routes */}
      <Route path="/" element={<ProtectedLayout><Dashboard /></ProtectedLayout>} />
      <Route path="/live" element={<ProtectedLayout><LiveEnergy /></ProtectedLayout>} />
      <Route path="/forecast" element={<ProtectedLayout><Forecasting /></ProtectedLayout>} />
      <Route path="/appliances" element={<ProtectedLayout><ApplianceAnalytics /></ProtectedLayout>} />
      <Route path="/solar" element={<ProtectedLayout><SolarForecast /></ProtectedLayout>} />
      <Route path="/cost" element={<ProtectedLayout><CostOptimizer /></ProtectedLayout>} />
      <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
      <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />

      {/* Fallback Catch-All */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}
