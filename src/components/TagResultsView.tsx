import { useMemo, useState } from 'react';
import type { TagResult } from '../utils/tags';
import { parseSingleTagInput } from '../utils/tags';

interface TagResultsViewProps {
  tags: string[];
  results: TagResult[];
  availableTags: string[];
  recentTags: string[];
  onOpenPage: (pageId: string) => void;
  onOpenTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export function TagResultsView({
  tags,
  results,
  availableTags,
  recentTags,
  onOpenPage,
  onOpenTag,
  onRemoveTag
}: TagResultsViewProps): JSX.Element {
  const [tagInput, setTagInput] = useState('');
  const [tagFeedback, setTagFeedback] = useState<string | null>(null);

  const quickAddTags = useMemo(
    () => recentTags.filter((tag) => !tags.includes(tag)).slice(0, 3),
    [recentTags, tags]
  );

  function handleAddTag(): void {
    const normalizedTag = parseSingleTagInput(tagInput);

    if (!normalizedTag) {
      setTagFeedback('Use a single tag like /history.');
      return;
    }

    if (tags.includes(normalizedTag)) {
      setTagFeedback(`"${normalizedTag}" is already active.`);
      setTagInput('');
      return;
    }

    if (!availableTags.includes(normalizedTag)) {
      setTagFeedback(`No pages currently use "${normalizedTag}".`);
      return;
    }

    onOpenTag(normalizedTag);
    setTagInput('');
    setTagFeedback(null);
  }

  return (
    <section className="content-section">
      <div className="section-header">
        <div className="tag-results-header">
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

          <div className="tag-filter-controls">
            <form
              className="tag-filter-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddTag();
              }}
            >
              <label className="tag-filter-input-shell">
                <span className="tag-filter-label">Add tag</span>
                <input
                  type="text"
                  list="tag-filter-options"
                  className="tag-input tag-filter-input"
                  value={tagInput}
                  onChange={(event) => {
                    setTagInput(event.target.value);
                    if (tagFeedback) {
                      setTagFeedback(null);
                    }
                  }}
                  placeholder="Type /tag or tag"
                  aria-label="Add tag filter"
                />
              </label>
              <button type="submit" className="secondary-button tag-filter-submit">
                Add
              </button>
            </form>

            {tagFeedback ? <p className="tag-filter-feedback">{tagFeedback}</p> : null}

            {quickAddTags.length > 0 ? (
              <div className="recent-tags-strip" aria-label="Recent tags">
                <span className="recent-tags-label">Recent</span>
                <div className="recent-tags-list">
                  {quickAddTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className="inline-tag-button recent-tag-button"
                      onClick={() => onOpenTag(tag)}
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <datalist id="tag-filter-options">
        {availableTags.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>

      {results.length === 0 ? (
        <div className="empty-state">
          <h2>No pages match all selected tags.</h2>
          <p>Try removing a tag or adding a different one.</p>
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
