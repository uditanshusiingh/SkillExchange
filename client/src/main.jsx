import React from 'react';
import { createRoot } from 'react-dom/client';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles.css';
import './refresh.css';
import App from './App.jsx';
import AdminApp from './AdminApp.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>{window.location.pathname.startsWith('/admin') ? <AdminApp /> : <App />}</React.StrictMode>
);
