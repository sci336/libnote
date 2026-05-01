import { useEffect, useMemo, useState } from 'react';
import { TagSuggestionsDropdown } from './TagSuggestionsDropdown';
import type { TagResult } from '../utils/tags';
import { getTagSuggestions, parseSingleTagInput } from '../utils/tags';

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
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(0);

  const quickAddTags = useMemo(
    () => recentTags.filter((tag) => !tags.includes(tag)).slice(0, 3),
    [recentTags, tags]
  );
  const suggestions = useMemo(
    () =>
      tagInput.trim().length > 0
        ? getTagSuggestions(availableTags, parseSingleTagInput(tagInput) ?? '', { excludeTags: tags })
        : [],
    [availableTags, tagInput, tags]
  );
  const shouldShowSuggestions = suggestionsVisible && suggestions.length > 0;

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(0);
    }
  }, [activeSuggestionIndex, suggestions.length]);

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

  function handleSelectSuggestion(tag: string): void {
    onOpenTag(tag);
    setTagInput('');
    setTagFeedback(null);
    setSuggestionsVisible(false);
    setActiveSuggestionIndex(0);
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
                  <span>/{tag}</span>
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
                  className="tag-input tag-filter-input"
                  value={tagInput}
                  onChange={(event) => {
                    setTagInput(event.target.value);
                    setSuggestionsVisible(true);
                    setActiveSuggestionIndex(0);
                    if (tagFeedback) {
                      setTagFeedback(null);
                    }
                  }}
                  onFocus={() => setSuggestionsVisible(true)}
                  onBlur={() => {
                    window.setTimeout(() => setSuggestionsVisible(false), 120);
                  }}
                  onKeyDown={(event) => {
                    if (!shouldShowSuggestions) {
                      if (event.key === 'Escape') {
                        setSuggestionsVisible(false);
                      }
                      return;
                    }

                    if (event.key === 'ArrowDown') {
                      event.preventDefault();
                      setActiveSuggestionIndex((current) => (current + 1) % suggestions.length);
                      return;
                    }

                    if (event.key === 'ArrowUp') {
                      event.preventDefault();
                      setActiveSuggestionIndex((current) => (current - 1 + suggestions.length) % suggestions.length);
                      return;
                    }

                    if (event.key === 'Enter') {
                      if (suggestions[activeSuggestionIndex]) {
                        event.preventDefault();
                        handleSelectSuggestion(suggestions[activeSuggestionIndex]);
                      }
                      return;
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setSuggestionsVisible(false);
                    }
                  }}
                  placeholder="Type /tag or tag"
                  aria-label="Add tag filter"
                />
                <TagSuggestionsDropdown
                  suggestions={shouldShowSuggestions ? suggestions : []}
                  activeIndex={activeSuggestionIndex}
                  onSelect={handleSelectSuggestion}
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
                      /{tag}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

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
                    /{tag}
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
