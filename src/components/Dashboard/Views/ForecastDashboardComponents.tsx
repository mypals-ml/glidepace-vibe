import { useState, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusAssumptionClasses } from '../../../utils/statusColors';
import type { User } from '../../../types';

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function ForecastDashboardSectionLoader({ variant, label }: { variant: 'completion' | 'chart' | 'status' | 'workers' | 'assumptions'; label: string }) {
  return (
    <div className="w-full min-w-0 rounded-lg bg-slate-50/80 p-4 animate-pulse" role="status" aria-live="polite" aria-label={label}>
      {variant === 'completion' && (
        <div className="w-full min-w-0 space-y-3">
          <span className="block h-7 w-full rounded bg-slate-200"></span>
          <span className="mx-auto block h-12 w-1/3 rounded bg-slate-200"></span>
          <div className="flex items-center justify-between gap-2">
            <span className="block h-3 w-12 rounded bg-slate-200"></span>
            <span className="block h-3 w-16 rounded bg-slate-200"></span>
          </div>
        </div>
      )}
      {variant === 'chart' && (
        <div className="grid w-full min-w-0 grid-cols-[2rem_minmax(0,1fr)] gap-2">
          <div className="space-y-8 py-2">
            <span className="block h-3 rounded bg-slate-200"></span>
            <span className="block h-3 rounded bg-slate-200"></span>
            <span className="block h-3 rounded bg-slate-200"></span>
          </div>
          <div className="min-w-0 space-y-3">
            <span className="block h-20 rounded bg-slate-200"></span>
            <div className="grid grid-cols-6 gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <span key={index} className="h-3 rounded bg-slate-200"></span>
              ))}
            </div>
          </div>
        </div>
      )}
      {variant === 'status' && (
        <div className="flex w-full min-w-0 items-center gap-5">
          <span className="h-32 w-32 shrink-0 rounded-full bg-slate-200"></span>
          <div className="min-w-0 flex-1 space-y-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} className="block h-9 rounded-lg bg-slate-200"></span>
            ))}
          </div>
        </div>
      )}
      {variant === 'workers' && (
        <div className="w-full min-w-0 space-y-3">
          {Array.from({ length: 2 }).map((_, rowIndex) => (
            <div key={rowIndex} className="grid w-full min-w-0 grid-cols-[5rem_minmax(0,1fr)] items-end gap-3">
              <span className="h-3 rounded bg-slate-200"></span>
              <div className="grid h-14 min-w-0 grid-cols-10 items-end gap-1">
                {Array.from({ length: 10 }).map((_, index) => (
                  <span key={index} className="rounded bg-slate-200" style={{ height: `${28 + ((index + rowIndex) % 5) * 14}%` }}></span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {variant === 'assumptions' && (
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="space-y-3 rounded-lg bg-white/70 px-3 py-3">
              <span className="block h-3 w-2/3 rounded bg-slate-200"></span>
              <span className="block h-6 w-1/2 rounded bg-slate-200"></span>
            </div>
          ))}
        </div>
      )}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function DashboardCard({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-forecast-card sm:p-5" aria-label={ariaLabel}>
      {children}
    </section>
  );
}

export function MetricTile({
  label,
  value,
  className = '',
  valueClassName = '',
  infoLabel,
  onInfoClick,
}: {
  label: string;
  value: string;
  className?: string;
  valueClassName?: string;
  infoLabel?: string;
  onInfoClick?: () => void;
}) {
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-70">{label}</div>
        {onInfoClick && infoLabel && (
          <button
            type="button"
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-white/70 text-xs font-extrabold italic text-primary shadow-sm transition-colors hover:bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={infoLabel}
            title={infoLabel}
            onClick={onInfoClick}
          >
            i
          </button>
        )}
      </div>
      <div className={`mt-1 min-w-fit whitespace-nowrap text-xl font-black tracking-normal ${valueClassName}`}>{value}</div>
    </div>
  );
}

export function AssumptionsStorageDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const storageNotes = [
    t('dashboard.burndownAssumptionsStorageGitHub', 'Shared assumptions are saved in the GitHub Project README. The app writes a small namespaced JSON block through GitHub Projects, so teammates opening the same project can load the same settings.'),
    t('dashboard.burndownAssumptionsStorageLocal', 'A per-project browser cache is also kept in localStorage. It makes reloads faster and provides the last known assumptions when GitHub cannot be reached.'),
    t('dashboard.burndownAssumptionsStorageActions', 'Sync reloads the latest shared assumptions. Save writes your edited assumptions back to GitHub. Cancel discards local draft edits before they are saved.'),
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="forecast-assumptions-storage-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('dashboard.burndownAssumptionsStorageEyebrow', 'Assumptions storage')}
            </p>
            <h3 id="forecast-assumptions-storage-title" className="mt-1 text-xl font-extrabold text-slate-950">
              {t('dashboard.burndownAssumptionsStorageTitle', 'Where assumptions are saved')}
            </h3>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={t('common.close', 'Close')}
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="space-y-3 px-6 py-5">
          {storageNotes.map((note) => (
            <p key={note} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-700">
              {note}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ForecastInfoButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-white text-xs font-extrabold italic text-primary shadow-sm transition-colors hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-primary/30"
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      i
    </button>
  );
}

export function ForecastSectionInfoDialog({
  isOpen,
  onClose,
  eyebrow,
  title,
  notes,
}: {
  isOpen: boolean;
  onClose: () => void;
  eyebrow: string;
  title: string;
  notes: string[];
}) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="forecast-section-info-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
            <h3 id="forecast-section-info-title" className="mt-1 text-xl font-extrabold text-slate-950">{title}</h3>
          </div>
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary/30"
            aria-label={t('common.close', 'Close')}
            onClick={onClose}
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>
        <div className="space-y-3 px-6 py-5">
          {notes.map((note) => (
            <p key={note} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-700">
              {note}
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ChartPill({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600">
      <span className={`h-2 w-2 rounded-full ${color}`}></span>
      {label}
    </span>
  );
}

export function DonutGraphic({
  style,
  fallbackClassName = '',
  percent,
  label,
  labelClassName,
  valueClassName = 'text-primary',
  hideLabel = false,
}: {
  style?: CSSProperties;
  fallbackClassName?: string;
  percent: number;
  label: string;
  labelClassName: string;
  valueClassName?: string;
  hideLabel?: boolean;
}) {
  return (
    <div className={`relative mx-auto h-36 w-36 shrink-0 rounded-full sm:mx-0 ${fallbackClassName}`} style={style}>
      <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-inset ring-slate-200/70">
        <span className={`text-3xl font-black tracking-normal ${valueClassName}`}>{percent}%</span>
        {!hideLabel && <span className={`text-[10px] font-extrabold uppercase tracking-[0.08em] ${labelClassName}`}>{label}</span>}
      </div>
    </div>
  );
}

export function AssumptionInput({
  label,
  value,
  className = '',
  type = 'text',
  readOnly = false,
  onChange,
}: {
  label: string;
  value: string;
  className?: string;
  type?: 'text' | 'date';
  readOnly?: boolean;
  onChange?: (value: string) => void;
}) {
  const inputClassName = readOnly
    ? 'h-11 w-full cursor-default rounded-lg border-0 bg-slate-50 px-3 text-base font-extrabold text-slate-500 outline-none'
    : 'h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-extrabold text-slate-950 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

  return (
    <label className={`block min-w-[140px] ${className}`}>
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        className={inputClassName}
        type={type}
        aria-label={label}
        aria-readonly={readOnly}
        readOnly={readOnly}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
      />
    </label>
  );
}

export function AssumptionNumberInput({
  label,
  value,
  suffix,
  className = '',
  min = 0,
  max = 100,
  step = 1,
  readOnly = false,
  onChange,
}: {
  label: string;
  value: number;
  suffix?: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  readOnly?: boolean;
  onChange?: (value: number) => void;
}) {
  const containerClassName = readOnly
    ? 'flex h-11 items-center rounded-lg border border-slate-100 bg-slate-50 px-3'
    : 'flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20';
  const inputClassName = readOnly
    ? 'min-w-12 flex-1 cursor-default bg-transparent text-base font-extrabold text-slate-500 outline-none'
    : 'min-w-12 flex-1 bg-transparent text-base font-extrabold text-slate-950 outline-none';

  return (
    <label className={`block min-w-[140px] ${className}`}>
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className={containerClassName}>
        <input
          className={inputClassName}
          type="number"
          aria-label={label}
          aria-readonly={readOnly}
          readOnly={readOnly}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange?.(clampNumber(event.currentTarget.valueAsNumber, min, max))}
        />
        {suffix && <span className={`ml-2 shrink-0 text-sm font-bold ${readOnly ? 'text-slate-300' : 'text-slate-400'}`}>{suffix}</span>}
      </span>
    </label>
  );
}

export function AssumptionWorkerDropdown({
  label,
  value,
  users,
  fallbackLabel,
}: {
  label: string;
  value: string;
  users: User[];
  fallbackLabel: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <div className="relative block min-w-[140px]">
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <button
        type="button"
        className="flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border-0 bg-slate-50 px-3 text-base font-extrabold text-slate-500 outline-none focus:ring-2 focus:ring-primary/20"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span>{value}</span>
        <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} aria-hidden="true">expand_more</span>
      </button>
      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-72 min-w-[280px] overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-2xl" role="listbox" aria-label={`${label} list`}>
          {users.length ? (
            <div className="flex flex-col">
              <div className="task-row-picker-muted px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {label}
              </div>
              <div className="task-row-picker-body max-h-60 overflow-y-auto custom-scrollbar">
                {users.map((user) => (
                  <ForecastAssigneeOption key={user.id} user={user} />
                ))}
              </div>
            </div>
          ) : (
            <div className="px-4 py-10 text-center">
              <span className="material-symbols-outlined mb-2 text-3xl text-slate-300">person_search</span>
              <div className="text-xs italic text-slate-400">{t('dashboard.noProjectAssignees', 'No project assignees')}</div>
              <div className="mt-2 text-[10px] font-semibold text-slate-400">{fallbackLabel}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ForecastAssigneeOption({ user }: { user: User }) {
  return (
    <div className="flex w-full items-center gap-3 px-3 py-2 text-left" role="option" aria-selected="true" title={user.name}>
      <div className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary text-[10px] font-bold shadow-sm ${user.avatarColor}`}>
        {user.avatarUrl ? (
          <img src={user.avatarUrl} alt={user.name} className="h-full w-full rounded-full object-cover" />
        ) : user.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-xs font-medium text-slate-700">{user.name}</div>
        {user.login && <div className="truncate text-[10px] text-slate-400">@{user.login}</div>}
      </div>
      <span className="material-symbols-outlined text-lg text-primary">check_circle</span>
    </div>
  );
}

export function AssumptionPercentInput({
  label,
  status,
  value,
  className = '',
  readOnly = false,
  onChange,
}: {
  label: string;
  status: string;
  value: number;
  className?: string;
  readOnly?: boolean;
  onChange?: (value: number) => void;
}) {
  const statusClassName = getStatusAssumptionClasses(status);
  const wrapperClassName = readOnly
    ? `block min-w-fit rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 ${className}`
    : `block min-w-fit rounded-lg border px-3 py-2 ${statusClassName.wrapper} ${className}`;
  const inputContainerClassName = readOnly
    ? 'flex h-9 items-center rounded-md border border-slate-100 bg-slate-50 px-3'
    : `flex h-9 items-center rounded-md border bg-white/80 px-3 focus-within:ring-2 ${statusClassName.input}`;
  const inputClassName = readOnly
    ? 'min-w-12 flex-1 cursor-default bg-transparent text-lg font-black text-slate-500 outline-none'
    : 'min-w-12 flex-1 bg-transparent text-lg font-black text-slate-950 outline-none';

  return (
    <label className={wrapperClassName}>
      <span className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${readOnly ? 'text-slate-400' : statusClassName.label}`}>
        <span className={`h-2 w-2 rounded-full ${readOnly ? 'bg-slate-300' : statusClassName.dot}`}></span>
        {label}
      </span>
      <span className={inputContainerClassName}>
        <input
          className={inputClassName}
          type="number"
          aria-label={label}
          aria-readonly={readOnly}
          readOnly={readOnly}
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => onChange?.(clampNumber(event.currentTarget.valueAsNumber, 0, 100))}
        />
        <span className={`shrink-0 text-sm font-bold ${readOnly ? 'text-slate-300' : statusClassName.label}`}>%</span>
      </span>
    </label>
  );
}

export function LegendItem({ label, percent, days, color, dotClassName, labelClassName = '' }: { label: string; percent: string; days: string; color: string; dotClassName: string; labelClassName?: string }) {
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-slate-100 px-1 py-2.5 last:border-b-0">
      <span className={`inline-flex min-w-0 items-center gap-2 font-semibold ${labelClassName}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} style={{ backgroundColor: color }}></span>
        <span className="truncate">{label}</span>
      </span>
      <span className="tabular-nums text-right text-xs font-extrabold text-slate-700">{percent}</span>
      <span className="tabular-nums text-right text-xs font-bold text-slate-500">{days}</span>
    </li>
  );
}
