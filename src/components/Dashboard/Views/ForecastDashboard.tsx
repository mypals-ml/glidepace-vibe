import { useId, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import { DEFAULT_WORKER, buildForecastDashboardData, type ForecastPoint, type ForecastStatusKey } from '../../../lib/forecastDashboardUtils';
import { getStatusAssumptionClasses, getStatusChartColor, getStatusColor, getStatusDotColor, getStatusTextColor } from '../../../utils/statusColors';

const CHART_WIDTH = 1000;
const CHART_HEIGHT = 220;
const CHART_TOP = 14;
const CHART_BOTTOM = 198;
const CHART_PLOT_HEIGHT = CHART_BOTTOM - CHART_TOP;
const CHART_ACTUAL_FILL_OPACITY = 0.22;
const CHART_PROJECTED_FILL_OPACITY = 0.2;

function formatDays(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}d`;
}

function formatLocalizedDays(value: number, t: TFunction) {
  const count = value.toFixed(value % 1 === 0 ? 0 : 1);
  const template = t('dashboard.burndownDaysValue', { count, defaultValue: '{{count}}d' });
  return typeof template === 'string' ? template.replace('{{count}}', count) : `${count}d`;
}

function normalizeForecastStatusLabel(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, ' ');
}

function translateForecastStatusLabel(status: string, statusKey: ForecastStatusKey, t: TFunction) {
  const translationByStatus: Record<string, { key: string; defaultValue: string }> = {
    draft: { key: 'dashboard.burndownAssumptionDraft', defaultValue: 'Draft' },
    todo: { key: 'dashboard.burndownAssumptionTodo', defaultValue: 'Todo' },
    'to do': { key: 'dashboard.burndownAssumptionTodo', defaultValue: 'Todo' },
    backlog: { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    open: { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    'not started': { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    'in progress': { key: 'dashboard.burndownAssumptionInProgress', defaultValue: 'In progress' },
    'in review': { key: 'dashboard.burndownAssumptionInReview', defaultValue: 'In review' },
    review: { key: 'dashboard.burndownAssumptionInReview', defaultValue: 'In review' },
    wip: { key: 'dashboard.burndownInFlight', defaultValue: 'In progress or review' },
    done: { key: 'dashboard.burndownAssumptionDone', defaultValue: 'Done' },
    closed: { key: 'dashboard.burndownDone', defaultValue: 'Done' },
    completed: { key: 'dashboard.burndownDone', defaultValue: 'Done' },
    merged: { key: 'dashboard.burndownDone', defaultValue: 'Done' },
    blocked: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    'on hold': { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    cancelled: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    canceled: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
    other: { key: 'dashboard.burndownAssumptionOther', defaultValue: 'Other' },
  };
  const exactTranslation = translationByStatus[normalizeForecastStatusLabel(status)];
  if (exactTranslation) {
    return t(exactTranslation.key, exactTranslation.defaultValue);
  }

  const translationByStatusKey: Record<ForecastStatusKey, { key: string; defaultValue: string }> = {
    done: { key: 'dashboard.burndownAssumptionDone', defaultValue: 'Done' },
    todo: { key: 'dashboard.burndownTodo', defaultValue: 'Todo' },
    inFlight: { key: 'dashboard.burndownInFlight', defaultValue: 'In progress or review' },
  };

  const fallbackTranslation = translationByStatusKey[statusKey];
  return t(fallbackTranslation.key, fallbackTranslation.defaultValue);
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

type DateTickLabel = ForecastPoint & {
  x: number;
  y: number;
  labelKind: 'start' | 'today' | 'completion';
};

function dateTickCoordinates(points: Array<ForecastPoint & { x: number; y: number }>) {
  const first = points[0];
  const last = points[points.length - 1];
  const actualBoundary = [...points].reverse().find((point) => !point.future);
  return [first, actualBoundary, last].filter((tick, index, ticks): tick is ForecastPoint & { x: number; y: number } => {
    if (!tick) return false;
    return ticks.findIndex((candidate) => candidate?.date === tick.date) === index;
  });
}

function dateTickLabels(points: Array<ForecastPoint & { x: number; y: number }>): DateTickLabel[] {
  const first = points[0];
  const last = points[points.length - 1];
  const actualBoundary = [...points].reverse().find((point) => !point.future);
  if (!first || !last) return [];

  const labels: DateTickLabel[] = [{ ...first, labelKind: 'start' }];
  if (last.date !== first.date) {
    labels.push({ ...last, labelKind: 'completion' });
  }
  if (actualBoundary && actualBoundary.date !== first.date && actualBoundary.date !== last.date) {
    labels.push({ ...actualBoundary, labelKind: 'today' });
  }
  return labels;
}

function dateTickLabelClassName(labelKind: DateTickLabel['labelKind'], x: number) {
  if (labelKind === 'start') return 'absolute left-0 top-1 whitespace-nowrap text-left';
  if (labelKind === 'completion') return 'absolute right-0 top-1 whitespace-nowrap text-right';
  return x < CHART_WIDTH / 2
    ? 'absolute top-1 translate-x-2 whitespace-nowrap text-left text-primary'
    : 'absolute top-1 -translate-x-[calc(100%+0.5rem)] whitespace-nowrap text-right text-primary';
}

function dateTickLabelStyle(labelKind: DateTickLabel['labelKind'], x: number): CSSProperties | undefined {
  if (labelKind !== 'today') return undefined;
  return { left: `${(x / CHART_WIDTH) * 100}%` };
}

function formatReadOnlyDate(value: string) {
  return value ? value.replaceAll('-', '/') : '-';
}

function shouldShowWorkerDateLabel(index: number, total: number, step: number) {
  return index === 0 || index === total - 1 || index % step === 0;
}

export function ForecastDashboard({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const { filteredTasks, isLoadingTasks, selectedProject } = useDashboard();
  const isCompactWorkerLabels = useMediaQuery('(max-width: 639px)');
  const isNarrowWorkerLabels = useMediaQuery('(max-width: 1023px)');
  const [isForecastRulesOpen, setIsForecastRulesOpen] = useState(false);
  const [capacityDaysPerWeek, setCapacityDaysPerWeek] = useState(5);
  const [statusRemainingPercent, setStatusRemainingPercent] = useState({
    draft: 0,
    todo: 100,
    inProgress: 50,
    inReview: 20,
    done: 0,
    other: 50,
  });
  const forecastAssumptions = useMemo(() => ({
    capacityDaysPerWeek,
    statusRemainingPercent,
  }), [capacityDaysPerWeek, statusRemainingPercent]);
  const chartData = useMemo(() => buildForecastDashboardData(filteredTasks, new Date(), forecastAssumptions), [filteredTasks, forecastAssumptions]);
  const coordinates = useMemo(() => pointCoordinates(chartData.points, chartData.totalEstimateDays), [chartData.points, chartData.totalEstimateDays]);
  const chartGuideTicks = [
    { label: '100%', y: CHART_TOP },
    { label: '50%', y: CHART_TOP + CHART_PLOT_HEIGHT * 0.5 },
  ];
  const dateTicks = dateTickCoordinates(coordinates);
  const xAxisLabels = dateTickLabels(coordinates);
  const actualPoints = coordinates.filter((point) => !point.future);
  const projectedPoints = coordinates.filter((point) => point.future);
  if (actualPoints.length && projectedPoints.length) {
    projectedPoints.unshift(actualPoints[actualPoints.length - 1]);
  }

  const dateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'short', day: '2-digit' }), [i18n.language]);
  const completionDateFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', year: 'numeric', month: 'short', day: '2-digit' }), [i18n.language]);
  const completionDate = chartData.completionDate
    ? completionDateFormatter.format(new Date(`${chartData.completionDate}T00:00:00`))
    : '';
  const todayLabel = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date()), [i18n.language]);
  const maxWorkerLoad = Math.max(1, ...chartData.workerLoads.flatMap((worker) => worker.days.map((day) => day.loadDays)));
  const totalEstimate = Math.max(1, chartData.totalEstimateDays);
  const projectedColor = getStatusChartColor('Blocked');
  const chartFillGradientId = useId().replace(/:/g, '');
  const actualFillGradientId = `${chartFillGradientId}-actual`;
  const projectedFillGradientId = `${chartFillGradientId}-projected`;
  const doneTextColor = getStatusTextColor('Done');
  const workerDateLabelStep = isCompactWorkerLabels ? 3 : isNarrowWorkerLabels ? 2 : 1;
  const assumptionStartDateValue = formatReadOnlyDate(chartData.points[0]?.date || '');
  const rawWorkerCount = new Set(chartData.tasks.flatMap((task) => task.assignees).filter((assignee) => assignee !== DEFAULT_WORKER)).size;
  const shouldShowWorkerLoads = isLoadingTasks || chartData.workerLoads.some((worker) => worker.worker !== DEFAULT_WORKER);
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
  const donutStyle = conicStops.length
    ? { background: `conic-gradient(${conicStops.join(', ')})` }
    : undefined;

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
  const summaryDonutStyle = summaryConicStops.length
    ? { background: `conic-gradient(${summaryConicStops.join(', ')})` }
    : undefined;
  const remainingPercent = Math.round((chartData.remainingDays / totalEstimate) * 100);
  const actualBoundary = actualPoints[actualPoints.length - 1];
  const assumptionStatusWorkloads = [
    { key: 'draft', status: 'Draft', label: t('dashboard.burndownAssumptionDraft', 'Draft'), value: statusRemainingPercent.draft },
    { key: 'todo', status: 'Todo', label: t('dashboard.burndownAssumptionTodo', 'Todo'), value: statusRemainingPercent.todo },
    { key: 'inProgress', status: 'In progress', label: t('dashboard.burndownAssumptionInProgress', 'In progress'), value: statusRemainingPercent.inProgress },
    { key: 'inReview', status: 'In review', label: t('dashboard.burndownAssumptionInReview', 'In review'), value: statusRemainingPercent.inReview },
    { key: 'done', status: 'Done', label: t('dashboard.burndownAssumptionDone', 'Done'), value: statusRemainingPercent.done },
    { key: 'other', status: 'Other', label: t('dashboard.burndownAssumptionOther', 'Other'), value: statusRemainingPercent.other },
  ];

  return (
    <div className={`flex-1 min-h-0 overflow-y-auto custom-scrollbar bg-forecast-background md:rounded-r-xl border md:border-y md:border-r border-slate-200/60 ${className}`}>
      <div className="pointer-events-none sticky top-0 z-0 h-0">
        <div className="forecast-canvas-grid absolute inset-x-0 top-0 h-[36rem]"></div>
        <div className="absolute left-1/2 top-8 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl"></div>
      </div>
      <div className="relative z-10 mx-auto flex min-h-full w-full max-w-4xl flex-col gap-5 px-4 pb-6 pt-10 sm:px-6 lg:pb-8 lg:pt-12">
        <header>
          <h1 className="pl-2 text-2xl font-extrabold tracking-normal text-slate-950 sm:pl-3 sm:text-3xl">{t('dashboard.forecastDashboardTitle', 'Forecast Dashboard')}</h1>
        </header>

        <section className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-forecast-highlight sm:p-5" aria-label={t('dashboard.burndownByDate', 'Burndown by date')}>
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownChartTitle', 'Burndown Chart')}</h2>
            <p className="text-sm font-medium text-slate-500">{t('dashboard.burndownProgressBasin', 'Remaining effort over time')}</p>
          </div>
          {isLoadingTasks ? (
            <ForecastDashboardSectionLoader variant="chart" label={t('dashboard.loadingTasks')} />
          ) : (
            <div className="space-y-5">
              <div className="grid gap-3">
                <MetricTile
                  label={t('dashboard.burndownEstimatedCompletion', 'Estimated completion')}
                  value={completionDate}
                  className="bg-primary/10 text-primary ring-primary/20 sm:col-span-1"
                  valueClassName="text-2xl sm:text-3xl"
                  infoLabel={t('dashboard.burndownRulesInfoAria', 'How forecast calculations work')}
                  onInfoClick={() => setIsForecastRulesOpen(true)}
                />
              </div>

              <div className="relative pt-1">
                {chartGuideTicks.map((tick, index) => (
                  <span
                    key={tick.label}
                    className={`absolute right-0 z-10 text-[9px] font-bold text-slate-300 ${index === 0 ? 'translate-y-1' : '-translate-y-1/2'}`}
                    style={{ top: `${(tick.y / CHART_HEIGHT) * 100}%` }}
                  >
                    {tick.label}
                  </span>
                ))}
                <svg className="aspect-[1000/220] w-full overflow-visible" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`} role="img" aria-label={t('dashboard.burndownChartAria', 'Remaining task days by date')}>
                  <defs>
                    <linearGradient id={actualFillGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={CHART_ACTUAL_FILL_OPACITY} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id={projectedFillGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={projectedColor} stopOpacity={CHART_PROJECTED_FILL_OPACITY} />
                      <stop offset="100%" stopColor={projectedColor} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <line x1="0" y1={CHART_TOP} x2={CHART_WIDTH} y2={CHART_TOP} className="stroke-slate-200" strokeWidth="2" />
                  <line x1="0" y1={CHART_TOP + CHART_PLOT_HEIGHT * 0.5} x2={CHART_WIDTH} y2={CHART_TOP + CHART_PLOT_HEIGHT * 0.5} className="stroke-slate-200" strokeWidth="2" strokeDasharray="8 8" />
                  <line x1="0" y1={CHART_BOTTOM} x2={CHART_WIDTH} y2={CHART_BOTTOM} className="stroke-slate-200" strokeWidth="2" />
                  {actualBoundary && (
                    <line x1={actualBoundary.x} y1={CHART_TOP} x2={actualBoundary.x} y2={CHART_BOTTOM} className="stroke-primary/35" strokeWidth="2" strokeDasharray="4 4" />
                  )}
                  {dateTicks.map((tick) => (
                    <line key={`x-${tick.date}`} x1={tick.x} y1={CHART_BOTTOM} x2={tick.x} y2={CHART_BOTTOM + 9} className="stroke-slate-300" strokeWidth="2" strokeLinecap="round" />
                  ))}
                  <path d={areaPath(actualPoints)} fill={`url(#${actualFillGradientId})`} />
                  <path d={areaPath(projectedPoints)} fill={`url(#${projectedFillGradientId})`} />
                  <polyline points={pointList(actualPoints)} fill="none" className="stroke-primary" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                  <polyline points={pointList(projectedPoints)} fill="none" stroke={projectedColor} strokeWidth="4" strokeDasharray="12 12" strokeLinecap="round" strokeLinejoin="round" />
                  {coordinates.map((point) => (
                    <circle key={point.date} cx={point.x} cy={point.y} r="5" className={`stroke-white ${point.future ? '' : 'fill-primary'}`} fill={point.future ? projectedColor : undefined} strokeWidth="3">
                      <title>{`${point.date}: ${formatDays(point.remainingDays)} ${t('dashboard.burndownRemainingLower', 'remaining')}`}</title>
                    </circle>
                  ))}
                </svg>
                <div className="relative h-7 text-[12px] font-semibold text-slate-500" data-testid="burndown-x-axis-labels">
                  {xAxisLabels.map((tick) => (
                    <span
                      key={`${tick.labelKind}-${tick.date}`}
                      className={dateTickLabelClassName(tick.labelKind, tick.x)}
                      style={dateTickLabelStyle(tick.labelKind, tick.x)}
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
                  <ChartPill label={t('dashboard.burndownProjected', 'Projected')} color={getStatusDotColor('Blocked')} className={getStatusColor('Blocked')} />
                </div>
              </div>
            </div>
          )}
        </section>

        <ForecastRulesDialog
          isOpen={isForecastRulesOpen}
          onClose={() => setIsForecastRulesOpen(false)}
        />

        <section className="flex flex-col gap-5">
          <DashboardCard>
            <div className="mb-4">
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownStatusDays', 'Work Loads by Task Status')}</h2>
              <p className="text-sm font-medium text-slate-500">{todayLabel}</p>
            </div>
            {isLoadingTasks ? (
              <ForecastDashboardSectionLoader variant="status" label={t('dashboard.loadingTasks')} />
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <DonutGraphic style={donutStyle} fallbackClassName="bg-slate-200" percent={donePercent} label={t('dashboard.burndownDone', 'Done')} labelClassName={doneTextColor} />
                <ul className="flex min-w-0 flex-1 flex-col gap-3 text-sm">
                  {statusSegments.map((status) => (
                    <LegendItem
                      key={status.status}
                      label={translateForecastStatusLabel(status.status, status.statusKey, t)}
                      percent={`${status.percent}%`}
                      days={formatLocalizedDays(status.days, t)}
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
                  fallbackClassName="bg-slate-200"
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
                      days={formatLocalizedDays(segment.days, t)}
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

          {shouldShowWorkerLoads && (
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
          )}
        </section>

        <DashboardCard ariaLabel={t('dashboard.burndownAssumptions', 'Assumptions')}>
          <div className="mb-5">
            <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownAssumptions', 'Assumptions')}</h2>
          </div>
          {isLoadingTasks ? (
            <ForecastDashboardSectionLoader variant="assumptions" label={t('dashboard.loadingTasks')} />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <AssumptionInput
                  label={t('dashboard.burndownAssumptionStartDate', 'Start date')}
                  value={assumptionStartDateValue}
                  readOnly
                />
                <AssumptionNumberInput
                  label={t('dashboard.burndownAssumptionCapacity', 'Capacity')}
                  value={capacityDaysPerWeek}
                  min={0.1}
                  max={35}
                  step={0.1}
                  suffix={t('dashboard.burndownAssumptionCapacityUnit', 'd / week')}
                  onChange={setCapacityDaysPerWeek}
                />
                <AssumptionInput label={t('dashboard.burndownAssumptionWorkers', 'Workers')} value={String(assumptionWorkerCount)} className="sm:col-span-2" readOnly />
              </div>

              <div className="mt-5 border-t border-slate-100 pt-5">
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{t('dashboard.burndownTaskStatusRemainingWorkload', 'Task status remaining workload')}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {assumptionStatusWorkloads.map((status, index) => (
                    <AssumptionPercentInput
                      key={status.label}
                      label={status.label}
                      status={status.status}
                      value={status.value}
                      className={index >= 4 ? 'md:col-span-2' : ''}
                      onChange={(value) => {
                        setStatusRemainingPercent((current) => ({
                          ...current,
                          [status.key]: value,
                        }));
                      }}
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
    <section className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-forecast-card sm:p-5" aria-label={ariaLabel}>
      {children}
    </section>
  );
}

function MetricTile({
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

function ForecastRulesDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
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

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function AssumptionInput({
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

function AssumptionNumberInput({
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

function AssumptionPercentInput({
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

function LegendItem({ label, percent, days, color, dotClassName, badgeClassName, labelClassName = '' }: { label: string; percent: string; days: string; color: string; dotClassName: string; badgeClassName: string; labelClassName?: string }) {
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
