import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { AuthProvider } from './contexts/AuthContext';
import { IntegrationsProvider } from './contexts/IntegrationsContext';
import { SnackbarProvider } from './contexts/SnackbarContext';
import { ThemeProvider } from './contexts/ThemeContext';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <IntegrationsProvider>
          <SnackbarProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </SnackbarProvider>
        </IntegrationsProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
