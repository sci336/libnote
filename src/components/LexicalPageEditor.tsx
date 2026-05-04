import { useEffect, useMemo, useState } from 'react';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list';
import { $createHeadingNode } from '@lexical/rich-text';
import { $setBlocksType } from '@lexical/selection';
import {
  $getSelection,
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  PASTE_COMMAND,
  type EditorState,
  type LexicalEditor,
  type PasteCommandType
} from 'lexical';
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
import type { PageEditorProps } from './PageEditor';
import { formatTimestamp } from '../utils/date';
import {
  LIBNOTE_LEXICAL_NODES,
  insertSanitizedHtmlIntoLexicalEditor,
  lexicalEditorToHtml,
  loadHtmlIntoLexicalEditor,
  sanitizeClipboardToHtml
} from '../utils/lexicalRichText';
import { normalizeTagList, parseSingleTagInput } from '../utils/tags';
import { isLoosePage } from '../utils/pageState';

export function LexicalPageEditor({
  page,
  books,
  chapters,
  parentBook,
  parentChapter,
  initialMoveBookId,
  contentSegments,
  pageTitleLookup,
  wikiLinkDestinationLabels,
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
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(initialMoveBookId);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const pageIsLoose = isLoosePage(page);
  const activeTextSize = getPresetForLegacyPx(page.textSize).id;
  const chaptersForSelectedBook = useMemo(
    () => chapters.filter((chapter) => chapter.bookId === selectedBookId),
    [chapters, selectedBookId]
  );
  const canMove = Boolean(selectedBookId && selectedChapterId);
  const initialConfig = useMemo(
    () => ({
      namespace: `LibNoteLexicalPrototype-${page.id}`,
      nodes: LIBNOTE_LEXICAL_NODES,
      editorState(editor: LexicalEditor) {
        loadHtmlIntoLexicalEditor(editor, page.content);
      },
      onError(error: Error) {
        console.error('Lexical editor error', error);
      }
    }),
    [page.content, page.id]
  );

  useEffect(() => {
    setSelectedBookId(initialMoveBookId);
    setSelectedChapterId('');
  }, [initialMoveBookId]);

  function addTagFromInput(): void {
    const tag = parseSingleTagInput(tagInput);
    if (!tag) {
      setTagInput('');
      return;
    }

    onChangeTags(normalizeTagList([...page.tags, tag]));
    setTagInput('');
  }

  return (
    <section className="editor-shell lexical-editor-shell">
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
          <div className="lexical-prototype-note" role="status">
            Lexical prototype enabled. Current notes still save as compatible HTML.
          </div>
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
                    x
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
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addTagFromInput();
                }
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
            <select
              value={selectedBookId}
              onChange={(event) => {
                setSelectedBookId(event.target.value);
                setSelectedChapterId('');
              }}
            >
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
                onClick={() => setEditorMode('preview')}
              >
                Preview
              </button>
            </div>
          </div>

          {editorMode === 'edit' ? (
            <LexicalComposer key={page.id} initialConfig={initialConfig}>
              <LexicalToolbar activeTextSize={activeTextSize} onChangeTextSize={onChangeTextSize} />
              <div className="editor-editing-pane lexical-editing-pane">
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable
                      className="editor-rich-text lexical-rich-text"
                      aria-label="Page content"
                      spellCheck
                      style={{ fontSize: `${page.textSize}px` }}
                    />
                  }
                  placeholder={<div className="lexical-placeholder">Start typing...</div>}
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
                <LexicalChangePlugin onChangeContent={onChangeContent} />
                <LexicalPasteSanitizerPlugin />
                {shouldAutoFocus ? <AutoFocusPlugin /> : null}
              </div>
            </LexicalComposer>
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

function LexicalToolbar({
  activeTextSize,
  onChangeTextSize
}: {
  activeTextSize: TextSizePresetId;
  onChangeTextSize: (size: number) => void;
}): JSX.Element {
  const [editor] = useLexicalComposerContext();

  function applyFormat(action: EditorFormatAction): void {
    switch (action) {
      case 'bold':
      case 'italic':
      case 'underline':
        editor.dispatchCommand(FORMAT_TEXT_COMMAND, action);
        break;
      case 'heading':
        editor.update(() => {
          $setBlocksType($getSelection(), () => $createHeadingNode('h2'));
        });
        break;
      case 'bulletList':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        break;
      case 'numberedList':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        break;
      case 'highlight':
      case 'checkbox':
        break;
    }
  }

  return (
    <EditorToolbar
      onFormat={applyFormat}
      activeTextSize={activeTextSize}
      onBeforeTextSizeChange={() => undefined}
      onTextSizeChange={(size) => onChangeTextSize(getPreset(size).legacyPx)}
    />
  );
}

function LexicalChangePlugin({ onChangeContent }: { onChangeContent: (content: string) => void }): JSX.Element {
  const [editor] = useLexicalComposerContext();

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState: EditorState) => {
        editorState.read(() => {
          onChangeContent(lexicalEditorToHtml(editor));
        });
      }}
    />
  );
}

function LexicalPasteSanitizerPlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () => {
      return editor.registerCommand(
        PASTE_COMMAND,
        (event: PasteCommandType) => {
          if (!(event instanceof ClipboardEvent) || !event.clipboardData) {
            return false;
          }

          const sanitizedHtml = sanitizeClipboardToHtml(
            event.clipboardData.getData('text/html'),
            event.clipboardData.getData('text/plain')
          );
          if (!sanitizedHtml) {
            return true;
          }

          event.preventDefault();
          editor.update(() => {
            insertSanitizedHtmlIntoLexicalEditor(editor, sanitizedHtml);
          });
          return true;
        },
        COMMAND_PRIORITY_HIGH
      );
    },
    [editor]
  );

  return null;
}

function getPreset(size: TextSizePresetId): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.find((preset) => preset.id === size) ?? TEXT_SIZE_PRESETS[1];
}

function getPresetForLegacyPx(size: number): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.reduce((closest, preset) => {
    return Math.abs(preset.legacyPx - size) < Math.abs(closest.legacyPx - size) ? preset : closest;
  }, TEXT_SIZE_PRESETS[1]);
}
