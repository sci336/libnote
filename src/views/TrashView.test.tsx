import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { TrashView } from './TrashView';
import type { TrashItem } from '../types/domain';

describe('TrashView accessibility copy', () => {
  it('labels destructive trash actions with their consequences', () => {
    const html = renderToStaticMarkup(
      <TrashView
        items={[trashPage]}
        onRestore={vi.fn()}
        onDeleteForever={vi.fn()}
        onEmptyTrash={vi.fn()}
      />
    );

    expect(html).toContain('aria-label="Permanently delete every item in Trash"');
    expect(html).toContain('aria-label="Restore Draft Page from Trash"');
    expect(html).toContain('aria-label="Permanently delete Draft Page from Trash. This cannot be undone."');
  });
});

const trashPage: TrashItem = {
  id: 'page-1',
  type: 'page',
  title: 'Draft Page',
  deletedAt: '2026-05-04T12:00:00.000Z',
  originalLocation: 'Book / Chapter'
};
