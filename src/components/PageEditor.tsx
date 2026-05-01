import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { InlineEditableText } from './InlineEditableText';
import {
  EditorToolbar,
  TEXT_SIZE_PRESETS,
  type EditorFormatAction,
  type TextSizePresetId
} from './EditorToolbar';
import { PageMetadataPanel } from './PageMetadataPanel';
import { SaveStatusIndicator } from './SaveStatusIndicator';
import { WikiLinkPreview } from './WikiLinkPreview';
import type { Book, Chapter, Page, SaveStatus } from '../types/domain';
import { formatTimestamp } from '../utils/date';
import { isLoosePage } from '../utils/pageState';
import type { ContentSegment, PageTitleLookup } from '../utils/pageLinks';
import { contentToEditableHtml, normalizeEditorHtml } from '../utils/richText';
import { parseSingleTagInput } from '../utils/tags';

interface PageEditorProps {
  page: Page;
  books: Book[];
  chapters: Chapter[];
  parentBook?: Book;
  parentChapter?: Chapter;
  initialMoveBookId: string;
  contentSegments: ContentSegment[];
  pageTitleLookup: PageTitleLookup;
  backlinks: Array<{ pageId: string; title: string; path: string }>;
  saveStatus: SaveStatus;
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
  onRetrySave: () => void;
}

export function PageEditor({
  page,
  books,
  chapters,
  parentBook,
  parentChapter,
  initialMoveBookId,
  contentSegments,
  pageTitleLookup,
  backlinks,
  saveStatus,
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
  onExportPage,
  onRetrySave
}: PageEditorProps): JSX.Element {
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const pageIsLoose = isLoosePage(page);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(initialMoveBookId);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const pendingTextSizeRef = useRef<TextSizePresetId | null>(null);
  const lastAppliedContentRef = useRef<string | null>(null);
  const lastSyncedPageIdRef = useRef<string | null>(null);
  const isSyncingEditorRef = useRef(false);
  const [activeTextSize, setActiveTextSize] = useState<TextSizePresetId>(() => getPresetForLegacyPx(page.textSize).id);

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
  }, [page.id]);

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
      }
    }

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [page.textSize]);

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

  function applyFormattingAction(action: EditorFormatAction): void {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }

    editor.focus();
    restoreSelection();
    document.execCommand('styleWithCSS', false, 'true');

    switch (action) {
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
          <SaveStatusIndicator status={saveStatus} onRetry={onRetrySave} />
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
              onChange={(event) => setTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') {
                  return;
                }

                event.preventDefault();
                const normalizedTag = parseSingleTagInput(tagInput);
                // Keep editor-entered tags on the same normalized path as search
                // filters so clicking a tag always routes back to matching pages.
                if (!normalizedTag || page.tags.includes(normalizedTag)) {
                  setTagInput('');
                  return;
                }

                onChangeTags([...page.tags, normalizedTag]);
                setTagInput('');
              }}
              placeholder="Add tag"
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
                  }}
                  onBlur={() => {
                    syncEditorContent();
                    saveSelection();
                  }}
                  onFocus={() => {
                    updateEditorEmptyState(editorRef.current);
                    saveSelection();
                  }}
                  onKeyDown={handleEditorKeyDown}
                  onKeyUp={saveSelection}
                  onMouseDown={() => {
                    pendingTextSizeRef.current = null;
                  }}
                  onMouseUp={saveSelection}
                  onClick={handleEditorClick}
                  style={{ fontSize: `${page.textSize}px` }}
                />
              </div>
            </>
          ) : (
            <WikiLinkPreview
              content={page.content}
              contentSegments={contentSegments}
              titleLookup={pageTitleLookup}
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
