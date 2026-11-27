import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminPage from './components/AdminPage';
import ApologyNote from './components/ApologyNote';
import BouquetPage from './components/BouquetPage';
import BouquetV2Page from './components/BouquetV2Page';
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
    ) : path === '/bouquet' ? (
      <BouquetPage />
    ) : path === '/bouquetv2' ? (
      <BouquetV2Page />
    ) : (
      <>
        {path === '/khushi' ? <KhushiPage /> : <App />}
        <ApologyNote />
      </>
    )}
  </StrictMode>,
);
