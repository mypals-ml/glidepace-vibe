import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDashboard } from '../../../context/DashboardContext';
import { useMediaQuery } from '../../../hooks/useMediaQuery';
import {
  DEFAULT_FORECAST_ASSUMPTIONS,
  normalizeForecastAssumptions,
  type ForecastAssumptions,
} from '../../../lib/forecastAssumptionsConfig';
import { Button } from '../../UI/Button';
import { DEFAULT_WORKER, buildForecastDashboardData } from '../../../lib/forecastDashboardUtils';
import { getStatusChartColor, getStatusColor, getStatusDotColor, getStatusTextColor } from '../../../utils/statusColors';
import {
  CHART_ACTUAL_FILL_OPACITY,
  CHART_BOTTOM,
  CHART_HEIGHT,
  CHART_PLOT_HEIGHT,
  CHART_PROJECTED_FILL_OPACITY,
  CHART_TOP,
  CHART_WIDTH,
  areaPath,
  dateTickCoordinates,
  dateTickLabelClassName,
  dateTickLabelStyle,
  dateTickLabels,
  formatDays,
  formatLocalizedDays,
  formatReadOnlyDate,
  pointCoordinates,
  pointList,
  shouldShowWorkerDateLabel,
  translateForecastStatusLabel,
} from './forecastDashboardChartUtils';
import {
  AssumptionInput,
  AssumptionNumberInput,
  AssumptionPercentInput,
  ChartPill,
  DashboardCard,
  DonutGraphic,
  ForecastDashboardSectionLoader,
  ForecastRulesDialog,
  LegendItem,
  MetricTile,
} from './ForecastDashboardComponents';

export function ForecastDashboard({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation();
  const {
    filteredTasks,
    isLoadingTasks,
    selectedProject,
    forecastAssumptions,
    refreshForecastAssumptionsFromGitHub,
    saveForecastAssumptionsToGitHub,
    isLoadingForecastAssumptions,
    isRefreshingForecastAssumptions,
    isSavingForecastAssumptions,
  } = useDashboard();
  const isCompactWorkerLabels = useMediaQuery('(max-width: 639px)');
  const isNarrowWorkerLabels = useMediaQuery('(max-width: 1023px)');
  const [isForecastRulesOpen, setIsForecastRulesOpen] = useState(false);
  const [isAssumptionsEditing, setIsAssumptionsEditing] = useState(false);
  const [draftAssumptions, setDraftAssumptions] = useState<ForecastAssumptions>(DEFAULT_FORECAST_ASSUMPTIONS);
  const exitEditOnNextAssumptionsUpdateRef = useRef(false);
  const activeAssumptions = isAssumptionsEditing ? draftAssumptions : forecastAssumptions;
  const { capacityDaysPerWeek, statusRemainingPercent } = activeAssumptions;
  const isAssumptionsLoading = isLoadingTasks || isLoadingForecastAssumptions;
  const isAssumptionsActionsBusy = isRefreshingForecastAssumptions || isSavingForecastAssumptions;
  const chartData = useMemo(() => buildForecastDashboardData(filteredTasks, new Date(), activeAssumptions), [filteredTasks, activeAssumptions]);

  useEffect(() => {
    if (exitEditOnNextAssumptionsUpdateRef.current) {
      exitEditOnNextAssumptionsUpdateRef.current = false;
      queueMicrotask(() => {
        setIsAssumptionsEditing(false);
      });
    }
  }, [forecastAssumptions]);

  const handleRefreshAssumptions = async () => {
    const refreshed = await refreshForecastAssumptionsFromGitHub();
    if (isAssumptionsEditing) {
      setDraftAssumptions(normalizeForecastAssumptions(refreshed ?? forecastAssumptions));
    }
  };

  const handleBeginAssumptionsEdit = async () => {
    exitEditOnNextAssumptionsUpdateRef.current = false;
    const refreshed = await refreshForecastAssumptionsFromGitHub();
    setDraftAssumptions(normalizeForecastAssumptions(refreshed ?? forecastAssumptions));
    setIsAssumptionsEditing(true);
  };

  const handleSaveAssumptions = async () => {
    const saved = await saveForecastAssumptionsToGitHub(draftAssumptions);
    if (saved) {
      // Defer exiting edit mode until the next render where the live
      // forecastAssumptions (updated by the save) is visible. This prevents
      // a window where editing=false but the context still holds the pre-save
      // assumptions, which would cause the calc to temporarily revert.
      exitEditOnNextAssumptionsUpdateRef.current = true;
    }
  };
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
                <div className="relative -mt-4 h-7 text-[12px] font-semibold text-slate-500" data-testid="burndown-x-axis-labels">
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
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownAssumptions', 'Assumptions')}</h2>
            {!isAssumptionsLoading && (
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { void handleRefreshAssumptions(); }}
                  disabled={isAssumptionsActionsBusy}
                  aria-label={t('dashboard.burndownAssumptionsRefresh', 'Refresh')}
                >
                  {t('dashboard.burndownAssumptionsRefresh', 'Refresh')}
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    if (isAssumptionsEditing) {
                      void handleSaveAssumptions();
                      return;
                    }
                    void handleBeginAssumptionsEdit();
                  }}
                  disabled={isAssumptionsActionsBusy}
                  aria-label={isAssumptionsEditing
                    ? t('dashboard.burndownAssumptionsSave', 'Save')
                    : t('dashboard.burndownAssumptionsEdit', 'Edit')}
                >
                  {isAssumptionsEditing
                    ? t('dashboard.burndownAssumptionsSave', 'Save')
                    : t('dashboard.burndownAssumptionsEdit', 'Edit')}
                </Button>
              </div>
            )}
          </div>
          {isAssumptionsLoading ? (
            <ForecastDashboardSectionLoader variant="assumptions" label={t('dashboard.loadingTasks')} />
          ) : (
            <div className={isAssumptionsEditing ? '' : 'rounded-xl bg-slate-50/70 p-1'}>
              <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${isAssumptionsEditing ? '' : 'px-1 pt-1'}`}>
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
                  readOnly={!isAssumptionsEditing}
                  onChange={(value) => {
                    setDraftAssumptions((current) => ({
                      ...current,
                      capacityDaysPerWeek: value,
                    }));
                  }}
                />
                <AssumptionInput label={t('dashboard.burndownAssumptionWorkers', 'Workers')} value={String(assumptionWorkerCount)} className="sm:col-span-2" readOnly />
              </div>

              <div className={`mt-5 border-t pt-5 ${isAssumptionsEditing ? 'border-slate-100' : 'border-slate-200/70 px-1 pb-1'}`}>
                <div className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-400">{t('dashboard.burndownTaskStatusRemainingWorkload', 'Task status remaining workload')}</div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-4">
                  {assumptionStatusWorkloads.map((status, index) => (
                    <AssumptionPercentInput
                      key={status.label}
                      label={status.label}
                      status={status.status}
                      value={status.value}
                      className={index >= 4 ? 'md:col-span-2' : ''}
                      readOnly={!isAssumptionsEditing}
                      onChange={(value) => {
                        setDraftAssumptions((current) => ({
                          ...current,
                          statusRemainingPercent: {
                            ...current.statusRemainingPercent,
                            [status.key as keyof typeof current.statusRemainingPercent]: value,
                          },
                        }));
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </DashboardCard>
      </div>
    </div>
  );
}
