import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { routes } from '@/routes.tsx';
import '@/index.css';

const router = createBrowserRouter(routes);
const root = document.getElementById('root');
if (!root) throw new Error('The site root element is missing.');

createRoot(root).render(<StrictMode><RouterProvider router={router} /></StrictMode>);
