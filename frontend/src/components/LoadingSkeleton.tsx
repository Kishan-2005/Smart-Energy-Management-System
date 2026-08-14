import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="glass-panel rounded-3xl p-6 h-36 flex flex-col justify-between overflow-hidden relative">
      <div className="flex justify-between items-center w-full">
        <div className="h-3 w-28 bg-slate-800 rounded-md animate-pulse" />
        <div className="h-8 w-8 bg-slate-800 rounded-xl animate-pulse" />
      </div>
      <div className="space-y-2 mt-4">
        <div className="h-7 w-36 bg-slate-800 rounded-md animate-pulse" />
        <div className="h-2.5 w-24 bg-slate-800/60 rounded-md animate-pulse" />
      </div>
    </div>
  );
};

export const ChartSkeleton: React.FC = () => {
  return (
    <div className="glass-panel rounded-3xl p-6 h-80 flex flex-col justify-between overflow-hidden relative">
      <div className="flex justify-between items-center w-full mb-6">
        <div className="space-y-2">
          <div className="h-4 w-40 bg-slate-800 rounded-md animate-pulse" />
          <div className="h-3 w-56 bg-slate-800/60 rounded-md animate-pulse" />
        </div>
        <div className="h-6 w-20 bg-slate-800/80 rounded-full animate-pulse" />
      </div>
      
      {/* Visual representation of an area graph skeleton */}
      <div className="flex-1 flex items-end gap-2 w-full pt-8 pb-4">
        {Array.from({ length: 12 }).map((_, i) => {
          const heights = ['h-12', 'h-24', 'h-16', 'h-32', 'h-28', 'h-40', 'h-36', 'h-48', 'h-20', 'h-36', 'h-44', 'h-16'];
          return (
            <div key={i} className={`flex-1 ${heights[i]} bg-slate-850 rounded-lg animate-pulse opacity-40`} />
          );
        })}
      </div>
    </div>
  );
};

export const ListSkeleton: React.FC = () => {
  return (
    <div className="glass-panel rounded-3xl p-6 space-y-4 overflow-hidden relative">
      <div className="space-y-1.5 mb-5">
        <div className="h-4 w-32 bg-slate-800 rounded-md animate-pulse" />
        <div className="h-3 w-48 bg-slate-800/60 rounded-md animate-pulse" />
      </div>
      
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center border border-slate-900 rounded-2xl p-4 bg-slate-950/20">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 bg-slate-850 rounded-xl animate-pulse" />
            <div className="space-y-1.5">
              <div className="h-3 w-28 bg-slate-800 rounded-md animate-pulse" />
              <div className="h-2 w-16 bg-slate-800/60 rounded-md animate-pulse" />
            </div>
          </div>
          <div className="h-6 w-12 bg-slate-850 rounded-full animate-pulse" />
        </div>
      ))}
    </div>
  );
};
