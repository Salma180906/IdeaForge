import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ConsentProvider } from './context/ConsentContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './context/ToastContext';
import { AuthProvider } from './context/AuthContext';
import { SmoothScrollProvider } from './context/SmoothScroll';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/motion.css';
import './styles/v3.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ConsentProvider>
        <ThemeProvider>
          <SmoothScrollProvider>
            <ToastProvider>
              <AuthProvider>
                <App />
              </AuthProvider>
            </ToastProvider>
          </SmoothScrollProvider>
        </ThemeProvider>
      </ConsentProvider>
    </BrowserRouter>
  </React.StrictMode>
);
