import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent as ReactClipboardEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent
} from 'react';
import { InlineEditableText } from './InlineEditableText';
import {
  EditorToolbar,
  TEXT_SIZE_PRESETS,
  type EditorFormatAction,
  type TextSizePresetId
} from './EditorToolbar';
import { PageMetadataPanel } from './PageMetadataPanel';
import { TagSuggestionsDropdown } from './TagSuggestionsDropdown';
import { WikiLinkPreview } from './WikiLinkPreview';
import type { Book, Chapter, Page } from '../types/domain';
import { formatTimestamp } from '../utils/date';
import { isLoosePage } from '../utils/pageState';
import type { ContentSegment, PageTitleLookup } from '../utils/pageLinks';
import {
  detectActiveWikiLinkTrigger,
  getAllPageTitleSuggestions
} from '../utils/pageLinks';
import {
  contentToEditableHtml,
  normalizeEditorHtml,
  sanitizePastedHtml,
  sanitizePastedPlainText
} from '../utils/richText';
import { detectActiveSlashTagTrigger, getAllTagSuggestions, parseSingleTagInput } from '../utils/tags';

export interface PageEditorProps {
  page: Page;
  books: Book[];
  chapters: Chapter[];
  pages: Page[];
  parentBook?: Book;
  parentChapter?: Chapter;
  initialMoveBookId: string;
  contentSegments: ContentSegment[];
  pageTitleLookup: PageTitleLookup;
  wikiLinkDestinationLabels: Map<string, string>;
  backlinks: Array<{ pageId: string; title: string; path: string }>;
  shouldAutoFocus?: boolean;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeTextSize: (size: number) => void;
  onChangeTags: (tags: string[]) => void;
  onDelete: () => void;
  onMoveLoosePage: (payload: { chapterId: string }) => void;
  onOpenPage: (pageId: string) => void;
  onCreatePageFromLink: (title: string) => void;
  onOpenTagSearch?: (tag: string) => void;
  onExportPage?: () => void;
}

type EditorAutocompleteKind = 'link' | 'tag';

interface EditorAutocompleteState {
  kind: EditorAutocompleteKind;
  suggestions: string[];
  activeIndex: number;
  start: number;
  end: number;
}

