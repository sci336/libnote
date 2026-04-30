import type { Book, Chapter, Page } from '../types/domain';
import { formatFullTimestamp } from '../utils/date';
import { isLoosePage } from '../utils/pageState';
import type { ContentSegment } from '../utils/pageLinks';
import { getPageWritingStats } from '../utils/pageStats';

interface PageMetadataPanelProps {
  page: Page;
  parentBook?: Book;
  parentChapter?: Chapter;
  contentSegments: ContentSegment[];
  backlinks: Array<{ pageId: string; title: string; path: string }>;
  isCollapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenPage: (pageId: string) => void;
  onOpenTagSearch?: (tag: string) => void;
}

interface OutgoingPageLink {
  key: string;
  label: string;
  targetPageId: string | null;
}

export function PageMetadataPanel({
  page,
  parentBook,
  parentChapter,
  contentSegments,
  backlinks,
  isCollapsed,
  onToggleCollapsed,
  onOpenPage,
  onOpenTagSearch
}: PageMetadataPanelProps): JSX.Element {
  const pageIsLoose = isLoosePage(page);
  const stats = getPageWritingStats(page.content);
  const outgoingLinks = getOutgoingLinks(contentSegments);
  const validOutgoingLinks = outgoingLinks.filter((link) => link.targetPageId);
  const brokenOutgoingLinks = outgoingLinks.filter((link) => !link.targetPageId);

  return (
    <aside className={`page-metadata-panel${isCollapsed ? ' is-collapsed' : ''}`} aria-label="Page Info">
      <div className="metadata-panel-header">
        <h2>Page Info</h2>
        <button type="button" className="secondary-button metadata-toggle-button" onClick={onToggleCollapsed}>
          {isCollapsed ? 'Show' : 'Hide'}
        </button>
      </div>

      {isCollapsed ? null : (
        <div className="metadata-panel-body">
          <section className="metadata-section">
            <h3>Basics</h3>
            <dl className="metadata-list">
              <div>
                <dt>Title</dt>
                <dd>{page.title}</dd>
              </div>
              <div>
                <dt>Created</dt>
                <dd>{formatFullTimestamp(page.createdAt)}</dd>
              </div>
              <div>
                <dt>Last edited</dt>
                <dd>{formatFullTimestamp(page.updatedAt)}</dd>
              </div>
              <div>
                <dt>Location</dt>
                <dd>{pageIsLoose ? 'Loose Page' : 'Book Page'}</dd>
              </div>
              {!pageIsLoose && parentBook ? (
                <div>
                  <dt>Book</dt>
                  <dd>{parentBook.title}</dd>
                </div>
              ) : null}
              {!pageIsLoose && parentChapter ? (
                <div>
                  <dt>Chapter</dt>
                  <dd>{parentChapter.title}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="metadata-section">
            <h3>Writing</h3>
            <div className="metadata-stat-grid">
              <MetadataStat label="Words" value={formatCount(stats.wordCount)} />
              <MetadataStat label="Characters" value={formatCount(stats.characterCount)} />
              <MetadataStat label="Read time" value={`${stats.readingTimeMinutes} min`} />
              <MetadataStat label="Lines" value={formatCount(stats.lineCount)} />
            </div>
          </section>

          <section className="metadata-section">
            <h3>Tags</h3>
            {page.tags.length > 0 ? (
              <div className="tag-list metadata-tag-list">
                {page.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="tag-pill-label inline-tag-button metadata-tag-button"
                    onClick={() => onOpenTagSearch?.(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="metadata-empty">No tags yet</p>
            )}
          </section>

          <section className="metadata-section">
            <h3>Outgoing Links</h3>
            {validOutgoingLinks.length > 0 ? (
              <div className="metadata-link-list">
                {validOutgoingLinks.map((link) => (
                  <button
                    key={link.key}
                    type="button"
                    className="metadata-link-item"
                    onClick={() => link.targetPageId && onOpenPage(link.targetPageId)}
                  >
                    {link.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="metadata-empty">No outgoing links</p>
            )}
          </section>

          <section className="metadata-section">
            <h3>Backlinks</h3>
            {backlinks.length > 0 ? (
              <div className="metadata-link-list">
                {backlinks.map((backlink) => (
                  <button
                    key={backlink.pageId}
                    type="button"
                    className="metadata-link-item metadata-link-item-stacked"
                    onClick={() => onOpenPage(backlink.pageId)}
                  >
                    <span>{backlink.title}</span>
                    <span>{backlink.path}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="metadata-empty">No backlinks yet</p>
            )}
          </section>

          <section className="metadata-section">
            <h3>Broken Links</h3>
            {brokenOutgoingLinks.length > 0 ? (
              <div className="metadata-broken-list">
                {brokenOutgoingLinks.map((link) => (
                  <span key={link.key} className="metadata-broken-link">
                    {link.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="metadata-empty">No broken links</p>
            )}
          </section>
        </div>
      )}
    </aside>
  );
}

function MetadataStat({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="metadata-stat">
      <span>{value}</span>
      <span>{label}</span>
    </div>
  );
}

function getOutgoingLinks(contentSegments: ContentSegment[]): OutgoingPageLink[] {
  const seen = new Set<string>();
  const links: OutgoingPageLink[] = [];

  for (const segment of contentSegments) {
    if (segment.type !== 'link' || segment.displayText.length === 0) {
      continue;
    }

    const key = `${segment.normalizedTargetTitle}:${segment.targetPageId ?? 'missing'}`;
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

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}
