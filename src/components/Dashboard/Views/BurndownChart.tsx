import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { buildBurndownChartData, type BurndownPoint } from '../../../lib/burndownChartUtils';
import { getStatusChartColor, getStatusColor, getStatusDotColor } from '../../../utils/statusColors';
import { BurndownIcon } from './BurndownIcon';

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 220;
const CHART_TOP = 14;
const CHART_BOTTOM = 198;
const CHART_PLOT_HEIGHT = CHART_BOTTOM - CHART_TOP;

function formatDays(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}d`;
}

function pointCoordinates(points: BurndownPoint[], totalEstimateDays: number) {
  const denominator = Math.max(1, totalEstimateDays);
  const lastIndex = Math.max(1, points.length - 1);
  return points.map((point, index) => ({
    ...point,
    x: (index / lastIndex) * CHART_WIDTH,
    y: CHART_BOTTOM - (point.remainingDays / denominator) * CHART_PLOT_HEIGHT,
  }));
}

function pointList(points: Array<BurndownPoint & { x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function areaPath(points: Array<BurndownPoint & { x: number; y: number }>) {
  if (points.length < 2) return '';
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${CHART_BOTTOM} L ${first.x.toFixed(1)} ${CHART_BOTTOM} Z`;
}

export function BurndownChart({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { filteredTasks } = useDashboard();
  const chartData = useMemo(() => buildBurndownChartData(filteredTasks), [filteredTasks]);
  const coordinates = useMemo(() => pointCoordinates(chartData.points, chartData.totalEstimateDays), [chartData.points, chartData.totalEstimateDays]);
  const yTicks = [
    { label: formatDays(chartData.totalEstimateDays), y: CHART_TOP },
    { label: formatDays(chartData.totalEstimateDays / 2), y: CHART_TOP + CHART_PLOT_HEIGHT * 0.5 },
    { label: '0d', y: CHART_BOTTOM },
  ];
  const dateTickStep = Math.max(1, Math.ceil(coordinates.length / 8));
  const dateTicks = coordinates.filter((_, index) => index % dateTickStep === 0);
  const actualPoints = coordinates.filter((point) => !point.future);
  const projectedPoints = coordinates.filter((point) => point.future);
  if (actualPoints.length && projectedPoints.length) {
    projectedPoints.unshift(actualPoints[actualPoints.length - 1]);
  }

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'numeric', day: 'numeric' }), [i18n.language]);
  const completionDate = dateFormatter.format(new Date(`${chartData.completionDate}T00:00:00`));
  const maxWorkerLoad = Math.max(1, ...chartData.workerLoads.flatMap((worker) => worker.days.map((day) => day.loadDays)));
  const totalEstimate = Math.max(1, chartData.totalEstimateDays);
  const assumptionStartDate = chartData.points[0]?.date ? dateFormatter.format(new Date(`${chartData.points[0].date}T00:00:00`)) : '-';
  const assumptionWorkerCount = new Set(chartData.tasks.flatMap((task) => task.assignees)).size;
  const donePercent = Math.round((chartData.statusTotals.done / totalEstimate) * 100);
  const statusSegments = chartData.statusBreakdown.map((status) => ({
    ...status,
    color: getStatusChartColor(status.status),
    percent: Math.round((status.days / totalEstimate) * 100),
  }));
  const conicStops = statusSegments.reduce<{ stops: string[]; start: number }>((acc, segment) => {
    const segmentEnd = acc.start + (segment.days / totalEstimate) * 360;
    return {
      stops: [...acc.stops, `${segment.color} ${acc.start}deg ${segmentEnd}deg`],
      start: segmentEnd,
    };
  }, { stops: [], start: 0 }).stops;
  const donutStyle = {
    background: conicStops.length ? `conic-gradient(${conicStops.join(', ')})` : 'rgb(226 232 240)',
  };

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar glass-panel bg-white/80 md:rounded-r-xl border md:border-y md:border-r border-slate-200/60 ${className}`}>
      <div className="flex min-h-full flex-col gap-4 p-4 lg:p-5">
        <section className="grid grid-cols-1 gap-3" aria-label={t('dashboard.burndownSummary', 'Burndown summary')}>
          <div className="rounded-lg border border-primary/15 bg-primary/5 p-4">
            <div className="mb-3 flex items-center gap-2 text-primary">
              <BurndownIcon size={22} />
              <span className="text-xs font-bold uppercase">{t('dashboard.burndownForecast', 'Forecast')}</span>
            </div>
            <div className="text-2xl font-extrabold text-slate-900">{completionDate}</div>
            <div className="mt-1 text-xs font-medium text-slate-500">{t('dashboard.burndownEstimatedCompletion', 'Estimated completion date')}</div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white/75 p-4 shadow-sm" aria-label={t('dashboard.burndownByDate', 'Burndown by date')}>
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.burndownByDate', 'Burndown by date')}</h2>
              <p className="text-xs font-medium text-slate-500">{t('dashboard.burndownProgressBasin', 'Progress basin')}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs font-semibold">
              <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-primary">
                <span className="h-2 w-2 rounded-full bg-primary"></span>
                {t('dashboard.burndownActual', 'Actual')}
              </span>
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-slate-600">
                <span className="h-2 w-2 rounded-full bg-slate-400"></span>
                {t('dashboard.burndownProjected', 'Projected')}
              </span>
            </div>
          </div>
          <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-stretch gap-3">
            <div className="relative text-right text-[11px] font-bold text-slate-400">
              {yTicks.map((tick) => (
                <span
                  key={tick.label}
                  className="absolute right-0 -translate-y-1/2"
                  style={{ top: `${(tick.y / CHART_HEIGHT) * 100}%` }}
                >
                  {tick.label}
                </span>
              ))}
            </div>
            <div className="min-w-0">
              <svg className="aspect-[1000/220] w-full overflow-visible" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={t('dashboard.burndownChartAria', 'Remaining task days by date')}>
                <line x1="0" y1={CHART_TOP} x2={CHART_WIDTH} y2={CHART_TOP} stroke="rgb(226 232 240)" strokeWidth="2" />
                <line x1="0" y1={CHART_TOP + CHART_PLOT_HEIGHT * 0.5} x2={CHART_WIDTH} y2={CHART_TOP + CHART_PLOT_HEIGHT * 0.5} stroke="rgb(226 232 240)" strokeWidth="2" strokeDasharray="8 8" />
                <line x1="0" y1={CHART_BOTTOM} x2={CHART_WIDTH} y2={CHART_BOTTOM} stroke="rgb(226 232 240)" strokeWidth="2" />
                {yTicks.map((tick) => (
                  <line key={`y-${tick.label}`} x1="-10" y1={tick.y} x2="0" y2={tick.y} stroke="rgb(148 163 184)" strokeWidth="2" strokeLinecap="round" />
                ))}
                {dateTicks.map((tick) => (
                  <line key={`x-${tick.date}`} x1={tick.x} y1={CHART_BOTTOM} x2={tick.x} y2={CHART_BOTTOM + 9} stroke="rgb(148 163 184)" strokeWidth="2" strokeLinecap="round" />
                ))}
                <path d={areaPath(actualPoints)} fill="rgba(79, 70, 229, 0.18)" />
                <path d={areaPath(projectedPoints)} fill="rgba(148, 163, 184, 0.18)" />
                <polyline points={pointList(actualPoints)} fill="none" stroke="var(--color-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={pointList(projectedPoints)} fill="none" stroke="rgb(100 116 139)" strokeWidth="4" strokeDasharray="12 12" strokeLinecap="round" strokeLinejoin="round" />
                {coordinates.map((point) => (
                  <circle key={point.date} cx={point.x} cy={point.y} r="5" fill={point.future ? 'rgb(100 116 139)' : 'var(--color-primary)'} stroke="white" strokeWidth="3">
                    <title>{`${point.date}: ${formatDays(point.remainingDays)} ${t('dashboard.burndownRemainingLower', 'remaining')}`}</title>
                  </circle>
                ))}
              </svg>
              <div className="relative h-5 text-[11px] font-semibold text-slate-400">
                {dateTicks.map((tick) => (
                  <span
                    key={tick.date}
                    className="absolute top-1 -translate-x-1/2"
                    style={{ left: `${(tick.x / CHART_WIDTH) * 100}%` }}
                  >
                    {dateFormatter.format(new Date(`${tick.date}T00:00:00`))}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(360px,1.2fr)]">
          <div className="rounded-lg border border-slate-200 bg-white/75 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.burndownStatusDays', 'Current status days')}</h2>
              <p className="text-xs font-medium text-slate-500">{t('dashboard.burndownStatusDaysHint', 'Task duration by status today')}</p>
            </div>
            <div className="flex items-center gap-5">
              <div className="relative h-36 w-36 shrink-0 rounded-full" style={donutStyle}>
                <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center">
                  <span className="text-2xl font-extrabold text-slate-900">{donePercent}%</span>
                  <span className="text-[10px] font-bold uppercase text-slate-400">{t('dashboard.burndownDone', 'Done')}</span>
                </div>
              </div>
              <ul className="flex min-w-0 flex-1 flex-col gap-2 text-sm">
                {statusSegments.map((status) => (
                  <LegendItem
                    key={status.status}
                    label={status.status}
                    value={`${status.percent}% / ${formatDays(status.days)}`}
                    color={status.color}
                    dotClassName={getStatusDotColor(status.status)}
                    badgeClassName={getStatusColor(status.status)}
                  />
                ))}
              </ul>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/75 p-4 shadow-sm">
            <div className="mb-4">
              <h2 className="text-base font-bold text-slate-900">{t('dashboard.burndownWorkerLoads', 'Top worker loads')}</h2>
              <p className="text-xs font-medium text-slate-500">{t('dashboard.burndownDailyWorkload', 'Daily workload')}</p>
            </div>
            <div className="space-y-3">
              {chartData.workerLoads.length ? chartData.workerLoads.map((worker) => (
                <div key={worker.worker} className="grid grid-cols-[7rem_minmax(0,1fr)] items-end gap-3">
                  <strong className="truncate text-xs font-bold text-slate-600" title={worker.worker}>{worker.worker}</strong>
                  <div className="grid h-14 grid-cols-10 items-end gap-1">
                    {worker.days.map((day) => (
                      <span key={day.date} className="flex h-full items-end rounded bg-slate-100" title={`${worker.worker} ${day.date}: ${formatDays(day.loadDays)}`}>
                        <i className="block w-full rounded bg-primary/75" style={{ height: `${Math.max(4, Math.round((day.loadDays / maxWorkerLoad) * 100))}%` }}></i>
                      </span>
                    ))}
                  </div>
                </div>
              )) : (
                <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">{t('dashboard.burndownNoOpenWork', 'No open work is scheduled in the next 10 days.')}</p>
              )}
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white/75 p-4 shadow-sm" aria-label={t('dashboard.burndownAssumptions', 'Assumptions')}>
          <div className="mb-4">
            <h2 className="text-base font-bold text-slate-900">{t('dashboard.burndownAssumptions', 'Assumptions')}</h2>
            <p className="text-xs font-medium text-slate-500">{t('dashboard.burndownForecastInputs', 'Forecast inputs')}</p>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <AssumptionItem label={t('dashboard.burndownAssumptionStartDate', 'Start date')} value={assumptionStartDate} />
            <AssumptionItem label={t('dashboard.burndownAssumptionCapacity', 'Capacity (days per week)')} value={t('dashboard.burndownAssumptionCapacityValue', '5d/week')} />
            <AssumptionItem label={t('dashboard.burndownAssumptionWorkers', 'Workers count')} value={String(assumptionWorkerCount)} />
          </div>
        </section>
      </div>
    </div>
  );
}

function AssumptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[11px] font-bold uppercase text-slate-400">{label}</div>
      <div className="mt-1 text-lg font-extrabold text-slate-900">{value}</div>
    </div>
  );
}

function LegendItem({ label, value, color, dotClassName, badgeClassName }: { label: string; value: string; color: string; dotClassName: string; badgeClassName: string }) {
  return (
    <li className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${badgeClassName}`}>
      <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-slate-600">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} style={{ backgroundColor: color }}></span>
        <span className="truncate">{label}</span>
      </span>
      <b className="shrink-0 text-slate-900">{value}</b>
    </li>
  );
}
