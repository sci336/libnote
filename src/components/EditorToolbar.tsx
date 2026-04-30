export type EditorFormatAction = 'bold' | 'italic' | 'underline' | 'heading' | 'bulletList' | 'numberedList' | 'checkbox';

interface EditorToolbarProps {
  onFormat: (action: EditorFormatAction) => void;
}

const TOOLBAR_BUTTONS: Array<{
  action: EditorFormatAction;
  label: string;
  title: string;
  text: string;
}> = [
  { action: 'bold', label: 'Bold', title: 'Bold (Ctrl/Cmd+B)', text: 'B' },
  { action: 'italic', label: 'Italic', title: 'Italic (Ctrl/Cmd+I)', text: 'I' },
  { action: 'underline', label: 'Underline', title: 'Underline (Ctrl/Cmd+U)', text: 'U' },
  { action: 'heading', label: 'Heading', title: 'Heading', text: 'H' },
  { action: 'bulletList', label: 'Bullet list', title: 'Bullet list (Ctrl/Cmd+Shift+8)', text: '• List' },
  { action: 'numberedList', label: 'Numbered list', title: 'Numbered list (Ctrl/Cmd+Shift+7)', text: '1. List' },
  { action: 'checkbox', label: 'Checkbox list', title: 'Checkbox list', text: '[] Task' }
];

export function EditorToolbar({ onFormat }: EditorToolbarProps): JSX.Element {
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Text formatting">
      {TOOLBAR_BUTTONS.map((button) => (
        <button
          key={button.action}
          type="button"
          className="editor-toolbar-button"
          aria-label={button.label}
          title={button.title}
          onMouseDown={(event) => {
            event.preventDefault();
          }}
          onClick={() => onFormat(button.action)}
        >
          {button.text}
        </button>
      ))}
    </div>
  );
}
