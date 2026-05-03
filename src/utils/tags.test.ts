import { describe, expect, it } from 'vitest';
import {
  formatTagQuery,
  isTagOnlyQuery,
  isValidTagToken,
  normalizeTag,
  normalizeTagList,
  parseSingleTagInput,
  parseTagQuery
} from './tags';

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
});
