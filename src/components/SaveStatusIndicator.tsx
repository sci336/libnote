import type { SaveStatus } from '../types/domain';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  onRetry: () => void;
}

export function SaveStatusIndicator({ status, onRetry }: SaveStatusIndicatorProps): JSX.Element | null {
  if (status.state === 'idle') {
    return null;
  }

  if (status.state === 'unsaved') {
    return (
      <div className="save-status save-status-unsaved" role="status" aria-live="polite">
        Unsaved changes
      </div>
    );
  }

  if (status.state === 'saving') {
    return (
      <div className="save-status save-status-saving" role="status" aria-live="polite">
        Saving...
      </div>
    );
  }

  if (status.state === 'retrying') {
    return (
      <div className="save-status save-status-retrying" role="status" aria-live="polite">
        Retrying save...
      </div>
    );
  }

  if (status.state === 'saved') {
    const savedAt = new Date(status.lastSavedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });

    return (
      <div className="save-status save-status-saved" role="status" aria-live="polite">
        Saved · Last saved at {savedAt}
      </div>
    );
  }

  return (
    <div className="save-status save-status-failed" role="alert">
      <div className="save-status-failed-copy">
        <strong>{status.error.title}</strong>
        <span>{status.error.message}</span>
        <span>{status.error.recovery}</span>
        <span>{status.error.suggestion}</span>
      </div>
      {status.canRetry === false ? null : (
        <button type="button" className="save-status-retry" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
