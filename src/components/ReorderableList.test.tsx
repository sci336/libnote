import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReorderableList } from './ReorderableList';

interface TestItem {
  id: string;
  label: string;
}

describe('ReorderableList keyboard controls', () => {
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

  it('moves an item with keyboard-accessible controls and reports the persisted order payload', () => {
    const onPersist = vi.fn();

    act(() => {
      root.render(<Harness onPersist={onPersist} />);
    });

    expect(getLabels()).toEqual(['Alpha', 'Beta', 'Gamma']);

    clickButton('Move Beta up');
    expect(getLabels()).toEqual(['Beta', 'Alpha', 'Gamma']);
    expect(onPersist).toHaveBeenLastCalledWith(['b', 'a', 'c']);

    clickButton('Move Beta to bottom');
    expect(getLabels()).toEqual(['Alpha', 'Gamma', 'Beta']);
    expect(onPersist).toHaveBeenLastCalledWith(['a', 'c', 'b']);
  });

  it('gives every reorder button a useful accessible name', () => {
    act(() => {
      root.render(<Harness onPersist={vi.fn()} />);
    });

    expect(container.querySelector('button[aria-label="Move Alpha to top"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Move Alpha up"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Move Alpha down"]')).not.toBeNull();
    expect(container.querySelector('button[aria-label="Move Alpha to bottom"]')).not.toBeNull();
  });

  function clickButton(name: string): void {
    const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`);
    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });
  }

  function getLabels(): string[] {
    return Array.from(container.querySelectorAll('[data-testid="item-label"]')).map(
      (element) => element.textContent ?? ''
    );
  }
});

function Harness({ onPersist }: { onPersist: (orderedIds: string[]) => void }): JSX.Element {
  const [items, setItems] = useState<TestItem[]>([
    { id: 'a', label: 'Alpha' },
    { id: 'b', label: 'Beta' },
    { id: 'c', label: 'Gamma' }
  ]);

  function handleReorder(orderedIds: string[]): void {
    onPersist(orderedIds);
    setItems((currentItems) => {
      const itemById = new Map(currentItems.map((item) => [item.id, item]));
      return orderedIds.map((id) => itemById.get(id)).filter((item): item is TestItem => Boolean(item));
    });
  }

  return (
    <ReorderableList
      items={items}
      onReorder={handleReorder}
      getItemLabel={(item) => item.label}
      renderItem={(item, reorderControls) => (
        <div>
          <span data-testid="item-label">{item.label}</span>
          {reorderControls}
        </div>
      )}
    />
  );
}
