import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminPage from './components/AdminPage';
import KhushiPage from './components/KhushiPage';
import './styles.css';

const path = window.location.pathname.replace(/\/$/, '');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {path === '/admin-44444' ? (
      <AdminPage />
    ) : path === '/khushi' ? (
      <KhushiPage />
    ) : (
      <App />
    )}
  </StrictMode>,
);
