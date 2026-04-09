import type { SearchResult } from '../utils/search';
import { getHighlightedParts } from '../utils/search';

interface SearchResultsViewProps {
  query: string;
  results: SearchResult[];
  onOpenPage: (pageId: string) => void;
}

export function SearchResultsView({
  query,
  results,
  onOpenPage
}: SearchResultsViewProps): JSX.Element {
  const trimmedQuery = query.trim();

  return (
    <section className="content-section">
      <div className="section-header">
        <div>
          <p className="eyebrow">Library Search</p>
          <h1>Search Results</h1>
          <p className="search-subtitle">
            {trimmedQuery ? `Results for "${trimmedQuery}"` : 'Search page titles and note content.'}
          </p>
        </div>
      </div>

      {!trimmedQuery ? (
        <div className="empty-state">
          <h2>Start a search</h2>
          <p>Type a word or phrase in the search bar to find matching pages across books, chapters, and loose pages.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="empty-state">
          <h2>No matches found</h2>
          <p>Try a shorter phrase, different wording, or another exact fragment from the page you remember.</p>
        </div>
      ) : (
        <div className="stack-list">
          {results.map((result) => (
            <button
              key={result.page.id}
              type="button"
              className="search-result-card"
              onClick={() => onOpenPage(result.page.id)}
            >
              <div className="search-result-head">
                <div className="search-result-title">
                  {getHighlightedParts(result.page.title || 'Untitled Page', query).map((part, index) =>
                    part.isMatch ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>
                  )}
                </div>
                <span className="search-result-badge">{result.matchLabel}</span>
              </div>
              <p className="search-result-path">{result.path}</p>
              <p className="search-result-snippet">
                {getHighlightedParts(result.snippet, query).map((part, index) =>
                  part.isMatch ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>
                )}
              </p>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
