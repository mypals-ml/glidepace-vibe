import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './components/UI/LoadingSpinner';
import './i18n'; // Initialize i18n

const GanttDashboard = lazy(() => import("./components/GanttDashboard").then(m => ({ default: m.GanttDashboard })));
const HelpOrgProjects = lazy(() => import("./components/HelpOrgProjects").then(m => ({ default: m.HelpOrgProjects })));

function App() {
  const content = window.location.pathname === '/help/org-projects' 
    ? <HelpOrgProjects /> 
    : <GanttDashboard />;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {content}
    </Suspense>
  );
}

export default App;

