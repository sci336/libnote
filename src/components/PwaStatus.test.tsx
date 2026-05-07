import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PwaStatus } from './PwaStatus';
import { PWA_UPDATE_READY_EVENT, activateWaitingServiceWorker } from '../utils/pwa';

vi.mock('../utils/pwa', async (importOriginal) => {
  const original = await importOriginal<typeof import('../utils/pwa')>();

  return {
    ...original,
    activateWaitingServiceWorker: vi.fn()
  };
});

describe('PwaStatus', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it('shows a subtle offline message when the browser goes offline', () => {
    renderStatus();

    act(() => {
      window.dispatchEvent(new Event('offline'));
    });

    expect(container.textContent).toContain('Offline');
    expect(container.textContent).toContain('loaded once');
  });

  it('shows an update reload action without reloading automatically', () => {
    renderStatus();

    act(() => {
      window.dispatchEvent(new Event(PWA_UPDATE_READY_EVENT));
    });

    const button = container.querySelector<HTMLButtonElement>('button');

    expect(container.textContent).toContain('update is ready');
    expect(activateWaitingServiceWorker).not.toHaveBeenCalled();

    act(() => {
      button?.click();
    });

    expect(activateWaitingServiceWorker).toHaveBeenCalledTimes(1);
  });

  function renderStatus(): void {
    act(() => {
      root.render(<PwaStatus />);
    });
  }
});
