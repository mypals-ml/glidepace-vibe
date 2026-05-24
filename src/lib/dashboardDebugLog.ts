type DashboardLogLevel = 'info' | 'warn';

export function logDashboardEvent(
  label: string,
  payload: Record<string, unknown>,
  level: DashboardLogLevel = 'info'
) {
  console[level](`${label} ${JSON.stringify(payload)}`);
}
