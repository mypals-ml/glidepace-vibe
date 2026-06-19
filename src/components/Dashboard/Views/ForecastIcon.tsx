export interface ForecastIconProps {
  className?: string;
  size?: number | string;
}

/**
 * ForecastIcon uses the 'view_timeline' symbol rotated 90 degrees.
 * It strictly maintains the exact same size and line weight as the original Gantt icon.
 */
export function ForecastIcon({ className = "", size = 20 }: ForecastIconProps) {
  return (
    <span 
      className={`material-symbols-outlined select-none inline-block ${className}`}
      style={{ 
        fontSize: typeof size === 'number' ? `${size}px` : size,
        transform: 'rotate(90deg) scale(1.35)'
      }}
      aria-hidden="true"
    >
      view_timeline
    </span>
  );
}
