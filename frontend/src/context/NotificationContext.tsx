import React, { createContext, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

export type NotificationType = 'success' | 'warning' | 'error' | 'info';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

interface NotificationContextType {
  showNotification: (title: string, message: string, type?: NotificationType, duration?: number) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback(
    (title: string, message: string, type: NotificationType = 'info', duration: number = 4000) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newNotification: Notification = { id, title, message, type, duration };

      setNotifications((prev) => [...prev, newNotification]);

      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    },
    []
  );

  const getIcon = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-emerald-450" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-450" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-rose-450 animate-pulse" />;
      case 'info':
      default:
        return <Info className="h-5 w-5 text-brand-450" />;
    }
  };

  const getBorderColor = (type: NotificationType) => {
    switch (type) {
      case 'success':
        return 'border-emerald-500/20 bg-emerald-950/20 shadow-emerald-500/5';
      case 'warning':
        return 'border-amber-500/20 bg-amber-950/20 shadow-amber-500/5';
      case 'error':
        return 'border-rose-500/20 bg-rose-950/20 shadow-rose-500/5';
      case 'info':
      default:
        return 'border-brand-500/20 bg-brand-950/20 shadow-brand-500/5';
    }
  };

  return (
    <NotificationContext.Provider value={{ showNotification }}>
      {children}
      
      {/* Toast Render Portal Stack */}
      <div className="fixed right-4 top-24 z-50 flex w-full max-w-sm flex-col gap-3 pointer-events-none px-4 sm:right-6 sm:px-0">
        <AnimatePresence>
          {notifications.map((n) => (
            <motion.div
              key={n.id}
              layout
              initial={{ opacity: 0, x: 50, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className={`pointer-events-auto flex items-start gap-3 rounded-2xl border p-4 backdrop-blur-xl shadow-xl transition-colors glass-panel ${getBorderColor(
                n.type
              )}`}
            >
              <div className="flex-shrink-0 mt-0.5">{getIcon(n.type)}</div>
              <div className="flex-1 space-y-0.5">
                <h4 className="text-xs font-black tracking-wide text-white uppercase">{n.title}</h4>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">{n.message}</p>
              </div>
              <button
                onClick={() => setNotifications((prev) => prev.filter((item) => item.id !== n.id))}
                className="flex-shrink-0 rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </NotificationContext.Provider>
  );
};
