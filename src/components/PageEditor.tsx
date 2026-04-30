import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from 'react';
import { InlineEditableText } from './InlineEditableText';
import { EditorToolbar, type EditorFormatAction } from './EditorToolbar';
import type { Book, Chapter, Page } from '../types/domain';
import { formatTimestamp } from '../utils/date';
import { isLoosePage } from '../utils/pageState';
import type { ContentSegment } from '../utils/pageLinks';
import { contentToEditableHtml, contentToPlainText, normalizeEditorHtml } from '../utils/richText';
import { isValidTag, normalizeTag } from '../utils/tags';

interface PageEditorProps {
  page: Page;
  books: Book[];
  chapters: Chapter[];
  initialMoveBookId: string;
  contentSegments: ContentSegment[];
  backlinks: Array<{ pageId: string; title: string; path: string }>;
  shouldAutoFocus?: boolean;
  onChangeTitle: (title: string) => void;
  onChangeContent: (content: string) => void;
  onChangeTextSize: (size: number) => void;
  onChangeTags: (tags: string[]) => void;
  onDelete: () => void;
  onMoveLoosePage: (payload: { chapterId: string }) => void;
  onOpenPage: (pageId: string) => void;
  onOpenTagSearch?: (tag: string) => void;
  onExportPage?: () => void;
}

export function PageEditor({
  page,
  books,
  chapters,
  initialMoveBookId,
  contentSegments,
  backlinks,
  shouldAutoFocus = false,
  onChangeTitle,
  onChangeContent,
  onChangeTextSize,
  onChangeTags,
  onDelete,
  onMoveLoosePage,
  onOpenPage,
  onOpenTagSearch,
  onExportPage
}: PageEditorProps): JSX.Element {
  const pageIsLoose = isLoosePage(page);
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(initialMoveBookId);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const lastAppliedContentRef = useRef<string | null>(null);
  const isSyncingEditorRef = useRef(false);

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
    if (!editor) {
      lastAppliedContentRef.current = nextHtml;
      return;
    }

    if (lastAppliedContentRef.current === nextHtml && editor.innerHTML === nextHtml) {
      return;
    }

    isSyncingEditorRef.current = true;
    editor.innerHTML = nextHtml;
    lastAppliedContentRef.current = nextHtml;
    isSyncingEditorRef.current = false;
  }, [page.id, page.content]);

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

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLDivElement>): void {
    if (event.nativeEvent.isComposing || event.altKey) {
      return;
    }

    const usesPrimaryModifier = event.metaKey || event.ctrlKey;
    if (!usesPrimaryModifier) {
      return;
    }

    const key = event.key.toLowerCase();

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

  const isEditorEmpty = contentToPlainText(page.content).trim().length === 0;

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
                    #{tag}
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
                const normalizedTag = normalizeTag(tagInput);
                // Keep editor-entered tags on the same normalized path as search
                // filters so clicking a tag always routes back to matching pages.
                if (!isValidTag(normalizedTag) || page.tags.includes(normalizedTag)) {
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
          <label className="text-size-control">
            <span>Text Size</span>
            <input
              type="range"
              min="14"
              max="24"
              step="1"
              value={page.textSize}
              onChange={(event) => onChangeTextSize(Number(event.target.value))}
            />
            <span>{page.textSize}px</span>
          </label>

          {pageIsLoose ? (
            <button type="button" className="secondary-button" onClick={() => setShowMovePanel((open) => !open)}>
              Move to Chapter
            </button>
          ) : null}

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

      <div
        className="editor-content-surface is-editing"
        style={{ fontSize: `${page.textSize}px` }}
      >
        <EditorToolbar onFormat={applyFormattingAction} />
        <div className="editor-editing-pane">
          <div
            ref={editorRef}
            className={`editor-rich-text ${isEditorEmpty ? 'is-empty' : ''}`}
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
              normalizeCurrentList();
              syncEditorContent();
              saveSelection();
            }}
            onBlur={() => {
              syncEditorContent();
              saveSelection();
            }}
            onFocus={saveSelection}
            onKeyDown={handleEditorKeyDown}
            onKeyUp={saveSelection}
            onMouseUp={saveSelection}
            onClick={handleEditorClick}
            style={{ fontSize: `${page.textSize}px` }}
          />
        </div>
      </div>

      {backlinks.length > 0 ? (
        <section className="backlinks-section" aria-label="Referenced by">
          <h3>Referenced by</h3>
          <div className="backlinks-list">
            {backlinks.map((backlink) => (
              <button
                key={backlink.pageId}
                type="button"
                className="backlink-item"
                onClick={() => onOpenPage(backlink.pageId)}
              >
                <span className="backlink-title">{backlink.title}</span>
                <span className="backlink-path">{backlink.path}</span>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
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
