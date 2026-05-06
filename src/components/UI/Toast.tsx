import { useEffect } from 'react';

interface ToastProps {
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: () => void;
  duration?: number;
}

export function Toast({ message, type = 'info', onClose, duration = 3000 }: ToastProps) {
  useEffect(() => {
    const timer = setTimeout(onClose, duration);
    return () => clearTimeout(timer);
  }, [onClose, duration]);

  const bgColors = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    info: 'bg-slate-800'
  };

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className={`${bgColors[type]} text-white px-6 py-3 rounded-full shadow-lg flex items-center gap-3 min-w-[200px] justify-center`}>
        {type === 'success' && <span className="material-symbols-outlined text-[20px]">check_circle</span>}
        {type === 'error' && <span className="material-symbols-outlined text-[20px]">error</span>}
        {type === 'info' && <span className="material-symbols-outlined text-[20px]">info</span>}
        <span className="text-sm font-medium">{message}</span>
      </div>
    </div>
  );
}
