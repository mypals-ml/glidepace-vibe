import { useState, useRef } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';

interface Option {
  id: string;
  name: string;
}

interface CustomSelectProps {
  label?: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CustomSelect({ label, options, value, onChange, placeholder, className = "" }: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  useClickOutside(containerRef, () => setIsOpen(false), isOpen);

  const selectedOption = options.find(opt => opt.id === value);

  return (
    <div className={`relative flex flex-col gap-1.5 ${className}`} ref={containerRef}>
      {label && (
        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block ml-1">
          {label}
        </label>
      )}
      
      <div
        onClick={() => setIsOpen(prev => !prev)}
        className={`flex items-center justify-between bg-white border border-slate-200 rounded-lg shadow-sm cursor-pointer hover:bg-slate-50 transition-all h-10 px-3 overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary ${isOpen ? 'ring-2 ring-primary/20 border-primary' : ''}`}
        role="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className={`text-sm truncate ${!selectedOption ? 'text-slate-400' : 'text-slate-700 font-medium'}`}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">
          expand_more
        </span>
      </div>

      {isOpen && (
        <div 
          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-[0_12px_40px_rgba(0,0,0,0.12)] z-[60] overflow-hidden animate-in fade-in zoom-in-95 duration-150 border border-slate-200/60 py-1"
          role="listbox"
        >
          <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
            {placeholder && (
              <button
                onClick={() => { onChange(''); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${!value ? 'text-primary font-bold bg-primary/5' : 'text-slate-500 hover:bg-slate-50'}`}
                role="option"
                aria-selected={!value}
              >
                <span className="truncate">{placeholder}</span>
                {!value && <span className="material-symbols-outlined text-sm">check</span>}
              </button>
            )}
            
            {options.map(option => (
              <button
                key={option.id}
                onClick={() => { onChange(option.id); setIsOpen(false); }}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between ${value === option.id ? 'text-primary font-bold bg-primary/5' : 'text-slate-600 hover:bg-slate-50'}`}
                role="option"
                aria-selected={value === option.id}
              >
                <span className="truncate">{option.name}</span>
                {value === option.id && <span className="material-symbols-outlined text-sm">check</span>}
              </button>
            ))}

            {options.length === 0 && (
              <div className="px-4 py-4 text-center text-xs text-slate-400 italic">
                No fields available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
