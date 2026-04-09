interface EmptyStateProps {
  title: string;
  message: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({
  title,
  message,
  actionLabel,
  onAction
}: EmptyStateProps): JSX.Element {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      <p>{message}</p>
      <button type="button" className="primary-button" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  );
}
