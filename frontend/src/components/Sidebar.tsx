import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  LayoutDashboard, 
  Zap, 
  TrendingUp, 
  Cpu, 
  Sun, 
  DollarSign, 
  BarChart3, 
  Settings as SettingsIcon, 
  LogOut, 
  X,
  Shield
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { logout, user } = useAuth();

  const menuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Live Energy', path: '/live', icon: Zap },
    { name: 'Forecasting', path: '/forecast', icon: TrendingUp },
    { name: 'Appliance Analytics', path: '/appliances', icon: Cpu },
    { name: 'Solar Forecast', path: '/solar', icon: Sun },
    { name: 'Cost Optimizer', path: '/cost', icon: DollarSign },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed bottom-0 top-0 left-0 z-50 flex w-72 flex-col 
        border-r border-slate-200/80 bg-white/95 px-6 py-6 
        transition-transform duration-300 ease-in-out dark:border-slate-800/80 dark:bg-darkbg-card/95
        lg:translate-x-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar Header Logo */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-teal-400 text-white shadow-md shadow-brand-500/20">
              <Zap className="h-5 w-5 fill-current" />
            </div>
            <div>
              <span className="font-bold text-slate-800 dark:text-white text-lg leading-tight tracking-wide">AuraEnergy</span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-brand-500">Intelligent AI</span>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="mt-8 flex items-center gap-3 rounded-2xl bg-slate-50 p-4 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800/50">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-100 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
            <span className="font-bold text-sm uppercase">{user?.username.slice(0, 2)}</span>
          </div>
          <div className="overflow-hidden">
            <span className="block truncate font-semibold text-slate-700 dark:text-slate-200 text-sm">{user?.username}</span>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <Shield className="h-3 w-3 text-brand-500" />
              <span className="truncate capitalize">{user?.role?.replace('_', ' ')}</span>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="mt-8 flex-1 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) => `
                  flex items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-md shadow-brand-500/20' 
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-100'
                  }
                `}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Sidebar Footer Logout */}
        <div className="mt-auto border-t border-slate-100 pt-4 dark:border-slate-800/80">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3.5 rounded-xl px-4 py-3 text-sm font-medium text-red-500 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition-all duration-200"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
