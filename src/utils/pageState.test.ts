import { describe, expect, it } from 'vitest';
import type { Page } from '../types/domain';
import { getPagePreview } from './pageState';

describe('page preview state', () => {
  it('builds plain text previews from rich HTML content', () => {
    const page = createPage(
      '<h1>Heading</h1><p><strong>Bold</strong> <em>italic</em> <u>under</u> <mark>highlight</mark> /tag</p><ul><li>First</li></ul>'
    );

    expect(getPagePreview(page)).toBe('Heading Bold italic under highlight /tag - First');
  });

  it('preserves empty page preview text for empty rich HTML', () => {
    expect(getPagePreview(createPage('<p><br></p>'))).toBe('Empty page');
  });

  it('clips long previews after converting HTML to plain text', () => {
    const preview = getPagePreview(
      createPage(
        '<p>Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu xi omicron pi rho sigma tau</p>'
      )
    );

    expect(preview).toHaveLength(93);
    expect(preview.endsWith('...')).toBe(true);
    expect(preview).not.toContain('<p>');
  });
});

function createPage(content: string): Page {
  return {
    id: 'page-1',
    chapterId: 'chapter-1',
    title: 'Preview Page',
    content,
    tags: [],
    textSize: 16,
    isLoose: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  };
}
