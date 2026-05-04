import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MoveTargetPanel } from './MoveTargetPanel';

describe('MoveTargetPanel accessibility behavior', () => {
  let container: HTMLDivElement;
  let root: Root;
  let requestAnimationFrameSpy: { mockRestore: () => void };

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 0;
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    requestAnimationFrameSpy.mockRestore();
    vi.clearAllMocks();
  });

  it('focuses the destination chooser when opened and cancels on Escape', () => {
    const onCancel = vi.fn();

    act(() => {
      root.render(
        <MoveTargetPanel
          title="Move Page to Chapter"
          options={[
            { id: 'current', label: 'Current Chapter' },
            { id: 'target', label: 'Target Chapter' }
          ]}
          currentTargetId="current"
          submitLabel="Move Page"
          onConfirm={vi.fn()}
          onCancel={onCancel}
        />
      );
    });

    expect(document.activeElement).toBe(container.querySelector('select'));

    container
      .querySelector('.move-panel')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
