import { GanttDashboard } from "./components/GanttDashboard";
import { HelpOrgProjects } from "./components/HelpOrgProjects";
import './i18n'; // Initialize i18n

function App() {
  if (window.location.pathname === '/help/org-projects') {
    return <HelpOrgProjects />;
  }
  
  return (
    <GanttDashboard />
  );
}

export default App;
