import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { InlineEditableText } from './InlineEditableText';
import { EditorToolbar, type EditorFormatAction } from './EditorToolbar';
import type { Book, Chapter, Page } from '../types/domain';
import { formatTimestamp } from '../utils/date';
import {
  applyBulletList,
  applyCheckbox,
  applyHeading,
  applyNumberedList,
  wrapSelection,
  type EditorFormattingResult
} from '../utils/editorFormatting';
import { isLoosePage } from '../utils/pageState';
import type { ContentSegment } from '../utils/pageLinks';
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
  const [isEditingContent, setIsEditingContent] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingSelectionRef = useRef<{ start: number; end: number } | null>(null);
  const queuedFormatActionRef = useRef<{ action: EditorFormatAction; start: number; end: number } | null>(null);

  useEffect(() => {
    setSelectedBookId(initialMoveBookId);
  }, [initialMoveBookId]);

  useEffect(() => {
    setSelectedChapterId('');
  }, [selectedBookId]);

  useEffect(() => {
    if (!shouldAutoFocus) return;

    const timeoutId = window.setTimeout(() => {
      // Defer until after the new page has rendered so freshly created pages can
      // jump straight into writing mode without racing the textarea mount.
      setIsEditingContent(true);
      const el = textareaRef.current;
      if (!el) return;

      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [page.id, shouldAutoFocus]);

  useEffect(() => {
    setIsEditingContent(false);
  }, [page.id]);

  useEffect(() => {
    if (!isEditingContent) {
      return;
    }

    // Re-focus after mode switches so clicking the preview behaves like entering
    // an inline editor, not like opening a separate editing surface.
    const timeoutId = window.setTimeout(() => {
      textareaRef.current?.focus();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [isEditingContent]);

  useEffect(() => {
    const textarea = textareaRef.current;
    const pendingSelection = pendingSelectionRef.current;
    if (!textarea || !pendingSelection) {
      return;
    }

    pendingSelectionRef.current = null;
    textarea.focus();
    textarea.setSelectionRange(pendingSelection.start, pendingSelection.end);
  }, [page.content, isEditingContent]);

  useEffect(() => {
    if (!isEditingContent || !textareaRef.current || !queuedFormatActionRef.current) {
      return;
    }

    const queuedAction = queuedFormatActionRef.current;
    queuedFormatActionRef.current = null;
    commitFormatting(buildFormattingResult(queuedAction.action, queuedAction.start, queuedAction.end));
  }, [isEditingContent, page.content]);

  const canMove = useMemo(() => {
    return Boolean(selectedBookId && selectedChapterId);
  }, [selectedBookId, selectedChapterId]);

  const chaptersForSelectedBook = useMemo(
    () => chapters.filter((chapter) => chapter.bookId === selectedBookId),
    [chapters, selectedBookId]
  );

  function commitFormatting(result: EditorFormattingResult): void {
    pendingSelectionRef.current = {
      start: result.selectionStart,
      end: result.selectionEnd
    };
    onChangeContent(result.text);
  }

  function buildFormattingResult(
    action: EditorFormatAction,
    explicitSelectionStart?: number,
    explicitSelectionEnd?: number
  ): EditorFormattingResult {
    const textarea = textareaRef.current;
    const selectionStart = explicitSelectionStart ?? textarea?.selectionStart ?? page.content.length;
    const selectionEnd = explicitSelectionEnd ?? textarea?.selectionEnd ?? page.content.length;

    switch (action) {
      case 'bold':
        return wrapSelection(page.content, selectionStart, selectionEnd, '**', '**', 'bold text');
      case 'italic':
        return wrapSelection(page.content, selectionStart, selectionEnd, '*', '*', 'italic text');
      case 'underline':
        return wrapSelection(page.content, selectionStart, selectionEnd, '<u>', '</u>', 'underlined text');
      case 'heading':
        return applyHeading(page.content, selectionStart, selectionEnd, 2);
      case 'bulletList':
        return applyBulletList(page.content, selectionStart, selectionEnd);
      case 'numberedList':
        return applyNumberedList(page.content, selectionStart, selectionEnd);
      case 'checkbox':
        return applyCheckbox(page.content, selectionStart, selectionEnd);
    }
  }

  function applyFormattingAction(action: EditorFormatAction): void {
    if (!isEditingContent || !textareaRef.current) {
      const fallbackCaret = page.content.length;
      queuedFormatActionRef.current = { action, start: fallbackCaret, end: fallbackCaret };
      setIsEditingContent(true);
      return;
    }

    commitFormatting(buildFormattingResult(action));
  }

  function handleEditorKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>): void {
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
        className={`editor-content-surface ${isEditingContent ? 'is-editing' : 'is-preview'}`}
        style={{ fontSize: `${page.textSize}px` }}
        onClick={() => {
          if (!isEditingContent) {
            setIsEditingContent(true);
          }
        }}
      >
        <EditorToolbar onFormat={applyFormattingAction} />
        {isEditingContent ? (
          <div className="editor-editing-pane">
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={page.content}
              onChange={(event) => onChangeContent(event.target.value)}
              onKeyDown={handleEditorKeyDown}
              onBlur={() => setIsEditingContent(false)}
              placeholder="Start typing..."
              style={{ fontSize: `${page.textSize}px` }}
            />
          </div>
        ) : (
          <div className="editor-content-preview" aria-label="Page content">
            {page.content.trim().length > 0 ? (
              contentSegments.map((segment, index) => {
                if (segment.type === 'text') {
                  return <span key={`text-${index}`}>{segment.text}</span>;
                }

                if (segment.targetPageId) {
                  const targetPageId = segment.targetPageId;
                  return (
                    <button
                      key={`link-${index}`}
                      type="button"
                      className="inline-page-link"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenPage(targetPageId);
                      }}
                    >
                      {segment.displayText}
                    </button>
                  );
                }

                // Unresolved links stay visible instead of disappearing so authors
                // can spot broken references while reading the rendered preview.
                return (
                  <span
                    key={`link-${index}`}
                    className="inline-page-link unresolved"
                    title="Page not found"
                  >
                    {segment.displayText}
                  </span>
                );
              })
            ) : (
              <p className="editor-content-placeholder">Start typing...</p>
            )}
          </div>
        )}
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
