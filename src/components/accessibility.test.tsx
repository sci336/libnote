import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InlineEditableText } from './InlineEditableText';
import { ReorderableList } from './ReorderableList';
import { EditorToolbar, type TextSizePresetId } from './EditorToolbar';
import { TagSuggestionsDropdown } from './TagSuggestionsDropdown';
import { SearchResultsView } from './SearchResultsView';
import { TagResultsView } from './TagResultsView';

describe('InlineEditableText Escape behavior', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('stops Escape propagation when cancelling inline edit', () => {
    const parentEscapeHandler = vi.fn();
    const onSave = vi.fn();

    act(() => {
      root.render(
        <div onKeyDown={(e) => { if (e.key === 'Escape') parentEscapeHandler(); }}>
          <InlineEditableText value="Test" onSave={onSave} />
        </div>
      );
    });

    const button = container.querySelector('button')!;
    act(() => { button.click(); });

    const input = container.querySelector('input')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(parentEscapeHandler).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('stops Enter propagation when committing inline edit', () => {
    const parentEnterHandler = vi.fn();
    const onSave = vi.fn();

    act(() => {
      root.render(
        <div onKeyDown={(e) => { if (e.key === 'Enter') parentEnterHandler(); }}>
          <InlineEditableText value="Test" onSave={onSave} />
        </div>
      );
    });

    const button = container.querySelector('button')!;
    act(() => { button.click(); });

    const input = container.querySelector('input')!;
    act(() => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    expect(parentEnterHandler).not.toHaveBeenCalled();
    expect(onSave).toHaveBeenCalledWith('Test');
  });
});

describe('ReorderableList announcements', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('announces position after keyboard move', () => {
    function Harness(): JSX.Element {
      const [items, setItems] = useState([
        { id: 'a', label: 'Alpha' },
        { id: 'b', label: 'Beta' },
        { id: 'c', label: 'Gamma' }
      ]);

      return (
        <ReorderableList
          items={items}
          onReorder={(orderedIds) => {
            setItems((current) => {
              const byId = new Map(current.map((i) => [i.id, i]));
              return orderedIds.map((id) => byId.get(id)!);
            });
          }}
          getItemLabel={(item) => item.label}
          renderItem={(item, controls) => (
            <div>
              <span>{item.label}</span>
              {controls}
            </div>
          )}
        />
      );
    }

    act(() => { root.render(<Harness />); });

    const liveRegion = container.querySelector('[aria-live="assertive"]');
    expect(liveRegion).not.toBeNull();

    const moveBtn = container.querySelector<HTMLButtonElement>('button[aria-label="Move Beta down"]');
    act(() => { moveBtn?.click(); });

    expect(liveRegion?.textContent).toBe('Beta, position 3 of 3');
  });
});

describe('EditorToolbar accessible names', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('provides aria-label and aria-pressed for formatting buttons', () => {
    act(() => {
      root.render(
        <EditorToolbar
          onFormat={vi.fn()}
          activeTextSize={'normal' as TextSizePresetId}
          onTextSizeChange={vi.fn()}
          onBeforeTextSizeChange={vi.fn()}
          activeFormats={{ bold: true }}
        />
      );
    });

    const boldBtn = container.querySelector('button[aria-label="Bold"]');
    expect(boldBtn).not.toBeNull();
    expect(boldBtn?.getAttribute('aria-pressed')).toBe('true');

    const italicBtn = container.querySelector('button[aria-label="Italic"]');
    expect(italicBtn).not.toBeNull();
    expect(italicBtn?.getAttribute('aria-pressed')).toBeNull();

    const toolbar = container.querySelector('[role="toolbar"]');
    expect(toolbar).not.toBeNull();
    expect(toolbar?.getAttribute('aria-label')).toBe('Text formatting');
  });
});

describe('TagSuggestionsDropdown semantics', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders a listbox with option roles and aria-selected', () => {
    act(() => {
      root.render(
        <TagSuggestionsDropdown
          suggestions={['history', 'homework']}
          activeIndex={1}
          onSelect={vi.fn()}
        />
      );
    });

    const listbox = container.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();

    const options = container.querySelectorAll('[role="option"]');
    expect(options.length).toBe(2);
    expect(options[0].getAttribute('aria-selected')).toBe('false');
    expect(options[1].getAttribute('aria-selected')).toBe('true');
  });

  it('returns null when there are no suggestions', () => {
    act(() => {
      root.render(
        <TagSuggestionsDropdown suggestions={[]} activeIndex={0} onSelect={vi.fn()} />
      );
    });

    expect(container.querySelector('[role="listbox"]')).toBeNull();
  });
});

describe('SearchResultsView filter group semantics', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('renders search filters as a group with aria-pressed buttons', () => {
    act(() => {
      root.render(
        <SearchResultsView
          query="test"
          mode={{ type: 'text', query: 'test' }}
          results={[
            {
              type: 'page',
              id: 'p1',
              title: 'Test Page',
              path: 'Book / Chapter',
              isLoosePage: false,
              snippet: 'test snippet',
              score: 1,
              matchKind: 'title-partial'
            }
          ]}
          trashResults={[]}
          onOpenResult={vi.fn()}
        />
      );
    });

    const filterGroup = container.querySelector('[role="group"][aria-label="Search result filters"]');
    expect(filterGroup).not.toBeNull();

    const allButton = filterGroup?.querySelector('button');
    expect(allButton?.getAttribute('aria-pressed')).toBe('true');
  });
});

describe('TagResultsView accessible semantics', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('uses role group for active tag list and remove buttons have labels', () => {
    act(() => {
      root.render(
        <TagResultsView
          tags={['school', 'history']}
          results={[]}
          availableTags={['school', 'history', 'work']}
          recentTags={['work']}
          onOpenPage={vi.fn()}
          onOpenTag={vi.fn()}
          onRemoveTag={vi.fn()}
        />
      );
    });

    const tagGroup = container.querySelector('[role="group"][aria-label="Active tag filters"]');
    expect(tagGroup).not.toBeNull();

    const removeButtons = container.querySelectorAll('.active-tag-remove');
    expect(removeButtons.length).toBe(2);
    expect(removeButtons[0].getAttribute('aria-label')).toBe('Remove tag school');
    expect(removeButtons[1].getAttribute('aria-label')).toBe('Remove tag history');

    const recentGroup = container.querySelector('[role="group"][aria-label="Recent tags"]');
    expect(recentGroup).not.toBeNull();
  });
});
