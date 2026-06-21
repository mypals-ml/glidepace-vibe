/** Shared Tailwind z-index classes for overlapping UI surfaces (low → high). */
export const UI_LAYER = {
  taskDetailsBackdrop: 'z-40',
  taskDetailsPanel: 'z-50',
  header: 'z-[60]',
  headerDropdown: 'z-[70]',
} as const;