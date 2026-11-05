import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/grenze-gotisch/wght.css';
import '@fontsource/noto-sans-runic/runic-400.css';
import './estilos/tokens.css';
import './estilos/app.css';
import App from './App.jsx';

createRoot(document.getElementById('raiz')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
