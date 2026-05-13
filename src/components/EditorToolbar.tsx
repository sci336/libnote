import { useEffect, useRef, useState } from 'react';

export type EditorFormatAction =
  | 'undo'
  | 'redo'
  | 'bold'
  | 'italic'
  | 'underline'
  | 'highlight'
  | 'heading'
  | 'bulletList'
  | 'numberedList'
  | 'checkbox';

export const TEXT_SIZE_PRESETS = [
  { id: 'small', label: 'Small', fontSize: '0.875rem', legacyPx: 14, commandSize: '2' },
  { id: 'normal', label: 'Normal', fontSize: '1rem', legacyPx: 16, commandSize: '3' },
  { id: 'large', label: 'Large', fontSize: '1.25rem', legacyPx: 20, commandSize: '4' },
  { id: 'extraLarge', label: 'Extra Large', fontSize: '1.5rem', legacyPx: 24, commandSize: '5' },
  { id: 'huge', label: 'Huge', fontSize: '2rem', legacyPx: 32, commandSize: '7' }
] as const;

export type TextSizePresetId = (typeof TEXT_SIZE_PRESETS)[number]['id'];

interface EditorToolbarProps {
  onFormat: (action: EditorFormatAction) => void;
  activeTextSize: TextSizePresetId;
  onTextSizeChange: (size: TextSizePresetId) => void;
  onBeforeTextSizeChange: () => void;
  activeFormats?: Partial<Record<EditorFormatAction, boolean>>;
}

const TOOLBAR_BUTTONS: Array<{
  action: EditorFormatAction;
  label: string;
  title: string;
  text: string;
}> = [
  { action: 'undo', label: 'Undo', title: 'Undo', text: 'Undo' },
  { action: 'redo', label: 'Redo', title: 'Redo', text: 'Redo' },
  { action: 'bold', label: 'Bold', title: 'Bold (Ctrl/Cmd+B)', text: 'B' },
  { action: 'italic', label: 'Italic', title: 'Italic (Ctrl/Cmd+I)', text: 'I' },
  { action: 'underline', label: 'Underline', title: 'Underline (Ctrl/Cmd+U)', text: 'U' },
  { action: 'highlight', label: 'Highlight', title: 'Highlight', text: 'Mark' },
  { action: 'heading', label: 'Heading', title: 'Heading', text: 'H' },
  { action: 'bulletList', label: 'Bullet list', title: 'Bullet list (Ctrl/Cmd+Shift+8)', text: '• List' },
  { action: 'numberedList', label: 'Numbered list', title: 'Numbered list (Ctrl/Cmd+Shift+7)', text: '1. List' },
  { action: 'checkbox', label: 'Checkbox list', title: 'Checkbox list', text: '[] Task' }
];

const COMPACT_TOOLBAR_MEDIA = '(max-width: 640px)';

function canMatchMedia(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function';
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => (canMatchMedia() ? window.matchMedia(query).matches : false));

  useEffect(() => {
    if (!canMatchMedia()) {
      return;
    }

    const mediaQuery = window.matchMedia(query);
    const handleChange = () => {
      setMatches(mediaQuery.matches);
    };

    handleChange();
    mediaQuery.addEventListener('change', handleChange);
    return () => {
      mediaQuery.removeEventListener('change', handleChange);
    };
  }, [query]);

  return matches;
}

interface TextSizeControlProps {
  activeTextSize: TextSizePresetId;
  className: string;
  onBeforeTextSizeChange: () => void;
  onTextSizeChange: (size: TextSizePresetId) => void;
}

function TextSizeControl({
  activeTextSize,
  className,
  onBeforeTextSizeChange,
  onTextSizeChange
}: TextSizeControlProps): JSX.Element {
  return (
    <label className={className}>
      <span>Text size</span>
      <select
        value={activeTextSize}
        aria-label="Text size"
        onMouseDown={onBeforeTextSizeChange}
        onFocus={onBeforeTextSizeChange}
        onChange={(event) => onTextSizeChange(event.target.value as TextSizePresetId)}
      >
        {TEXT_SIZE_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function EditorToolbar({
  onFormat,
  activeTextSize,
  onTextSizeChange,
  onBeforeTextSizeChange,
  activeFormats = {}
}: EditorToolbarProps): JSX.Element {
  const moreSummaryRef = useRef<HTMLElement | null>(null);
  const isCompactToolbar = useMediaQuery(COMPACT_TOOLBAR_MEDIA);
  // Only render one text-size control per breakpoint so Playwright and screen
  // readers do not see duplicate accessible controls.
  const primaryMobileActions: EditorFormatAction[] = [
    'bold',
    'italic',
    'underline',
    'highlight',
    'heading',
    'bulletList',
    'checkbox'
  ];
  const overflowMobileActions = TOOLBAR_BUTTONS.filter(
    (button) => !primaryMobileActions.includes(button.action)
  );

  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {!isCompactToolbar ? (
        <TextSizeControl
          activeTextSize={activeTextSize}
          className="editor-text-size-control"
          onBeforeTextSizeChange={onBeforeTextSizeChange}
          onTextSizeChange={onTextSizeChange}
        />
      ) : null}
      {TOOLBAR_BUTTONS.map((button) => (
        <button
          key={button.action}
          type="button"
          className={`editor-toolbar-button editor-toolbar-button-${button.action} ${
            activeFormats[button.action] ? 'is-active' : ''
          }`}
          aria-label={button.label}
          aria-pressed={activeFormats[button.action] ? true : undefined}
          title={button.title}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => onFormat(button.action)}
        >
          {button.text}
        </button>
      ))}
      <details
        className="editor-toolbar-more"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            // Native details has no managed focus behavior, so return focus to
            // the trigger after keyboard dismissal.
            event.currentTarget.removeAttribute('open');
            moreSummaryRef.current?.focus();
          }
        }}
      >
        <summary ref={moreSummaryRef} aria-label="More formatting options" title="More formatting options">
          ...
        </summary>
        <div className="editor-toolbar-more-menu">
          {isCompactToolbar ? (
            <TextSizeControl
              activeTextSize={activeTextSize}
              className="editor-toolbar-more-size"
              onBeforeTextSizeChange={onBeforeTextSizeChange}
              onTextSizeChange={onTextSizeChange}
            />
          ) : null}
          {overflowMobileActions.map((button) => (
            <button
              key={button.action}
              type="button"
              className={`editor-toolbar-more-button ${activeFormats[button.action] ? 'is-active' : ''}`}
              aria-label={button.label}
              aria-pressed={activeFormats[button.action] ? true : undefined}
              title={button.title}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              onClick={(event) => {
                onFormat(button.action);
                event.currentTarget.closest('details')?.removeAttribute('open');
              }}
            >
              {button.text}
            </button>
          ))}
        </div>
      </details>
    </div>
  );
}
