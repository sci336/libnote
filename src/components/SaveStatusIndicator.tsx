import type { SaveStatus } from '../types/domain';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  onRetry?: () => void;
}

export function SaveStatusIndicator({
  status,
  onRetry
}: SaveStatusIndicatorProps): JSX.Element | null {
  if (status.state === 'idle') {
    return null;
  }

  if (status.state === 'saving') {
    return (
      <div className="save-status-indicator" aria-live="polite" role="status">
        <span className="save-status-dot" aria-hidden="true" />
        <span>Saving...</span>
      </div>
    );
  }

  if (status.state === 'saved') {
    const lastSavedLabel = new Date(status.lastSavedAt).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit'
    });

    return (
      <div className="save-status-indicator is-saved" aria-live="polite" role="status">
        <span className="save-status-dot" aria-hidden="true" />
        <span>{`Saved · Last saved at ${lastSavedLabel}`}</span>
      </div>
    );
  }

  return (
    <div className="save-status-indicator is-failed" aria-live="assertive" role="alert">
      <span className="save-status-dot" aria-hidden="true" />
      <span>{status.error ?? 'Save failed'}</span>
      {onRetry ? (
        <button type="button" className="save-status-retry" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