export function PageEditor({
  page,
  books,
  chapters,
  pages,
  parentBook,
  parentChapter,
  initialMoveBookId,
  contentSegments,
  pageTitleLookup,
  wikiLinkDestinationLabels,
  backlinks,
  shouldAutoFocus = false,
  onChangeTitle,
  onChangeContent,
  onChangeTextSize,
  onChangeTags,
  onDelete,
  onMoveLoosePage,
  onOpenPage,
  onCreatePageFromLink,
  onOpenTagSearch,
  onExportPage
}: PageEditorProps): JSX.Element {
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const pageIsLoose = isLoosePage(page);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(initialMoveBookId);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const [tagSuggestionsVisible, setTagSuggestionsVisible] = useState(false);
  const [activeTagSuggestionIndex, setActiveTagSuggestionIndex] = useState(0);
  const [editorAutocomplete, setEditorAutocomplete] = useState<EditorAutocompleteState | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const pendingTextSizeRef = useRef<TextSizePresetId | null>(null);
  const lastAppliedContentRef = useRef<string | null>(null);
  const lastSyncedPageIdRef = useRef<string | null>(null);
  const isSyncingEditorRef = useRef(false);
  const [activeTextSize, setActiveTextSize] = useState<TextSizePresetId>(() => getPresetForLegacyPx(page.textSize).id);
  const pageTagSuggestions = useMemo(
    () =>
      tagInput.trim().length > 0
        ? getAllTagSuggestions(pages, parseSingleTagInput(tagInput) ?? '', { excludeTags: page.tags })
        : [],
    [page.tags, pages, tagInput]
  );
  const shouldShowPageTagSuggestions = tagSuggestionsVisible && pageTagSuggestions.length > 0;

  useEffect(() => {
    setSelectedBookId(initialMoveBookId);
  }, [initialMoveBookId]);

  useEffect(() => {
    setSelectedChapterId('');
  }, [selectedBookId]);

  useEffect(() => {
    if (!shouldAutoFocus) return;

    const timeoutId = window.setTimeout(() => {
      const el = editorRef.current;
      if (!el) return;

      el.focus();
      placeCaretAtEnd(el);
      saveSelection();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [page.id, shouldAutoFocus]);

  useEffect(() => {
    const editor = editorRef.current;
    const nextHtml = contentToEditableHtml(page.content);
    const normalizedIncomingHtml = normalizeEditorHtml(nextHtml);
    const isNewPage = lastSyncedPageIdRef.current !== page.id;

    lastSyncedPageIdRef.current = page.id;

    if (!editor) {
      lastAppliedContentRef.current = normalizedIncomingHtml;
      return;
    }

    const normalizedCurrentHtml = normalizeEditorHtml(editor.innerHTML);

    // Keep the live contentEditable DOM in place while the user is typing. We
    // only push HTML into the editor when a different page loads or when the
    // incoming content is actually different from what the editor already holds.
    if (!isNewPage && normalizedCurrentHtml === normalizedIncomingHtml) {
      lastAppliedContentRef.current = normalizedIncomingHtml;
      updateEditorEmptyState(editor);
      return;
    }

    if (!isNewPage && document.activeElement === editor) {
      lastAppliedContentRef.current = normalizedIncomingHtml;
      updateEditorEmptyState(editor);
      return;
    }

    isSyncingEditorRef.current = true;
    editor.innerHTML = nextHtml;
    normalizeFontSizeMarkup(editor);
    lastAppliedContentRef.current = normalizedIncomingHtml;
    updateEditorEmptyState(editor);
    updateActiveTextSize();
    isSyncingEditorRef.current = false;
  }, [editorMode, page.id, page.content]);

  useEffect(() => {
    pendingTextSizeRef.current = null;
    updateActiveTextSize();
  }, [page.id, page.textSize]);

  useEffect(() => {
    setEditorMode('edit');
    setEditorAutocomplete(null);
    setTagSuggestionsVisible(false);
  }, [page.id]);

  useEffect(() => {
    if (activeTagSuggestionIndex >= pageTagSuggestions.length) {
      setActiveTagSuggestionIndex(0);
    }
  }, [activeTagSuggestionIndex, pageTagSuggestions.length]);

  useEffect(() => {
    function handleSelectionChange(): void {
      const editor = editorRef.current;
      const selection = window.getSelection();

      if (!editor || !selection || selection.rangeCount === 0) {
        return;
      }

      const range = selection.getRangeAt(0);
      if (editor.contains(range.commonAncestorContainer)) {
        const detectedTextSize = getActiveTextSize(editor, page.textSize);
        setActiveTextSize(
          pendingTextSizeRef.current && range.collapsed ? pendingTextSizeRef.current : detectedTextSize
        );
        updateEditorAutocomplete();
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [page.id, page.textSize, pages]);

  const canMove = useMemo(() => {
    return Boolean(selectedBookId && selectedChapterId);
  }, [selectedBookId, selectedChapterId]);

  const chaptersForSelectedBook = useMemo(
    () => chapters.filter((chapter) => chapter.bookId === selectedBookId),
    [chapters, selectedBookId]
  );

  function saveSelection(): void {
    const selection = window.getSelection();
    const editor = editorRef.current;

    if (!selection || selection.rangeCount === 0 || !editor) {
      return;
    }

    const range = selection.getRangeAt(0);
    if (!editor.contains(range.commonAncestorContainer)) {
      return;
    }

    savedSelectionRef.current = range.cloneRange();
    const detectedTextSize = getActiveTextSize(editor, page.textSize);
    const fallbackTextSize = getPresetForLegacyPx(page.textSize).id;

    if (pendingTextSizeRef.current && range.collapsed && detectedTextSize === fallbackTextSize) {
      setActiveTextSize(pendingTextSizeRef.current);
      return;
    }

    pendingTextSizeRef.current = null;
    setActiveTextSize(detectedTextSize);
  }

  function restoreSelection(): boolean {
    const selection = window.getSelection();
    const editor = editorRef.current;
    const savedRange = savedSelectionRef.current;

    if (!selection || !editor || !savedRange) {
      return false;
    }

    selection.removeAllRanges();
    selection.addRange(savedRange);
    return true;
  }

  function syncEditorContent(): void {
    const editor = editorRef.current;
    if (!editor || isSyncingEditorRef.current) {
      return;
    }

    const normalizedHtml = normalizeEditorHtml(editor.innerHTML);
    lastAppliedContentRef.current = normalizedHtml;
    updateEditorEmptyState(editor);
    onChangeContent(normalizedHtml);
  }

  function updateEditorAutocomplete(): void {
    const editor = editorRef.current;
    const caret = getCaretTextOffset(editor);

    if (!editor || caret === null || document.activeElement !== editor) {
      setEditorAutocomplete(null);
      return;
    }

    const text = editor.textContent ?? '';
    const wikiTrigger = detectActiveWikiLinkTrigger(text, caret);

    if (wikiTrigger) {
      const suggestions = getAllPageTitleSuggestions(pages, wikiTrigger.query, page.id);
      setEditorAutocomplete((current) =>
        suggestions.length > 0
          ? buildNextEditorAutocomplete(current, 'link', suggestions, wikiTrigger.start, wikiTrigger.end)
          : null
      );
      return;
    }

    const tagTrigger = detectActiveSlashTagTrigger(text, caret);

    if (tagTrigger) {
      const suggestions = getAllTagSuggestions(pages, tagTrigger.query);
      setEditorAutocomplete((current) =>
        suggestions.length > 0
          ? buildNextEditorAutocomplete(current, 'tag', suggestions, tagTrigger.start, tagTrigger.end)
          : null
      );
      return;
    }

    setEditorAutocomplete(null);
  }

  function applyEditorSuggestion(suggestion: string): void {
    const editor = editorRef.current;
    const autocomplete = editorAutocomplete;

    if (!editor || !autocomplete) {
      return;
    }

    const replacement = autocomplete.kind === 'link' ? `[[${suggestion}]]` : `/${suggestion}`;
    editor.focus();

    const range = createRangeFromTextOffsets(editor, autocomplete.start, autocomplete.end);
    if (!range) {
      return;
    }

    range.deleteContents();
    const insertedText = document.createTextNode(replacement);
    range.insertNode(insertedText);

    const nextRange = document.createRange();
    nextRange.setStartAfter(insertedText);
    nextRange.collapse(true);

    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(nextRange);

    normalizeFontSizeMarkup(editor);
    syncEditorContent();
    saveSelection();
    setEditorAutocomplete(null);
  }

  function handleAddTagFromInput(): void {
    const normalizedTag = parseSingleTagInput(tagInput);
    // Keep editor-entered tags on the same normalized path as search
    // filters so clicking a tag always routes back to matching pages.
    if (!normalizedTag || page.tags.includes(normalizedTag)) {
      setTagInput('');
      setTagSuggestionsVisible(false);
      return;
    }

    onChangeTags([...page.tags, normalizedTag]);
    setTagInput('');
    setTagSuggestionsVisible(false);
  }

  function applyPageTagSuggestion(tag: string): void {
    if (!page.tags.includes(tag)) {
      onChangeTags([...page.tags, tag]);
    }

    setTagInput('');
    setTagSuggestionsVisible(false);
    setActiveTagSuggestionIndex(0);
  }

  function applyFormattingAction(action: EditorFormatAction): void {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');

    switch (action) {
      case 'undo':
        document.execCommand('undo');
        break;
      case 'redo':
        document.execCommand('redo');
        break;
      case 'bold':
        document.execCommand('bold');
        break;
      case 'italic':
        document.execCommand('italic');
        break;
      case 'underline':
        document.execCommand('underline');
        break;
      case 'highlight':
        document.execCommand('hiliteColor', false, '#fff3a3');
        break;
      case 'heading':
        document.execCommand('formatBlock', false, 'h2');
        break;
      case 'bulletList':
        document.execCommand('insertUnorderedList');
        normalizeCurrentList();
        break;
      case 'numberedList':
        document.execCommand('insertOrderedList');
        normalizeCurrentList();
        break;
      case 'checkbox':
        document.execCommand('insertUnorderedList');
        convertCurrentListToTaskList();
        break;
    }

    normalizeCurrentList();
    syncEditorContent();
    saveSelection();
  }

  function applyTextSize(size: TextSizePresetId): void {
    const editor = editorRef.current;
    const preset = getPreset(size);
    if (!editor) {
      return;
    }

    editor.focus();
    restoreSelection();
    const selection = window.getSelection();
    const appliesToFutureText = Boolean(selection?.rangeCount && selection.getRangeAt(0).collapsed);
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand('fontSize', false, preset.commandSize);
    normalizeFontSizeMarkup(editor);
    pendingTextSizeRef.current = appliesToFutureText ? preset.id : null;
    setActiveTextSize(preset.id);
    syncEditorContent();

    const nextSelection = window.getSelection();
    if (nextSelection?.rangeCount) {
      savedSelectionRef.current = nextSelection.getRangeAt(0).cloneRange();
    }
  }

  function updateActiveTextSize(): void {
    const editor = editorRef.current;
    setActiveTextSize(editor ? getActiveTextSize(editor, page.textSize) : getPresetForLegacyPx(page.textSize).id);
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.nativeEvent.isComposing || event.altKey) {
      return;
    }

    if (editorAutocomplete) {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setEditorAutocomplete((current) =>
          current
            ? {
                ...current,
                activeIndex: (current.activeIndex + 1) % current.suggestions.length
              }
            : current
        );
        return;
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setEditorAutocomplete((current) =>
          current
            ? {
                ...current,
                activeIndex: (current.activeIndex - 1 + current.suggestions.length) % current.suggestions.length
              }
            : current
        );
        return;
      }

      if (event.key === 'Enter' || event.key === 'Tab') {
        const suggestion = editorAutocomplete.suggestions[editorAutocomplete.activeIndex];
        if (suggestion) {
          event.preventDefault();
          applyEditorSuggestion(suggestion);
        }
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        setEditorAutocomplete(null);
        return;
      }
    }

    const key = event.key.toLowerCase();

    if (['arrowup', 'arrowright', 'arrowdown', 'arrowleft', 'home', 'end', 'pageup', 'pagedown'].includes(key)) {
      pendingTextSizeRef.current = null;
    }

    const usesPrimaryModifier = event.metaKey || event.ctrlKey;
    if (!usesPrimaryModifier) {
      return;
    }

    if (!event.shiftKey && key === 'b') {
      event.preventDefault();
      applyFormattingAction('bold');
      return;
    }

    if (!event.shiftKey && key === 'i') {
      event.preventDefault();
      applyFormattingAction('italic');
      return;
    }

    if (!event.shiftKey && key === 'u') {
      event.preventDefault();
      applyFormattingAction('underline');
      return;
    }

    if (event.shiftKey && key === 'h') {
      event.preventDefault();
      applyFormattingAction('highlight');
      return;
    }

    if (event.shiftKey && (key === '8' || key === '*')) {
      event.preventDefault();
      applyFormattingAction('bulletList');
      return;
    }

    if (event.shiftKey && (key === '7' || key === '&')) {
      event.preventDefault();
      applyFormattingAction('numberedList');
    }
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLDivElement>): void {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    const clipboard = event.clipboardData;
    const html = clipboard.getData('text/html');
    const text = clipboard.getData('text/plain');
    const sanitizedHtml = html.trim().length > 0 ? sanitizePastedHtml(html) : sanitizePastedPlainText(text);

    event.preventDefault();

    if (sanitizedHtml.length === 0) {
      return;
    }

    insertHtmlAtCurrentSelection(editor, sanitizedHtml);
    normalizeFontSizeMarkup(editor);
    syncEditorContent();
    saveSelection();
    updateEditorAutocomplete();
  }

  function handleEditorClick(event: ReactMouseEvent<HTMLDivElement>): void {
    const target = event.target instanceof HTMLElement ? event.target : null;
    const taskItem = target?.closest('li[data-task-item="true"]');

    if (taskItem instanceof HTMLLIElement) {
      const bounds = taskItem.getBoundingClientRect();
      const clickedCheckboxArea = event.clientX - bounds.left <= 26;

      if (clickedCheckboxArea) {
        event.preventDefault();
        taskItem.dataset.checked = taskItem.dataset.checked === 'true' ? 'false' : 'true';
        updateEditorEmptyState(editorRef.current);
        syncEditorContent();
      }
    }

    saveSelection();
  }

  function normalizeCurrentList(): void {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;

    if (!editor || !anchorNode) {
      return;
    }

    const currentList = getClosestList(anchorNode, editor);
    if (!currentList) {
      return;
    }

    if (currentList.tagName === 'UL' && currentList.dataset.listType !== 'task') {
      currentList.removeAttribute('data-list-type');
    }

    currentList.querySelectorAll(':scope > li').forEach((item) => {
      if (!(item instanceof HTMLLIElement)) {
        return;
      }

      if (currentList.dataset.listType === 'task') {
        item.dataset.taskItem = 'true';
        item.dataset.checked = item.dataset.checked === 'true' ? 'true' : 'false';
      } else {
        item.removeAttribute('data-task-item');
        item.removeAttribute('data-checked');
      }
    });
  }

  function convertCurrentListToTaskList(): void {
    const editor = editorRef.current;
    const selection = window.getSelection();
    const anchorNode = selection?.anchorNode;

    if (!editor || !anchorNode) {
      return;
    }

    const currentList = getClosestList(anchorNode, editor);
    if (!(currentList instanceof HTMLUListElement)) {
      return;
    }

    currentList.dataset.listType = 'task';
    currentList.querySelectorAll(':scope > li').forEach((item) => {
      if (!(item instanceof HTMLLIElement)) {
        return;
      }

      item.dataset.taskItem = 'true';
      item.dataset.checked = item.dataset.checked === 'true' ? 'true' : 'false';
    });
  }

  return (
    <section className="editor-shell">
      <div className="editor-header">
        <div>
          <InlineEditableText
            value={page.title}
            onSave={onChangeTitle}
            className="editor-title"
            inputClassName="editor-title-input"
            placeholder="Untitled Page"
          />
          <p className="editor-meta">
            Updated {formatTimestamp(page.updatedAt)}
            {pageIsLoose ? ' - Loose Page' : ''}
          </p>
          <div className="tag-editor" aria-label="Page tags">
            <div className="tag-list">
              {page.tags.map((tag) => (
                <span key={tag} className="tag-pill">
                  <button
                    type="button"
                    className="tag-pill-label inline-tag-button page-tag-button"
                    aria-label={`Open tag filter for ${tag}`}
                    onClick={() => onOpenTagSearch?.(tag)}
                  >
                    /{tag}
                  </button>
                  <button
                    type="button"
                    className="tag-pill-remove"
                    aria-label={`Remove tag ${tag}`}
                    onClick={() => onChangeTags(page.tags.filter((existingTag) => existingTag !== tag))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              type="text"
              className="tag-input"
              value={tagInput}
              onChange={(event) => {
                setTagInput(event.target.value);
                setTagSuggestionsVisible(true);
                setActiveTagSuggestionIndex(0);
              }}
              onFocus={() => setTagSuggestionsVisible(true)}
              onBlur={() => {
                window.setTimeout(() => setTagSuggestionsVisible(false), 120);
              }}
              onKeyDown={(event) => {
                if (shouldShowPageTagSuggestions) {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault();
                    setActiveTagSuggestionIndex((current) => (current + 1) % pageTagSuggestions.length);
                    return;
                  }

                  if (event.key === 'ArrowUp') {
                    event.preventDefault();
                    setActiveTagSuggestionIndex(
                      (current) => (current - 1 + pageTagSuggestions.length) % pageTagSuggestions.length
                    );
                    return;
                  }

                  if (event.key === 'Enter' || event.key === 'Tab') {
                    const suggestion = pageTagSuggestions[activeTagSuggestionIndex];
                    if (suggestion) {
                      event.preventDefault();
                      applyPageTagSuggestion(suggestion);
                    }
                    return;
                  }
                }

                if (event.key === 'Escape') {
                  event.preventDefault();
                  setTagSuggestionsVisible(false);
                  return;
                }

                if (event.key !== 'Enter') {
                  return;
                }

                event.preventDefault();
                handleAddTagFromInput();
              }}
              placeholder="Add /tag"
            />
            <TagSuggestionsDropdown
              suggestions={shouldShowPageTagSuggestions ? pageTagSuggestions : []}
              activeIndex={activeTagSuggestionIndex}
              onSelect={applyPageTagSuggestion}
            />
          </div>
        </div>

        <div className="editor-actions">
          {pageIsLoose ? (
            <button type="button" className="secondary-button" onClick={() => setShowMovePanel((open) => !open)}>
              Move to Chapter
            </button>
          ) : null}

          <button
            type="button"
            className="secondary-button"
            onClick={() => setShowMetadataPanel((open) => !open)}
            aria-expanded={showMetadataPanel}
            aria-controls="page-info-panel"
          >
            {showMetadataPanel ? 'Hide Page Info' : 'Show Page Info'}
          </button>

          {onExportPage ? (
            <button type="button" className="secondary-button" onClick={onExportPage}>
              Export Page (.txt)
            </button>
          ) : null}

          <button type="button" className="danger-button" onClick={onDelete}>
            Move to Trash
          </button>
        </div>
      </div>

      {pageIsLoose && showMovePanel ? (
        <div className="move-panel">
          <h3>Move Loose Page into a Chapter</h3>

          <label>
            <span>Book</span>
            <select value={selectedBookId} onChange={(event) => setSelectedBookId(event.target.value)}>
              <option value="">Select a book</option>
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.title}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Chapter</span>
            <select
              value={selectedChapterId}
              onChange={(event) => setSelectedChapterId(event.target.value)}
              disabled={!selectedBookId}
            >
              <option value="">Select a chapter</option>
              {chaptersForSelectedBook.map((chapter) => (
                <option key={chapter.id} value={chapter.id}>
                  {chapter.title}
                </option>
              ))}
            </select>
          </label>

          <div className="move-panel-actions">
            <button
              type="button"
              className="primary-button"
              disabled={!canMove}
              onClick={() => {
                onMoveLoosePage({ chapterId: selectedChapterId });
                setShowMovePanel(false);
                setSelectedChapterId('');
              }}
            >
              Move Page into Chapter
            </button>

            <button type="button" className="secondary-button" onClick={() => setShowMovePanel(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className={`editor-workspace${showMetadataPanel ? ' has-metadata-panel' : ''}`}>
        <div className={`editor-content-surface ${editorMode === 'preview' ? 'is-preview' : 'is-editing'}`}>
          <div className="editor-mode-bar">
            <div className="editor-mode-toggle" role="group" aria-label="Editor mode">
              <button
                type="button"
                className={editorMode === 'edit' ? 'is-active' : ''}
                aria-pressed={editorMode === 'edit'}
                onClick={() => setEditorMode('edit')}
              >
                Edit
              </button>
              <button
                type="button"
                className={editorMode === 'preview' ? 'is-active' : ''}
                aria-pressed={editorMode === 'preview'}
                onClick={() => {
                  syncEditorContent();
                  setEditorMode('preview');
                }}
              >
                Preview
              </button>
            </div>
          </div>

          {editorMode === 'edit' ? (
            <>
              <EditorToolbar
                onFormat={applyFormattingAction}
                activeTextSize={activeTextSize}
                onBeforeTextSizeChange={saveSelection}
                onTextSizeChange={applyTextSize}
              />
              <div className="editor-editing-pane">
                <div
                  ref={editorRef}
                  className="editor-rich-text"
                  contentEditable
                  suppressContentEditableWarning
                  role="textbox"
                  aria-multiline="true"
                  aria-label="Page content"
                  data-placeholder="Start typing..."
                  spellCheck
                  onInput={() => {
                    // Rich content is stored as HTML so formatting survives autosave and
                    // reloads, while search/export/backlink code reads visible plain text
                    // through shared conversion helpers instead of parsing raw tags.
                    normalizeFontSizeMarkup(editorRef.current);
                    normalizeCurrentList();
                    syncEditorContent();
                    saveSelection();
                    updateEditorAutocomplete();
                  }}
                  onBlur={() => {
                    syncEditorContent();
                    saveSelection();
                    window.setTimeout(() => setEditorAutocomplete(null), 120);
                  }}
                  onFocus={() => {
                    updateEditorEmptyState(editorRef.current);
                    saveSelection();
                    updateEditorAutocomplete();
                  }}
                  onKeyDown={handleEditorKeyDown}
                  onPaste={handleEditorPaste}
                  onKeyUp={(event) => {
                    saveSelection();
                    if (['ArrowDown', 'ArrowUp', 'Enter', 'Tab', 'Escape'].includes(event.key)) {
                      return;
                    }
                    updateEditorAutocomplete();
                  }}
                  onMouseDown={() => {
                    pendingTextSizeRef.current = null;
                  }}
                  onMouseUp={() => {
                    saveSelection();
                    updateEditorAutocomplete();
                  }}
                  onClick={handleEditorClick}
                  style={{ fontSize: `${page.textSize}px` }}
                />
                <TagSuggestionsDropdown
                  suggestions={editorAutocomplete?.suggestions ?? []}
                  activeIndex={editorAutocomplete?.activeIndex ?? 0}
                  onSelect={applyEditorSuggestion}
                  ariaLabel={editorAutocomplete?.kind === 'link' ? 'Page link suggestions' : 'Tag suggestions'}
                  prefix={editorAutocomplete?.kind === 'link' ? '' : '/'}
                  className="editor-autocomplete-dropdown"
                />
              </div>
            </>
          ) : (
            <WikiLinkPreview
              content={page.content}
              contentSegments={contentSegments}
              titleLookup={pageTitleLookup}
              destinationLabels={wikiLinkDestinationLabels}
              textSize={page.textSize}
              onOpenPage={onOpenPage}
              onCreatePageFromLink={onCreatePageFromLink}
            />
          )}
        </div>

        {showMetadataPanel ? (
          <PageMetadataPanel
            page={page}
            parentBook={parentBook}
            parentChapter={parentChapter}
            contentSegments={contentSegments}
            wikiLinkDestinationLabels={wikiLinkDestinationLabels}
            backlinks={backlinks}
            onOpenPage={onOpenPage}
            onCreatePageFromLink={onCreatePageFromLink}
            onOpenTagSearch={onOpenTagSearch}
          />
        ) : null}
      </div>
    </section>
  );
}

function updateEditorEmptyState(editor: HTMLDivElement | null): void {
  if (!editor) {
    return;
  }

  editor.dataset.isEmpty = normalizeEditorHtml(editor.innerHTML).length === 0 ? 'true' : 'false';
}

function getClosestList(node: Node, editor: HTMLElement): HTMLOListElement | HTMLUListElement | null {
  const element = node instanceof HTMLElement ? node : node.parentElement;
  const list = element?.closest('ol, ul');

  if (!list || !editor.contains(list)) {
    return null;
  }

  return list as HTMLOListElement | HTMLUListElement;
}

function placeCaretAtEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection) {
    return;
  }

  const range = document.createRange();
  range.selectNodeContents(element);
  range.collapse(false);
  selection.removeAllRanges();
  selection.addRange(range);
}

function insertHtmlAtCurrentSelection(editor: HTMLElement, html: string): void {
  let selection = window.getSelection();

  if (!selection || selection.rangeCount === 0 || !editor.contains(selection.getRangeAt(0).commonAncestorContainer)) {
    editor.focus();
    placeCaretAtEnd(editor);
    selection = window.getSelection();
  }

  if (!selection || selection.rangeCount === 0) {
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();

  const template = document.createElement('template');
  template.innerHTML = html;
  const fragment = template.content;
  const lastInsertedNode = fragment.lastChild;

  range.insertNode(fragment);

  if (!lastInsertedNode) {
    return;
  }

  const nextRange = document.createRange();
  nextRange.setStartAfter(lastInsertedNode);
  nextRange.collapse(true);
  selection.removeAllRanges();
  selection.addRange(nextRange);
}

function getCaretTextOffset(editor: HTMLElement | null): number | null {
  const selection = window.getSelection();

  if (!editor || !selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  if (!range.collapsed || !editor.contains(range.commonAncestorContainer)) {
    return null;
  }

  const textOffset = getTextOffsetForDomPosition(editor, range.endContainer, range.endOffset);
  if (textOffset !== null) {
    return textOffset;
  }

  const fallbackRange = range.cloneRange();
  fallbackRange.selectNodeContents(editor);
  fallbackRange.setEnd(range.endContainer, range.endOffset);
  return fallbackRange.toString().length;
}

function buildNextEditorAutocomplete(
  current: EditorAutocompleteState | null,
  kind: EditorAutocompleteKind,
  suggestions: string[],
  start: number,
  end: number
): EditorAutocompleteState {
  const keepsActiveSuggestion =
    current?.kind === kind &&
    current.start === start &&
    current.end === end &&
    current.suggestions.join('\n') === suggestions.join('\n');

  return {
    kind,
    suggestions,
    activeIndex: keepsActiveSuggestion ? Math.min(current.activeIndex, suggestions.length - 1) : 0,
    start,
    end
  };
}

function createRangeFromTextOffsets(editor: HTMLElement, startOffset: number, endOffset: number): Range | null {
  const start = Math.max(0, startOffset);
  const end = Math.max(start, endOffset);
  const startPosition = getTextNodePosition(editor, start);
  const endPosition = getTextNodePosition(editor, end);

  if (!startPosition || !endPosition) {
    return null;
  }

  const range = document.createRange();
  range.setStart(startPosition.node, startPosition.offset);
  range.setEnd(endPosition.node, endPosition.offset);
  return range;
}

function getTextOffsetForDomPosition(root: HTMLElement, container: Node, offset: number): number | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let current = walker.nextNode();
  let textOffset = 0;

  if (container.nodeType === Node.TEXT_NODE) {
    while (current) {
      const textNode = current as Text;
      if (textNode === container) {
        return textOffset + Math.max(0, Math.min(offset, textNode.data.length));
      }

      textOffset += textNode.data.length;
      current = walker.nextNode();
    }

    return null;
  }

  if (container instanceof Element) {
    const childAtOffset = container.childNodes[offset] ?? null;

    while (current) {
      const textNode = current as Text;
      if (
        childAtOffset &&
        (textNode === childAtOffset || (childAtOffset instanceof Element && childAtOffset.contains(textNode)))
      ) {
        return textOffset;
      }

      textOffset += textNode.data.length;
      current = walker.nextNode();
    }

    return textOffset;
  }

  return null;
}

function getTextNodePosition(root: HTMLElement, targetOffset: number): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let remainingOffset = targetOffset;
  let current = walker.nextNode();
  let lastTextNode: Text | null = null;

  while (current) {
    const textNode = current as Text;
    const textLength = textNode.data.length;
    lastTextNode = textNode;

    if (remainingOffset <= textLength) {
      return {
        node: textNode,
        offset: remainingOffset
      };
    }

    remainingOffset -= textLength;
    current = walker.nextNode();
  }

  if (lastTextNode) {
    return {
      node: lastTextNode,
      offset: lastTextNode.data.length
    };
  }

  const textNode = document.createTextNode('');
  root.appendChild(textNode);
  return {
    node: textNode,
    offset: 0
  };
}

function getPreset(size: TextSizePresetId): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.find((preset) => preset.id === size) ?? TEXT_SIZE_PRESETS[1];
}

function getPresetForLegacyPx(size: number): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.reduce((closest, preset) => {
    return Math.abs(preset.legacyPx - size) < Math.abs(closest.legacyPx - size) ? preset : closest;
  }, TEXT_SIZE_PRESETS[1]);
}

function getActiveTextSize(editor: HTMLElement, fallbackPx: number): TextSizePresetId {
  const selection = window.getSelection();
  const node = selection && selection.rangeCount > 0 ? selection.focusNode ?? selection.anchorNode : null;
  const startElement = getSelectionElement(node, editor);
  const styledElement = findFontSizedAncestor(startElement, editor);

  if (!styledElement) {
    return getPresetForLegacyPx(fallbackPx).id;
  }

  return getPresetForComputedFontSize(styledElement).id;
}

function getSelectionElement(node: Node | null, editor: HTMLElement): HTMLElement {
  if (!node || !editor.contains(node)) {
    return editor;
  }

  if (node instanceof HTMLElement) {
    return node;
  }

  return node.parentElement ?? editor;
}

function findFontSizedAncestor(element: HTMLElement, editor: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = element;

  while (current && current !== editor) {
    if (current.style.fontSize || (current instanceof HTMLFontElement && current.size)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getPresetForComputedFontSize(element: HTMLElement): (typeof TEXT_SIZE_PRESETS)[number] {
  const fontSize = window.getComputedStyle(element).fontSize;
  const px = Number.parseFloat(fontSize);

  if (!Number.isFinite(px)) {
    return TEXT_SIZE_PRESETS[1];
  }

  const rootPx = Number.parseFloat(window.getComputedStyle(document.documentElement).fontSize) || 16;
  const rem = px / rootPx;

  return TEXT_SIZE_PRESETS.reduce((closest, preset) => {
    const presetRem = Number.parseFloat(preset.fontSize);
    return Math.abs(presetRem - rem) < Math.abs(Number.parseFloat(closest.fontSize) - rem) ? preset : closest;
  }, TEXT_SIZE_PRESETS[1]);
}

function normalizeFontSizeMarkup(editor: HTMLElement | null): void {
  if (!editor) {
    return;
  }

  editor.querySelectorAll('font[size]').forEach((fontElement) => {
    if (!(fontElement instanceof HTMLFontElement)) {
      return;
    }

    const preset = getPresetForCommandSize(fontElement.size);
    const span = document.createElement('span');
    span.style.fontSize = preset.fontSize;

    while (fontElement.firstChild) {
      span.appendChild(fontElement.firstChild);
    }

    fontElement.replaceWith(span);
  });

  editor.querySelectorAll<HTMLElement>('[style*="font-size"]').forEach((element) => {
    const normalizedPreset = getPresetForStyleFontSize(element.style.fontSize);
    if (normalizedPreset) {
      element.style.fontSize = normalizedPreset.fontSize;
    }
  });
}

function getPresetForCommandSize(size: string): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.find((preset) => preset.commandSize === size) ?? TEXT_SIZE_PRESETS[1];
}

function getPresetForStyleFontSize(fontSize: string): (typeof TEXT_SIZE_PRESETS)[number] | null {
  const normalized = fontSize.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  const keywordMap: Record<string, TextSizePresetId> = {
    small: 'small',
    medium: 'normal',
    large: 'large',
    'x-large': 'extraLarge',
    'xx-large': 'huge',
    '-webkit-xxx-large': 'huge'
  };
  const keywordPreset = keywordMap[normalized];

  if (keywordPreset) {
    return getPreset(keywordPreset);
  }

  return TEXT_SIZE_PRESETS.find((preset) => preset.fontSize === normalized) ?? null;
}
