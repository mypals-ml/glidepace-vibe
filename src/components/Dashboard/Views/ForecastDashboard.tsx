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
import { getProjectDisplayTitle, getSavedProjectHistoryTitle } from '../../../lib/projectDisplay';
import { getStatusChartColor, getStatusDotColor, getStatusTextColor } from '../../../utils/statusColors';
import type { User } from '../../../types';
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
  AssumptionWorkerDropdown,
  AssumptionsStorageDialog,
  ChartPill,
  DashboardCard,
  DonutGraphic,
  ForecastInfoButton,
  ForecastDashboardSectionLoader,
  ForecastSectionInfoDialog,
  LegendItem,
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
  const [isAssumptionsStorageOpen, setIsAssumptionsStorageOpen] = useState(false);
  const [openSectionInfo, setOpenSectionInfo] = useState<'completion' | 'chart' | 'summary' | 'status' | null>(null);
  const [chartStartIndex, setChartStartIndex] = useState(0);
  const [chartHoverPoint, setChartHoverPoint] = useState<{ date: string; remainingDays: number; future: boolean; x: number; y: number } | null>(null);
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
      const next = normalizeForecastAssumptions(refreshed ?? forecastAssumptions);
      setDraftAssumptions({
        ...next,
        availableWorkers: next.availableWorkers ?? rawWorkerCount,
      });
    }
  };

  const handleBeginAssumptionsEdit = async () => {
    exitEditOnNextAssumptionsUpdateRef.current = false;
    const refreshed = await refreshForecastAssumptionsFromGitHub();
    const next = normalizeForecastAssumptions(refreshed ?? forecastAssumptions);
    setDraftAssumptions({
      ...next,
      availableWorkers: next.availableWorkers ?? rawWorkerCount,
    });
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

  const handleCancelAssumptionsEdit = () => {
    exitEditOnNextAssumptionsUpdateRef.current = false;
    const next = normalizeForecastAssumptions(forecastAssumptions);
    setDraftAssumptions({
      ...next,
      availableWorkers: next.availableWorkers ?? rawWorkerCount,
    });
    setIsAssumptionsEditing(false);
  };
  // Range slider: trim the chart's start date, but always keep at least the most recent 2 weeks visible.
  const CHART_MIN_VISIBLE_DAYS = 14;
  const chartRangeMaxStartIndex = useMemo(() => {
    const points = chartData.points;
    if (points.length < 2) return 0;
    const lastTime = new Date(`${points[points.length - 1].date}T00:00:00`).getTime();
    let maxIndex = 0;
    for (let index = 0; index < points.length; index += 1) {
      const daysToEnd = (lastTime - new Date(`${points[index].date}T00:00:00`).getTime()) / 86400000;
      if (daysToEnd >= CHART_MIN_VISIBLE_DAYS) maxIndex = index;
      else break;
    }
    return maxIndex;
  }, [chartData.points]);
  const showChartRangeSlider = chartRangeMaxStartIndex > 0;
  const effectiveChartStartIndex = Math.min(chartStartIndex, chartRangeMaxStartIndex);
  const visibleChartPoints = useMemo(
    () => chartData.points.slice(effectiveChartStartIndex),
    [chartData.points, effectiveChartStartIndex],
  );
  const chartRangeStartDate = chartData.points[effectiveChartStartIndex]?.date ?? '';
  // Scale the y-axis to the largest remaining effort within the visible window so the trimmed curve fills the height.
  const chartYMax = useMemo(
    () => Math.max(1, ...visibleChartPoints.map((point) => point.remainingDays)),
    [visibleChartPoints],
  );
  const coordinates = useMemo(() => pointCoordinates(visibleChartPoints, chartYMax), [visibleChartPoints, chartYMax]);
  // The y-axis top equals the remaining workload at the slide-to start day, expressed as a percentage of the total project effort.
  // Exception: when the slide-to date is the project start date, the top is always 100%.
  const chartTopPercent = effectiveChartStartIndex === 0
    ? 100
    : Math.round((chartYMax / Math.max(1, chartData.totalEstimateDays)) * 100);
  const chartGuideTicks = [
    { label: `${chartTopPercent}%`, y: CHART_TOP },
    { label: `${Math.round(chartTopPercent * 0.5)}%`, y: CHART_TOP + CHART_PLOT_HEIGHT * 0.5 },
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
  const completionMonthFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { month: 'short' }), [i18n.language]);
  const completionDayFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { day: 'numeric' }), [i18n.language]);
  const completionWeekdayFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { weekday: 'long' }), [i18n.language]);
  const completionYearFormatter = useMemo(() => new Intl.DateTimeFormat(i18n.language, { year: 'numeric' }), [i18n.language]);
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
  const projectAssignees = useMemo(() => {
    const usersByKey = new Map<string, User>();
    filteredTasks.forEach((task) => {
      task.assignees.forEach((assignee) => {
        if (assignee.id === 'unassigned') return;
        const key = assignee.id || assignee.login || assignee.name;
        if (key) usersByKey.set(key, assignee);
      });
    });
    return [...usersByKey.values()].sort((left, right) => left.name.localeCompare(right.name));
  }, [filteredTasks]);
  const rawWorkerCount = projectAssignees.length;
  const shouldShowWorkerLoads = isLoadingTasks || chartData.workerLoads.some((worker) => worker.worker !== DEFAULT_WORKER);
  const availableWorkers = activeAssumptions.availableWorkers ?? rawWorkerCount;
  const teamCapacityDaysPerWeek = capacityDaysPerWeek * availableWorkers;
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
    },
    {
      label: t('dashboard.burndownSummaryRemaining', 'Remaining'),
      days: chartData.remainingDays,
      color: getStatusChartColor('Blocked'),
      textClassName: getStatusTextColor('Blocked'),
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
  const selectedProjectTitle = getProjectDisplayTitle(
    selectedProject?.title,
    getSavedProjectHistoryTitle(selectedProject?.id, selectedProject?.accountId),
  );
  const selectedProjectDisplayTitle = selectedProjectTitle || t('dashboard.burndownCompletionCurrentProject', 'Current project');
  const completionValue = completionDate || t('dashboard.burndownCompletionUnavailable', 'Not available');
  const completionDateObject = chartData.completionDate ? new Date(`${chartData.completionDate}T00:00:00`) : null;
  const completionDateParts = completionDateObject
    ? {
        month: completionMonthFormatter.format(completionDateObject),
        day: completionDayFormatter.format(completionDateObject),
        weekday: completionWeekdayFormatter.format(completionDateObject),
        year: completionYearFormatter.format(completionDateObject),
      }
    : null;
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

        <div className="flex flex-col gap-5 lg:flex-row lg:items-stretch">
          <section className="relative min-w-0 overflow-hidden rounded-[1.5rem] border-0 bg-white shadow-forecast-highlight lg:flex-1 lg:basis-0" aria-label={t('dashboard.burndownEstimatedCompletion', 'Estimated completion')}>
            <div className="relative p-4 sm:p-5">
              <div className="mb-4">
                <div className="flex items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownEstimatedCompletion', 'Estimated completion')}</h2>
                  <ForecastInfoButton
                    label={t('dashboard.burndownCompletionInfoAria', 'How the completion date is calculated')}
                    onClick={() => setOpenSectionInfo('completion')}
                  />
                </div>
                <p className="text-sm font-medium text-slate-500">{t('dashboard.burndownCompletionHeroTitle', 'When your project is on track to finish')}</p>
              </div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  {isLoadingTasks ? (
                    <ForecastDashboardSectionLoader variant="completion" label={t('dashboard.loadingTasks')} />
                  ) : completionDateParts ? (
                    <div className="flex w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
                      <div className="bg-primary py-1.5 text-center text-sm font-extrabold uppercase tracking-[0.16em] text-white sm:text-base">{completionDateParts.month}</div>
                      <div className="px-4 pb-2 pt-3">
                        <div className="text-center">
                          <span className="text-6xl font-black leading-none tracking-tight text-slate-900 sm:text-7xl">{completionDateParts.day}</span>
                        </div>
                        <div className="mt-3 flex items-end justify-between gap-2 text-xs font-semibold text-slate-500">
                          <span>{completionDateParts.year}</span>
                          <span>{completionDateParts.weekday}</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="min-w-0 text-4xl font-black leading-[1.05] tracking-tight text-primary sm:text-5xl">{completionValue}</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="min-w-0 rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-forecast-card sm:p-5 lg:flex-1 lg:basis-0" aria-label={t('dashboard.burndownSummaryTitle', 'Effort Remaining')}>
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownSummaryTitle', 'Effort Remaining')}</h2>
                <ForecastInfoButton
                  label={t('dashboard.burndownSummaryInfoAria', 'How effort remaining is calculated')}
                  onClick={() => setOpenSectionInfo('summary')}
                />
              </div>
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
                  hideLabel
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
                      labelClassName={segment.textClassName}
                    />
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>

        <section className="rounded-[1.25rem] border border-slate-200/80 bg-white p-4 shadow-forecast-highlight sm:p-5" aria-label={t('dashboard.burndownByDate', 'Burndown by date')}>
          <div className="mb-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownChartTitle', 'Burndown Chart')}</h2>
              <ForecastInfoButton
                label={t('dashboard.burndownChartInfoAria', 'How the burndown chart is calculated')}
                onClick={() => setOpenSectionInfo('chart')}
              />
            </div>
            <p className="text-sm font-medium text-slate-500">{t('dashboard.burndownProgressBasin', 'Remaining effort over time')}</p>
          </div>
          {isLoadingTasks ? (
            <ForecastDashboardSectionLoader variant="chart" label={t('dashboard.loadingTasks')} />
          ) : (
            <div className="space-y-5">
              {showChartRangeSlider && (
                <div className="flex items-center gap-3" data-testid="burndown-range-slider">
                  <span className="shrink-0 text-xs font-semibold text-slate-500">
                    {t('dashboard.burndownChartRangeFrom', 'From')}{' '}
                    <span className="font-bold text-slate-700">{chartRangeStartDate ? dateFormatter.format(new Date(`${chartRangeStartDate}T00:00:00`)) : ''}</span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={chartRangeMaxStartIndex}
                    step={1}
                    value={effectiveChartStartIndex}
                    onChange={(event) => setChartStartIndex(Number(event.target.value))}
                    className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-primary"
                    aria-label={t('dashboard.burndownChartRangeAria', 'Adjust the chart start date')}
                  />
                </div>
              )}
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
                <div className="relative">
                <svg
                  className="aspect-[1000/220] w-full overflow-visible"
                  viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                  role="img"
                  aria-label={t('dashboard.burndownChartAria', 'Remaining task days by date')}
                  onMouseMove={(event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    if (!rect.width || coordinates.length === 0) return;
                    const fraction = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
                    const index = Math.round(fraction * (coordinates.length - 1));
                    setChartHoverPoint(coordinates[index] ?? null);
                  }}
                  onMouseLeave={() => setChartHoverPoint(null)}
                >
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
                    <circle key={point.date} cx={point.x} cy={point.y} r="5" fill="transparent" stroke="none">
                      <title>{`${point.date}: ${formatDays(point.remainingDays)} ${t('dashboard.burndownRemainingLower', 'remaining')}`}</title>
                    </circle>
                  ))}
                  {actualBoundary && (
                    <circle cx={actualBoundary.x} cy={actualBoundary.y} r="6" className="fill-primary stroke-white" strokeWidth="3">
                      <title>{`${actualBoundary.date}: ${formatDays(actualBoundary.remainingDays)} ${t('dashboard.burndownRemainingLower', 'remaining')}`}</title>
                    </circle>
                  )}
                  {chartHoverPoint && (
                    <g pointerEvents="none">
                      <line x1={chartHoverPoint.x} y1={CHART_TOP} x2={chartHoverPoint.x} y2={CHART_BOTTOM} className={chartHoverPoint.future ? '' : 'stroke-primary'} stroke={chartHoverPoint.future ? projectedColor : undefined} strokeWidth="2" strokeDasharray="4 4" />
                      <circle cx={chartHoverPoint.x} cy={chartHoverPoint.y} r="6" stroke="white" strokeWidth="3" className={chartHoverPoint.future ? '' : 'fill-primary'} fill={chartHoverPoint.future ? projectedColor : undefined} />
                    </g>
                  )}
                </svg>
                {chartHoverPoint && (
                  <div
                    className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-center shadow-md"
                    style={{ left: `${(chartHoverPoint.x / CHART_WIDTH) * 100}%`, top: `${(chartHoverPoint.y / CHART_HEIGHT) * 100}%` }}
                  >
                    <div className="text-xs font-extrabold text-slate-900">
                      {Math.round((chartHoverPoint.remainingDays / Math.max(1, chartData.totalEstimateDays)) * 100)}% · {formatDays(chartHoverPoint.remainingDays)}
                    </div>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {dateFormatter.format(new Date(`${chartHoverPoint.date}T00:00:00`))}
                    </div>
                  </div>
                )}
                </div>
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

              <div className="flex flex-wrap items-center justify-between gap-4 text-sm font-bold" data-testid="burndown-chart-legend">
                <p className="min-w-0 truncate text-xs font-extrabold text-slate-700" title={selectedProjectDisplayTitle}>{selectedProjectDisplayTitle}</p>
                <div className="flex flex-wrap items-center gap-4">
                  <ChartPill label={t('dashboard.burndownActual', 'Actual')} color="bg-primary" />
                  <ChartPill label={t('dashboard.burndownProjected', 'Projected')} color={getStatusDotColor('Blocked')} />
                </div>
              </div>
            </div>
          )}
        </section>

        <ForecastSectionInfoDialog
          isOpen={openSectionInfo === 'completion'}
          onClose={() => setOpenSectionInfo(null)}
          eyebrow={t('dashboard.burndownCompletionInfoEyebrow', 'Estimated completion')}
          title={t('dashboard.burndownCompletionInfoTitle', 'How the completion date is calculated')}
          notes={[
            t('dashboard.burndownRulesCompletion', 'Estimated completion uses the remaining workload allocated across available workers and the capacity assumption in days per week. The latest worker completion date becomes the project completion date.'),
            t('dashboard.burndownRulesWorkers', 'Tasks with assignees split workload evenly across those assignees. Unassigned work is spread across active assignees, or one virtual worker when no assignees exist.'),
          ]}
        />

        <ForecastSectionInfoDialog
          isOpen={openSectionInfo === 'chart'}
          onClose={() => setOpenSectionInfo(null)}
          eyebrow={t('dashboard.burndownChartInfoEyebrow', 'Burndown chart')}
          title={t('dashboard.burndownChartInfoTitle', 'How the burndown chart is calculated')}
          notes={[
            t('dashboard.burndownChartInfoActual', 'The solid actual line plots the remaining workload measured at each past date, so its slope reflects how quickly completed work has reduced the backlog up to today.'),
            t('dashboard.burndownRulesProjected', 'The projected line simulates future workday burn-down from today using the same worker allocation and capacity. The line reaches zero on the estimated completion date.'),
          ]}
        />

        <section className="flex flex-col gap-5">
          <DashboardCard>
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownStatusDays', 'Work Loads by Task Status')}</h2>
                <ForecastInfoButton
                  label={t('dashboard.burndownStatusInfoAria', 'How workload by task status is calculated')}
                  onClick={() => setOpenSectionInfo('status')}
                />
              </div>
              <p className="text-sm font-medium text-slate-500">{todayLabel}</p>
            </div>
            {isLoadingTasks ? (
              <ForecastDashboardSectionLoader variant="status" label={t('dashboard.loadingTasks')} />
            ) : (
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <DonutGraphic style={donutStyle} fallbackClassName="bg-slate-200" percent={donePercent} label={t('dashboard.burndownDone', 'Done')} labelClassName={doneTextColor} valueClassName={doneTextColor} hideLabel />
                <ul className="flex min-w-0 flex-1 flex-col gap-3 text-sm">
                  {statusSegments.map((status) => (
                    <LegendItem
                      key={status.status}
                      label={translateForecastStatusLabel(status.status, status.statusKey, t)}
                      percent={`${status.percent}%`}
                      days={formatLocalizedDays(status.days, t)}
                      color={status.color}
                      dotClassName={getStatusDotColor(status.status)}
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
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-slate-950">{t('dashboard.burndownAssumptions', 'Assumptions')}</h2>
            </div>
            <div className="flex items-center gap-2">
              {!isAssumptionsLoading && (
                isAssumptionsEditing ? (
                  <>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => { void handleSaveAssumptions(); }}
                      disabled={isAssumptionsActionsBusy}
                      aria-label={t('dashboard.burndownAssumptionsSave', 'Save')}
                    >
                      {t('dashboard.burndownAssumptionsSave', 'Save')}
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleCancelAssumptionsEdit}
                      disabled={isAssumptionsActionsBusy}
                      aria-label={t('dashboard.burndownAssumptionsCancel', 'Cancel')}
                    >
                      {t('dashboard.burndownAssumptionsCancel', 'Cancel')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      leftIcon="sync"
                      onClick={() => { void handleRefreshAssumptions(); }}
                      disabled={isAssumptionsActionsBusy}
                      className="px-2 lg:px-4 justify-center relative transition-all duration-300 bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      aria-label={t('dashboard.burndownAssumptionsSync', 'Sync')}
                    >
                      {t('dashboard.burndownAssumptionsSync', 'Sync')}
                    </Button>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => { void handleBeginAssumptionsEdit(); }}
                      disabled={isAssumptionsActionsBusy}
                      aria-label={t('dashboard.burndownAssumptionsEdit', 'Edit')}
                    >
                      {t('dashboard.burndownAssumptionsEdit', 'Edit')}
                    </Button>
                  </>
                )
              )}
              <ForecastInfoButton
                label={t('dashboard.burndownAssumptionsStorageInfoAria', 'Where assumptions are saved')}
                onClick={() => setIsAssumptionsStorageOpen(true)}
              />
            </div>
          </div>
          <AssumptionsStorageDialog
            isOpen={isAssumptionsStorageOpen}
            onClose={() => setIsAssumptionsStorageOpen(false)}
          />
          <ForecastSectionInfoDialog
            isOpen={openSectionInfo === 'summary'}
            onClose={() => setOpenSectionInfo(null)}
            eyebrow={t('dashboard.burndownSummaryInfoEyebrow', 'Effort remaining')}
            title={t('dashboard.burndownSummaryInfoTitle', 'How effort remaining is calculated')}
            notes={[
              t('dashboard.burndownSummaryInfoCompleted', 'Completed effort is the total estimated effort minus the remaining effort. The ring shows how much work is still left across the project.'),
              t('dashboard.burndownSummaryInfoRemaining', 'Remaining effort uses task estimates when available, otherwise task duration. Each open task is weighted by the remaining-workload percentage configured in Assumptions.'),
            ]}
          />
          <ForecastSectionInfoDialog
            isOpen={openSectionInfo === 'status'}
            onClose={() => setOpenSectionInfo(null)}
            eyebrow={t('dashboard.burndownStatusInfoEyebrow', 'Task status workload')}
            title={t('dashboard.burndownStatusInfoTitle', 'How workload by task status is calculated')}
            notes={[
              t('dashboard.burndownStatusInfoGrouping', 'This section groups the project effort by each task status, such as Done, Draft, Todo, In progress, and other project-specific statuses.'),
              t('dashboard.burndownStatusInfoPercent', 'Percentages are based on each status group’s effort compared with the total project effort. The day value is the summed estimate or duration for tasks in that status.'),
            ]}
          />
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
                <AssumptionWorkerDropdown
                  label={t('dashboard.burndownAssumptionWorkers', 'Project assignees')}
                  value={String(rawWorkerCount)}
                  users={projectAssignees}
                  fallbackLabel={DEFAULT_WORKER}
                />
                <AssumptionNumberInput
                  label={t('dashboard.burndownAssumptionAvailableWorkers', 'Available Workers')}
                  value={availableWorkers}
                  min={0}
                  max={100}
                  step={1}
                  readOnly={!isAssumptionsEditing}
                  onChange={(value) => {
                    setDraftAssumptions((current) => ({
                      ...current,
                      availableWorkers: value,
                    }));
                  }}
                />
                <AssumptionNumberInput
                  label={t('dashboard.burndownAssumptionCapacity', 'Capacity per worker')}
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
                <AssumptionInput
                  label={t('dashboard.burndownAssumptionTeamCapacity', 'Capacity of the team')}
                  value={`${Number(teamCapacityDaysPerWeek.toFixed(1)).toString()} ${t('dashboard.burndownAssumptionCapacityUnit', 'd / week')}`}
                  readOnly
                />
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
