import type { Page } from '../types/domain';
import { contentToPlainText } from './richText';

export type ContentSegment =
  | {
      type: 'text';
      text: string;
    }
  | {
      type: 'link';
      raw: string;
      displayText: string;
      targetPageId: string | null;
      normalizedTargetTitle: string;
    };

export type PageTitleLookup = Map<string, Page>;
export type BacklinkIndex = Record<string, string[]>;

export interface PageConnectionLink {
  key: string;
  label: string;
  targetPageId: string | null;
}

const BRACKET_LINK_PATTERN = /\[\[([\s\S]*?)\]\]/g;
const WHITESPACE_PATTERN = /\s+/g;

/**
 * Normalizes page titles for the `[[Page Title]]` link system.
 * Matching is intentionally case-insensitive and whitespace-insensitive so small
 * title edits do not silently break the reader experience.
 */
export function normalizePageTitle(title: string): string {
  return flattenText(title).toLowerCase();
}

export const normalizeWikiLinkTitle = normalizePageTitle;

export function extractBracketLinks(text: string): string[] {
  const matches: string[] = [];
  const sourceText = toSafeString(contentToPlainText(text));

  for (const match of sourceText.matchAll(BRACKET_LINK_PATTERN)) {
    const linkText = match[1]?.trim() ?? '';
    if (linkText.length > 0) {
      matches.push(linkText);
    }
  }

  return matches;
}

export const extractWikiLinks = extractBracketLinks;

export function buildPageTitleLookup(allPages: Page[]): PageTitleLookup {
  const lookup: PageTitleLookup = new Map();

  for (const page of allPages) {
    const normalizedTitle = normalizePageTitle(page.title);
    if (!normalizedTitle) {
      continue;
    }

    if (!lookup.has(normalizedTitle)) {
      // Duplicate titles currently resolve to the first matching page. Keeping
      // that rule centralized here avoids each renderer inventing its own tie-breaker.
      lookup.set(normalizedTitle, page);
    }
  }

  return lookup;
}

export function resolveBracketLink(linkText: string, allPages: Page[]): Page | null {
  const lookup = buildPageTitleLookup(allPages);
  return resolveBracketLinkFromLookup(linkText, lookup);
}

export function parseContentIntoSegments(
  text: string,
  titleLookup: PageTitleLookup
): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const sourceText = toSafeString(contentToPlainText(text));
  let cursor = 0;

  for (const match of sourceText.matchAll(BRACKET_LINK_PATTERN)) {
    const raw = match[0];
    const innerText = match[1] ?? '';
    const displayText = innerText.trim();
    const normalizedTargetTitle = normalizePageTitle(displayText);
    const matchIndex = match.index ?? cursor;

    if (matchIndex > cursor) {
      segments.push({
        type: 'text',
        text: sourceText.slice(cursor, matchIndex)
      });
    }

    const targetPage = resolveBracketLinkFromLookup(displayText, titleLookup);
    segments.push({
      type: 'link',
      raw,
      displayText: targetPage?.title ?? displayText,
      targetPageId: targetPage?.id ?? null,
      normalizedTargetTitle
    });

    cursor = matchIndex + raw.length;
  }

  if (cursor < sourceText.length) {
    segments.push({
      type: 'text',
      text: sourceText.slice(cursor)
    });
  }

  if (segments.length === 0) {
    return [
      {
        type: 'text',
        text: sourceText
      }
    ];
  }

  return segments;
}

export function getOutgoingLinks(currentPage: Page, allPages: Page[]): PageConnectionLink[] {
  const titleLookup = buildPageTitleLookup(allPages);
  return getConnectionLinksFromSegments(parseContentIntoSegments(currentPage.content, titleLookup))
    .filter((link) => link.targetPageId);
}

export function getBrokenLinks(currentPage: Page, allPages: Page[]): PageConnectionLink[] {
  const titleLookup = buildPageTitleLookup(allPages);
  return getConnectionLinksFromSegments(parseContentIntoSegments(currentPage.content, titleLookup))
    .filter((link) => !link.targetPageId);
}

export function getBacklinks(currentPage: Page, allPages: Page[]): Page[] {
  const backlinkIndex = buildBacklinkIndex(allPages);
  const pageById = new Map(allPages.map((page) => [page.id, page]));

  return (backlinkIndex[currentPage.id] ?? [])
    .map((pageId) => pageById.get(pageId))
    .filter((page): page is Page => Boolean(page));
}

export function getConnectionLinksFromSegments(contentSegments: ContentSegment[]): PageConnectionLink[] {
  const seen = new Set<string>();
  const links: PageConnectionLink[] = [];

  for (const segment of contentSegments) {
    if (segment.type !== 'link' || segment.displayText.length === 0) {
      continue;
    }

    const key = segment.targetPageId ?? `missing:${segment.normalizedTargetTitle}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    links.push({
      key,
      label: segment.displayText,
      targetPageId: segment.targetPageId
    });
  }

  return links;
}

/**
 * Builds a reverse lookup of "which pages reference this page".
 * Backlinks are derived at render time from raw page content rather than stored,
 * which keeps editing simple and avoids synchronization bugs.
 */
export function buildBacklinkIndex(allPages: Page[]): BacklinkIndex {
  const backlinkIndex: BacklinkIndex = Object.create(null);
  const titleLookup = buildPageTitleLookup(allPages);

  for (const sourcePage of allPages) {
    const linkedTargetIds = new Set<string>();

    for (const linkText of extractBracketLinks(sourcePage.content)) {
      const targetPage = resolveBracketLinkFromLookup(linkText, titleLookup);
      if (targetPage && targetPage.id !== sourcePage.id) {
        linkedTargetIds.add(targetPage.id);
      }
    }

    for (const targetPageId of linkedTargetIds) {
      const backlinks = backlinkIndex[targetPageId] ?? [];
      backlinkIndex[targetPageId] = [...backlinks, sourcePage.id];
    }
  }

  return backlinkIndex;
}

function resolveBracketLinkFromLookup(
  linkText: string,
  titleLookup: PageTitleLookup
): Page | null {
  const normalizedTitle = normalizePageTitle(linkText);
  if (!normalizedTitle) {
    return null;
  }

  return titleLookup.get(normalizedTitle) ?? null;
}

function toSafeString(value: unknown): string {
  if (typeof value === 'string') {
    return value;
  }

  if (value === null || value === undefined) {
    return '';
  }

  return String(value);
}

function flattenText(value: unknown): string {
  return toSafeString(value).trim().replace(WHITESPACE_PATTERN, ' ');
}
