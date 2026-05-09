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

export function EditorToolbar({
  onFormat,
  activeTextSize,
  onTextSizeChange,
  onBeforeTextSizeChange,
  activeFormats = {}
}: EditorToolbarProps): JSX.Element {
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
      <label className="editor-text-size-control">
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
            event.currentTarget.removeAttribute('open');
          }
        }}
      >
        <summary aria-label="More formatting options" title="More formatting options">
          ...
        </summary>
        <div className="editor-toolbar-more-menu">
          <label className="editor-toolbar-more-size">
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
