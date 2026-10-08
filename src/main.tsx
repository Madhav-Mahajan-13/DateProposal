import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AdminPage from './components/AdminPage';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {window.location.pathname.replace(/\/$/, '') === '/admin-44444' ? (
      <AdminPage />
    ) : (
      <App />
    )}
  </StrictMode>,
);
