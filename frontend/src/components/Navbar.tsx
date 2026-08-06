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
    <header className="sticky top-0 z-30 flex h-20 items-center justify-between border-b border-slate-200/80 bg-white/70 px-6 backdrop-blur-md dark:border-slate-800/80 dark:bg-darkbg-card/70 lg:px-8">
      {/* Page Title & Hamburger */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuToggle}
          className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div>
          <h1 className="font-bold text-slate-800 dark:text-white text-xl md:text-2xl leading-none">{getPageTitle(location.pathname)}</h1>
          <span className="mt-1 hidden items-center gap-1.5 text-xs text-slate-400 dark:text-slate-400 md:flex">
            Welcome back to your energy portal
          </span>
        </div>
      </div>

      {/* Utilities */}
      <div className="flex items-center gap-2 md:gap-4">
        {/* Calendar widget */}
        <div className="hidden items-center gap-2 rounded-xl bg-slate-50 border border-slate-100 px-3 py-1.5 text-xs font-medium text-slate-500 dark:bg-slate-900/50 dark:border-slate-800/50 dark:text-slate-400 md:flex">
          <Calendar className="h-4 w-4 text-brand-500" />
          <span>{formattedDate}</span>
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="rounded-xl border border-slate-200/80 bg-white p-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800/85 dark:bg-darkbg-card dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
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
          className="relative rounded-xl border border-slate-200/80 bg-white p-2.5 text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:border-slate-800/85 dark:bg-darkbg-card dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-white"
          aria-label="Notifications"
        >
          <Bell className="h-4.5 w-4.5" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-brand-500 animate-pulse-slow" />
        </button>
      </div>
    </header>
  );
};
