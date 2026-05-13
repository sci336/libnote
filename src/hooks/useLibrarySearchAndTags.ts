import { useMemo, useState } from 'react';
import type { LibraryData, ViewState } from '../types/domain';
import { buildSearchIndex, normalizeSearchQuery, parseSearchInput, searchPages, searchTrashedEntities } from '../utils/search';
import { formatTagQuery, normalizeTag, normalizeTagList, parseTagQuery } from '../utils/tags';

interface UseLibrarySearchAndTagsOptions {
  data: LibraryData | null;
  view: ViewState;
  navigateToView: (
    nextView: ViewState,
    options?: { pushHistory?: boolean; shouldCloseSidebar?: boolean }
  ) => void;
  replaceView: (nextView: ViewState, options?: { shouldCloseSidebar?: boolean }) => void;
  closeSidebarOnMobile: () => void;
}

export function useLibrarySearchAndTags({
  data,
  view,
  navigateToView,
  replaceView,
  closeSidebarOnMobile
}: UseLibrarySearchAndTagsOptions) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOriginView, setSearchOriginView] = useState<ViewState>({ type: 'root' });
  const [tagOriginView, setTagOriginView] = useState<ViewState>({ type: 'root' });
  const [recentTags, setRecentTags] = useState<string[]>([]);

  const normalizedSearchQuery = useMemo(() => normalizeSearchQuery(searchQuery), [searchQuery]);
  // Building the search index is the expensive part of search, so keep it lazy
  // until the user is actively searching or has typed something meaningful.
  const shouldBuildSearchIndex = view.type === 'search' || normalizedSearchQuery.length > 0;
  const searchIndex = useMemo(
    () => (data && shouldBuildSearchIndex ? buildSearchIndex(data) : null),
    [data, shouldBuildSearchIndex]
  );
  const searchResults = useMemo(
    () => (searchIndex ? searchPages(searchQuery, searchIndex) : []),
    [searchIndex, searchQuery]
  );
  const trashSearchResults = useMemo(
    () => (searchIndex ? searchTrashedEntities(searchQuery, searchIndex) : []),
    [searchIndex, searchQuery]
  );
  const searchMode = useMemo(() => parseSearchInput(searchQuery), [searchQuery]);

  function resetSearchAndTags(): void {
    setSearchQuery('');
    setRecentTags([]);
    setSearchOriginView({ type: 'root' });
    setTagOriginView({ type: 'root' });
  }

  function rememberRecentTags(tags: string[]): void {
    const normalizedTags = normalizeTagList(tags);
    if (normalizedTags.length === 0) {
      return;
    }

    setRecentTags((currentTags) => {
      const nextTags = [...currentTags];

      // Reinsert tags at the front without duplicates so recent tag chips behave
      // like a small MRU list across typed filters and clicked tags.
      for (const tag of [...normalizedTags].reverse()) {
        const existingIndex = nextTags.indexOf(tag);
        if (existingIndex !== -1) {
          nextTags.splice(existingIndex, 1);
        }

        nextTags.unshift(tag);
      }

      return nextTags;
    });
  }

  function getTagViewExitTarget(): ViewState {
    return tagOriginView.type === 'tag' ? { type: 'root' } : tagOriginView;
  }

  function applyTagView(nextRawTags: string[], options?: { shouldCloseSidebar?: boolean }): void {
    const nextTags = normalizeTagList(nextRawTags);

    if (nextTags.length === 0) {
      setSearchQuery('');
      replaceView(getTagViewExitTarget());
      if (options?.shouldCloseSidebar) {
        closeSidebarOnMobile();
      }
      return;
    }

    if (view.type !== 'tag') {
      // Preserve the non-tag origin once, even when tag mode starts from search,
      // so removing the last active tag exits to the place the user came from.
      setTagOriginView(view.type === 'search' ? searchOriginView : view);
    }

    rememberRecentTags(nextTags);
    setSearchQuery(formatTagQuery(nextTags));
    if (view.type === 'tag') {
      replaceView({ type: 'tag', tags: nextTags });
    } else {
      navigateToView({ type: 'tag', tags: nextTags }, { pushHistory: true });
    }

    if (options?.shouldCloseSidebar) {
      closeSidebarOnMobile();
    }
  }

  function handleSearchChange(value: string): void {
    setSearchQuery(value);
    const parsedTags = parseTagQuery(value);
    if (parsedTags && parsedTags.length > 0) {
      // Route tag-only queries into the dedicated tag view so typed filters,
      // clicked tags, and tag removal all operate on the same source of truth.
      applyTagView(parsedTags);
      return;
    }

    const normalizedQuery = normalizeSearchQuery(value);

    if (normalizedQuery) {
      // Remember where search started so "back" returns to the prior context
      // instead of treating search like a dead-end screen.
      if (view.type !== 'search') {
        setSearchOriginView(view);
      }

      if (view.type === 'search') {
        replaceView({ type: 'search', query: value });
      } else {
        navigateToView({ type: 'search', query: value }, { pushHistory: true });
      }
      return;
    }

    if (view.type === 'tag') {
      replaceView(getTagViewExitTarget());
    }

    if (view.type === 'search') {
      replaceView({ type: 'search', query: '' });
    }
  }

  function handleSearchFocus(): void {
    if (view.type !== 'search') {
      setSearchOriginView(view);
      navigateToView({ type: 'search', query: searchQuery }, { pushHistory: true });
    }
  }

  function handleOpenTag(tag: string): void {
    const normalizedTag = normalizeTag(tag);
    if (!normalizedTag) {
      return;
    }

    if (view.type === 'tag') {
      // Clicking an additional tag refines the current intersection instead of
      // throwing away the active tag route.
      applyTagView([...view.tags, normalizedTag], { shouldCloseSidebar: true });
      return;
    }

    applyTagView([normalizedTag], { shouldCloseSidebar: true });
  }

  function handleOpenTags(): void {
    setSearchQuery('');

    if (view.type !== 'tag') {
      setTagOriginView(view.type === 'search' ? searchOriginView : view);
    }

    navigateToView({ type: 'tag', tags: [] }, { shouldCloseSidebar: true });
  }

  function handleRemoveActiveTag(tag: string): void {
    if (view.type !== 'tag') {
      return;
    }

    const normalizedTag = normalizeTag(tag);
    const nextTags = view.tags.filter((activeTag) => activeTag !== normalizedTag);

    if (nextTags.length === 0) {
      // Clearing the last tag exits tag mode entirely so the search bar and
      // visible route do not drift out of sync.
      applyTagView([], { shouldCloseSidebar: true });
      return;
    }

    applyTagView(nextTags);
  }

  function renameRecentTag(oldTag: string, newTag: string): void {
    setRecentTags((currentTags) =>
      normalizeTagList(currentTags.map((tag) => (tag === oldTag ? newTag : tag)))
    );
  }

  function deleteRecentTag(tag: string): void {
    setRecentTags((currentTags) => currentTags.filter((currentTag) => currentTag !== tag));
  }

  function mergeRecentTags(sourceTag: string, targetTag: string): void {
    setRecentTags((currentTags) =>
      normalizeTagList(currentTags.map((tag) => (tag === sourceTag ? targetTag : tag)))
    );
  }

  return {
    searchQuery,
    searchOriginView,
    tagOriginView,
    recentTags,
    searchResults,
    trashSearchResults,
    searchMode,
    resetSearchAndTags,
    handleSearchChange,
    handleSearchFocus,
    handleOpenTags,
    handleOpenTag,
    handleRemoveActiveTag,
    renameRecentTag,
    deleteRecentTag,
    mergeRecentTags
  };
}
