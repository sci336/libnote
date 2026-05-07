export const PWA_UPDATE_READY_EVENT = 'libnote:pwa-update-ready';
export const PWA_RELOAD_FOR_UPDATE_EVENT = 'libnote:pwa-reload-for-update';

export function registerProductionServiceWorker(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) {
    return;
  }

  let updateReloadRequested = false;

  window.addEventListener(PWA_RELOAD_FOR_UPDATE_EVENT, () => {
    updateReloadRequested = true;
  });

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (updateReloadRequested) {
      window.location.reload();
    }
  });

  const serviceWorkerUrl = new URL('sw.js', window.location.origin + import.meta.env.BASE_URL);

  navigator.serviceWorker
    .register(serviceWorkerUrl.href, { scope: import.meta.env.BASE_URL })
    .then((registration) => {
      if (registration.waiting && navigator.serviceWorker.controller) {
        notifyUpdateReady(registration);
      }

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;

        if (!installingWorker) {
          return;
        }

        installingWorker.addEventListener('statechange', () => {
          if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
            notifyUpdateReady(registration);
          }
        });
      });
    })
    .catch((error) => {
      console.error('Service worker registration failed', error);
    });
}

export function cleanupDevelopmentServiceWorkers(): void {
  if (!('serviceWorker' in navigator) || import.meta.env.PROD) {
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
            .filter((key) => key.startsWith('note-library-') || key.startsWith('libnote-'))
            .map((key) => caches.delete(key))
        )
      )
      .catch((error) => {
        console.error('Cache cleanup failed', error);
      });
  }
}

export function activateWaitingServiceWorker(): void {
  window.dispatchEvent(new Event(PWA_RELOAD_FOR_UPDATE_EVENT));

  navigator.serviceWorker
    .getRegistration(import.meta.env.BASE_URL)
    .then((registration) => {
      registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    })
    .catch((error) => {
      console.error('Service worker update activation failed', error);
    });
}

function notifyUpdateReady(registration: ServiceWorkerRegistration): void {
  window.dispatchEvent(
    new CustomEvent<ServiceWorkerRegistration>(PWA_UPDATE_READY_EVENT, {
      detail: registration
    })
  );
}
