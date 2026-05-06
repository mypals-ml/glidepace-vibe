import { lazy, Suspense } from 'react';
import { LoadingSpinner } from './components/UI/LoadingSpinner';
import './i18n'; // Initialize i18n

const ProjectDashboard = lazy(() => import("./components/ProjectDashboard").then(m => ({ default: m.ProjectDashboard })));
const HelpOrgProjects = lazy(() => import("./components/HelpOrgProjects").then(m => ({ default: m.HelpOrgProjects })));

function App() {
  const content = window.location.pathname === '/help/org-projects' 
    ? <HelpOrgProjects /> 
    : <ProjectDashboard />;

  return (
    <Suspense fallback={<LoadingSpinner />}>
      {content}
    </Suspense>
  );
}

export default App;

