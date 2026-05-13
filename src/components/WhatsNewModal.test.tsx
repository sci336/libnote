import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { APP_VERSION } from '../config/releaseNotes';
import { LAST_SEEN_UPDATE_VERSION_KEY, WhatsNewModal } from './WhatsNewModal';

describe('WhatsNewModal', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    window.localStorage.clear();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    window.localStorage.clear();
  });

  it('shows release notes when the current version has not been seen', () => {
    renderWhatsNewModal();

    expect(container.textContent).toContain("What's New in LibNote");
    expect(container.textContent).toContain(`Version ${APP_VERSION}`);
    expect(container.textContent).toContain('Improved mobile menu layout.');
  });

  it('does not show again after the current version is dismissed', () => {
    renderWhatsNewModal();

    clickButton('Got it');

    expect(window.localStorage.getItem(LAST_SEEN_UPDATE_VERSION_KEY)).toBe(APP_VERSION);
    expect(container.textContent).not.toContain("What's New in LibNote");

    renderWhatsNewModal();

    expect(container.textContent).not.toContain("What's New in LibNote");
  });

  it('shows again when the saved version differs from the current version', () => {
    window.localStorage.setItem(LAST_SEEN_UPDATE_VERSION_KEY, '0.0.1');

    renderWhatsNewModal();

    expect(container.textContent).toContain("What's New in LibNote");
  });

  function renderWhatsNewModal(): void {
    act(() => {
      root.render(<WhatsNewModal />);
    });
  }

  function clickButton(label: string): void {
    const button = Array.from(container.querySelectorAll('button')).find((item) => item.textContent === label);

    act(() => {
      button?.click();
    });
  }
});
