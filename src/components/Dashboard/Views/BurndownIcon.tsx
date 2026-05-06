export interface BurndownIconProps {
  className?: string;
  size?: number | string;
}

/**
 * BurndownIcon uses the 'view_timeline' symbol rotated 90 degrees.
 * It strictly maintains the exact same size and line weight as the original Gantt icon.
 */
export function BurndownIcon({ className = "", size = 20 }: BurndownIconProps) {
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
