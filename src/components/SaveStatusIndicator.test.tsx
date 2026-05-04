import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import type { SaveStatus } from '../types/domain';

describe('SaveStatusIndicator', () => {
  it('renders nothing while idle', () => {
    expect(render({ state: 'idle' })).toBe('');
  });

  it('distinguishes unsaved, saving, saved, and retrying states', () => {
    expect(render({ state: 'unsaved' })).toContain('Unsaved changes');
    expect(render({ state: 'saving' })).toContain('Saving...');
    expect(render({ state: 'retrying' })).toContain('Retrying save...');
    expect(render({ state: 'saved', lastSavedAt: new Date('2026-05-04T14:30:00Z').getTime() })).toContain('Saved');
  });

  it('shows clear recovery guidance when saving fails', () => {
    const html = render({
      state: 'failed',
      error: {
        title: 'Changes could not be saved.',
        message: 'Your latest edits may only exist in this open tab.',
        recovery: 'Export a backup before closing or refreshing.',
        suggestion: 'Browser storage may be full or unavailable.'
      }
    });

    expect(html).toContain('Changes could not be saved.');
    expect(html).toContain('Your latest edits may only exist in this open tab.');
    expect(html).toContain('Export a backup before closing or refreshing.');
    expect(html).toContain('Retry');
  });
});

function render(status: SaveStatus): string {
  return renderToStaticMarkup(<SaveStatusIndicator status={status} onRetry={vi.fn()} />);
}
