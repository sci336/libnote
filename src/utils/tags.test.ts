import { describe, expect, it } from 'vitest';
import {
  formatTagQuery,
  getAllTagSuggestions,
  getTagResults,
  isTagOnlyQuery,
  isValidTagToken,
  normalizeTag,
  normalizeTagList,
  parseSingleTagInput,
  parseTagQuery,
  replaceSlashTagToken
} from './tags';
import type { Page } from '../types/domain';

describe('tags', () => {
  it('normalizes slash tags to lowercase trimmed values', () => {
    expect(normalizeTag('  History  ')).toBe('history');
    expect(parseSingleTagInput('/History')).toBe('history');
    expect(parseSingleTagInput('#History')).toBe('history');
  });

  it('parses tag-only queries and rejects mixed input', () => {
    expect(parseTagQuery('/history /Mythology')).toEqual(['history', 'mythology']);
    expect(parseTagQuery('history /mythology')).toBeNull();
    expect(parseTagQuery('/')).toBeNull();
  });

  it('detects only valid tag-only queries', () => {
    expect(isTagOnlyQuery('/history')).toBe(true);
    expect(isTagOnlyQuery('/history /mythology')).toBe(true);
    expect(isTagOnlyQuery('history /mythology')).toBe(false);
    expect(isTagOnlyQuery('/')).toBe(false);
  });

  it('removes duplicate and variant tags while preserving first-use order', () => {
    expect(normalizeTagList(['History', 'history', 'Mythology'])).toEqual(['history', 'mythology']);
    expect(normalizeTagList(['/History', '/history'].map((tag) => parseSingleTagInput(tag) ?? ''))).toEqual([
      'history'
    ]);
    expect(formatTagQuery(['History', 'history', 'Mythology'])).toBe('/history /mythology');
  });

  it('validates slash token syntax for search input', () => {
    expect(isValidTagToken('/history')).toBe(true);
    expect(isValidTagToken('/history-notes')).toBe(true);
    expect(isValidTagToken('#history')).toBe(false);
    expect(isValidTagToken('/history,notes')).toBe(false);
    expect(isValidTagToken('/history/notes')).toBe(false);
  });

  it('ranks slash tag suggestions by normalized exact, starts-with, then contains matches', () => {
    const pages = [
      createPage('page-1', ['history-class']),
      createPage('page-2', ['art-history']),
      createPage('page-3', ['history']),
      createPage('page-4', ['math'])
    ];

    expect(getAllTagSuggestions(pages, 'history')).toEqual(['history', 'history-class', 'art-history']);
  });

  it('deduplicates normalized slash tag suggestions', () => {
    const pages = [createPage('page-1', ['History', 'history', 'historical-fiction'])];

    expect(getAllTagSuggestions(pages, 'hist')).toEqual(['historical-fiction', 'history']);
  });

  it('formats selected tag autocomplete text as a normal slash tag', () => {
    expect(replaceSlashTagToken('Read /his today', 9, 'history')).toBe('Read /history today');
  });

  it('builds tag result snippets from rich HTML as plain text', () => {
    const pages = [
      {
        ...createPage('page-1', ['history']),
        title: 'Rich Note',
        content:
          '<h2>Heading</h2><p><strong>Bold</strong> <em>italic</em> <u>under</u> <mark>highlight</mark> <a href="https://example.com">link</a> /history</p><ul><li>Bullet</li></ul><ol><li>First</li></ol><ul data-list-type="task"><li data-task-item="true" data-checked="true">Done</li></ul>'
      }
    ];

    expect(getTagResults(pages, [], [], ['history'])[0].snippet).toBe(
      'Heading Bold italic under highlight link /history - Bullet 1. First - [x] Done'
    );
  });

  it('preserves empty tag snippets for empty rich HTML', () => {
    const pages = [{ ...createPage('page-1', ['history']), content: '<p><br></p>' }];

    expect(getTagResults(pages, [], [], ['history'])[0].snippet).toBe('');
  });

  it('normalizes page tags before matching and displaying tag results', () => {
    const pages = [
      createPage('page-1', [' History ', 'history', '/School']),
      createPage('page-2', ['history'])
    ];

    const results = getTagResults(pages, [], [], ['history', 'school']);

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      pageId: 'page-1',
      tags: ['history', 'school']
    });
  });
});

function createPage(id: string, tags: string[]): Page {
  return {
    id,
    chapterId: 'chapter-1',
    title: id,
    content: '',
    tags,
    textSize: 16,
    isLoose: false,
    sortOrder: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z'
  };
}
