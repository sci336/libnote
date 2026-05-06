import { useEffect, useMemo, useState } from 'react';
import type { SearchMode, SearchResult } from '../utils/search';
import { SEARCH_RESULT_LIMIT, getHighlightedParts, getSearchResultBadgeLabel, getSearchResultPath } from '../utils/search';

type SearchFilter = 'all' | 'pages' | 'books' | 'chapters' | 'loosePages' | 'trash';

interface SearchResultsViewProps {
  query: string;
  mode: SearchMode;
  results: SearchResult[];
  trashResults: SearchResult[];
  onOpenResult: (result: SearchResult) => void;
}

export function SearchResultsView({
  query,
  mode,
  results,
  trashResults,
  onOpenResult
}: SearchResultsViewProps): JSX.Element {
  const [activeFilter, setActiveFilter] = useState<SearchFilter>('all');
  const trimmedQuery = query.trim();
  const isTagSearch = mode.type === 'tag';
  const isMixedSearch = mode.type === 'mixed';
  const isEmptyTag = mode.type === 'emptyTag';
  const filteredResults = useMemo(
    () => filterSearchResults(results, trashResults, activeFilter),
    [activeFilter, results, trashResults]
  );
  const filterOptions = useMemo(
    () => buildFilterOptions(results, trashResults),
    [results, trashResults]
  );
  const isShowingResultLimit = filteredResults.length >= SEARCH_RESULT_LIMIT;

  useEffect(() => {
    setActiveFilter('all');
  }, [trimmedQuery]);

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

      {trimmedQuery && !isEmptyTag ? (
        <div className="search-filter-row" role="group" aria-label="Search result filters">
          {filterOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`search-filter-button ${activeFilter === option.value ? 'is-active' : ''}`}
              aria-pressed={activeFilter === option.value}
              onClick={() => setActiveFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}

      {isShowingResultLimit ? (
        <p className="search-subtitle">
          Showing the first {SEARCH_RESULT_LIMIT} matches. Add more specific words or tags to narrow the list.
        </p>
      ) : null}

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
      ) : filteredResults.length === 0 ? (
        <div className="empty-state">
          <h2>{getEmptyStateTitle(activeFilter)}</h2>
          <p>
            {getEmptyStateMessage(activeFilter, isTagSearch, isMixedSearch)}
          </p>
        </div>
      ) : (
        <div className="stack-list">
          {filteredResults.map((result) => (
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

function buildFilterOptions(
  results: SearchResult[],
  trashResults: SearchResult[]
): Array<{ value: SearchFilter; label: string }> {
  const counts = results.reduce(
    (nextCounts, result) => {
      if (result.type === 'book') {
        nextCounts.books += 1;
      } else if (result.type === 'chapter') {
        nextCounts.chapters += 1;
      } else if (isLoosePageResult(result)) {
        nextCounts.loosePages += 1;
      } else if (isBookPageResult(result)) {
        nextCounts.pages += 1;
      }

      return nextCounts;
    },
    { pages: 0, books: 0, chapters: 0, loosePages: 0 }
  );

  const options: Array<{ value: SearchFilter; label: string }> = [
    { value: 'all', label: 'All' },
    { value: 'pages', label: `Pages (${counts.pages})` },
    { value: 'books', label: `Books (${counts.books})` },
    { value: 'chapters', label: `Chapters (${counts.chapters})` },
    { value: 'loosePages', label: `Loose Pages (${counts.loosePages})` }
  ];

  options.push({ value: 'trash', label: `Trash (${trashResults.length})` });

  return options;
}

function filterSearchResults(
  results: SearchResult[],
  trashResults: SearchResult[],
  activeFilter: SearchFilter
): SearchResult[] {
  if (activeFilter === 'all') {
    return results;
  }

  if (activeFilter === 'trash') {
    return trashResults;
  }

  if (activeFilter === 'pages') {
    return results.filter(isBookPageResult);
  }

  if (activeFilter === 'loosePages') {
    return results.filter(isLoosePageResult);
  }

  if (activeFilter === 'books') {
    return results.filter((result) => result.type === 'book');
  }

  return results.filter((result) => result.type === 'chapter');
}

function isBookPageResult(result: SearchResult): boolean {
  return result.type === 'page' && !result.isLoosePage;
}

function isLoosePageResult(result: SearchResult): boolean {
  return result.type === 'page' && result.isLoosePage;
}

function getEmptyStateTitle(activeFilter: SearchFilter): string {
  if (activeFilter === 'all') {
    return 'No matches found';
  }

  return `No matching ${getFilterEmptyLabel(activeFilter)} found`;
}

function getEmptyStateMessage(activeFilter: SearchFilter, isTagSearch: boolean, isMixedSearch: boolean): string {
  if (activeFilter === 'trash') {
    return 'No trashed items matched this search.';
  }

  if (activeFilter === 'loosePages') {
    return 'No matching loose pages found.';
  }

  if (activeFilter === 'chapters') {
    return 'No matching chapters found.';
  }

  if (activeFilter === 'books') {
    return 'No matching books found.';
  }

  if (activeFilter === 'pages') {
    return 'No matching pages found.';
  }

  if (isTagSearch) {
    return 'No pages match all selected tags.';
  }

  if (isMixedSearch) {
    return 'No pages match that text with all selected tags.';
  }

  return 'Try a shorter phrase, different wording, or another exact fragment from the page you remember.';
}

function getFilterEmptyLabel(activeFilter: SearchFilter): string {
  if (activeFilter === 'loosePages') {
    return 'loose pages';
  }

  if (activeFilter === 'trash') {
    return 'trashed items';
  }

  return activeFilter;
}
