import type { CSSProperties, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { getStatusAssumptionClasses } from '../../../utils/statusColors';

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

export function ForecastDashboardSectionLoader({ variant, label }: { variant: 'chart' | 'status' | 'workers' | 'assumptions'; label: string }) {
  return (
    <div className="w-full min-w-0 rounded-lg bg-slate-50/80 p-4 animate-pulse" role="status" aria-live="polite" aria-label={label}>
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

export function ForecastRulesDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  if (!isOpen) return null;

  const rules = [
    t('dashboard.burndownRulesCompletion', 'Estimated completion uses the remaining workload allocated across available workers and the capacity assumption in days per week. The latest worker completion date becomes the project completion date.'),
    t('dashboard.burndownRulesRemaining', 'Remaining workload starts from task estimates when available, otherwise inclusive task duration. Each open task is multiplied by its status remaining-workload percentage.'),
    t('dashboard.burndownRulesProjected', 'The projected line simulates future workday burn-down from today using the same worker allocation and capacity. The line reaches zero on the estimated completion date.'),
    t('dashboard.burndownRulesWorkers', 'Tasks with assignees split workload evenly across those assignees. Unassigned work is spread across active assignees, or one virtual worker when no assignees exist.'),
  ];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="forecast-rules-title">
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              {t('dashboard.burndownRulesEyebrow', 'Forecast rules')}
            </p>
            <h3 id="forecast-rules-title" className="mt-1 text-xl font-extrabold text-slate-950">
              {t('dashboard.burndownRulesTitle', 'How the forecast is calculated')}
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
          {rules.map((rule) => (
            <p key={rule} className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-700">
              {rule}
            </p>
          ))}
        </div>
        <div className="border-t border-slate-100 px-6 py-3 text-[10px] text-slate-400">
          This specification is generated based on the file{' '}
          <a
            href="https://github.com/mypals-ml/glidepace-vibe/blob/develop/docs/FORECAST_ESTIMATION_RULES.md"
            target="_blank"
            rel="noopener noreferrer"
            className="underline decoration-slate-300 hover:text-primary"
          >
            docs/FORECAST_ESTIMATION_RULES.md
          </a>{' '}
          in the source code repository on GitHub.
        </div>
      </div>
    </div>
  );
}

export function ChartPill({ label, color, className }: { label: string; color: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold ${className}`}>
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
}: {
  style?: CSSProperties;
  fallbackClassName?: string;
  percent: number;
  label: string;
  labelClassName: string;
  valueClassName?: string;
}) {
  return (
    <div className={`relative mx-auto h-36 w-36 shrink-0 rounded-full sm:mx-0 ${fallbackClassName}`} style={style}>
      <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center ring-1 ring-inset ring-slate-200/70">
        <span className={`text-3xl font-black tracking-normal ${valueClassName}`}>{percent}%</span>
        <span className={`text-[10px] font-extrabold uppercase tracking-[0.08em] ${labelClassName}`}>{label}</span>
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
  onChange,
}: {
  label: string;
  value: number;
  suffix: string;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className={`block min-w-[140px] ${className}`}>
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <span className="flex h-11 items-center rounded-lg border border-slate-200 bg-white px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20">
        <input
          className="min-w-12 flex-1 bg-transparent text-base font-extrabold text-slate-950 outline-none"
          type="number"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(clampNumber(event.currentTarget.valueAsNumber, min, max))}
        />
        <span className="ml-2 shrink-0 text-sm font-bold text-slate-400">{suffix}</span>
      </span>
    </label>
  );
}

export function AssumptionPercentInput({
  label,
  status,
  value,
  className = '',
  onChange,
}: {
  label: string;
  status: string;
  value: number;
  className?: string;
  onChange: (value: number) => void;
}) {
  const statusClassName = getStatusAssumptionClasses(status);
  return (
    <label className={`block min-w-fit rounded-lg border px-3 py-2 ${statusClassName.wrapper} ${className}`}>
      <span className={`mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold ${statusClassName.label}`}>
        <span className={`h-2 w-2 rounded-full ${statusClassName.dot}`}></span>
        {label}
      </span>
      <span className={`flex h-9 items-center rounded-md border bg-white/80 px-3 focus-within:ring-2 ${statusClassName.input}`}>
        <input
          className="min-w-12 flex-1 bg-transparent text-lg font-black text-slate-950 outline-none"
          type="number"
          aria-label={label}
          min={0}
          max={100}
          step={1}
          value={value}
          onChange={(event) => onChange(clampNumber(event.currentTarget.valueAsNumber, 0, 100))}
        />
        <span className={`shrink-0 text-sm font-bold ${statusClassName.label}`}>%</span>
      </span>
    </label>
  );
}

export function LegendItem({ label, percent, days, color, dotClassName, badgeClassName, labelClassName = '' }: { label: string; percent: string; days: string; color: string; dotClassName: string; badgeClassName: string; labelClassName?: string }) {
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 ${badgeClassName}`}>
      <span className={`inline-flex min-w-0 items-center gap-2 font-semibold ${labelClassName}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} style={{ backgroundColor: color }}></span>
        <span className="truncate">{label}</span>
      </span>
      <span className="flex flex-wrap justify-end gap-2">
        <span className="rounded-md border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-extrabold">{percent}</span>
        <span className="rounded-md border border-current/20 bg-current/10 px-2 py-0.5 text-xs font-bold">{days}</span>
      </span>
    </li>
  );
}