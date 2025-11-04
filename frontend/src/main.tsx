import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Admin from './Admin.tsx'
import DijkstraTestPage from './DijkstraTestPage.tsx'
import LinkListPage from './LinkListPage';
import LinkImagePage from './LinkImagePage';
import ErrorBoundary from './ErrorBoundary.tsx';

const path = window.location.pathname;
const linkImageMatch = path.match(/^\/links\/(\d+)$/);
createRoot(document.getElementById('root')!).render(
  <>
    {linkImageMatch ? (
      <ErrorBoundary><LinkImagePage linkId={Number(linkImageMatch[1])} /></ErrorBoundary>
    ) : path === "/links" ? (
      <ErrorBoundary><LinkListPage /></ErrorBoundary>
    ) : path === "/admin" ? (
      <ErrorBoundary><Admin /></ErrorBoundary>
    ) : path === "/dijkstra" ? (
      <ErrorBoundary><DijkstraTestPage /></ErrorBoundary>
    ) : (
      <ErrorBoundary><App /></ErrorBoundary>
    )}
  </>
)
