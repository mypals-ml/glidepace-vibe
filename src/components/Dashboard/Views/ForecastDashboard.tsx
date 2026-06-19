import { useMemo, type CSSProperties, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { buildForecastDashboardData, type ForecastPoint } from '../../../lib/forecastDashboardUtils';
import { getStatusChartColor, getStatusColor, getStatusDotColor, getStatusTextColor } from '../../../utils/statusColors';

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 220;
const CHART_TOP = 14;
const CHART_BOTTOM = 198;
const CHART_PLOT_HEIGHT = CHART_BOTTOM - CHART_TOP;

function formatDays(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}d`;
}

function pointCoordinates(points: ForecastPoint[], totalEstimateDays: number) {
  const denominator = Math.max(1, totalEstimateDays);
  const lastIndex = Math.max(1, points.length - 1);
  return points.map((point, index) => ({
    ...point,
    x: (index / lastIndex) * CHART_WIDTH,
    y: CHART_BOTTOM - (point.remainingDays / denominator) * CHART_PLOT_HEIGHT,
  }));
}

function pointList(points: Array<ForecastPoint & { x: number; y: number }>) {
  return points.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
}

function areaPath(points: Array<ForecastPoint & { x: number; y: number }>) {
  if (points.length < 2) return '';
  const line = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  return `${line} L ${last.x.toFixed(1)} ${CHART_BOTTOM} L ${first.x.toFixed(1)} ${CHART_BOTTOM} Z`;
}

function dateTickCoordinates(points: Array<ForecastPoint & { x: number; y: number }>) {
  const first = points[0];
  const last = points[points.length - 1];
  const actualBoundary = [...points].reverse().find((point) => !point.future);
  const dateTicks = [first, actualBoundary, last].filter((tick, index, ticks): tick is ForecastPoint & { x: number; y: number } => {
    if (!tick) return false;
    return ticks.findIndex((candidate) => candidate?.date === tick.date) === index;
  });
  return dateTicks.map((tick, index) => ({
    ...tick,
    showLabel: index === 0 || index === dateTicks.length - 1 || (last ? Math.abs(last.x - tick.x) > 120 : true),
  }));
}

function shouldShowWorkerDateLabel(index: number, total: number, step: number) {
  return index === 0 || index === total - 1 || index % step === 0;
}

export function ForecastDashboard({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { filteredTasks, isLoadingTasks, selectedProject } = useDashboard();
  const isCompactWorkerLabels = useMediaQuery('(max-width: 639px)');
  const isNarrowWorkerLabels = useMediaQuery('(max-width: 1023px)');
  const chartData = useMemo(() => buildForecastDashboardData(filteredTasks), [filteredTasks]);
  const coordinates = useMemo(() => pointCoordinates(chartData.points, chartData.totalEstimateDays), [chartData.points, chartData.totalEstimateDays]);
  const chartGuideTicks = [
    { label: '100%', y: CHART_TOP },
    { label: '50%', y: CHART_TOP + CHART_PLOT_HEIGHT * 0.5 },
  ];
  const dateTicks = dateTickCoordinates(coordinates);
  const actualPoints = coordinates.filter((point) => !point.future);
  const projectedPoints = coordinates.filter((point) => point.future);
  if (actualPoints.length && projectedPoints.length) {
    projectedPoints.unshift(actualPoints[actualPoints.length - 1]);
  }

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'short', day: '2-digit' }), [i18n.language]);
  const completionDateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'short', day: '2-digit' }), [i18n.language]);
  const completionDate = completionDateFormatter.format(new Date(`${chartData.completionDate}T00:00:00`));
  const todayLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [i18n.language]);
  const maxWorkerLoad = Math.max(1, ...chartData.workerLoads.flatMap((worker) => worker.days.map((day) => day.loadDays)));
  const totalEstimate = Math.max(1, chartData.totalEstimateDays);
  const projectedColor = getStatusChartColor('In progress');
  const doneTextColor = getStatusTextColor('Done');
  const workerDateLabelStep = isCompactWorkerLabels ? 3 : isNarrowWorkerLabels ? 2 : 1;
  const assumptionStartDate = chartData.points[0]?.date ? dateFormatter.format(new Date(`${chartData.points[0].date}T00:00:00`)) : '-';
  const rawWorkerCount = new Set(chartData.tasks.flatMap((task) => task.assignees)).size;
  const assumptionWorkerCount = Math.max(1, rawWorkerCount);
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

  // Project summary: completed vs. remaining effort across the whole project.
  const completedDays = Math.max(0, chartData.totalEstimateDays - chartData.remainingDays);
  const projectSummarySegments = [
    {
      label: t('dashboard.burndownSummaryCompleted', 'Completed'),
      days: completedDays,
      color: getStatusChartColor('Done'),
      textClassName: getStatusTextColor('Done'),
      badgeClassName: getStatusColor('Done'),
    },
    {
      label: t('dashboard.burndownSummaryRemaining', 'Remaining'),
      days: chartData.remainingDays,
      color: getStatusChartColor('Blocked'),
      textClassName: getStatusTextColor('Blocked'),
      badgeClassName: getStatusColor('Blocked'),
    },
  ].map((segment) => ({
    ...segment,
    percent: Math.round((segment.days / totalEstimate) * 100),
  }));
  const summaryConicStops = projectSummarySegments.reduce<{ stops: string[]; start: number }>((acc, segment) => {
    const segmentEnd = acc.start + (segment.days / totalEstimate) * 360;
    return {
      stops: [...acc.stops, `${segment.color} ${acc.start}deg ${segmentEnd}deg`],
      start: segmentEnd,
    };
  }, { stops: [], start: 0 }).stops;
  const summaryDonutStyle = {
    background: summaryConicStops.length ? `conic-gradient(${summaryConicStops.join(', ')})` : 'rgb(226 232 240)',
  };
  const remainingPercent = Math.round((chartData.remainingDays / totalEstimate) * 100);
  const actualBoundary = actualPoints[actualPoints.length - 1];
  const assumptionStatusWorkloads = [
    { label: t('dashboard.burndownAssumptionDraft', 'Draft'), value: '0' },
    { label: t('dashboard.burndownAssumptionTodo', 'Todo'), value: '100' },
    { label: t('dashboard.burndownAssumptionInProgress', 'In progress'), value: '50' },
    { label: t('dashboard.burndownAssumptionInReview', 'In review'), value: '20' },
    { label: t('dashboard.burndownAssumptionDone', 'Done'), value: '0' },
    { label: t('dashboard.burndownAssumptionOther', 'Other'), value: '50' },
  ];

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-[#f7f8ff] md:rounded-r-xl border md:border-y md:border-r border-slate-200/60 ${className}`}>
      <div className="pointer-events-none sticky top-0 z-0 h-0">
        <div className="absolute inset-x-0 top-0 h-[36rem] bg-[radial-gradient(circle_at_1px_1px,rgba(99,102,241,0.13)_1px,transparent_0)] [background-size:18px_18px]"></div>
        <div className="absolute left-1/2 top-8 h-64 w-64 -translate-x-1/2 rounded-full bg-indigo-200/35 blur-3xl"></div>
      </div>
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 pb-6 pt-10 sm:px-6 lg:pb-8 lg:pt-12">
        <header className="space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-[0.35em] text-slate-500">{t('dashboard.viewForecast', 'Forecast')}</p>
          <h1 className="text-2xl font-extrabold tracking-normal text-slate-950 sm:text-3xl">{t('dashboard.forecastDashboardTitle', 'Forecast Dashboard')}</h1>
          <p className="text-sm font-medium text-slate-500">{t('dashboard.forecastDashboardSubtitle', 'A stacked planning summary from the current filtered task set.')}</p>
        </header>

        <section className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_60px_rgba(79,70,229,0.10)] sm:p-5" aria-label={t('dashboard.burndownByDate', 'Burndown by date')}>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownChartTitle', 'Burndown Chart')}</h2>
            <p className="text-sm font-medium text-slate-500">{t('dashboard.burndownProgressBasin', 'Remaining effort over time')}</p>
          </div>
          {isLoadingTasks ? (
            <ForecastDashboardSectionLoader variant="chart" label={t('dashboard.loadingTasks')} />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_5.5rem]">
                <MetricTile
                  label={t('dashboard.burndownEstimatedCompletion', 'Estimated completion')}
                  value={completionDate}
                  className="bg-primary/10 text-primary ring-primary/20 sm:col-span-1"
                  valueClassName="text-2xl sm:text-3xl"
                />
                <MetricTile
                  label={t('dashboard.burndownRemainingEffort', 'Remaining')}
                  value={formatDays(chartData.remainingDays)}
                  className="bg-white text-slate-950 ring-slate-200"
                />
                <MetricTile
                  label={t('dashboard.burndownTotalEffort', 'Total')}
                  value={formatDays(chartData.totalEstimateDays)}
                  className="bg-white text-slate-950 ring-slate-200 sm:col-start-1 sm:w-24"
                />
              </div>

              <div className="relative pt-1">
                {chartGuideTicks.map((tick) => (
                  <span
                    key={tick.label}
                    className="absolute right-0 z-10 -translate-y-1/2 text-[9px] font-bold text-slate-300"
                    style={{ top: `${(tick.y / CHART_HEIGHT) * 100}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
                <svg className="aspect-[1000/220] w-full overflow-visible" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={t('dashboard.burndownChartAria', 'Remaining task days by date')}>
                  <line x1="0" y1={CHART_TOP} x2={CHART_WIDTH} y2={CHART_TOP} stroke="rgb(226 232 240)" strokeWidth="2" />
                  <line x1="0" y1={CHART_TOP + CHART_PLOT_HEIGHT * 0.5} x2={CHART_WIDTH} y2={CHART_TOP + CHART_PLOT_HEIGHT * 0.5} stroke="rgb(226 232 240)" strokeWidth="2" strokeDasharray="8 8" />
                  <line x1="0" y1={CHART_BOTTOM} x2={CHART_WIDTH} y2={CHART_BOTTOM} stroke="rgb(226 232 240)" strokeWidth="2" />
                  {actualBoundary && (
                    <line x1={actualBoundary.x} y1={CHART_TOP} x2={actualBoundary.x} y2={CHART_BOTTOM} stroke="rgb(203 213 225)" strokeWidth="2" strokeDasharray="4 4" />
                  )}
                  {dateTicks.map((tick) => (
                    <line key={`x-${tick.date}`} x1={tick.x} y1={CHART_BOTTOM} x2={tick.x} y2={CHART_BOTTOM + 9} stroke="rgb(203 213 225)" strokeWidth="2" strokeLinecap="round" />
                  ))}
                  <path d={areaPath(actualPoints)} fill="rgba(79, 70, 229, 0.13)" />
                  <path d={areaPath(projectedPoints)} fill="rgba(234, 179, 8, 0.18)" />
                  <polyline points={pointList(actualPoints)} fill="none" stroke="var(--color-primary)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={pointList(projectedPoints)} fill="none" stroke={projectedColor} strokeWidth="4" strokeDasharray="12 12" strokeLinecap="round" strokeLinejoin="round" />
                  {coordinates.map((point) => (
                    <circle key={point.date} cx={point.x} cy={point.y} r="5" fill={point.future ? projectedColor : 'var(--color-primary)'} stroke="white" strokeWidth="3">
                      <title>{`${point.date}: ${formatDays(point.remainingDays)} ${t('dashboard.burndownRemainingLower', 'remaining')}`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="relative h-7 text-[12px] font-semibold text-slate-500">
                  {dateTicks.map((tick) => (
                    <span
                      key={tick.date}
                      className={`absolute top-1 -translate-x-1/2 whitespace-nowrap ${tick.showLabel ? '' : 'sr-only'}`}
                      style={{ left: `${(tick.x / CHART_WIDTH) * 100}%` }}
                    >
                      {dateFormatter.format(new Date(`${tick.date}T00:00:00`))}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold">
                {selectedProject?.title && (
                  <span className="inline-flex min-w-0 items-center gap-2 truncate text-slate-900" title={selectedProject.title}>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary"></span>
                    <span className="truncate">{selectedProject.title}</span>
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <ChartPill label={t('dashboard.burndownActual', 'Actual')} color="bg-primary" className="bg-primary/10 text-primary" />
                  <ChartPill label={t('dashboard.burndownProjected', 'Projected')} color="bg-yellow-500" className="bg-yellow-50 text-yellow-700" />
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-5">
          <DashboardCard>
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownStatusDays', 'Task Duration by Status')}</h2>
              <p className="text-sm font-medium text-slate-500">{todayLabel}</p>
            </div>
            {isLoadingTasks ? (
              <ForecastDashboardSectionLoader variant="status" label={t('dashboard.loadingTasks')} />
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <DonutGraphic style={donutStyle} percent={donePercent} label={t('dashboard.burndownDone', 'Done')} labelClassName={doneTextColor} />
                <ul className="flex min-w-0 flex-1 flex-col gap-3 text-sm">
                  {statusSegments.map((status) => (
                    <LegendItem
                      key={status.status}
                      label={status.status}
                      percent={`${status.percent}%`}
                      days={formatDays(status.days)}
                      color={status.color}
                      dotClassName={getStatusDotColor(status.status)}
                      badgeClassName={getStatusColor(status.status)}
                    />
                  ))}
                </ul>
              </div>
            )}
          </DashboardCard>

          <DashboardCard>
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownSummaryTitle', 'Effort Remaining')}</h2>
              <p className="text-sm font-medium text-slate-500">{t('dashboard.burndownSummaryHint', 'Completed vs. remaining effort')}</p>
            </div>
            {isLoadingTasks ? (
              <ForecastDashboardSectionLoader variant="status" label={t('dashboard.loadingTasks')} />
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <DonutGraphic
                  style={summaryDonutStyle}
                  percent={remainingPercent}
                  label={t('dashboard.burndownSummaryRemaining', 'Remaining')}
                  labelClassName={getStatusTextColor('Blocked')}
                  valueClassName={getStatusTextColor('Blocked')}
                />
                <ul className="flex min-w-0 flex-1 flex-col gap-3 text-sm">
                  {projectSummarySegments.map((segment) => (
                    <LegendItem
                      key={segment.label}
                      label={segment.label}
                      percent={`${segment.percent}%`}
                      days={formatDays(segment.days)}
                      color={segment.color}
                      dotClassName=""
                      badgeClassName={segment.badgeClassName}
                      labelClassName={segment.textClassName}
                    />
                  ))}
                </ul>
              </div>
            )}
          </DashboardCard>

          <DashboardCard>
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownWorkerLoads', 'Top worker loads')}</h2>
              <p className="text-sm font-medium text-slate-500">{t('dashboard.burndownDailyWorkload', 'Daily workload · next 10 days')}</p>
            </div>
            {isLoadingTasks ? (
              <ForecastDashboardSectionLoader variant="workers" label={t('dashboard.loadingTasks')} />
            ) : (
              <div className="space-y-4">
                {chartData.workerLoads.length ? chartData.workerLoads.map((worker) => (
                  <div key={worker.worker} className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-end gap-3 sm:grid-cols-[8rem_minmax(0,1fr)]">
                    <strong className="truncate text-right text-sm font-bold text-slate-600" title={worker.worker}>{worker.worker}</strong>
                    <div className="min-w-0 space-y-1.5">
                      <div className="grid h-14 grid-cols-10 items-end gap-1.5">
                        {worker.days.map((day) => (
                          <span key={day.date} className="flex h-full items-end rounded-md bg-slate-100" title={`${worker.worker} ${day.date}: ${formatDays(day.loadDays)}`}>
                            <i className="block w-full rounded-md bg-primary/80" style={{ height: `${Math.max(8, Math.round((day.loadDays / maxWorkerLoad) * 100))}%` }}></i>
                          </span>
                        ))}
                      </div>
                      <div className="grid grid-cols-10 gap-1 text-center text-[9px] font-bold leading-none text-slate-400 sm:text-[10px]">
                        {worker.days.map((day, index) => shouldShowWorkerDateLabel(index, worker.days.length, workerDateLabelStep) ? (
                          <span key={`${day.date}-label`} className="truncate" title={day.date}>
                            {dateFormatter.format(new Date(`${day.date}T00:00:00`))}
                          </span>
                        ) : (
                          <span key={`${day.date}-label`} aria-hidden="true"></span>
                        ))}
                      </div>
                    </div>
                  </div>
                )) : (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm font-medium text-slate-500">{t('dashboard.burndownNoOpenWork', 'No open work is scheduled in the next 10 days.')}</p>
                )}
              </div>
            )}
          </DashboardCard>
        </section>

        <DashboardCard ariaLabel={t('dashboard.burndownAssumptions', 'Assumptions')}>
          <div className="mb-5 flex items-center gap-2">
            <h2 className="text-lg font-extrabold uppercase tracking-[0.2em] text-slate-950">{t('dashboard.burndownAssumptions', 'Assumptions')}</h2>
            <button
              type="button"
              className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[11px] font-extrabold italic text-slate-400"
              title={t('dashboard.burndownForecastInputs', 'Forecast inputs')}
              aria-label={t('dashboard.burndownForecastInputs', 'Forecast inputs')}
            >
              i
            </button>
          </div>
          {isLoadingTasks ? (
            <ForecastDashboardSectionLoader variant="assumptions" label={t('dashboard.loadingTasks')} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AssumptionInput label={t('dashboard.burndownAssumptionStartDate', 'Start date')} value={assumptionStartDate} />
                <AssumptionInput label={t('dashboard.burndownAssumptionCapacity', 'Capacity')} value={t('dashboard.burndownAssumptionCapacityValue', '5d / week')} />
                <AssumptionInput label={t('dashboard.burndownAssumptionWorkers', 'Workers')} value={String(assumptionWorkerCount)} className="sm:col-span-2" />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{t('dashboard.burndownTaskStatusRemainingWorkload', 'Task status remaining workload')}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {assumptionStatusWorkloads.map((status, index) => (
                    <AssumptionPercentInput
                      key={status.label}
                      label={status.label}
                      value={status.value}
                      className={index >= 4 ? 'md:col-span-2' : ''}
                    />
                  ))}
                </div>
              </div>
            </>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}

function ForecastDashboardSectionLoader({ variant, label }: { variant: 'chart' | 'status' | 'workers' | 'assumptions'; label: string }) {
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

function DashboardCard({ children, ariaLabel }: { children: ReactNode; ariaLabel?: string }) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-[0_18px_60px_rgba(15,23,42,0.07)] sm:p-5" aria-label={ariaLabel}>
      {children}
    </section>
  );
}

function MetricTile({ label, value, className = '', valueClassName = '' }: { label: string; value: string; className?: string; valueClassName?: string }) {
  return (
    <div className={`rounded-xl px-4 py-3 ring-1 ${className}`}>
      <div className="text-[11px] font-extrabold uppercase tracking-[0.14em] opacity-70">{label}</div>
      <div className={`mt-1 truncate text-xl font-black tracking-normal ${valueClassName}`}>{value}</div>
    </div>
  );
}

function ChartPill({ label, color, className }: { label: string; color: string; className: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-extrabold ${className}`}>
      <span className={`h-2 w-2 rounded-full ${color}`}></span>
      {label}
    </span>
  );
}

function DonutGraphic({
  style,
  percent,
  label,
  labelClassName,
  valueClassName = 'text-primary',
}: {
  style: CSSProperties;
  percent: number;
  label: string;
  labelClassName: string;
  valueClassName?: string;
}) {
  return (
    <div className="relative mx-auto h-36 w-36 shrink-0 rounded-full sm:mx-0" style={style}>
      <div className="absolute inset-5 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-[inset_0_0_0_1px_rgba(226,232,240,0.7)]">
        <span className={`text-3xl font-black tracking-normal ${valueClassName}`}>{percent}%</span>
        <span className={`text-[10px] font-extrabold uppercase tracking-[0.08em] ${labelClassName}`}>{label}</span>
      </div>
    </div>
  );
}

function AssumptionInput({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      <input
        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3 text-base font-extrabold text-slate-950 shadow-sm outline-none"
        readOnly
        value={value}
      />
    </label>
  );
}

function AssumptionPercentInput({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <label className={`block rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm ${className}`}>
      <span className="mb-1.5 block text-[11px] font-semibold text-slate-500">{label}</span>
      <span className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3">
        <input
          className="min-w-0 flex-1 bg-transparent text-lg font-black text-slate-950 outline-none"
          readOnly
          value={value}
        />
        <span className="text-sm font-bold text-slate-400">%</span>
      </span>
    </label>
  );
}

function LegendItem({ label, percent, days, color, dotClassName, badgeClassName, labelClassName = '' }: { label: string; percent: string; days: string; color: string; dotClassName: string; badgeClassName: string; labelClassName?: string }) {
  return (
    <li className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 rounded-lg border px-3 py-2 ${badgeClassName}`}>
      <span className={`inline-flex min-w-0 items-center gap-2 font-semibold ${labelClassName}`}>
        <span className={`h-2.5 w-2.5 rounded-full ${dotClassName}`} style={{ backgroundColor: color }}></span>
        <span className="truncate">{label}</span>
      </span>
      <span className="flex flex-wrap justify-end gap-2">
        <span className="rounded-md bg-white/75 px-2 py-0.5 text-xs font-extrabold text-slate-900 shadow-sm ring-1 ring-black/5">{percent}</span>
        <span className="rounded-md bg-white/55 px-2 py-0.5 text-xs font-bold text-slate-600 shadow-sm ring-1 ring-black/5">{days}</span>
      </span>
    </li>
  );
}
