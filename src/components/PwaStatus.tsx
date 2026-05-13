import { useEffect, useState } from 'react';
import { PWA_UPDATE_READY_EVENT, activateWaitingServiceWorker } from '../utils/pwa';

export function PwaStatus(): JSX.Element | null {
  // PWA status is advisory only. It reflects browser connectivity/update events
  // without implying that local IndexedDB data is synced anywhere.
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' && 'onLine' in navigator ? !navigator.onLine : false
  );
  const [isUpdateReady, setIsUpdateReady] = useState(false);

  useEffect(() => {
    function handleOnline(): void {
      setIsOffline(false);
    }

    function handleOffline(): void {
      setIsOffline(true);
    }

    function handleUpdateReady(): void {
      setIsUpdateReady(true);
    }

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener(PWA_UPDATE_READY_EVENT, handleUpdateReady);
    };
  }, []);

  if (!isOffline && !isUpdateReady) {
    return null;
  }

  return (
    <div className="pwa-status-stack" aria-live="polite">
      {isOffline ? (
        <div className="pwa-status pwa-status-offline">
          <span>Offline. LibNote can keep opening from this device after it has loaded once.</span>
        </div>
      ) : null}
      {isUpdateReady ? (
        <div className="pwa-status pwa-status-update">
          <span>A LibNote update is ready.</span>
          <button type="button" className="pwa-status-button" onClick={activateWaitingServiceWorker}>
            Reload
          </button>
        </div>
      ) : null}
    </div>
  );
}
