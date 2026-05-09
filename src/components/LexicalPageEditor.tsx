import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent as ReactFormEvent,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import {
  $isListItemNode,
  $isListNode,
  INSERT_CHECK_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  type ListNode
} from '@lexical/list';
import { $createHeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { $patchStyleText, $getSelectionStyleValueForProperty, $setBlocksType } from '@lexical/selection';
import {
  $getSelection,
  $getRoot,
  $createParagraphNode,
  $createRangeSelection,
  $isRangeSelection,
  $isTextNode,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  FORMAT_TEXT_COMMAND,
  KEY_ARROW_DOWN_COMMAND,
  KEY_ARROW_UP_COMMAND,
  KEY_ENTER_COMMAND,
  KEY_ESCAPE_COMMAND,
  KEY_TAB_COMMAND,
  PASTE_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND,
  type EditorState,
  type LexicalEditor,
  type LexicalNode,
  type PasteCommandType,
  type RangeSelection,
  type TextNode
} from 'lexical';
import { InlineEditableText } from './InlineEditableText';
import {
  EditorToolbar,
  TEXT_SIZE_PRESETS,
  type EditorFormatAction,
  type TextSizePresetId
} from './EditorToolbar';
import { PageMetadataPanel } from './PageMetadataPanel';
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
import {
  detectActiveSlashTagTrigger,
  getAllTagSuggestions,
  normalizeTagList,
  parseSingleTagInput
} from '../utils/tags';
import { isLoosePage } from '../utils/pageState';
import {
  detectActiveWikiLinkTrigger,
  getPageTitleAutocompleteSuggestions,
  type PageTitleAutocompleteSuggestion
} from '../utils/pageLinks';

type LexicalAutocompleteKind = 'link' | 'tag';

type LexicalAutocompleteSuggestion =
  | (PageTitleAutocompleteSuggestion & { kind: 'link' })
  | { kind: 'tag'; tag: string };

interface LexicalAutocompleteState {
  kind: LexicalAutocompleteKind;
  suggestions: LexicalAutocompleteSuggestion[];
  activeIndex: number;
  textNodeKey: string;
  start: number;
  end: number;
  position: LexicalAutocompletePosition;
}

interface LexicalAutocompletePosition {
  top: number;
  left: number;
  width: number;
}

export function LexicalPageEditor({
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
  const [showMovePanel, setShowMovePanel] = useState(false);
  const [showMetadataPanel, setShowMetadataPanel] = useState(false);
  const [selectedBookId, setSelectedBookId] = useState(initialMoveBookId);
  const [selectedChapterId, setSelectedChapterId] = useState('');
  const [tagInput, setTagInput] = useState('');
  const tagInputRef = useRef<HTMLInputElement | null>(null);
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
      theme: {
        text: {
          underline: 'lexical-text-underline',
          strikethrough: 'lexical-text-strikethrough'
        },
        list: {
          checklist: 'lexical-checklist',
          listitem: 'lexical-listitem',
          listitemChecked: 'lexical-listitem-checked',
          listitemUnchecked: 'lexical-listitem-unchecked'
        }
      },
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
      focusTagInput();
      return;
    }

    onChangeTags(normalizeTagList([...page.tags, tag]));
    setTagInput('');
    focusTagInput();
  }

  function focusTagInput(): void {
    window.setTimeout(() => tagInputRef.current?.focus(), 0);
  }

  function handleTagSubmit(event: ReactFormEvent<HTMLFormElement>): void {
    event.preventDefault();
    addTagFromInput();
  }

  function handleTagKeyDown(event: ReactKeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setTagInput('');
      (event.target as HTMLInputElement).blur();
      return;
    }

    if (isTagSubmitKey(event)) {
      event.preventDefault();
      event.stopPropagation();
      addTagFromInput();
    }
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
            <form className="tag-input-form" onSubmit={handleTagSubmit}>
              <input
                ref={tagInputRef}
                type="text"
                className="tag-input"
                value={tagInput}
                aria-label="Add tag"
                enterKeyHint="done"
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add /tag"
              />
            </form>
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
        <div
          className="move-panel"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              setShowMovePanel(false);
            }
          }}
        >
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
                    />
                  }
                  placeholder={<div className="lexical-placeholder">Start typing...</div>}
                  ErrorBoundary={LexicalErrorBoundary}
                />
                <HistoryPlugin />
                <ListPlugin />
                <CheckListPlugin />
                <LexicalChangePlugin onChangeContent={onChangeContent} />
                <LexicalPasteSanitizerPlugin />
                <LexicalAutocompletePlugin
                  pages={pages}
                  books={books}
                  chapters={chapters}
                  currentPageId={page.id}
                />
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
  const [activeFormats, setActiveFormats] = useState<Partial<Record<EditorFormatAction, boolean>>>({});
  const [selectionTextSize, setSelectionTextSize] = useState<TextSizePresetId>(activeTextSize);
  const lastRangeSelectionRef = useRef<RangeSelection | null>(null);

  useEffect(() => {
    function updateToolbarState(): void {
      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) {
          setActiveFormats({});
          return;
        }

        if (!selection.isCollapsed()) {
          lastRangeSelectionRef.current = selection.clone();
        }
        const anchorNode = selection.anchor.getNode();
        const listNode = getNearestListNode(anchorNode);
        const blockNode = listNode ?? getNearestBlockNode(anchorNode);

        setActiveFormats({
          bold: selection.hasFormat('bold'),
          italic: selection.hasFormat('italic'),
          underline: selection.hasFormat('underline'),
          highlight: selection.hasFormat('highlight'),
          heading: $isHeadingNode(blockNode),
          bulletList: listNode?.getListType() === 'bullet',
          numberedList: listNode?.getListType() === 'number',
          checkbox: listNode?.getListType() === 'check'
        });

        const fontSize = $getSelectionStyleValueForProperty(selection, 'font-size', '');
        setSelectionTextSize(getPresetForFontSize(fontSize).id);
      });
    }

    updateToolbarState();

    const unregisterSelection = editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateToolbarState();
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
    const unregisterUpdate = editor.registerUpdateListener(() => {
      updateToolbarState();
    });

    return () => {
      unregisterSelection();
      unregisterUpdate();
    };
  }, [editor]);

  function applyFormat(action: EditorFormatAction): void {
    switch (action) {
      case 'undo':
        editor.dispatchCommand(UNDO_COMMAND, undefined);
        break;
      case 'redo':
        editor.dispatchCommand(REDO_COMMAND, undefined);
        break;
      case 'bold':
      case 'italic':
      case 'underline':
      case 'highlight':
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.formatText(action);
          }
        });
        break;
      case 'heading':
        editor.update(() => {
          const selection = $getSelection();
          const anchorNode = $isRangeSelection(selection) ? selection.anchor.getNode() : null;
          const blockNode = anchorNode ? getNearestBlockNode(anchorNode) : null;
          $setBlocksType(selection, () =>
            $isHeadingNode(blockNode) ? $createParagraphNode() : $createHeadingNode('h2')
          );
        });
        break;
      case 'bulletList':
        editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        break;
      case 'numberedList':
        editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        break;
      case 'checkbox':
        editor.dispatchCommand(INSERT_CHECK_LIST_COMMAND, undefined);
        break;
    }
  }

  function applyTextSize(size: TextSizePresetId): void {
    const preset = getPreset(size);
    editor.update(() => {
      const currentSelection = $getSelection();
      const selection = $isRangeSelection(currentSelection)
        ? currentSelection
        : lastRangeSelectionRef.current?.clone() ?? null;
      if ($isRangeSelection(selection)) {
        $setSelection(selection);
        $patchStyleText(selection, { 'font-size': preset.id === 'normal' ? null : preset.fontSize });
      }
    });
    onChangeTextSize(preset.legacyPx);
  }

  return (
    <EditorToolbar
      onFormat={applyFormat}
      activeTextSize={selectionTextSize}
      onBeforeTextSizeChange={() => undefined}
      onTextSizeChange={applyTextSize}
      activeFormats={activeFormats}
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

function LexicalAutocompletePlugin({
  pages,
  books,
  chapters,
  currentPageId
}: {
  pages: PageEditorProps['pages'];
  books: PageEditorProps['books'];
  chapters: PageEditorProps['chapters'];
  currentPageId: string;
}): JSX.Element | null {
  const [editor] = useLexicalComposerContext();
  const [autocomplete, setAutocomplete] = useState<LexicalAutocompleteState | null>(null);
  const dismissedAutocompleteKeyRef = useRef<string | null>(null);

  const updateAutocomplete = useCallback(() => {
    editor.getEditorState().read(() => {
      const next = getLexicalAutocompleteState(editor, pages, chapters, books, currentPageId, autocomplete);
      if (next && getLexicalAutocompleteDismissKey(next) === dismissedAutocompleteKeyRef.current) {
        setAutocomplete(null);
        return;
      }

      setAutocomplete(next);
    });
  }, [autocomplete, books, chapters, currentPageId, editor, pages]);

  const dismissAutocomplete = useCallback((current: LexicalAutocompleteState) => {
    dismissedAutocompleteKeyRef.current = getLexicalAutocompleteDismissKey(current);
    setAutocomplete(null);
  }, []);

  const applySuggestion = useCallback(
    (suggestion: LexicalAutocompleteSuggestion) => {
      const current = autocomplete;
      if (!current) {
        return;
      }

      editor.focus();
      editor.update(() => {
        const replacement =
          suggestion.kind === 'link'
            ? `[[${suggestion.title}]]`
            : buildSlashTagReplacement(suggestion.tag, current.textNodeKey, current.end);
        replaceLexicalTextRange(current.textNodeKey, current.start, current.end, replacement);
      });
      dismissedAutocompleteKeyRef.current = null;
      setAutocomplete(null);
    },
    [autocomplete, editor]
  );

  useEffect(() => {
    return editor.registerUpdateListener(() => {
      updateAutocomplete();
    });
  }, [editor, updateAutocomplete]);

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        updateAutocomplete();
        return false;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [editor, updateAutocomplete]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_DOWN_COMMAND,
      (event) => {
        if (!autocomplete) {
          return false;
        }

        event.preventDefault();
        setAutocomplete((current) =>
          current ? { ...current, activeIndex: (current.activeIndex + 1) % current.suggestions.length } : current
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [autocomplete, editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ARROW_UP_COMMAND,
      (event) => {
        if (!autocomplete) {
          return false;
        }

        event.preventDefault();
        setAutocomplete((current) =>
          current
            ? {
                ...current,
                activeIndex: (current.activeIndex - 1 + current.suggestions.length) % current.suggestions.length
              }
            : current
        );
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [autocomplete, editor]);

  useEffect(() => {
    function selectActiveSuggestion(event: KeyboardEvent | null): boolean {
      if (!autocomplete) {
        return false;
      }

      const suggestion = autocomplete.suggestions[autocomplete.activeIndex];
      if (!suggestion) {
        return false;
      }

      event?.preventDefault();
      applySuggestion(suggestion);
      return true;
    }

    const unregisterEnter = editor.registerCommand(KEY_ENTER_COMMAND, selectActiveSuggestion, COMMAND_PRIORITY_HIGH);
    const unregisterTab = editor.registerCommand(KEY_TAB_COMMAND, selectActiveSuggestion, COMMAND_PRIORITY_HIGH);
    return () => {
      unregisterEnter();
      unregisterTab();
    };
  }, [applySuggestion, autocomplete, editor]);

  useEffect(() => {
    return editor.registerCommand(
      KEY_ESCAPE_COMMAND,
      (event) => {
        if (!autocomplete) {
          return false;
        }

        event.preventDefault();
        dismissAutocomplete(autocomplete);
        return true;
      },
      COMMAND_PRIORITY_HIGH
    );
  }, [autocomplete, dismissAutocomplete, editor]);

  useEffect(() => {
    if (!autocomplete) {
      return undefined;
    }

    const currentAutocomplete = autocomplete;
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      if (target.closest('.lexical-autocomplete-dropdown') || target.closest('.lexical-editing-pane')) {
        return;
      }

      dismissAutocomplete(currentAutocomplete);
    }

    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('resize', updateAutocomplete);
    window.addEventListener('scroll', updateAutocomplete, true);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('resize', updateAutocomplete);
      window.removeEventListener('scroll', updateAutocomplete, true);
    };
  }, [autocomplete, dismissAutocomplete, updateAutocomplete]);

  if (!autocomplete || autocomplete.suggestions.length === 0) {
    return null;
  }

  return (
    <LexicalAutocompleteMenu autocomplete={autocomplete} onSelect={applySuggestion} />
  );
}

function LexicalAutocompleteMenu({
  autocomplete,
  onSelect
}: {
  autocomplete: LexicalAutocompleteState;
  onSelect: (suggestion: LexicalAutocompleteSuggestion) => void;
}): JSX.Element {
  const style = {
    '--lexical-autocomplete-top': `${autocomplete.position.top}px`,
    '--lexical-autocomplete-left': `${autocomplete.position.left}px`,
    '--lexical-autocomplete-width': `${autocomplete.position.width}px`
  } as CSSProperties;

  return (
    <div
      className="tag-suggestions-dropdown editor-autocomplete-dropdown lexical-autocomplete-dropdown"
      role="listbox"
      aria-label={autocomplete.kind === 'link' ? 'Page link suggestions' : 'Tag suggestions'}
      style={style}
    >
      {autocomplete.suggestions.map((suggestion, index) => (
        <button
          key={suggestion.kind === 'link' ? suggestion.pageId : suggestion.tag}
          type="button"
          role="option"
          aria-selected={index === autocomplete.activeIndex}
          className={`tag-suggestion-item ${index === autocomplete.activeIndex ? 'is-active' : ''}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onSelect(suggestion)}
        >
          {suggestion.kind === 'link' ? (
            <>
              <span className="tag-suggestion-token">[[{suggestion.title}]]</span>
              <span className="editor-autocomplete-context">
                {suggestion.isDuplicateTitle
                  ? suggestion.pathLabel
                  : suggestion.pathLabel.replace(` / ${suggestion.title}`, '')}
              </span>
            </>
          ) : (
            <span className="tag-suggestion-token">/{suggestion.tag}</span>
          )}
        </button>
      ))}
    </div>
  );
}

function getLexicalAutocompleteState(
  editor: LexicalEditor,
  pages: PageEditorProps['pages'],
  chapters: PageEditorProps['chapters'],
  books: PageEditorProps['books'],
  currentPageId: string,
  current: LexicalAutocompleteState | null
): LexicalAutocompleteState | null {
  if (!editor.isEditable()) {
    return null;
  }

  const selection = $getSelection();
  if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
    return null;
  }

  const anchorNode = selection.anchor.getNode();
  if (!$isTextNode(anchorNode)) {
    return null;
  }

  const cursor = selection.anchor.offset;
  const text = anchorNode.getTextContent();
  const wikiTrigger = detectActiveWikiLinkTrigger(text, cursor);

  if (wikiTrigger) {
    const suggestions = getPageTitleAutocompleteSuggestions(pages, chapters, books, wikiTrigger.query, currentPageId)
      .map((suggestion) => ({ ...suggestion, kind: 'link' as const }));

    return suggestions.length > 0
      ? buildNextLexicalAutocomplete(current, 'link', suggestions, anchorNode, wikiTrigger.start, wikiTrigger.end)
      : null;
  }

  const tagTrigger = detectActiveSlashTagTrigger(text, cursor);
  if (tagTrigger) {
    const suggestions = getAllTagSuggestions(pages, tagTrigger.query)
      .map((tag) => ({ kind: 'tag' as const, tag }));

    return suggestions.length > 0
      ? buildNextLexicalAutocomplete(current, 'tag', suggestions, anchorNode, tagTrigger.start, tagTrigger.end)
      : null;
  }

  return null;
}

function buildNextLexicalAutocomplete(
  current: LexicalAutocompleteState | null,
  kind: LexicalAutocompleteKind,
  suggestions: LexicalAutocompleteSuggestion[],
  textNode: TextNode,
  start: number,
  end: number
): LexicalAutocompleteState {
  const textNodeKey = textNode.getKey();
  const position = getLexicalAutocompletePosition();
  const keepsActiveSuggestion =
    current?.kind === kind &&
    current.textNodeKey === textNodeKey &&
    current.start === start &&
    current.end === end &&
    current.suggestions.map(getLexicalSuggestionKey).join('\n') === suggestions.map(getLexicalSuggestionKey).join('\n');

  return {
    kind,
    suggestions,
    activeIndex: keepsActiveSuggestion ? Math.min(current.activeIndex, suggestions.length - 1) : 0,
    textNodeKey,
    start,
    end,
    position
  };
}

function getLexicalAutocompletePosition(): LexicalAutocompletePosition {
  const fallback = { top: 48, left: 16, width: 320 };
  const rootElement = document.activeElement?.closest('.lexical-editing-pane');
  const pane = rootElement instanceof HTMLElement ? rootElement : null;
  const selection = window.getSelection();

  if (!pane || !selection || selection.rangeCount === 0) {
    return fallback;
  }

  const range = selection.getRangeAt(0).cloneRange();
  const caretRect = getRangeClientRect(range);
  const paneRect = pane.getBoundingClientRect();

  if (!caretRect || paneRect.width <= 0) {
    return getFallbackAutocompletePosition(pane);
  }

  const menuWidth = Math.min(352, Math.max(220, paneRect.width - 32));
  const rawLeft = caretRect.left - paneRect.left + pane.scrollLeft;
  const rawTop = caretRect.bottom - paneRect.top + pane.scrollTop + 8;
  const left = clamp(rawLeft, 12, Math.max(12, pane.clientWidth - menuWidth - 12));
  const top = Math.max(12, rawTop);

  return { top, left, width: menuWidth };
}

function getRangeClientRect(range: Range): DOMRect | null {
  const firstRect = range.getClientRects()[0];
  if (firstRect && (firstRect.width > 0 || firstRect.height > 0)) {
    return firstRect;
  }

  const rect = range.getBoundingClientRect();
  return rect.width > 0 || rect.height > 0 ? rect : null;
}

function getFallbackAutocompletePosition(pane: HTMLElement): LexicalAutocompletePosition {
  const width = Math.min(352, Math.max(220, pane.clientWidth - 32));
  return {
    top: 48,
    left: clamp(16, 12, Math.max(12, pane.clientWidth - width - 12)),
    width
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getLexicalSuggestionKey(suggestion: LexicalAutocompleteSuggestion): string {
  return suggestion.kind === 'link' ? suggestion.pageId : suggestion.tag;
}

function getLexicalAutocompleteDismissKey(autocomplete: LexicalAutocompleteState): string {
  return [
    autocomplete.kind,
    autocomplete.textNodeKey,
    autocomplete.start,
    autocomplete.end,
    autocomplete.suggestions.map(getLexicalSuggestionKey).join('\n')
  ].join(':');
}

function buildSlashTagReplacement(tag: string, textNodeKey: string, end: number): string {
  const textNode = $getRoot()
    .getAllTextNodes()
    .find((candidate) => candidate.getKey() === textNodeKey);
  const nextCharacter = textNode?.getTextContent()[end] ?? '';
  return nextCharacter.length > 0 && /\s/.test(nextCharacter) ? `/${tag}` : `/${tag} `;
}

function replaceLexicalTextRange(textNodeKey: string, start: number, end: number, replacement: string): void {
  const textNode = $getRoot()
    .getAllTextNodes()
    .find((candidate) => candidate.getKey() === textNodeKey);

  if (!textNode) {
    return;
  }

  const safeStart = Math.max(0, Math.min(start, textNode.getTextContentSize()));
  const safeEnd = Math.max(safeStart, Math.min(end, textNode.getTextContentSize()));
  textNode.spliceText(safeStart, safeEnd - safeStart, replacement, true);

  const nextSelection = $createRangeSelection();
  const nextOffset = safeStart + replacement.length;
  nextSelection.anchor.set(textNode.getKey(), nextOffset, 'text');
  nextSelection.focus.set(textNode.getKey(), nextOffset, 'text');
  $setSelection(nextSelection);
}

function getPreset(size: TextSizePresetId): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.find((preset) => preset.id === size) ?? TEXT_SIZE_PRESETS[1];
}

function getPresetForFontSize(fontSize: string): (typeof TEXT_SIZE_PRESETS)[number] {
  if (!fontSize) {
    return TEXT_SIZE_PRESETS[1];
  }
  return TEXT_SIZE_PRESETS.find((preset) => preset.fontSize === fontSize) ?? TEXT_SIZE_PRESETS[1];
}

function getPresetForLegacyPx(size: number): (typeof TEXT_SIZE_PRESETS)[number] {
  return TEXT_SIZE_PRESETS.reduce((closest, preset) => {
    return Math.abs(preset.legacyPx - size) < Math.abs(closest.legacyPx - size) ? preset : closest;
  }, TEXT_SIZE_PRESETS[1]);
}

function isTagSubmitKey(event: ReactKeyboardEvent<HTMLInputElement>): boolean {
  if (event.nativeEvent.isComposing) {
    return false;
  }

  const key = event.key.toLowerCase();
  const code = event.code.toLowerCase();
  const hasInput = event.currentTarget.value.trim().length > 0;

  if (key === 'enter' || key === 'return' || code === 'enter' || code === 'numpadenter') {
    return true;
  }

  if (hasInput && ['done', 'go', 'send', 'search', 'submit'].includes(key)) {
    return true;
  }

  // Some virtual keyboards, including browser keyboards on XR devices, can
  // surface their submit action as focus navigation. Treat Tab as submission
  // only when there is tag text waiting to be committed.
  return hasInput && (key === 'tab' || code === 'tab');
}

function getNearestListNode(node: LexicalNode): ListNode | null {
  let current: LexicalNode | null = node;

  while (current) {
    if ($isListNode(current)) {
      return current;
    }

    if ($isListItemNode(current)) {
      return getListNodeFromItem(current);
    }

    current = current.getParent();
  }

  return null;
}

function getListNodeFromItem(node: LexicalNode): ListNode | null {
  let current: LexicalNode | null = node.getParent();

  while (current) {
    if ($isListNode(current)) {
      return current;
    }
    current = current.getParent();
  }

  return null;
}

function getNearestBlockNode(node: LexicalNode): LexicalNode | null {
  let current: LexicalNode | null = node;

  while (current) {
    const parent: LexicalNode | null = current.getParent();
    if (!parent || parent.getType() === 'root') {
      return current;
    }
    current = parent;
  }

  return null;
}
