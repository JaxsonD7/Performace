import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { App } from '@/App';
import { StoreProvider } from '@/store/store';
import '@/index.css';

// HashRouter, not BrowserRouter: this app is meant to run from a file:// build
// or any static host without server-side rewrite rules.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <HashRouter>
        <App />
      </HashRouter>
    </StoreProvider>
  </StrictMode>,
);
