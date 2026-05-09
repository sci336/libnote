import { useEffect, useState } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import type { AppSettings, ShortcutAction, ShortcutBinding } from '../types/domain';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTION_LABELS,
  SHORTCUT_ACTIONS,
  areShortcutBindingsEqual,
  bindingFromKeyboardEvent,
  formatShortcut,
  validateShortcutBinding
} from '../utils/shortcuts';

interface ShortcutEditorProps {
  settings: AppSettings;
  onUpdateShortcut: (action: ShortcutAction, binding: ShortcutBinding | null) => void;
  onResetShortcut: (action: ShortcutAction) => void;
  onResetAllShortcuts: () => void;
}

export function AppMenuShortcutEditor({
  settings,
  onUpdateShortcut,
  onResetShortcut,
  onResetAllShortcuts
}: ShortcutEditorProps): JSX.Element {
  const [capturingAction, setCapturingAction] = useState<ShortcutAction | null>(null);
  const [errors, setErrors] = useState<Partial<Record<ShortcutAction, string>>>({});

  function setError(action: ShortcutAction, message: string | null): void {
    setErrors((currentErrors) => {
      const nextErrors = { ...currentErrors };

      if (message) {
        nextErrors[action] = message;
      } else {
        delete nextErrors[action];
      }

      return nextErrors;
    });
  }

  useEffect(() => {
    if (!capturingAction) {
      return;
    }

    function handleCaptureKeyDown(event: KeyboardEvent): void {
      if (!capturingAction) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();

      if (event.key === 'Escape') {
        setCapturingAction(null);
        setError(capturingAction, null);
        return;
      }

      const binding = bindingFromKeyboardEvent(event);
      const validationMessage = validateShortcutBinding(capturingAction, binding, settings.shortcuts);

      if (validationMessage) {
        setError(capturingAction, validationMessage);
        return;
      }

      onUpdateShortcut(capturingAction, binding);
      setCapturingAction(null);
      setError(capturingAction, null);
    }

    window.addEventListener('keydown', handleCaptureKeyDown, true);
    return () => window.removeEventListener('keydown', handleCaptureKeyDown, true);
  }, [capturingAction, onUpdateShortcut, settings.shortcuts]);

  function handleShortcutFieldKeyDown(action: ShortcutAction, event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (capturingAction === action) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      setCapturingAction(action);
      setError(action, null);
    }
  }

  function startCapture(action: ShortcutAction): void {
    setCapturingAction(action);
    setError(action, null);
  }

  function clearShortcut(action: ShortcutAction): void {
    onUpdateShortcut(action, null);
    setError(action, null);
    if (capturingAction === action) {
      setCapturingAction(null);
    }
  }

  function resetShortcut(action: ShortcutAction): void {
    onResetShortcut(action);
    setError(action, null);
    if (capturingAction === action) {
      setCapturingAction(null);
    }
  }

  function resetAllShortcuts(): void {
    onResetAllShortcuts();
    setCapturingAction(null);
    setErrors({});
  }

  return (
    <div className="shortcut-editor">
      {SHORTCUT_ACTIONS.map((action) => {
        const currentBinding = settings.shortcuts[action];
        const isCapturing = capturingAction === action;
        const isDefault = areShortcutBindingsEqual(currentBinding, DEFAULT_SHORTCUTS[action]);

        return (
          <div className={`shortcut-editor-row ${isCapturing ? 'is-capturing' : ''}`} key={action}>
            <div className="shortcut-editor-copy">
              <strong>{SHORTCUT_ACTION_LABELS[action]}</strong>
              {isCapturing ? (
                <span>Press a new shortcut. Esc to cancel.</span>
              ) : (
                <span>Click the shortcut field to edit.</span>
              )}
              {errors[action] ? (
                <p className="shortcut-error" id={`shortcut-error-${action}`}>
                  {errors[action]}
                </p>
              ) : null}
            </div>

            <div className="shortcut-editor-controls">
              <button
                type="button"
                className={`shortcut-field ${isCapturing ? 'is-capturing' : ''} ${errors[action] ? 'has-error' : ''}`}
                aria-label={`Edit shortcut for ${SHORTCUT_ACTION_LABELS[action]}`}
                aria-describedby={errors[action] ? `shortcut-error-${action}` : undefined}
                autoFocus={isCapturing}
                onClick={() => startCapture(action)}
                onKeyDown={(event) => handleShortcutFieldKeyDown(action, event)}
              >
                {isCapturing ? 'Press shortcut...' : formatShortcut(currentBinding)}
              </button>
              {currentBinding ? (
                <button type="button" className="settings-choice-button" onClick={() => clearShortcut(action)}>
                  Clear
                </button>
              ) : null}
              {!isDefault ? (
                <button type="button" className="settings-choice-button" onClick={() => resetShortcut(action)}>
                  Reset
                </button>
              ) : null}
            </div>
          </div>
        );
      })}

      <div className="shortcut-editor-footer">
        <button type="button" className="settings-choice-button" onClick={resetAllShortcuts}>
          Reset all shortcuts
        </button>
      </div>
    </div>
  );
}
