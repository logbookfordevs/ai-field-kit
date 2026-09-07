import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from '@/App.jsx';
import Docs from '@/docs/Docs.jsx';
import '@/index.css';

const Page = window.location.pathname.replace(/\/$/, '') === '/docs' ? Docs : App;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Page />
  </StrictMode>,
);
