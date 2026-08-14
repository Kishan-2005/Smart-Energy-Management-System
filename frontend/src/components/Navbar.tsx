import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Menu, Sun, Moon, Bell, Calendar } from 'lucide-react';

interface NavbarProps {
  onMenuToggle: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onMenuToggle }) => {
  const { theme, toggleTheme } = useAuth();
  const location = useLocation();

  // Map route names to clean visual headers
  const getPageTitle = (path: string) => {
    switch (path) {
      case '/': return 'System Overview';
      case '/live': return 'Live Grid Telemetry';
      case '/forecast': return 'AI Consumption Forecast';
      case '/appliances': return 'Appliance Consumption Analytics';
      case '/solar': return 'Solar & Storage Forecast';
      case '/cost': return 'Tariff Cost Optimization';
      case '/reports': return 'Historical Reports Builder';
      case '/settings': return 'System Settings';
      default: return 'Dashboard';
    }
  };

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return (
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-white/5 bg-slate-950/40 px-6 backdrop-blur-md lg:px-8">
      {/* Page Title & Hamburger */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="rounded-xl p-2 text-slate-400 hover:bg-white/5 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <h1 className="font-extrabold text-white text-xl md:text-2xl tracking-tight leading-none">{getPageTitle(location.pathname)}</h1>
          <span className="mt-1 hidden items-center gap-1.5 text-xs text-slate-400 md:flex">
            Welcome back to your energy portal
          </span>
        </div>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Calendar widget */}
        <div className="hidden items-center gap-2 rounded-xl bg-white/5 border border-white/5 px-3 py-1.5 text-xs font-semibold text-slate-300 md:flex">
          <Calendar className="h-4 w-4 text-brand-400" />
          <span>{formattedDate}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-xl border border-white/5 bg-white/5 p-2.5 text-slate-350 hover:bg-white/10 hover:text-white transition-all"
          aria-label="Toggle Theme"
        >
          {theme === 'light' ? (
            <Moon className="h-4.5 w-4.5" />
          ) : (
            <Sun className="h-4.5 w-4.5" />
          )}
        </button>

        {/* Notification Bell */}
        <button
          className="relative rounded-xl border border-white/5 bg-white/5 p-2.5 text-slate-350 hover:bg-white/10 hover:text-white transition-all"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-400 animate-pulse" />
        </button>
      </div>
    </header>
  );
};
