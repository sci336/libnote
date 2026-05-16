import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import type { SaveStatus } from '../types/domain';

describe('SaveStatusIndicator', () => {
  it('renders nothing while idle', () => {
    expect(render({ state: 'idle' })).toBe('');
  });

  it('distinguishes unsaved, saving, saved, and retrying states', () => {
    expect(render({ state: 'unsaved' })).toContain('Unsaved');
    expect(render({ state: 'saving' })).toContain('Saving');
    expect(render({ state: 'retrying' })).toContain('Retrying');
    expect(render({ state: 'saved', lastSavedAt: new Date('2026-05-04T14:30:00Z').getTime() })).toContain('Saved');
  });

  it('shows clear recovery guidance when saving fails', () => {
    const html = render({
      state: 'failed',
      error: {
        title: 'LibNote could not save locally.',
        message: 'Your latest changes are still open here, but they may not be saved in this browser yet.',
        recovery: 'If these changes are important, export a backup before closing or refreshing.',
        suggestion: 'Browser storage may be full or unavailable.'
      }
    });

    expect(html).toContain('LibNote could not save locally.');
    expect(html).toContain('Your latest changes are still open here');
    expect(html).toContain('export a backup before closing or refreshing.');
    expect(html).toContain('Retry');
  });

  it('can hide retry when the failure is not a safe save retry', () => {
    const html = render({
      state: 'failed',
      canRetry: false,
      error: {
        title: 'LibNote could not save locally.',
        message: 'Your latest changes are still open here, but they may not be saved in this browser yet.',
        recovery: 'If these changes are important, export a backup before closing or refreshing.',
        suggestion: 'Browser storage may be full or unavailable.'
      }
    });

    expect(html).not.toContain('Retry');
  });
});

function render(status: SaveStatus): string {
  return renderToStaticMarkup(<SaveStatusIndicator status={status} onRetry={vi.fn()} />);
}
