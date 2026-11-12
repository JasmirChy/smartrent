import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import App from './App';
import './index.css';

// --- 30-MINUTE IDLE AUTO-SLEEP TRACKER FOR NEON DB & RENDER ---
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let lastActivityTimestamp = Date.now();
window.__SMARTRENT_IS_IDLE__ = false;

const markUserActive = () => {
  const wasIdle = window.__SMARTRENT_IS_IDLE__;
  lastActivityTimestamp = Date.now();
  window.__SMARTRENT_IS_IDLE__ = false;

  // If waking up from idle sleep, immediately trigger a fresh sync
  if (wasIdle) {
    queryClient.invalidateQueries();
  }
};

// Listen for any user interaction (mouse, keyboard, touch, scroll)
['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'visibilitychange'].forEach(
  (eventName) => {
    window.addEventListener(
      eventName,
      () => {
        if (!document.hidden) {
          markUserActive();
        }
      },
      { passive: true }
    );
  }
);

// Check every 60 seconds if the user has been inactive for > 30 minutes
setInterval(() => {
  if (Date.now() - lastActivityTimestamp > IDLE_TIMEOUT_MS) {
    window.__SMARTRENT_IS_IDLE__ = true;
  }
}, 60000);

// Global smart QueryClient:
// - Stops polling immediately when tab is hidden/minimized (refetchIntervalInBackground: false)
// - Stops polling if user hasn't interacted for 30 minutes (saves Neon DB compute hours)
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: () => {
        if (document.hidden || window.__SMARTRENT_IS_IDLE__) {
          return false; // Let Neon DB & Render sleep!
        }
        return 6000; // Poll every 6s only while user is actively using the app
      },
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);