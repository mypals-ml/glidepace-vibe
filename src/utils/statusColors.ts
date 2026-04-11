/**
 * Shared status color utilities using the semantic color tokens
 * defined in index.css (@theme). Used across the app for consistent
 * status styling (Sidebar, TaskDetailsPanel, StatusSelector, etc.).
 */

export function getStatusColor(status: string): string {
  switch (status) {
    case 'Done':
      return 'bg-status-done-bg text-status-done-text border-status-done-border';
    case 'In Progress':
      return 'bg-status-inprogress-bg text-status-inprogress-text border-status-inprogress-border';
    default:
      return 'bg-status-todo-bg text-status-todo-text border-status-todo-border';
  }
}

export function getStatusDotColor(status: string): string {
  switch (status) {
    case 'Done':
      return 'bg-status-done-highlight';
    case 'In Progress':
      return 'bg-status-inprogress-highlight animate-pulse';
    default:
      return 'bg-status-todo-highlight';
  }
}
