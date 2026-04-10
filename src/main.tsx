import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    if (import.meta.env.PROD) {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.error('Service worker registration failed', error);
      });
      return;
    }

    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister()))
      )
      .catch((error) => {
        console.error('Service worker cleanup failed', error);
      });

    if ('caches' in window) {
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key.startsWith('note-library-'))
              .map((key) => caches.delete(key))
          )
        )
        .catch((error) => {
          console.error('Cache cleanup failed', error);
        });
    }
  });
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
