import type { SearchMode, SearchResult } from '../utils/search';
import { getHighlightedParts, getSearchResultBadgeLabel, getSearchResultPath } from '../utils/search';

interface SearchResultsViewProps {
  query: string;
  mode: SearchMode;
  results: SearchResult[];
  onOpenResult: (result: SearchResult) => void;
}

export function SearchResultsView({
  query,
  mode,
  results,
  onOpenResult
}: SearchResultsViewProps): JSX.Element {
  const trimmedQuery = query.trim();
  const isTagSearch = mode.type === 'tag';
  const isMixedSearch = mode.type === 'mixed';
  const isEmptyTag = mode.type === 'emptyTag';

  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Library Search</p>
          <h1>Search Results</h1>
          <p className="search-subtitle">
            {isMixedSearch
              ? `Results for "${mode.query}" tagged ${mode.tags.map((tag) => `/${tag}`).join(' ')}`
              : isTagSearch
              ? `Tags: ${mode.tags.map((tag) => `/${tag}`).join(' ')}`
              : isEmptyTag
                ? 'Enter a tag after "/" to search by tag.'
                : trimmedQuery
                  ? `Results for "${trimmedQuery}"`
                  : 'Search book titles, chapter titles, and page titles or content.'}
          </p>
        </div>
      </div>

      {!trimmedQuery ? (
        <div className="empty-state">
          <h2>Start a search</h2>
          <p>Type a word or phrase in the search bar to find matching books, chapters, and pages.</p>
        </div>
      ) : isEmptyTag ? (
        <div className="empty-state">
          <h2>Enter a tag</h2>
          <p>Type a tag after "/" to search pages by exact tag, for example `/school`.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h2>No matches found</h2>
          <p>
            {isTagSearch
              ? 'No pages match all selected tags.'
              : isMixedSearch
                ? 'No pages match that text with all selected tags.'
              : 'Try a shorter phrase, different wording, or another exact fragment from the page you remember.'}
          </p>
        </div>
      ) : (
        <div className="stack-list">
          {results.map((result) => (
            <button
              key={`${result.type}-${result.id}`}
              type="button"
              className="search-result-card"
              onClick={() => onOpenResult(result)}
            >
              <div className="search-result-head">
                <div className="search-result-title">
                  {getHighlightedParts(result.title || 'Untitled', query).map((part, index) =>
                    part.isMatch ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>
                  )}
                </div>
                <span className="search-result-badge">{getSearchResultBadgeLabel(result)}</span>
              </div>
              {getSearchResultPath(result) ? <p className="search-result-path">{getSearchResultPath(result)}</p> : null}
              {result.type === 'page' && result.snippet ? (
                <p className="search-result-snippet">
                  {getHighlightedParts(result.snippet, query).map((part, index) =>
                    part.isMatch ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>
                  )}
                </p>
              ) : null}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
