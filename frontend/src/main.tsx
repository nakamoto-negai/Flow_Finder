import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import LinkListPage from './LinkListPage';
import LinkImagePage from './LinkImagePage';

const path = window.location.pathname;
const linkImageMatch = path.match(/^\/links\/(\d+)$/);
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {linkImageMatch ? (
      <LinkImagePage linkId={Number(linkImageMatch[1])} />
    ) : path === "/links" ? (
      <LinkListPage />
    ) : (
      <App />
    )}
  </StrictMode>,
)
