import type { TagResult } from '../utils/tags';

interface TagResultsViewProps {
  tags: string[];
  results: TagResult[];
  onOpenPage: (pageId: string) => void;
  onOpenTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function TagResultsView({
  tags,
  results,
  onOpenPage,
  onOpenTag,
  onRemoveTag
}: TagResultsViewProps): JSX.Element {
  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Tags</p>
          <h1>Tagged Pages</h1>
          <div className="active-tag-list" aria-label="Active tag filters">
            {tags.map((tag) => (
              <span key={tag} className="active-tag-pill">
                <span>#{tag}</span>
                <button
                  type="button"
                  className="active-tag-remove"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() => onRemoveTag(tag)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <p className="search-subtitle">
            {results.length === 1 ? '1 page' : `${results.length} pages`} • Showing pages tagged with all selected tags
          </p>
        </div>
      </div>

      {results.length === 0 ? (
        <div className="empty-state">
          <h2>No pages match all selected tags.</h2>
          <p>Try removing a tag.</p>
        </div>
      ) : (
        <div className="stack-list">
          {results.map((result) => (
            <article key={result.pageId} className="search-result-card">
              <button
                type="button"
                className="tag-result-main"
                onClick={() => onOpenPage(result.pageId)}
              >
                <div className="search-result-head">
                  <div className="search-result-title">{result.pageTitle}</div>
                  <span className="search-result-badge">Tag match</span>
                </div>
                <p className="search-result-path">{result.path}</p>
                {result.snippet ? <p className="search-result-snippet">{result.snippet}</p> : null}
              </button>
              <div className="tag-list search-result-tags">
                {result.tags.map((tag) => (
                  <button
                    key={`${result.pageId}-${tag}`}
                    type="button"
                    className={`tag-pill-label inline-tag-button ${tags.includes(tag) ? 'is-active' : ''}`}
                    onClick={() => {
                      if (!tags.includes(tag)) {
                        onOpenTag(tag);
                      }
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
