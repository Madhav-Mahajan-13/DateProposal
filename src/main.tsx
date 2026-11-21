import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminPage from './components/AdminPage';
import ApologyNote from './components/ApologyNote';
import KhushiPage from './components/KhushiPage';
import VisitsPage from './components/VisitsPage';
import { trackVisit } from './lib/trackVisit';
import './styles.css';

const path = window.location.pathname.replace(/\/$/, '');

// Admin pages are not counted as visits.
if (!path.startsWith('/admin-44444')) void trackVisit();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/admin-44444' ? (
      <AdminPage />
    ) : path === '/admin-44444/visits' ? (
      <VisitsPage />
    ) : (
      <>
        {path === '/khushi' ? <KhushiPage /> : <App />}
        <ApologyNote />
      </>
    )}
  </StrictMode>,
);
