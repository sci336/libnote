import type { Book, Chapter, Page } from '../types/domain';
import { formatFullTimestamp } from '../utils/date';
import { isLoosePage } from '../utils/pageState';
import {
  getAmbiguousLinksFromSegments,
  getConnectionLinksFromSegments,
  type ContentSegment,
  type PageConnectionLink
} from '../utils/pageLinks';
import { getPageWritingStats } from '../utils/pageStats';

const MAX_VISIBLE_AMBIGUOUS_DESTINATIONS = 3;

interface PageMetadataPanelProps {
  page: Page;
  parentBook?: Book;
  parentChapter?: Chapter;
  contentSegments: ContentSegment[];
  wikiLinkDestinationLabels: Map<string, string>;
  backlinks: Array<{ pageId: string; title: string; path: string }>;
  onOpenPage: (pageId: string) => void;
  onCreatePageFromLink: (title: string) => void;
  onOpenTagSearch?: (tag: string) => void;
}

export function PageMetadataPanel({
  page,
  parentBook,
  parentChapter,
  contentSegments,
  wikiLinkDestinationLabels,
  backlinks,
  onOpenPage,
  onCreatePageFromLink,
  onOpenTagSearch
}: PageMetadataPanelProps): JSX.Element {
  const pageIsLoose = isLoosePage(page);
  const stats = getPageWritingStats(page.content);
  const outgoingLinks = getConnectionLinksFromSegments(contentSegments);
  const validOutgoingLinks = outgoingLinks.filter((link) => link.resolutionStatus === 'resolved');
  const brokenOutgoingLinks = outgoingLinks.filter((link) => link.resolutionStatus === 'missing');
  const ambiguousOutgoingLinks = getAmbiguousLinksFromSegments(contentSegments);

  return (
    <aside id="page-info-panel" className="page-metadata-panel" aria-label="Page Info">
      <div className="metadata-panel-header">
        <h2>Page Info</h2>
      </div>

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
                    /{tag}
                  </button>
                ))}
              </div>
            ) : (
              <p className="metadata-empty">No tags yet</p>
            )}
          </section>

          <section className="metadata-section metadata-connections-section">
            <h3>Page Connections</h3>

            <div className="metadata-connection-group">
              <h4>Outgoing Links</h4>
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
                <p className="metadata-empty">No outgoing links yet.</p>
              )}
            </div>

            {ambiguousOutgoingLinks.length > 0 ? (
              <div className="metadata-connection-group">
                <h4>Ambiguous Links</h4>
                <div className="metadata-ambiguous-list">
                  {ambiguousOutgoingLinks.map((link) => (
                    <AmbiguousLinkRow
                      key={link.key}
                      link={link}
                      destinationLabels={wikiLinkDestinationLabels}
                    />
                  ))}
                </div>
              </div>
            ) : null}

            <div className="metadata-connection-group">
              <h4>Backlinks</h4>
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
                <p className="metadata-empty">No backlinks yet.</p>
              )}
            </div>

            <div className="metadata-connection-group">
              <h4>Broken Links</h4>
              {brokenOutgoingLinks.length > 0 ? (
                <div className="metadata-broken-list">
                  {brokenOutgoingLinks.map((link) => (
                    <div key={link.key} className="metadata-broken-link-row">
                      <span className="metadata-broken-link">{link.label}</span>
                      <button
                        type="button"
                        className="secondary-button metadata-create-link-button"
                        onClick={() => onCreatePageFromLink(link.label)}
                      >
                        Create page
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="metadata-empty">No broken links.</p>
              )}
            </div>
          </section>
      </div>
    </aside>
  );
}

function AmbiguousLinkRow({
  link,
  destinationLabels
}: {
  link: PageConnectionLink;
  destinationLabels: Map<string, string>;
}): JSX.Element {
  const visibleDestinationLabels = link.matchingPageIds
    .slice(0, MAX_VISIBLE_AMBIGUOUS_DESTINATIONS)
    .map((pageId) => destinationLabels.get(pageId))
    .filter((label): label is string => Boolean(label));
  const hiddenDestinationCount = Math.max(0, link.matchingPageIds.length - visibleDestinationLabels.length);

  return (
    <div className="metadata-ambiguous-link-row">
      <div className="metadata-ambiguous-link-header">
        <span className="metadata-ambiguous-link-title">{link.label}</span>
        <span className="metadata-ambiguous-link-count">
          {formatCount(link.matchingPageIds.length)} possible matches
        </span>
      </div>
      {visibleDestinationLabels.length > 0 ? (
        <ul className="metadata-ambiguous-path-list">
          {visibleDestinationLabels.map((label) => (
            <li key={label}>{label}</li>
          ))}
          {hiddenDestinationCount > 0 ? <li>+{formatCount(hiddenDestinationCount)} more</li> : null}
        </ul>
      ) : null}
    </div>
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

function formatCount(value: number): string {
  return new Intl.NumberFormat().format(value);
}
